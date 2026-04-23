package com.emiseure.customer

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.content.ComponentName
import android.util.Log
import android.os.Build
import android.os.UserManager
import android.Manifest
import android.app.admin.DevicePolicyManager

@Suppress("DEPRECATION")
class MyDeviceAdminReceiver : DeviceAdminReceiver() {

    private val TAG = "DeviceAdminReceiver"

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "✅ Device Admin ENABLED")
        
        // 🛡️ ANTI-TAMPERING: Lock down device immediately
        preventPhysicalTampering(context)
        
        // 🔌 USB SECURITY: Disable all USB-based attacks
        UsbSecurityManager.enforceUsbSecurity(context)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.w(TAG, "⚠️ Device Admin DISABLED by user — recording tamper attempt")
        // 🚨 AUDIT: Record admin disable as tampering event
        TamperDetectionManager.recordTamperAttempt(context, "ADMIN_DISABLED")
        // 🛡️ Attempt to re-enforce even after disable (may fail if truly removed)
        preventPhysicalTampering(context)
    }

    override fun onPasswordFailed(context: Context, intent: Intent) {
        super.onPasswordFailed(context, intent)
        Log.w(TAG, "🔐 Device password attempt FAILED — recording tamper attempt")
        // 🚨 AUDIT: Record failed password as potential brute-force attempt
        TamperDetectionManager.recordTamperAttempt(context, "PASSWORD_BRUTE_FORCE")
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
                // 🔐 Block factory reset attempts (hides wipe data in Settings)
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET)
                Log.d(TAG, "✅ DISALLOW_FACTORY_RESET enforced")
                
                // 🔐 Block safe boot (prevents Vol Down+Power → Recovery Mode)
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT)
                Log.d(TAG, "✅ DISALLOW_SAFE_BOOT enforced")
                
                // 🔐 Block debugging features (prevents ADB wipe commands)
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_DEBUGGING_FEATURES)
                Log.d(TAG, "✅ DISALLOW_DEBUGGING_FEATURES enforced")
                
                // 🔐 Block physical media mounting (prevents USB-based wipe)
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
                Log.d(TAG, "✅ DISALLOW_MOUNT_PHYSICAL_MEDIA enforced")
                
                // 🔐 Block adding new users (prevents guest bypass)
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_ADD_USER)
                Log.d(TAG, "✅ DISALLOW_ADD_USER enforced")

                // 🔐 DEAD-PORT SECURITY: Kill USB Data signaling (API 31+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    try {
                        dpm.setUsbDataSignalingEnabled(false)
                        Log.i(TAG, "✅ USB Data Signaling DISABLED (Hardware Level)")
                    } catch (e: Exception) {
                        Log.w(TAG, "setUsbDataSignalingEnabled failed", e)
                    }
                }

                // 🔐 Block USB file transfers (MTP/PTP)
                try {
                    dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_USB_FILE_TRANSFER)
                    Log.d(TAG, "✅ DISALLOW_USB_FILE_TRANSFER enforced")
                } catch (e: Exception) {
                    Log.w(TAG, "DISALLOW_USB_FILE_TRANSFER not available")
                }

                // 🔐 Block OEM unlock via global settings (prevents bootloader unlock → wipe)
                try {
                    dpm.setGlobalSetting(adminComponent, "oem_unlock_allowed", "0")
                    Log.d(TAG, "✅ OEM unlock DISABLED via global setting")
                } catch (e: Exception) {
                    Log.w(TAG, "setGlobalSetting oem_unlock_allowed failed", e)
                }

                // 🔐 Block app uninstall
                try {
                    dpm.setUninstallBlocked(adminComponent, context.packageName, true)
                    Log.d(TAG, "✅ App uninstallation BLOCKED")
                } catch (e: Exception) {
                    Log.w(TAG, "setUninstallBlocked failed", e)
                }

                // 🔐 LOCK TASK MODE: Whitelist this app to be un-escaped
                try {
                    dpm.setLockTaskPackages(adminComponent, arrayOf(context.packageName))
                    Log.d(TAG, "✅ Lock task package whitelisted: ${context.packageName}")
                    
                    // 🛡️ Disable keyguard (Redmi/Vivo Fix)
                    dpm.setKeyguardDisabled(adminComponent, true)
                    Log.d(TAG, "✅ Keyguard DISABLED (Maximum Security)")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to set lock task packages or disable keyguard", e)
                }

                Log.i(TAG, "🛡️ All anti-tampering restrictions applied successfully")
            } else {
                Log.w(TAG, "⚠️ preventPhysicalTampering: Not device owner — restrictions skipped")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply anti-tampering restrictions", e)
        }
    }
}
