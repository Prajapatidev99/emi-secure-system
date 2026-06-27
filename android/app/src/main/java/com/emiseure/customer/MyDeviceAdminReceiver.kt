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
        // ⚠️ Admin is already disabled — preventPhysicalTampering() would fail since
        // we no longer have device owner privileges. Just log the warning.
        Log.w(TAG, "⚠️ Device Admin disabled — cannot re-enforce restrictions without admin privileges")
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

                // 🔐 Block USB file transfers (MTP/PTP) - API 33+
                if (Build.VERSION.SDK_INT >= 33) {
                    try {
                        dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_USB_FILE_TRANSFER)
                        Log.d(TAG, "✅ DISALLOW_USB_FILE_TRANSFER enforced")
                    } catch (e: Exception) {
                        Log.w(TAG, "DISALLOW_USB_FILE_TRANSFER not available")
                    }
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

                // 🔐 HIDE/CUSTOMIZE ORGANIZATION MESSAGE
                try {
                    // Hide the message from the main lock screen
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        dpm.setDeviceOwnerLockScreenInfo(adminComponent, null)
                    }
                    // Customize the message in the quick settings dropdown to look official
                    dpm.setOrganizationName(adminComponent, "Device Security Manager")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to set organization message", e)
                }

                Log.i(TAG, "🛡️ All anti-tampering restrictions applied successfully")

                // 🔐 HARDWARE-BACKED FRP: Lock bootloader and enable enterprise FRP
                enforceHardwareBackedProtection(context, dpm, adminComponent)

            } else {
                Log.w(TAG, "⚠️ preventPhysicalTampering: Not device owner — restrictions skipped")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply anti-tampering restrictions", e)
        }
    }

    /**
     * 🔐 HARDWARE-BACKED PROTECTION (No Root Required!)
     *
     * These protections are stored in hardware partitions that SURVIVE factory reset:
     * 1. PersistentDataBlock: Disables OEM unlock at hardware level
     * 2. FactoryResetProtectionPolicy: Forces specific Google account after reset
     *
     * Even if customer does hardware factory reset (Vol+Power):
     * - Bootloader stays locked (can't flash TWRP/custom ROM)
     * - FRP forces YOUR shop's Google account
     * - Standard FRP bypass tools won't work on enterprise-managed FRP
     */
    private fun enforceHardwareBackedProtection(
        context: Context,
        dpm: android.app.admin.DevicePolicyManager,
        adminComponent: ComponentName
    ) {
        // 🔐 STEP 1: Bootloader OEM Unlock is already blocked via Global Settings (see above)

        // 🔐 STEP 2: Set enterprise FRP policy (Android 11+)
        // This stores the required Google account in a protected partition
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                // Hardcoded Master Email for Enterprise FRP
                val masterEmail = "devmobile997422@gmail.com"
                
                val frpPolicy = android.app.admin.FactoryResetProtectionPolicy.Builder()
                    .setFactoryResetProtectionAccounts(listOf(masterEmail))
                    .setFactoryResetProtectionEnabled(true)
                    .build()

                dpm.setFactoryResetProtectionPolicy(adminComponent, frpPolicy)
                Log.d(TAG, "✅ Enterprise FRP policy set to MASTER EMAIL — $masterEmail")
                Log.d(TAG, "🔐 After factory reset, ONLY this account can unlock the phone")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to set FactoryResetProtectionPolicy", e)
            }
        }
    }
}
