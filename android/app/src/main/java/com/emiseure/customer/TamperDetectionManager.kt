package com.emiseure.customer

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
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
    private const val MAX_LOG_ENTRIES = 50 // Max tamper events to keep in secure storage

    // 🚨 Tamper attempt type constants
    const val TAMPER_BOOT_WHILE_LOCKED       = "BOOT_WHILE_LOCKED"
    const val TAMPER_LOCKED_BOOT_WHILE_LOCKED = "LOCKED_BOOT_WHILE_LOCKED"
    const val TAMPER_ADMIN_DISABLED          = "ADMIN_DISABLED"
    const val TAMPER_FACTORY_RESET_ATTEMPT   = "FACTORY_RESET_ATTEMPT"
    const val TAMPER_PASSWORD_BRUTE_FORCE    = "PASSWORD_BRUTE_FORCE"
    const val TAMPER_HARD_RESET_ATTEMPT      = "HARD_RESET_ATTEMPT"
    const val TAMPER_RECOVERY_MODE_ATTEMPT   = "RECOVERY_MODE_ATTEMPT"
    const val TAMPER_WIPE_DATA_ATTEMPT       = "WIPE_DATA_ATTEMPT"

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

            // 🔐 Block USB file transfer (protocol level)
            try {
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_USB_FILE_TRANSFER)
                Log.d(TAG, "✅ DISALLOW_USB_FILE_TRANSFER applied")
            } catch (e: Exception) {
                Log.w(TAG, "DISALLOW_USB_FILE_TRANSFER not available")
            }

            // 🔐 Hardware-level USB Data Signaling Block (API 31+)
            // This is significantly more powerful - it electrically disables data signaling on the USB port.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try {
                    dpm.setUsbDataSignalingEnabled(false)
                    Log.d(TAG, "✅ Hardware-level USB data signaling DISABLED")
                } catch (e: SecurityException) {
                    Log.e(TAG, "SecurityException while disabling USB data signaling (Device Owner required)", e)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to disable hardware-level USB data signaling", e)
                }
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
     * 📊 Log tampering attempt for audit trail.
     * Writes to Direct Boot safe storage using an indexed log (survives factory reset).
     */
    fun recordTamperAttempt(context: Context, attemptType: String) {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            val currentAttempts = prefs.getInt(TAMPER_ATTEMPTS_KEY, 0)
            val newAttempts = currentAttempts + 1
            val timestamp = System.currentTimeMillis()

            prefs.edit().apply {
                // Update summary counters
                putInt(TAMPER_ATTEMPTS_KEY, newAttempts)
                putLong(LAST_TAMPER_TIMESTAMP, timestamp)
                putString("LAST_TAMPER_TYPE", attemptType)

                // Append indexed log entry (ring-buffer up to MAX_LOG_ENTRIES)
                val logIndex = (currentAttempts % MAX_LOG_ENTRIES)
                putString("TAMPER_LOG_TYPE_$logIndex", attemptType)
                putLong("TAMPER_LOG_TIME_$logIndex", timestamp)
                apply()
            }

            Log.w(TAG, "🚨 Tamper attempt #$newAttempts recorded: $attemptType @ $timestamp")

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

            val totalAttempts = prefs.getInt(TAMPER_ATTEMPTS_KEY, 0)

            prefs.edit().apply {
                remove(TAMPER_ATTEMPTS_KEY)
                remove(LAST_TAMPER_TIMESTAMP)
                remove("LAST_TAMPER_TYPE")
                // Clear all indexed log entries
                for (i in 0 until minOf(totalAttempts, MAX_LOG_ENTRIES)) {
                    remove("TAMPER_LOG_TYPE_$i")
                    remove("TAMPER_LOG_TIME_$i")
                }
                apply()
            }

            Log.d(TAG, "✅ Tamper records cleared")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear tamper records", e)
        }
    }

    /**
     * 📋 Get detailed tamper information (summary)
     */
    fun getTamperDetails(context: Context): Map<String, Any> {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            return mapOf(
                "tamperAttempts" to prefs.getInt(TAMPER_ATTEMPTS_KEY, 0),
                "lastTamperTime" to prefs.getLong(LAST_TAMPER_TIMESTAMP, 0),
                "lastTamperType" to (prefs.getString("LAST_TAMPER_TYPE", null) ?: "NONE")
            )

        } catch (e: Exception) {
            Log.e(TAG, "Failed to get tamper details", e)
            return emptyMap()
        }
    }

    /**
     * 📜 Get full indexed tamper log (all events stored in Direct Boot storage)
     * Returns a list of maps, each with "type" and "timestamp" keys.
     * Ordered from least recent to most recent (index 0 = oldest in ring buffer).
     */
    fun getTamperLog(context: Context): List<Map<String, Any>> {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            val totalAttempts = prefs.getInt(TAMPER_ATTEMPTS_KEY, 0)
            val entriesStored = minOf(totalAttempts, MAX_LOG_ENTRIES)
            val log = mutableListOf<Map<String, Any>>()

            for (i in 0 until entriesStored) {
                val type = prefs.getString("TAMPER_LOG_TYPE_$i", "UNKNOWN") ?: "UNKNOWN"
                val time = prefs.getLong("TAMPER_LOG_TIME_$i", 0L)
                log.add(mapOf("index" to i, "type" to type, "timestamp" to time))
            }

            // Sort by timestamp ascending so most recent is last
            return log.sortedBy { it["timestamp"] as Long }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to get tamper log", e)
            return emptyList()
        }
    }

    /**
     * 🔓 Re-enable hardware-level USB data signaling (admin/troubleshooting only)
     */
    fun reEnableUsbData(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager


                if (dpm.isDeviceOwnerApp(context.packageName)) {
                    dpm.setUsbDataSignalingEnabled(true)
                    Log.i(TAG, "🔓 Hardware-level USB data signaling RE-ENABLED")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to re-enable USB data signaling", e)
            }
        }
    }
}
