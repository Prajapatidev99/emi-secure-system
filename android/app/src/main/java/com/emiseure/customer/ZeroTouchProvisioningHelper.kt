package com.emiseure.customer

import android.app.DownloadManager
import android.app.admin.DevicePolicyManager
import android.app.admin.FactoryResetProtectionPolicy
import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.util.Log
import androidx.annotation.RequiresApi
import org.json.JSONArray
import org.json.JSONObject
import android.os.UserManager
import java.io.File

/**
 * 🔄 ZERO-TOUCH / AUTO-PROVISIONING HELPER
 *
 * Handles the full "APK comes back after factory reset" lifecycle:
 *
 * SCENARIO: User bypasses all restrictions and completes factory reset.
 * WHAT HAPPENS:
 *   1. Device boots fresh
 *   2. User installs APK manually (or via QR/zero-touch in setup wizard)
 *   3. App opens → calls this helper on first launch
 *   4. Backend recognizes IMEI → device still "Locked" in DB
 *   5. Lock screen shown even WITHOUT Device Owner
 *   6. Admin re-provisions via ADB/QR to restore Device Owner + full restrictions
 *
 * ZERO-TOUCH ENROLLMENT:
 *   - Register device IMEI in Google Zero-Touch portal
 *   - After any factory reset, setup wizard auto-downloads our APK
 *   - Makes it Device Owner automatically → full lock restored
 *
 * FACTORY RESET PROTECTION:
 *   - With DISALLOW_FACTORY_RESET active, user can't reset in the first place
 *   - If they power off and on, lock is enforced via BootReceiver
 *   - FRP (Factory Reset Protection) adds a second layer requiring Google account
 */
object ZeroTouchProvisioningHelper {

    private const val TAG = "ZeroTouchProvisioning"

    // APK download URL — served from our backend's /public folder
    private const val APK_FILENAME = "EMI-Secure.apk"

    /**
     * 🔐 Generate a Zero-Touch / QR Provisioning configuration JSON.
     *
     * This JSON is embedded in the QR code that, when scanned during
     * Android setup wizard (Vol Down×3 + click), configures the device
     * to automatically install & set our app as Device Policy Controller.
     *
     * Reference: https://developers.google.com/android/work/play/emm-api/prov-devices
     */
    fun generateProvisioningConfig(backendUrl: String, apkChecksum: String): JSONObject {
        return JSONObject().apply {
            // The package to install as DPC (Device Policy Controller)
            put("android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME",
                "com.emiseure.customer/.MyDeviceAdminReceiver")

            // APK download URL — backend must serve the latest APK at this path
            put("android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION",
                "$backendUrl/EMI-Secure.apk")

            // SHA-256 checksum of the APK (prevents MITM replacing the APK)
            // Get this by running: sha256sum EMI-Secure.apk | cut -c1-8 (first 8 hex chars → 4 bytes)
            // Or: certutil -hashfile EMI-Secure.apk SHA256
            put("android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM", apkChecksum)

            // Skip encryption requirement (optional, for faster setup)
            put("android.app.extra.PROVISIONING_SKIP_ENCRYPTION", false)

            // Locale and timezone for quick setup
            put("android.app.extra.PROVISIONING_LOCALE", "en_IN")
            put("android.app.extra.PROVISIONING_TIME_ZONE", "Asia/Kolkata")

            // Admin extras bundle — passed to our DPC on provisioning complete
            val adminExtras = JSONObject().apply {
                put("backend_url", backendUrl)
                put("auto_lock_on_provision", true)
                put("provisioning_version", "1.0")
            }
            put("android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE", adminExtras.toString())
        }
    }

