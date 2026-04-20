package com.emiseure.customer

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.UserManager
import android.util.Log
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    private val TAG = "FCM_Service"

    // ------------------------------
    // 🔐 DIRECT BOOT SAFE STORAGE
    // ------------------------------
    private fun getSecurePrefs(context: Context) =
        context.createDeviceProtectedStorageContext()
            .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

    private fun saveLockState(context: Context, locked: Boolean) {
        getSecurePrefs(context)
            .edit()
            .putBoolean("IS_LOCKED", locked)
            .commit() // MUST be sync (reboot safety)
        Log.d(TAG, "IS_LOCKED saved as $locked")
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        if (data.isEmpty()) return

        val action = data["action"]
        val unlockKey = data["unlock_key"] // Server-synced offline key

        Log.d(TAG, "FCM received → action=$action")

        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(this, MyDeviceAdminReceiver::class.java)

        val isAuthorized =
            dpm.isDeviceOwnerApp(packageName) || dpm.isAdminActive(adminComponent)

        if (!isAuthorized) {
            Log.e(TAG, "Command ignored. App is not Device Owner / Admin.")
            return
        }

        val prefs = getSecurePrefs(this)

        // ------------------------------------
        // 🔑 UPDATE OFFLINE MASTER KEY (IF ANY)
        // ------------------------------------
        unlockKey?.let {
            prefs.edit().putString("UNLOCK_KEY", it).commit()
            Log.d(TAG, "Offline unlock key updated from server")
        }

        // ------------------------------
        // 🚨 COMMAND HANDLER
        // ------------------------------
        when (action) {

            "LOCK" -> {
                Log.w(TAG, "LOCK command received")

                saveLockState(this, true)

                // Start foreground monitoring service
                try {
                    val serviceIntent = Intent(this, LockMonitorService::class.java)
                    serviceIntent.putExtra("action", "START_MONITORING")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(serviceIntent)
                    } else {
                        startService(serviceIntent)
                    }
                    Log.d(TAG, "LockMonitorService started")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start LockMonitorService", e)
                }

                try {
                    val lockIntent = Intent(this, LockScreenActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        putExtra("UNLOCK_KEY_VIA_INTENT", unlockKey)
                    }
                    startActivity(lockIntent)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to launch LockScreenActivity from FCM", e)
                }
            }

            "UNLOCK" -> {
                Log.i(TAG, "UNLOCK command received")

                saveLockState(this, false)

                // Stop monitoring service
                try {
                    val serviceIntent = Intent(this, LockMonitorService::class.java)
                    serviceIntent.putExtra("action", "STOP_MONITORING")
                    startService(serviceIntent)
                    Log.d(TAG, "LockMonitorService stop requested")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to stop LockMonitorService", e)
                }

                sendBroadcast(
                    Intent("com.emiseure.customer.ACTION_UNLOCK")
                )
            }

            "REMINDER", "WARNING" -> {
                Log.i(TAG, "Notification ($action) received: ${data["message"]}")
                val messageText = data["message"] ?: "Please check your EMI payment status."
                showNotification(this, action, messageText)
            }

            "WIPE" -> {
                Log.e(TAG, "WIPE command received")

                if (dpm.isDeviceOwnerApp(packageName)) {
                    try {
                        dpm.wipeData(0)
                    } catch (e: SecurityException) {
                        Log.e(TAG, "Device wipe failed", e)
                    }
                } else {
                    Log.e(TAG, "WIPE denied. Not device owner.")
                }
            }

            "RELEASE_OWNERSHIP" -> {
                Log.i(TAG, "RELEASE_OWNERSHIP command received")

                if (dpm.isDeviceOwnerApp(packageName)) {
                    try {
                        // 1. Disable USB Debugging (Security)
                        try {
                            dpm.setGlobalSetting(
                                adminComponent,
                                android.provider.Settings.Global.ADB_ENABLED,
                                "0"
                            )
                            Log.d(TAG, "USB Debugging disabled")
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to disable ADB", e)
                        }

                        // 2. Clear all user restrictions
                        try {
                            dpm.clearUserRestriction(adminComponent,        UserManager.DISALLOW_FACTORY_RESET)
                            dpm.clearUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT)
                            dpm.clearUserRestriction(adminComponent, UserManager.DISALLOW_USB_FILE_TRANSFER)
                            dpm.clearUserRestriction(adminComponent, UserManager.DISALLOW_UNINSTALL_APPS)
                            dpm.clearUserRestriction(adminComponent, UserManager.DISALLOW_MODIFY_ACCOUNTS)
                            Log.d(TAG, "All user restrictions cleared")
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to clear restrictions", e)
                        }

                        // 3. Unblock app uninstallation
                        try {
                            dpm.setUninstallBlocked(adminComponent, packageName, false)
                            Log.d(TAG, "App uninstall unblocked")
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to unblock uninstall", e)
                        }

                        // 4. Clear device owner
                        try {
                            dpm.clearDeviceOwnerApp(packageName)
                            Log.i(TAG, "Device owner cleared - Device is now fully released")
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to clear device owner", e)
                        }

                        // 5. Clear lock state
                        saveLockState(this, false)

                    } catch (e: Exception) {
                        Log.e(TAG, "Error during device release", e)
                    }
                } else {
                    Log.w(TAG, "RELEASE_OWNERSHIP ignored. Not device owner.")
                }
            }

            else -> {
                Log.w(TAG, "Unknown action: $action")
            }
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token: $token")
        // Send token to your server here
    }

    private fun showNotification(context: Context, type: String, message: String) {
        val channelId = "billing_alerts"
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Billing Alerts",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

        val title = if (type == "WARNING") "Urgent: Device Lock Warning" else "EMI Payment Reminder"
        
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        
        val pendingIntent: PendingIntent = PendingIntent.getActivity(
            context, 0, intent, PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        // Make warning sticky
        if (type == "WARNING") {
            builder.setOngoing(true)
            builder.color = android.graphics.Color.RED
        }

        notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
    }
}
