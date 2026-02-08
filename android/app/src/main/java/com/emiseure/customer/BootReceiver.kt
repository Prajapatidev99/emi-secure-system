package com.emiseure.customer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    private val TAG = "BootReceiver"

    override fun onReceive(context: Context, intent: Intent) {

        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED
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

            if (isLocked) {
                Log.w(TAG, "Device is LOCKED → launching LockScreenActivity")
                Log.w(TAG, "Lock will be enforced WITHOUT internet connection")

                // Start foreground monitoring service FIRST (critical for lock persistence)
                try {
                    val serviceIntent = Intent(context, LockMonitorService::class.java)
                    serviceIntent.putExtra("action", "START_MONITORING")
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

            } else {
                Log.d(TAG, "Device is UNLOCKED → no action required")
            }

        } catch (e: Exception) {
            Log.e(TAG, "BootReceiver failed to enforce lock state", e)
            // Log stack trace for debugging
            e.printStackTrace()
        }
    }
}
