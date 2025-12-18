package com.emiseure.customer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
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

        try {
            // 🔐 CRITICAL: Use Device-Protected Storage (Direct Boot safe)
            val deviceContext = context.createDeviceProtectedStorageContext()
            val prefs = deviceContext.getSharedPreferences(
                "EMI_SECURE_PREFS",
                Context.MODE_PRIVATE
            )

            val isLocked = prefs.getBoolean("IS_LOCKED", false)
            Log.d(TAG, "Local lock state after boot: $isLocked")

            if (isLocked) {
                Log.w(TAG, "Device is LOCKED → launching LockScreenActivity")

                val lockIntent = Intent(context, LockScreenActivity::class.java).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                                Intent.FLAG_ACTIVITY_CLEAR_TOP
                    )
                }

                context.startActivity(lockIntent)

            } else {
                Log.d(TAG, "Device is UNLOCKED → no action required")
            }

        } catch (e: Exception) {
            Log.e(TAG, "BootReceiver failed to enforce lock state", e)
        }
    }
}
