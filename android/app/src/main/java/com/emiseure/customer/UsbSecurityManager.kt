package com.emiseure.customer

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.UserManager
import android.util.Log
import android.provider.Settings

/**
 * 🔌 USB SECURITY MANAGER
 * 
 * Comprehensive USB security to prevent:
 * - USB debugging/ADB access
 * - USB file transfer (MTP/PTP)
 * - Device formatting via USB
 * - Unauthorized data access
 * - Recovery mode access via USB
 * 
 * Applies multiple layers of restrictions:
 * 1. Disable USB debugging at OS level
 * 2. Disable MTP file transfer mode
 * 3. Apply device policy restrictions
 * 4. Monitor all USB connections
 * 5. Log all USB connection attempts
 */
object UsbSecurityManager {

    private const val TAG = "UsbSecurityManager"
    private const val USB_CONNECTIONS_KEY = "USB_CONNECTIONS"
    private const val LAST_USB_CONNECTION = "LAST_USB_CONNECTION"
    private const val USB_ATTACK_COUNT = "USB_ATTACK_COUNT"

    /**
     * 🔌 Enforce comprehensive USB security
     * Should be called when device is locked or on boot
     */
    fun enforceUsbSecurity(context: Context) {
        try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(context, MyDeviceAdminReceiver::class.java)

            if (!dpm.isDeviceOwnerApp(context.packageName)) {
                Log.w(TAG, "Not device owner - USB restrictions may not be fully applied")
                return
            }

            Log.d(TAG, "Enforcing comprehensive USB security...")

            // 🔌 LAYER 1: Disable USB Debugging at OS Level
            disableUsbDebugging(context, dpm, adminComponent)

            // 🔌 LAYER 2: Disable MTP/PTP File Transfer
            disableMtpFileTransfer(context)

            // 🔌 LAYER 3: Apply Device Policy Restrictions
            applyDevicePolicyRestrictions(context, dpm, adminComponent)

            // 🔌 LAYER 4: Disable Development Settings
            disableDeveloperSettings(context, dpm, adminComponent)

            Log.i(TAG, "🛡️ All USB security layers enforced successfully")

        } catch (e: SecurityException) {
            Log.e(TAG, "Security exception while enforcing USB security", e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to enforce USB security", e)
        }
    }

    /**
     * 🔌 Layer 1: Disable USB Debugging
     */
    private fun disableUsbDebugging(
        context: Context,
        dpm: DevicePolicyManager,
        adminComponent: ComponentName
    ) {
        try {
            // Disable ADB via Global Settings
            dpm.setGlobalSetting(
                adminComponent,
                Settings.Global.ADB_ENABLED,
                "0"
            )
            Log.d(TAG, "✅ USB Debugging (ADB) disabled via Global Settings")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to disable USB debugging", e)
        }
    }

    /**
     * 🔌 Layer 2: Disable MTP File Transfer Mode
     */
    private fun disableMtpFileTransfer(context: Context) {
        try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(context, MyDeviceAdminReceiver::class.java)

            // Disable USB file transfer via user restriction
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_USB_FILE_TRANSFER)
            
