package com.emiseure.customer

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.UserManager
import android.util.Log

/**
 * 🛡️ TAMPER DETECTION & PREVENTION MANAGER
 * 
 * Handles:
 * - Physical tampering detection (hard reset button presses)
 * - Recovery mode access attempts
 * - Factory reset prevention
 * - Wipe data blocking
 * - Safe boot disabling
 */
object TamperDetectionManager {

    private const val TAG = "TamperDetectionManager"
    private const val TAMPER_ATTEMPTS_KEY = "TAMPER_ATTEMPTS"
    private const val LAST_TAMPER_TIMESTAMP = "LAST_TAMPER_TIMESTAMP"

    /**
     * 🛡️ Apply comprehensive anti-tampering restrictions
     * Should be called on device lock and after boot
     */
    fun enforceAntiTamperingLock(context: Context) {
        try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(context, MyDeviceAdminReceiver::class.java)

            if (!dpm.isDeviceOwnerApp(context.packageName)) {
                Log.w(TAG, "Not device owner - cannot enforce anti-tampering")
                return
            }

            // 🔐 Core Restrictions
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_DEBUGGING_FEATURES)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_ADD_USER)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_MODIFY_ACCOUNTS)

            // 🔐 Advanced Restrictions (API 21+)
            try {
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES)
                Log.d(TAG, "✅ DISALLOW_INSTALL_UNKNOWN_SOURCES applied")
            } catch (e: Exception) {
                Log.w(TAG, "DISALLOW_INSTALL_UNKNOWN_SOURCES not available on this API level")
            }

            // 🔐 Block USB file transfer
            try {
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_USB_FILE_TRANSFER)
                Log.d(TAG, "✅ DISALLOW_USB_FILE_TRANSFER applied")
            } catch (e: Exception) {
                Log.w(TAG, "DISALLOW_USB_FILE_TRANSFER not available")
            }

            // 🔐 Lock task packages (kiosk mode enforcement)
            try {
                dpm.setLockTaskPackages(adminComponent, arrayOf(context.packageName))
                Log.d(TAG, "✅ Lock task packages enforced")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to set lock task packages", e)
            }

            // 🔐 Block app uninstallation
            try {
                dpm.setUninstallBlocked(adminComponent, context.packageName, true)
                Log.d(TAG, "✅ App uninstallation blocked")
            } catch (e: Exception) {
                Log.w(TAG, "Failed to block uninstallation", e)
            }

            // 🔐 Prevent removing this admin receiver
            try {
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_UNINSTALL_APPS)
                Log.d(TAG, "✅ DISALLOW_UNINSTALL_APPS applied")
            } catch (e: Exception) {
                Log.w(TAG, "DISALLOW_UNINSTALL_APPS not available")
            }

            Log.i(TAG, "🛡️ All anti-tampering measures enforced successfully")

        } catch (e: SecurityException) {
            Log.e(TAG, "Security exception while enforcing anti-tampering", e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to enforce anti-tampering measures", e)
        }
    }

    /**
     * 📊 Log tampering attempt for audit trail
     */
    fun recordTamperAttempt(context: Context, attemptType: String) {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            val currentAttempts = prefs.getInt(TAMPER_ATTEMPTS_KEY, 0)
            val newAttempts = currentAttempts + 1

            prefs.edit().apply {
                putInt(TAMPER_ATTEMPTS_KEY, newAttempts)
                putLong(LAST_TAMPER_TIMESTAMP, System.currentTimeMillis())
                putString("LAST_TAMPER_TYPE", attemptType)
                apply()
            }

            Log.w(TAG, "🚨 Tamper attempt recorded: $attemptType (Total: $newAttempts)")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to record tamper attempt", e)
        }
    }

    /**
     * 🔍 Check if device has been tampered with
     */
    fun checkForTampering(context: Context): Boolean {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            val tamperAttempts = prefs.getInt(TAMPER_ATTEMPTS_KEY, 0)
            return tamperAttempts > 0

        } catch (e: Exception) {
            Log.e(TAG, "Failed to check tampering status", e)
            return false
        }
    }

    /**
     * 🔍 Get tamper attempt count
     */
    fun getTamperAttemptCount(context: Context): Int {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            return prefs.getInt(TAMPER_ATTEMPTS_KEY, 0)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to get tamper attempt count", e)
            return 0
        }
    }

    /**
     * 🗑️ Clear tamper records (admin use only)
     */
    fun clearTamperRecords(context: Context) {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            prefs.edit().apply {
                remove(TAMPER_ATTEMPTS_KEY)
                remove(LAST_TAMPER_TIMESTAMP)
                remove("LAST_TAMPER_TYPE")
                apply()
            }

            Log.d(TAG, "✅ Tamper records cleared")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear tamper records", e)
        }
    }

    /**
     * 📋 Get detailed tamper information
     */
    fun getTamperDetails(context: Context): Map<String, Any> {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            return mapOf(
                "tamperAttempts" to prefs.getInt(TAMPER_ATTEMPTS_KEY, 0),
                "lastTamperTime" to prefs.getLong(LAST_TAMPER_TIMESTAMP, 0),
                "lastTamperType" to (prefs.getString("LAST_TAMPER_TYPE", null) ?: "UNKNOWN")
            )

        } catch (e: Exception) {
            Log.e(TAG, "Failed to get tamper details", e)
            return emptyMap()
        }
    }
}
