package com.emiseure.customer

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.UserManager
import android.util.Log
import com.emiseure.customer.BuildConfig
import com.emiseure.customer.utils.SecureNetworkClient
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * 🔐 CRITICAL FIX #3: Fallback Security - Works Even Without Device Owner
 *
 * Problem: If device owner is removed, ALL restrictions become ineffective
 * Solution: Implement server-side validation layer that enforces lock even without device owner
 *
 * How it works:
 * 1. On app startup, verify lock status with backend
 * 2. If backend says "locked", show lock screen even without device owner
 * 3. Backend-enforced lock persists even if admin privileges are removed
 * 4. Uses FCM to push unlock commands
 */
class DeviceOwnerFallbackManager(private val context: Context) {

    companion object {
        private const val TAG = "OwnerFallback"
        private const val PREFS_NAME = "EMI_DEVICE_OWNER_FALLBACK"
        private const val KEY_LAST_SYNC = "LAST_SERVER_SYNC"
        private const val KEY_LOCK_STATE_CACHED = "LOCK_STATE_CACHED"
        private val SYNC_INTERVAL_MS = TimeUnit.MINUTES.toMillis(5)
        private val REQUEST_TIMEOUT_MS = TimeUnit.SECONDS.toMillis(10)
        // Backend base URL — loaded from BuildConfig (local.properties)
        private val BASE_URL = BuildConfig.BACKEND_URL
    }

    private val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
    private val adminComponent = ComponentName(context, MyDeviceAdminReceiver::class.java)
    private val prefs = context.createDeviceProtectedStorageContext()
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * 🔐 Verify device lock status with backend server
     * Called on app startup and periodically
     */
    fun verifyLockStatusWithServer(onResult: (isLocked: Boolean) -> Unit) {
        // 🛡️ If already synced recently, use cached state
        val lastSync = prefs.getLong(KEY_LAST_SYNC, 0)
        val now = System.currentTimeMillis()

        if (now - lastSync < SYNC_INTERVAL_MS) {
            val cachedLocked = prefs.getBoolean(KEY_LOCK_STATE_CACHED, true) // fail closed
            Log.d(TAG, "Using cached lock state: $cachedLocked")
            onResult(cachedLocked)
            return
        }

        // 🔄 Fetch device lock status from backend
        fetchDeviceLockStatusFromBackend { isLocked ->
            // Cache the result
            prefs.edit().apply {
                putBoolean(KEY_LOCK_STATE_CACHED, isLocked)
                putLong(KEY_LAST_SYNC, System.currentTimeMillis())
            }.commit()

            onResult(isLocked)
        }
    }

    /**
     * 🔐 Check if device owner permission is still valid
     */
    fun isDeviceOwnerActive(): Boolean {
        return try {
            dpm?.isDeviceOwnerApp(context.packageName) == true
        } catch (e: Exception) {
            Log.w(TAG, "Could not check device owner status: ${e.message}")
            false
        }
    }

    /**
     * 🚨 CRITICAL: Enforce lock even without device owner
     * Called when backend confirms device should be locked
     */
    fun enforceServerSideLock() {
        Log.w(TAG, "🚨 Enforcing server-side lock (Device Owner may be inactive)")

        try {
            // 1️⃣ Save lock state to Direct Boot storage
            val securePrefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            securePrefs.edit().apply {
                putBoolean("IS_LOCKED", true)
                putLong("SERVER_ENFORCED_LOCK_TIME", System.currentTimeMillis())
                putString("LOCK_REASON", "SERVER_OVERRIDE")
            }.commit()

            // 2️⃣ Try to enforce with device owner if still active
            if (isDeviceOwnerActive()) {
                try {
                    dpm?.apply {
                        addUserRestriction(adminComponent, UserManager.DISALLOW_USB_FILE_TRANSFER)
                        addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT)
                        addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET)
                    }
                    Log.d(TAG, "Device owner restrictions re-applied")
                } catch (e: Exception) {
                    Log.w(TAG, "Could not apply device owner restrictions: ${e.message}")
                }
            } else {
                Log.w(TAG, "Device owner NOT active - relying on app-level enforcement only")
            }

            // 3️⃣ Launch lock screen immediately
            val lockIntent = Intent(context, LockScreenActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("LOCK_REASON", "SERVER_ENFORCED")
            }
            context.startActivity(lockIntent)

