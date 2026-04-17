package com.emiseure.customer

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.content.ComponentName
import android.util.Log
import android.os.Build

@Suppress("DEPRECATION")
class MyDeviceAdminReceiver : DeviceAdminReceiver() {

    private val TAG = "DeviceAdminReceiver"

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "✅ Device Admin ENABLED")
        
        // 🛡️ ANTI-TAMPERING: Lock down device immediately
        preventPhysicalTampering(context)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.w(TAG, "⚠️ Device Admin DISABLED by user")
    }

    override fun onPasswordFailed(context: Context, intent: Intent) {
        super.onPasswordFailed(context, intent)
        Log.w(TAG, "🔐 Device password attempt FAILED")
    }

    override fun onPasswordSucceeded(context: Context, intent: Intent) {
        super.onPasswordSucceeded(context, intent)
        Log.i(TAG, "🔓 Device password attempt SUCCEEDED")
    }
    
    /**
     * 🛡️ CRITICAL: Block all physical tampering attempts
     * - Prevent hard reset button usage
     * - Block recovery mode access
     * - Disable wipe data option
     * - Prevent safe boot
     */
    private fun preventPhysicalTampering(context: Context) {
        try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager
            val adminComponent = ComponentName(context, this::class.java)
            
            if (dpm.isDeviceOwnerApp(context.packageName)) {
                // 🔐 Block factory reset attempts
                dpm.addUserRestriction(adminComponent, android.os.UserManager.DISALLOW_FACTORY_RESET)
                Log.d(TAG, "✅ DISALLOW_FACTORY_RESET enforced")
                
                // 🔐 Block safe boot (prevents recovery mode access)
                dpm.addUserRestriction(adminComponent, android.os.UserManager.DISALLOW_SAFE_BOOT)
                Log.d(TAG, "✅ DISALLOW_SAFE_BOOT enforced")
                
                // 🔐 Block debugging features (prevents ADB wipe)
                dpm.addUserRestriction(adminComponent, android.os.UserManager.DISALLOW_DEBUGGING_FEATURES)
                Log.d(TAG, "✅ DISALLOW_DEBUGGING_FEATURES enforced")
                
                // 🔐 Block physical media mounting (prevents USB wipe)
                dpm.addUserRestriction(adminComponent, android.os.UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
                Log.d(TAG, "✅ DISALLOW_MOUNT_PHYSICAL_MEDIA enforced")
                
                // 🔐 Block adding new users (prevents bypass)
                dpm.addUserRestriction(adminComponent, android.os.UserManager.DISALLOW_ADD_USER)
                Log.d(TAG, "✅ DISALLOW_ADD_USER enforced")
                
                // 🔐 Block modifying accounts (prevents unlock attempts)
                dpm.addUserRestriction(adminComponent, android.os.UserManager.DISALLOW_MODIFY_ACCOUNTS)
                Log.d(TAG, "✅ DISALLOW_MODIFY_ACCOUNTS enforced")
                
                Log.i(TAG, "🛡️ All anti-tampering restrictions applied successfully")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply anti-tampering restrictions", e)
        }
    }
}
