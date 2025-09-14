package com.emiseure.customer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity

class LockScreenActivity : AppCompatActivity() {

    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == ACTION_UNLOCK) {
                finish()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_lock_screen)

        // Make the activity full-screen and show over the lock screen
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )

        // Register the broadcast receiver to listen for unlock commands
        registerReceiver(unlockReceiver, IntentFilter(ACTION_UNLOCK), RECEIVER_EXPORTED)
    }

    override fun onDestroy() {
        super.onDestroy()
        // Unregister the receiver to avoid memory leaks
        unregisterReceiver(unlockReceiver)
    }

    // Override the back button to do nothing, trapping the user on this screen.
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Do nothing. The user cannot go back.
    }

    companion object {
        const val ACTION_UNLOCK = "com.emiseure.customer.UNLOCK_DEVICE"
    }
}
