package com.emiseure.customer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.emiseure.customer.databinding.ActivityLockScreenBinding
import java.util.Locale

class LockScreenActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLockScreenBinding
    private var iconClickCount = 0
    private val handler = Handler(Looper.getMainLooper())
    private var resetClickCountRunnable: Runnable? = null


    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.emiseure.customer.ACTION_UNLOCK") {
                // CRITICAL FIX: The activity must be taken out of Kiosk Mode (Lock Task)
                // before it can be programmatically closed.
                stopLockTask()
                finishAndRemoveTask()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLockScreenBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Make the activity full-screen and show over the lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                        or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                        or WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
        
        val filter = IntentFilter("com.emiseure.customer.ACTION_UNLOCK")
        // FIX: Use RECEIVER_NOT_EXPORTED for better security, as this broadcast is internal to the app.
        registerReceiver(unlockReceiver, filter, RECEIVER_NOT_EXPORTED)

        setupOfflineUnlock()

        startLockTask()
    }

    private fun setupOfflineUnlock() {
        binding.lockIcon.setOnClickListener {
            iconClickCount++

            // If a reset timer is already running, cancel it
            resetClickCountRunnable?.let { handler.removeCallbacks(it) }

            // Start a new timer to reset the click count after 2 seconds
            resetClickCountRunnable = Runnable {
                iconClickCount = 0
            }
            handler.postDelayed(resetClickCountRunnable!!, 2000)

            if (iconClickCount >= 5) {
                binding.keypadContainer.visibility = View.VISIBLE
                binding.mainContent.visibility = View.GONE
                iconClickCount = 0 // Reset after showing
            }
        }

        binding.keypadSubmitButton.setOnClickListener {
            val enteredKey = binding.keypadInput.text.toString().trim().uppercase(Locale.ROOT)
            val deviceContext = createDeviceProtectedStorageContext()
            val prefs = deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
            val correctKey = prefs.getString("UNLOCK_KEY", null)

            // Enhanced check for debugging
            if (correctKey.isNullOrEmpty()) {
                Toast.makeText(this, "Error: Key not synced. Please connect to internet and reopen main app screen.", Toast.LENGTH_LONG).show()
                val prefsContents = prefs.all.toString()
                Log.e("LockScreen", "Unlock key is null or empty. Current Prefs: $prefsContents")
            } else if (enteredKey == correctKey) {
                Toast.makeText(this, "Device Unlocked!", Toast.LENGTH_SHORT).show()
                // Set lock state to false and send broadcast to fully unlock
                prefs.edit().putBoolean("IS_LOCKED", false).commit()
                sendBroadcast(Intent("com.emiseure.customer.ACTION_UNLOCK"))
            } else {
                val debugMessage = "Incorrect Key. App expects: $correctKey"
                Toast.makeText(this, debugMessage, Toast.LENGTH_LONG).show()
                binding.keypadInput.text.clear()
            }
        }

        binding.keypadCancelButton.setOnClickListener {
            binding.keypadContainer.visibility = View.GONE
            binding.mainContent.visibility = View.VISIBLE
            binding.keypadInput.text.clear()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(unlockReceiver)
        stopLockTask()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Do nothing. The user is locked in.
    }
}
