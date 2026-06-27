package com.emiseure.customer

import android.content.Context
import android.os.Build
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.edit
import com.emiseure.customer.BuildConfig
import com.google.firebase.messaging.FirebaseMessaging

/**
 * 🔐 CRITICAL FIX #6: Factory Reset Protection (FRP) Bypass Detection & Recovery
 *
 * Problem: Some Android versions/ROM variants allow bypassing FRP
 * User could:
 * 1. Factory reset device
 * 2. Skip setup wizard or use different Google account
 * 3. Device is no longer locked
 * 4. Access kiosk mode apps
 *
 * Solution: Detect post-factory-reset state and enforce server-side re-lock
 * even if Device Owner was removed during reset
 */
class FactoryResetProtectionManager(private val context: Context) {

    companion object {
        private const val TAG = "FrpBypassDetection"
        private const val PREFS_NAME = "EMI_FRP_RECOVERY"
        private const val KEY_DEVICE_ID = "DEVICE_UNIQUE_ID"
        private const val KEY_WAS_LOCKED = "WAS_LOCKED"
        private const val KEY_DEVICE_OWNER_ACTIVE = "DEVICE_OWNER_ACTIVE"
        private const val KEY_FACTORY_RESET_COUNT = "FACTORY_RESET_COUNT"
    }

    private val dpm = context.getSystemService(android.app.admin.DevicePolicyManager::class.java)
    private val prefs = context.createDeviceProtectedStorageContext()
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * 🔍 Initialize FRP protection on app startup
     */
    fun initializeFrpProtection() {
        Log.d(TAG, "Initializing FRP protection")

        // Get or create device ID for tracking
        val deviceId = getOrCreateDeviceId()

        // Check if this looks like a post-reset install
        if (isPostFactoryResetInstall()) {
            Log.w(TAG, "🚨 POST-FACTORY-RESET detected!")
            handlePostFactoryReset(deviceId)
        }

        // Record current state for future comparisons
        recordCurrentDeviceState()
    }