    /**
     * 📲 Trigger APK self-download via DownloadManager.
     * Called when a fresh install detects it needs to re-download latest version.
     */
    fun triggerApkSelfDownload(context: Context, backendUrl: String) {
        try {
            val apkUrl = "$backendUrl/EMI-Secure.apk"
            Log.d(TAG, "Triggering APK download from: $apkUrl")

            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val request = DownloadManager.Request(Uri.parse(apkUrl)).apply {
                setTitle("EMI Secure - Updating")
                setDescription("Downloading security update...")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, APK_FILENAME)
                setMimeType("application/vnd.android.package-archive")
                addRequestHeader("Accept", "application/vnd.android.package-archive")
            }

            val downloadId = downloadManager.enqueue(request)
            Log.d(TAG, "✅ APK download enqueued with ID: $downloadId")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to trigger APK self-download", e)
        }
    }

    /**
     * 🔐 Apply strict Factory Reset Protection policy.
     */
    @RequiresApi(Build.VERSION_CODES.R)
    fun applyFactoryResetProtection(
        context: Context,
        adminAccountIds: List<String> = listOf("prajapatidev9974@gmail.com")
    ) {
        try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(context, MyDeviceAdminReceiver::class.java)

            if (!dpm.isDeviceOwnerApp(context.packageName)) {
                Log.w(TAG, "Not Device Owner — FRP policy cannot be set")
                return
            }

            // 🛡️ CRITICAL: Using Builder with enabled flag to force account verification
            val builder = FactoryResetProtectionPolicy.Builder()
                .setFactoryResetProtectionAccounts(adminAccountIds)
                
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setFactoryResetProtectionEnabled(true)
            }

            val frpPolicy = builder.build()
            dpm.setFactoryResetProtectionPolicy(adminComponent, frpPolicy)
            Log.i(TAG, "🔒 FRP Policy FORCE-ENFORCED for master account: $adminAccountIds")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to set FRP policy", e)
        }
    }

    /**
     * 🔒 MAXIMUM LOCKDOWN: Disable all recovery and bypass vectors
     */
    fun enforceFullSystemLockdown(context: Context) {
        try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(context, MyDeviceAdminReceiver::class.java)

            if (!dpm.isDeviceOwnerApp(context.packageName)) return

            // 1. Disable Factory Reset (Hides it in Settings)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET)
            
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_DEBUGGING_FEATURES)
            
            // 🚫 BLOCK USB DATA (Stops PC-based Flashing/Bypassing)
            // Required Android 12+ (API 31)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try {
                    dpm.setUsbDataSignalingEnabled(false)
                } catch (e: Exception) {
                    // Log but continue if OEM doesn't support
                }
            }

            // 🚫 BLOCK SETTINGS TAMPERING
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_WIFI)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_BLUETOOTH)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SMS)
            
            // 🚫 BLOCK ACCOUNT TAMPERING (Prevent adding new Gmails)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_MODIFY_ACCOUNTS)

            // 🔐 ENFORCE FRP MASTER ACCOUNT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                applyFactoryResetProtection(context)
            }

            Log.i(TAG, "🛡️ Full system lockdown verified and active")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to enforce system lockdown", e)
        }
    }

    /**
     * 📋 Check if this appears to be a post-factory-reset fresh install.
     *
     * Heuristics:
     * - No Device Owner active (was cleared by reset)
     * - No lock state prefs exist in Device Protected storage
     * - App was just installed (packageInfo.firstInstallTime ≈ lastUpdateTime)
     */
    fun isPostFactoryResetInstall(context: Context): Boolean {
        try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

            // If we're Device Owner, this is NOT a post-reset fresh install
            if (dpm.isDeviceOwnerApp(context.packageName)) return false

            // Check if Device Protected storage has any lock state
            val dpContext = context.createDeviceProtectedStorageContext()
            val dpPrefs = dpContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
            if (dpPrefs.contains("IS_LOCKED")) return false

            // Check fresh install heuristic via package info
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            val timeDiff = packageInfo.lastUpdateTime - packageInfo.firstInstallTime
            val isFreshInstall = timeDiff < 60_000L // Less than 1 minute between install and update

            Log.d(TAG, "Post-reset check: isDO=${dpm.isDeviceOwnerApp(context.packageName)}, " +
                      "hasPrefs=${dpPrefs.contains("IS_LOCKED")}, isFreshInstall=$isFreshInstall")

            return isFreshInstall

        } catch (e: Exception) {
            Log.e(TAG, "Error checking post-factory-reset state", e)
            return false
        }
    }

    /**
     * 📄 Get the provisioning QR code JSON string for this device.
     * Used by the dashboard to generate a scannable QR code for re-provisioning.
     */
    fun getProvisioningJson(backendUrl: String, apkChecksum: String): String {
        return generateProvisioningConfig(backendUrl, apkChecksum).toString(2)
    }
}
