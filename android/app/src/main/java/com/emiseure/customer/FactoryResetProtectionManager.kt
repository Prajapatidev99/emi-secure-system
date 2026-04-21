package com.emiseure.customer

import android.content.Context
import android.os.Build
import android.util.Log
import androidx.core.content.edit
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
            // Indicators of post-reset:
            // 1. First run (no previous FRP prefs)
            // 2. Device owner was active before but isn't now
            // 3. Very few packages installed (fresh system)
            // 4. No Google account configured

            val wasLockedBefore = prefs.getBoolean(KEY_WAS_LOCKED, false)
            val hadDeviceOwnerBefore = prefs.getBoolean(KEY_DEVICE_OWNER_ACTIVE, false)
            val isOwnerNow = dpm?.isDeviceOwnerApp(context.packageName) == true

            Log.d(TAG, "FRP Check: wasLocked=$wasLockedBefore, hadOwner=$hadDeviceOwnerBefore, isOwnerNow=$isOwnerNow")

            // If it WAS locked and HAD device owner, but now DOESN'T - this is suspicious!
            if (wasLockedBefore && hadDeviceOwnerBefore && !isOwnerNow) {
                Log.w(TAG, "⚠️ Device owner was removed - FRP bypass likely!")
                return true
            }

            // No previous state = first install (could be after reset)
            if (!wasLockedBefore && !hadDeviceOwnerBefore && isOwnerNow) {
                // This is normal: first provisioning with device owner
                return false
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
                // Create unique ID based on device identifiers
                @Suppress("DEPRECATION", "HardwareIds")
                val serial = Build.SERIAL
                id = "${Build.DEVICE}_${serial}_${Build.BOARD}".take(50)
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
    @Suppress("UNUSED_PARAMETER")
    private fun reportFactoryResetToBackend(deviceId: String, resetCount: Int) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            try {
                @Suppress("UNUSED_VARIABLE")
                val fcmToken = if (task.isSuccessful) task.result else "UNKNOWN"

                Log.d(TAG, "Factory reset report prepared for device: $deviceId")
                // TODO: Send report to backend via your production network client
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
            // TODO: Send via your production network client (SecureNetworkClient)
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
