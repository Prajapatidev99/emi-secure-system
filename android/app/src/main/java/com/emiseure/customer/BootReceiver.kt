package com.emiseure.customer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import androidx.core.app.NotificationCompat

class BootReceiver : BroadcastReceiver() {

    private val TAG = "BootReceiver"

    override fun onReceive(context: Context, intent: Intent) {

        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
            action != Intent.ACTION_USER_UNLOCKED &&
            action != "android.intent.action.QUICKBOOT_POWERON"
        ) {
            return
        }

        Log.d(TAG, "Boot event received: $action")
        Log.d(TAG, "Boot timestamp: ${System.currentTimeMillis()}")

        try {
            // 🔐 CRITICAL: Use Device-Protected Storage (Direct Boot safe)
            val deviceContext = context.createDeviceProtectedStorageContext()
            val prefs = deviceContext.getSharedPreferences(
                "EMI_SECURE_PREFS",
                Context.MODE_PRIVATE
            )

            val isLocked = prefs.getBoolean("IS_LOCKED", false)
            val unlockKey = prefs.getString("UNLOCK_KEY", null)
            
            Log.d(TAG, "Local lock state after boot: $isLocked")
            Log.d(TAG, "Unlock key present: ${!unlockKey.isNullOrEmpty()}")

            // 🛡️ ANTI-TAMPERING: Persist lock state and enforce device policies
            if (isLocked) {
                // Ensure lock state is persisted (survives hard resets)
                prefs.edit().putBoolean("IS_LOCKED", true).apply()

                // BUG-03 FIX: Sync plain-text key into Keystore vault so LockScreenActivity can read it
                if (!unlockKey.isNullOrEmpty()) {
                    try {
                        val keyManager = com.emiseure.customer.utils.OfflineUnlockKeyManager(context)
                        var isStored = keyManager.getUnlockKey() != null
                        if (!isStored) {
                            // Vault is empty — populate from plain prefs
                            isStored = keyManager.storeUnlockKey(unlockKey)
                            Log.d(TAG, "Unlock key synced from plain prefs to Keystore vault on boot")
                        }
                        
                        // FIX: Remove plaintext key from prefs to avoid parallel plaintext exposure
                        if (isStored) {
                            prefs.edit().remove("UNLOCK_KEY").apply()
                            Log.d(TAG, "Plaintext unlock key cleared from preferences")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to sync key to Keystore vault on boot", e)
                    }
                }

                // BUG-22 FIX: Only record LOCKED_BOOT as suspicious (not every normal reboot)
                if (action == Intent.ACTION_LOCKED_BOOT_COMPLETED) {
                    TamperDetectionManager.recordTamperAttempt(context, "LOCKED_BOOT_WHILE_LOCKED")
                    Log.w(TAG, "🚨 Locked-boot recorded in tamper audit")
                } else {
                    Log.d(TAG, "Normal boot while locked (not recorded as tamper)")
                }
                
                // 🛡️ Re-enforce comprehensive anti-tampering protections
                TamperDetectionManager.enforceAntiTamperingLock(context)
                
                // 🔌 Enforce USB security on boot
                UsbSecurityManager.enforceUsbSecurity(context)
                
                Log.w(TAG, "Device is LOCKED → launching LockScreenActivity")
                Log.w(TAG, "Lock will be enforced WITHOUT internet connection")

                // Start foreground monitoring service FIRST (critical for lock persistence)
                try {
                    val serviceIntent = Intent(context, LockMonitorService::class.java)
                    serviceIntent.action = "START_MONITORING"
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                    Log.d(TAG, "LockMonitorService started on boot")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start LockMonitorService on boot", e)
                    // Continue anyway - lock screen is still critical
                }

                // Launch lock screen with unlock key
                try {
                    val lockIntent = Intent(context, LockScreenActivity::class.java).apply {
                        addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK or
                                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                    Intent.FLAG_ACTIVITY_NO_HISTORY
                        )
                        // Pass unlock key if available for offline unlock
                        unlockKey?.let {
                            putExtra("UNLOCK_KEY_VIA_INTENT", it)
                        }
                    }

                    context.startActivity(lockIntent)
                    Log.d(TAG, "LockScreenActivity launched successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "CRITICAL: Failed to launch LockScreenActivity from boot", e)
                    // Try again with a delay
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        try {
                            val retryIntent = Intent(context, LockScreenActivity::class.java).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            context.startActivity(retryIntent)
                            Log.d(TAG, "LockScreenActivity launched on retry")
                        } catch (retryError: Exception) {
                            Log.e(TAG, "CRITICAL: Retry failed to launch lock screen", retryError)
                        }
                    }, 2000) // 2 second delay
                }

                // Bug 9 FIX: On Android 10+, startActivity from BroadcastReceiver may be restricted.
                // Show a full-screen notification as a fallback to ensure the lock screen appears.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        showFullScreenLockNotification(context, unlockKey)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to show full-screen lock notification", e)
                    }
                }

            } else {
                // Prefs say unlocked — but verify with backend in case of factory reset
                // If prefs don't contain IS_LOCKED key at all, this might be a post-reset boot
                if (!prefs.contains("IS_LOCKED")) {
                    Log.w(TAG, "⚠️ No lock state in prefs — possible factory reset. Checking backend via IMEI...")
                    // Fire an intent to trigger PostResetReprovisionReceiver's IMEI check
                    // Or directly start a check here
                    try {
                        val intent = Intent(context, MainActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            putExtra("CHECK_IMEI_ON_BOOT", true)
                        }
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to start IMEI check activity", e)
                    }
                } else {
                    Log.d(TAG, "Device is UNLOCKED → no action required")
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "BootReceiver failed to enforce lock state", e)
            // Log stack trace for debugging
            e.printStackTrace()
        }
    }

    /**
     * 🔔 Bug 9 FIX: Show a high-priority full-screen notification that launches LockScreenActivity.
     * This serves as a fallback on Android 10+ where startActivity from a BroadcastReceiver
     * may be silently blocked. The full-screen intent bypasses the restriction.
     */
    private fun showFullScreenLockNotification(context: Context, unlockKey: String?) {
        try {
            val channelId = "lock_screen_boot_channel"

            // Create notification channel (Android 8+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    channelId,
                    "Device Lock Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Critical alerts for device lock enforcement"
                    enableVibration(true)
                    setShowBadge(true)
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                }
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.createNotificationChannel(channel)
            }

            // Build full-screen intent for LockScreenActivity
            val lockIntent = Intent(context, LockScreenActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                unlockKey?.let { putExtra("UNLOCK_KEY_VIA_INTENT", it) }
            }
            val fullScreenPendingIntent = PendingIntent.getActivity(
                context, 0, lockIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, channelId)
                .setContentTitle("⚠️ Device Locked")
                .setContentText("This device is locked. Tap to view lock screen.")
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setOngoing(true)
                .setAutoCancel(false)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setContentIntent(fullScreenPendingIntent)
                .build()

            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(8888, notification)

            Log.d(TAG, "✅ Full-screen lock notification shown (Android 10+ fallback)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show full-screen lock notification", e)
        }
    }
}
