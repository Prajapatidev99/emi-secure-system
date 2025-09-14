package com.emiseure.customer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    private val TAG = "BootReceiver"
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d(TAG, "Device has booted. Checking local lock status...")
            
            // Check the locally saved lock state instead of making a network call
            val prefs = context.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
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