    /**
     * 🔍 Check if this is a fresh install after factory reset
     */
    private fun isPostFactoryResetInstall(): Boolean {
        return try {
            // Check 1: Does the KEY_WAS_LOCKED key EXIST in prefs?
            // Device Protected Storage is wiped by factory reset, so if the key
            // doesn't exist at all, this is either first install OR post-reset.
            val hasWasLockedKey = prefs.contains(KEY_WAS_LOCKED)
            val hasDeviceOwnerKey = prefs.contains(KEY_DEVICE_OWNER_ACTIVE)
            val isOwnerNow = dpm?.isDeviceOwnerApp(context.packageName) == true

            Log.d(TAG, "FRP Check: hasWasLockedKey=$hasWasLockedKey, hasDeviceOwnerKey=$hasDeviceOwnerKey, isOwnerNow=$isOwnerNow")

            // If prefs keys don't exist at all — this is either first install or post-reset
            if (!hasWasLockedKey && !hasDeviceOwnerKey) {
                // Check 2: Is the app a system app (exists in /system/priv-app/) but has no local state?
                // This indicates a data wipe on a pre-installed system app
                val isSystemApp = try {
                    val appInfo = context.packageManager.getApplicationInfo(context.packageName, 0)
                    (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
                } catch (e: Exception) { false }

                if (isSystemApp) {
                    Log.w(TAG, "⚠️ System app with no local state — likely factory reset!")
                    return true
                }

                // If not a system app, this could be a normal first install
                // Check if Device Owner is already active (normal first provisioning)
                if (isOwnerNow) {
                    Log.d(TAG, "First provisioning with device owner — not a reset")
                    return false
                }

                // No prefs, no device owner — suspicious, likely post-reset
                Log.w(TAG, "⚠️ No local state and no device owner — possible factory reset")
                return true
            }

            // Check 3 (secondary signal): If prefs exist but Device Owner was removed
            val wasLockedBefore = prefs.getBoolean(KEY_WAS_LOCKED, false)
            val hadDeviceOwnerBefore = prefs.getBoolean(KEY_DEVICE_OWNER_ACTIVE, false)

            if (wasLockedBefore && hadDeviceOwnerBefore && !isOwnerNow) {
                Log.w(TAG, "⚠️ Device owner was removed — FRP bypass likely!")
                return true
            }

            // Other suspicious patterns
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error checking post-reset state", e)
            false
        }
    }

    /**
     * 🚨 Handle detected factory reset
     */
    private fun handlePostFactoryReset(deviceId: String) {
        try {
            Log.e(TAG, "🚨 CRITICAL: Handling factory reset - Re-locking device from backend")

            // Increment reset counter
            val resetCount = prefs.getInt(KEY_FACTORY_RESET_COUNT, 0) + 1
            prefs.edit { putInt(KEY_FACTORY_RESET_COUNT, resetCount) }

            // Immediately enforce lock via server
            DeviceOwnerFallbackManager(context).enforceServerSideLock()

            // Report reset to backend
            reportFactoryResetToBackend(deviceId, resetCount)

            // Try to re-enable device owner if possible
            attemptDeviceOwnerReProvisioning()

        } catch (e: Exception) {
            Log.e(TAG, "Error handling factory reset", e)
        }
    }

    /**
     * 🔄 Attempt to re-provision device owner after reset
     */
    private fun attemptDeviceOwnerReProvisioning() {
        try {
            Log.d(TAG, "Attempting device owner re-provisioning...")

            // Check if device owner is already set
            if (dpm?.isDeviceOwnerApp(context.packageName) == true) {
                Log.d(TAG, "✅ Device owner is already active")
                return
            }

            // Device owner can't be set programmatically after first setup
            // Must be done via:
            // 1. NFC bump during provisioning
            // 2. Managed Device Provisioning
            // 3. QR code provisioning (if available)

            // For now, we rely on backend + software-based security
            Log.w(TAG, "Device owner re-provisioning requires manual intervention via backend")

            // Notify backend to attempt ZTP re-provisioning
            notifyBackendOfReprovisioningNeeded()

        } catch (e: Exception) {
            Log.e(TAG, "Error attempting re-provisioning", e)
        }
    }

    /**
     * 🔍 Detect suspicious account changes after reset
     */
    fun detectSuspiciousAccountChanges() {
        try {
            val am = context.getSystemService(android.accounts.AccountManager::class.java)
            val googleAccounts = am?.getAccountsByType("com.google") ?: emptyArray()

            Log.d(TAG, "Current Google accounts: ${googleAccounts.size}")

            if (googleAccounts.isNotEmpty()) {
                val accountsStr = googleAccounts.joinToString(",") { it.name }

                // Check if this matches previously known accounts
                val knownAccounts = prefs.getString("KNOWN_ACCOUNTS", "")
                if (!knownAccounts.isNullOrEmpty() && accountsStr != knownAccounts) {
                    Log.w(TAG, "🚨 Google account changed! From: $knownAccounts To: $accountsStr")
                    DeviceOwnerFallbackManager(context).enforceServerSideLock()
                }

                // Store current accounts
                prefs.edit { putString("KNOWN_ACCOUNTS", accountsStr) }
            }
        } catch (e: Exception) {
            Log.d(TAG, "Error detecting account changes: ${e.message}")
        }
    }

    /**
     * 📱 Get or create unique device identifier
     */
    private fun getOrCreateDeviceId(): String {
        return try {
            var id = prefs.getString(KEY_DEVICE_ID, null)
            if (id.isNullOrEmpty()) {
                // Create unique ID based on device identifiers (IMEI instead of deprecated Build.SERIAL)
                val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
                val imei = try { tm?.getImei(0) ?: "UNKNOWN" } catch (e: Exception) { "UNKNOWN" }
                id = "${Build.DEVICE}_${imei}_${Build.BOARD}".take(50)
                prefs.edit { putString(KEY_DEVICE_ID, id) }
                Log.d(TAG, "Created device ID: $id")
            }
            id
        } catch (e: Exception) {
            Log.e(TAG, "Error creating device ID", e)
            "UNKNOWN"
        }
    }

    /**
     * 📊 Record current device state for future comparisons
     */
    private fun recordCurrentDeviceState() {
        try {
            val isOwnerNow = dpm?.isDeviceOwnerApp(context.packageName) == true

            prefs.edit {
                putBoolean(KEY_WAS_LOCKED, true) // We enforce lock state via backend
                putBoolean(KEY_DEVICE_OWNER_ACTIVE, isOwnerNow)
                putLong("LAST_STATE_CHECK", System.currentTimeMillis())
            }

            Log.d(TAG, "Device state recorded: owner=$isOwnerNow")
        } catch (e: Exception) {
            Log.e(TAG, "Error recording device state", e)
        }
    }

    /**
     * 📡 Report factory reset to backend
     */
    private fun reportFactoryResetToBackend(deviceId: String, resetCount: Int) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            try {
                val fcmToken = if (task.isSuccessful) task.result else "UNKNOWN"

                Log.d(TAG, "Factory reset report prepared for device: $deviceId")
                
                // FIX: Send real report using SecureNetworkClient
                val url = "${BuildConfig.BACKEND_URL}/api/public/devices/security-event"
                val body = org.json.JSONObject().apply {
                    put("deviceId", deviceId)
                    put("eventType", "FACTORY_RESET")
                    put("fcmToken", fcmToken)
                    put("resetCount", resetCount)
                    put("timestamp", System.currentTimeMillis())
                }
                
                com.emiseure.customer.utils.SecureNetworkClient.post(
                    url = url,
                    body = body,
                    onSuccess = { Log.d(TAG, "Factory reset reported successfully") },
                    onError = { Log.e(TAG, "Failed to report factory reset: $it") }
                )
            } catch (e: Exception) {
                Log.e(TAG, "Error preparing factory reset report", e)
            }
        }
    }

    /**
     * 📡 Notify backend that device needs re-provisioning
     */
    private fun notifyBackendOfReprovisioningNeeded() {
        try {
            Log.d(TAG, "Notified backend of reprovision need (Action: REPROVISION_NEEDED)")
            
            // FIX: Send real request using SecureNetworkClient
            val deviceId = getOrCreateDeviceId()
            val url = "${BuildConfig.BACKEND_URL}/api/public/devices/security-event"
            val body = org.json.JSONObject().apply {
                put("deviceId", deviceId)
                put("eventType", "REPROVISION_NEEDED")
                put("timestamp", System.currentTimeMillis())
            }
            
            com.emiseure.customer.utils.SecureNetworkClient.post(
                url = url,
                body = body,
                onSuccess = { Log.d(TAG, "Reprovision need reported successfully") },
                onError = { Log.e(TAG, "Failed to report reprovision need: $it") }
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error notifying backend", e)
        }
    }

    /**
     * 🛡️ Prevent setup wizard from completing with wrong account
     * Call this from MainActivity during initialization
     */
    @Suppress("unused")
    fun blockUnauthorizedSetup() {
        try {
            // If device was previously locked and is now unlocked
            // Prevent normal operation
            val wasLocked = prefs.getBoolean(KEY_WAS_LOCKED, false)
            if (wasLocked) {
                Log.w(TAG, "⚠️ Device was previously locked - enforcing lock")
                DeviceOwnerFallbackManager(context).enforceServerSideLock()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in setup blocking", e)
        }
    }

    /**
     * 📊 Get FRP statistics
     */
    @Suppress("unused")
    fun getFrpStats(): Map<String, Any> {
        return try {
            mapOf<String, Any>(
                "resetCount" to prefs.getInt(KEY_FACTORY_RESET_COUNT, 0),
                "wasLocked" to prefs.getBoolean(KEY_WAS_LOCKED, false),
                "deviceOwnerActive" to (dpm?.isDeviceOwnerApp(context.packageName) == true),
                "lastStateCheck" to prefs.getLong("LAST_STATE_CHECK", 0),
                "deviceId" to (prefs.getString(KEY_DEVICE_ID, "UNKNOWN") ?: "UNKNOWN")
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error getting FRP stats", e)
            mapOf<String, Any>("error" to (e.message ?: "Unknown error"))
        }
    }
}

/**
 * 🚀 Initialize FRP protection from MainActivity.onCreate()
 */
@Suppress("unused")
fun initializeFrpProtection(context: Context) {
    try {
        val manager = FactoryResetProtectionManager(context)
        manager.initializeFrpProtection()
        manager.detectSuspiciousAccountChanges()
        Log.d("FrpProtection", "Factory reset protection initialized")
    } catch (e: Exception) {
        Log.e("FrpProtection", "Failed to initialize", e)
    }
}