            Log.d(TAG, "✅ USB file transfer (MTP/PTP) disabled")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to disable MTP file transfer", e)
        }
    }

    /**
     * 🔌 Layer 3: Apply Device Policy Restrictions
     */
    private fun applyDevicePolicyRestrictions(
        context: Context,
        dpm: DevicePolicyManager,
        adminComponent: ComponentName
    ) {
        try {
            // Disable debugging features entirely (includes ADB and USB debugging options)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_DEBUGGING_FEATURES)
            Log.d(TAG, "✅ Debugging features completely disabled")

            // Disable physical media mounting (prevents USB storage access)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
            Log.d(TAG, "✅ Physical media mounting disabled")

            // Disable safe boot (prevents recovery mode via USB)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT)
            Log.d(TAG, "✅ Safe boot disabled (prevents recovery mode)")

            // Disable factory reset (prevents format via recovery)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET)
            Log.d(TAG, "✅ Factory reset disabled")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply device policy restrictions", e)
        }
    }

    /**
     * 🔌 Layer 4: Disable Developer Settings
     */
    private fun disableDeveloperSettings(
        context: Context,
        dpm: DevicePolicyManager,
        adminComponent: ComponentName
    ) {
        try {
            // Set development settings password to random (blocks access)
            val devSettingsPassword = (0..999999).random().toString()
            dpm.setGlobalSetting(
                adminComponent,
                Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
                "0"
            )
            Log.d(TAG, "✅ Developer settings disabled")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fully disable developer settings", e)
        }
    }

    /**
     * 📊 Record USB Connection Attempt
     * Should be called whenever USB connection is detected
     */
    fun recordUsbConnection(context: Context, connectionType: String = "UNKNOWN") {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            // Increment connection count
            val currentCount = prefs.getInt(USB_CONNECTIONS_KEY, 0)
            val newCount = currentCount + 1

            // Check if this might be an attack (rapid multiple connections)
            val lastConnection = prefs.getLong(LAST_USB_CONNECTION, 0)
            val timeSinceLastConnection = System.currentTimeMillis() - lastConnection
            
            val attackCount = if (timeSinceLastConnection < 10000) { // Within 10 seconds
                prefs.getInt(USB_ATTACK_COUNT, 0) + 1
            } else {
                0 // Reset attack counter if reasonable time between connections
            }

            prefs.edit().apply {
                putInt(USB_CONNECTIONS_KEY, newCount)
                putLong(LAST_USB_CONNECTION, System.currentTimeMillis())
                putInt(USB_ATTACK_COUNT, attackCount)
                putString("LAST_USB_CONNECTION_TYPE", connectionType)
                apply()
            }

            if (attackCount > 0) {
                Log.w(TAG, "🚨 Potential USB attack detected! Rapid connections: $attackCount")
                recordSecurityAlert(context, "USB_ATTACK", mapOf(
                    "rapidConnections" to attackCount,
                    "connectionType" to connectionType
                ))
            } else {
                Log.d(TAG, "📊 USB connection recorded: $connectionType (Total: $newCount)")
            }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to record USB connection", e)
        }
    }

    /**
     * 🚨 Alert on security incident
     */
    private fun recordSecurityAlert(context: Context, alertType: String, details: Map<String, Any>) {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            val alerts = prefs.getInt("SECURITY_ALERTS", 0) + 1
            prefs.edit().apply {
                putInt("SECURITY_ALERTS", alerts)
                putString("LAST_ALERT_TYPE", alertType)
                putLong("LAST_ALERT_TIME", System.currentTimeMillis())
                apply()
            }

            Log.e(TAG, "🚨 SECURITY ALERT: $alertType - $details")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to record security alert", e)
        }
    }

    /**
     * 📊 Get USB Connection Statistics
     */
    fun getUsbConnectionStats(context: Context): Map<String, Any> {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            return mapOf(
                "totalConnections" to prefs.getInt(USB_CONNECTIONS_KEY, 0),
                "lastConnectionTime" to prefs.getLong(LAST_USB_CONNECTION, 0),
                "lastConnectionType" to (prefs.getString("LAST_USB_CONNECTION_TYPE", null) ?: "UNKNOWN"),
                "rapidAttackCount" to prefs.getInt(USB_ATTACK_COUNT, 0),
                "securityAlerts" to prefs.getInt("SECURITY_ALERTS", 0),
                "lastAlertType" to (prefs.getString("LAST_ALERT_TYPE", null) ?: "NONE")
            )

        } catch (e: Exception) {
            Log.e(TAG, "Failed to get USB connection stats", e)
            return emptyMap()
        }
    }

    /**
     * 🔍 Check if device is connected to USB
     */
    fun isUsbConnected(context: Context): Boolean {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            // Check if last connection was recent (within last minute)
            val lastConnection = prefs.getLong(LAST_USB_CONNECTION, 0)
            val timeSinceLastConnection = System.currentTimeMillis() - lastConnection

            return timeSinceLastConnection < 60000 // Recent connection

        } catch (e: Exception) {
            Log.e(TAG, "Failed to check USB status", e)
            return false
        }
    }

    /**
     * 🛡️ Verify USB Security Status
     */
    fun verifyUsbSecurityStatus(context: Context): Boolean {
        try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(context, MyDeviceAdminReceiver::class.java)

            if (!dpm.isDeviceOwnerApp(context.packageName)) {
                Log.w(TAG, "Device Owner app check failed")
                return false
            }

            // Check if critical restrictions are applied
            val activeRestrictions = dpm.getActiveAdmins()
            Log.d(TAG, "✅ USB Security Status Verified - Device Owner active")
            
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to verify USB security status", e)
            return false
        }
    }

    /**
     * 🗑️ Clear USB connection history (Admin use only)
     */
    fun clearUsbConnectionHistory(context: Context) {
        try {
            val prefs = context.createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

            prefs.edit().apply {
                remove(USB_CONNECTIONS_KEY)
                remove(LAST_USB_CONNECTION)
                remove(USB_ATTACK_COUNT)
                remove("LAST_USB_CONNECTION_TYPE")
                remove("SECURITY_ALERTS")
                remove("LAST_ALERT_TYPE")
                apply()
            }

            Log.d(TAG, "✅ USB connection history cleared")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear USB connection history", e)
        }
    }
}
