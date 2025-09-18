package com.emiseure.customer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    private val TAG = "BootReceiver"
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_LOCKED_BOOT_COMPLETED) {
            Log.d(TAG, "Received boot action: ${intent.action}. Checking local lock status...")

            // Use device-protected storage to read the state before the user unlocks the phone
            val deviceContext = context.createDeviceProtectedStorageContext()
            val prefs = deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
            val isLocked = prefs.getBoolean("IS_LOCKED", false)

            if (isLocked) {
                Log.w(TAG, "Device state is LOCKED. Relaunching LockScreenActivity.")
                val lockIntent = Intent(context, LockScreenActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(lockIntent)
            } else {
                Log.d(TAG, "Device state is UNLOCKED. No action needed.")
            }
        }
    }
}
