package com.emiseure.customer

import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * 🔄 POST-RESET RE-PROVISIONING RECEIVER
 *
 * Detected scenarios:
 * 1. Fresh install after factory reset (no EMI_SECURE_PREFS exist)
 * 2. App reinstalled after uninstall attempt
 *
 * On factory reset:
 * - Our app's prefs are wiped (not in Direct Boot store — that's also wiped)
 * - Device Owner is revoked
 * - This receiver fires on BOOT_COMPLETED for the freshly installed APK
 *
 * Strategy:
 * - Detect "first install" state (no prefs, no lock state)
 * - Show a notification prompting re-provisioning via admin
 * - Start auto-download of the re-provision flow
 * - The backend tracks IMEI → Device still "Locked" in DB → lock enforced on next sync
 */
class PostResetReprovisionReceiver : BroadcastReceiver() {

    private val TAG = "PostResetReprovision"

    companion object {
        private const val PROVISION_CHANNEL_ID = "reprovision_channel"
        private const val PROVISION_NOTIFICATION_ID = 9001
        private const val PREF_FIRST_BOOT_HANDLED = "FIRST_BOOT_HANDLED"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) return

        Log.d(TAG, "PostResetReprovisionReceiver triggered: $action")

        try {
            // ─── Check if this is a FRESH install (factory reset scenario) ───
            // We use regular SharedPreferences here (not Device Protected)
            // because if Device Protected prefs exist, BootReceiver handles it already
            val regularPrefs = context.getSharedPreferences("EMI_REPROVISION", Context.MODE_PRIVATE)
            val firstBootHandled = regularPrefs.getBoolean(PREF_FIRST_BOOT_HANDLED, false)

            // Also check Device Protected storage for existing lock state
            val hasDeviceProtectedState = try {
                val dpContext = context.createDeviceProtectedStorageContext()
                val dpPrefs = dpContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
                dpPrefs.contains("IS_LOCKED") // If this key exists, BootReceiver will handle locking
            } catch (e: Exception) {
                false
            }

            if (hasDeviceProtectedState) {
                // BootReceiver already handles this — device was simply rebooted
                Log.d(TAG, "Device Protected state found — BootReceiver handles this boot")
                return
            }

            if (!firstBootHandled) {
                // ⚠️ FRESH INSTALL DETECTED — Factory reset likely occurred
                Log.w(TAG, "⚠️ FRESH INSTALL detected — Device may have been factory reset!")

                // Mark that we've handled this first boot
                regularPrefs.edit().putBoolean(PREF_FIRST_BOOT_HANDLED, true).apply()

                // Log tamper attempt (factory reset succeeded despite our protections)
                try {
                    TamperDetectionManager.recordTamperAttempt(context, TamperDetectionManager.TAMPER_FACTORY_RESET_ATTEMPT)
                } catch (e: Exception) {
                    Log.e(TAG, "Could not record tamper attempt", e)
                }

                // Show re-provisioning notification to push user to go back to admin
                showReprovisionNotification(context)

                // Start re-provisioning activity immediately (lock the device in UI)
                startReprovisionActivity(context)

            } else {
                Log.d(TAG, "Not a fresh install — normal boot handled by BootReceiver")
            }

        } catch (e: Exception) {
            Log.e(TAG, "PostResetReprovisionReceiver error", e)
        }
    }

    /**
     * 🔴 Show a persistent notification that admin must re-provision this device.
     * The user CANNOT unlock it without the admin re-setting it up as Device Owner.
     */
    private fun showReprovisionNotification(context: Context) {
        try {
            createNotificationChannel(context)

            // Intent to open MainActivity (which will trigger server sync → lock if needed)
            val openIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, PROVISION_CHANNEL_ID)
                .setContentTitle("⚠️ Device Security Alert")
                .setContentText("This device requires re-authorization. Contact your EMI provider.")
                .setStyle(NotificationCompat.BigTextStyle()
                    .bigText(
                        "This device was reset. EMI Secure cannot protect it without re-authorization.\n\n" +
                        "📞 Contact your EMI provider immediately to re-activate device lock.\n\n" +
                        "🚨 This device is being tracked."
                    )
                )
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setOngoing(true)          // Cannot be dismissed by user
                .setAutoCancel(false)
                .setContentIntent(pendingIntent)
                .build()

            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(PROVISION_NOTIFICATION_ID, notification)

            Log.d(TAG, "✅ Re-provision notification shown")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show re-provision notification", e)
        }
    }

    private fun startReprovisionActivity(context: Context) {
        try {
            // Launch MainActivity — it will call fetchDeviceStatus() which will:
            // 1. Hit the backend with this device's Android ID
            // 2. Backend responds with deviceStatus = "Locked"
            // 3. MainActivity launches LockScreenActivity immediately
            // Even without Device Owner, the UI lock is enforced
            val intent = Intent(context, MainActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_NO_HISTORY
                )
                putExtra("FROM_REPROVISION", true)
            }
            context.startActivity(intent)
            Log.d(TAG, "✅ Re-provision activity started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start re-provision activity", e)
        }
    }

    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                PROVISION_CHANNEL_ID,
                "Device Security Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Critical alerts when device protection is compromised"
                enableVibration(true)
                setShowBadge(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }
}
