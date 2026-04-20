package com.emiseure.customer

import android.app.AlertDialog
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * 🛠️ AUTOSTART HELPER FOR CHINESE ROMS
 * 
 * Devices like Xiaomi, Oppo, and Vivo aggressively kill apps in the background
 * and prevent BOOT_COMPLETED receivers from firing unless "Autostart" is manually enabled.
 * Since this is a proprietary OS restriction, no programmatic API or Device Owner
 * privilege can bypass it.
 *
 * This helper detects these specific brands and forces the admin during provisioning
 * to click a deep-link that takes them to the exact Autostart settings screen.
 */
object AutoStartHelper {

    private const val TAG = "AutoStartHelper"
    private const val PREF_NAME = "EMI_AUTOSTART_PREFS"
    private const val KEY_PROMPTED = "has_prompted_autostart"

    /**
     * Checks if the device requires an Autostart nudge and prompts the user if they haven't been asked yet.
     */
    fun checkAndPromptAutoStart(context: Context) {
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_PROMPTED, false)) {
            return // Already prompted during setup
        }

        val manufacturer = Build.MANUFACTURER.lowercase()
        val intent = getAutoStartIntent(manufacturer)

        if (intent != null) {
            // Verify the intent resolves on this specific device
            if (context.packageManager.resolveActivity(intent, 0) != null) {
                Log.w(TAG, "Chinese ROM detected ($manufacturer). Prompting for Autostart.")
                showAutoStartDialog(context, intent, prefs)
            } else {
                // Sometimes the deep link changes in newer OS versions. If it fails, fallback to standard settings
                Log.w(TAG, "Autostart intent not resolvable. Admin must configure manually.")
            }
        }
    }

    private fun showAutoStartDialog(context: Context, intent: Intent, prefs: android.content.SharedPreferences) {
        AlertDialog.Builder(context)
            .setTitle("⚠️ CRITICAL INITIAL SETUP")
            .setMessage("This device uses strict battery optimizations. You MUST enable 'Autostart' for EMI Secure, otherwise the device will fail to lock upon restart.\n\nPlease tap the button below and toggle 'Autostart' to ON.")
            .setCancelable(false)
            .setPositiveButton("Enable Autostart") { dialog, _ ->
                prefs.edit().putBoolean(KEY_PROMPTED, true).apply()
                try {
                    context.startActivity(intent)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to launch Autostart intent", e)
                }
                dialog.dismiss()
            }
            .setNegativeButton("Done Already") { dialog, _ ->
                prefs.edit().putBoolean(KEY_PROMPTED, true).apply()
                dialog.dismiss()
            }
            .show()
    }

    /**
     * Returns the proprietary intent deep-link for the respective manufacturer's Autostart manager.
     */
    private fun getAutoStartIntent(manufacturer: String): Intent? {
        val intent = Intent()
        try {
            when {
                // MIUI / HyperOS
                manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco") -> {
                    intent.component = ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
                }
                // ColorOS
                manufacturer.contains("oppo") -> {
                    intent.component = ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
                }
                // Funtouch OS
                manufacturer.contains("vivo") -> {
                    intent.component = ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")
                }
                // EMUI / MagicOS
                manufacturer.contains("huawei") || manufacturer.contains("honor") -> {
                    intent.component = ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
                }
                // Letv
                manufacturer.contains("letv") -> {
                    intent.component = ComponentName("com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity")
                }
                // Asus
                manufacturer.contains("asus") -> {
                    intent.component = ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.entry.FunctionActivity")
                }
                else -> return null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error generating AutoStart intent", e)
            return null
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return intent
    }
}