            // 4️⃣ Send telemetry to backend about lock enforcement
            reportLockEnforcementToBackend()

        } catch (e: Exception) {
            Log.e(TAG, "Failed to enforce server-side lock", e)
        }
    }

    /**
     * 🚨 CRITICAL: Recover from device owner removal
     * Detect when device owner permission is lost and activate fallback
     */
    fun detectAndRecoverFromOwnerRemoval() {
        val wasOwnerBefore = prefs.getBoolean("WAS_DEVICE_OWNER", false)
        val isOwnerNow = isDeviceOwnerActive()

        if (wasOwnerBefore && !isOwnerNow) {
            // 🚨 Device owner was removed!
            Log.e(TAG, "🚨 CRITICAL: Device owner permission was REMOVED!")

            // Record tamper attempt
            TamperDetectionManager.recordTamperAttempt(
                context,
                "DEVICE_OWNER_REMOVED"
            )

            // Re-lock device via server
            enforceServerSideLock()
        }

        // Always update the current state
        prefs.edit().putBoolean("WAS_DEVICE_OWNER", isOwnerNow).apply()
    }

    /**
     * 🔐 Initialize FCM-based unlock command receiver
     * Backend can send unlock via FCM when user completes verification
     */
    fun setupRemoteUnlockListener() {
        // This is typically handled by MyFirebaseMessagingService
        // But we document it here for clarity:
        // FCM message with "ACTION" = "UNLOCK" should trigger unlock
        Log.d(TAG, "Remote unlock listener is managed by FirebaseMessagingService")
    }

    /**
     * 🔄 Fetch lock status from backend (internal function)
     */
    private fun fetchDeviceLockStatusFromBackend(onResult: (Boolean) -> Unit) {
        // Get FCM token for identification
        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseApp.initializeApp(context)
            }
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.w(TAG, "Could not get FCM token — defaulting to LOCKED (fail-closed)")
                    onResult(true) // Fail closed — default to locked for security
                    return@addOnCompleteListener
                }

                val fcmToken = task.result
                val requestBody = JSONObject().apply {
                    put("fcmToken", fcmToken)
                    put("action", "CHECK_LOCK_STATUS")
                }

                // Make API call to backend (using your existing network client)
                makeServerRequest(
                    "/api/device/check-lock-status",
                    requestBody
                ) { response, error ->
                    if (error != null) {
                        Log.w(TAG, "Failed to fetch lock status from server: ${error.message}")
                        // Use cached state on error, default to true (fail closed)
                        val cachedState = prefs.getBoolean(KEY_LOCK_STATE_CACHED, true)
                        onResult(cachedState)
                        return@makeServerRequest
                    }

                    try {
                        val isLocked = response?.optBoolean("isLocked", false) == true
                        Log.d(TAG, "Server lock status: isLocked=$isLocked")
                        onResult(isLocked)
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing server response — defaulting to LOCKED (fail-closed)", e)
                        onResult(true) // Fail closed — default to locked for security
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get FCM token for lock status check", e)
            onResult(true) // Fail closed on error
        }
    }

    /**
     * 📊 Report lock enforcement to backend for audit
     */
    private fun reportLockEnforcementToBackend() {
        val requestBody = JSONObject().apply {
            put("action", "REPORT_LOCK_ENFORCEMENT")
            put("timestamp", System.currentTimeMillis())
            put("deviceOwnerActive", isDeviceOwnerActive())
            put("enforceType", "SERVER_SIDE")
        }

        makeServerRequest(
            "/api/device/report-lock",
            requestBody
        ) { _, error ->
            if (error != null) {
                Log.w(TAG, "Failed to report lock enforcement: ${error.message}")
            } else {
                Log.d(TAG, "Lock enforcement reported to backend")
            }
        }
    }

    /**
     * 🔄 Make HTTP request to backend using the app’s pinned SecureNetworkClient.
     *
     * FIX (BUG): The original implementation was a permanent stub that always
     * called onComplete(null, Exception("Not implemented")). This meant that
     * verifyLockStatusWithServer() and reportLockEnforcementToBackend() NEVER
     * reached the server, making the entire fallback manager non-functional.
     */
    private fun makeServerRequest(
        endpoint: String,
        body: JSONObject,
        onComplete: (response: JSONObject?, error: Exception?) -> Unit
    ) {
        val url = "$BASE_URL$endpoint"
        SecureNetworkClient.post(
            url = url,
            body = body,
            onSuccess = { response ->
                onComplete(response, null)
            },
            onError = { errorMessage ->
                Log.w(TAG, "Server request failed [$endpoint]: $errorMessage")
                onComplete(null, Exception(errorMessage))
            }
        )
    }

    /**
     * 🛡️ Periodically verify lock status in background
     */
    fun startPeriodicVerification() {
        Log.d(TAG, "Starting periodic lock verification")

        val verificationRunnable = object : Runnable {
            override fun run() {
                verifyLockStatusWithServer { isLocked ->
                    if (isLocked && !isDeviceOwnerActive()) {
                        Log.w(TAG, "Periodic check: Device should be locked but owner is inactive")
                        enforceServerSideLock()
                    }
                }
                // Re-schedule for next verification
                Handler(Looper.getMainLooper()).postDelayed(this, SYNC_INTERVAL_MS)
            }
        }

        Handler(Looper.getMainLooper()).post(verificationRunnable)
    }
}
