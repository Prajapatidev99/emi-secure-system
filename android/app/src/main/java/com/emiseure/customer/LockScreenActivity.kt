package com.emiseure.customer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.emiseure.customer.databinding.ActivityLockScreenBinding
import java.util.Locale

class LockScreenActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLockScreenBinding
    private var offlineUnlockKey: String? = null
    private var iconClickCount = 0
    private val handler = Handler(Looper.getMainLooper())
    private var resetClickCountRunnable: Runnable? = null

    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.emiseure.customer.ACTION_UNLOCK") {
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
        registerReceiver(unlockReceiver, filter, RECEIVER_NOT_EXPORTED)

        // --- DEFINITIVE FIX for "Key not synced" error ---
        // This logic robustly retrieves the unlock key, prioritizing the one passed
        // directly from MainActivity to avoid any file-system race conditions.
        val keyFromIntent = intent.getStringExtra("UNLOCK_KEY_VIA_INTENT")
        val deviceContext = createDeviceProtectedStorageContext()
        val prefs = deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

        if (!keyFromIntent.isNullOrEmpty()) {
            // Path 1: Key was passed directly. This is the most reliable path.
            Log.d("LockScreen", "Received unlock key directly via Intent. Saving it for future use.")
            offlineUnlockKey = keyFromIntent
            // Also save it to make sure it's available for future reboots.
            prefs.edit().putString("UNLOCK_KEY", offlineUnlockKey).apply() // Can be async here
        } else {
            // Path 2: Launched from reboot or FCM. Rely on previously saved storage.
            Log.d("LockScreen", "No key in Intent, reading from device-protected storage.")
            offlineUnlockKey = prefs.getString("UNLOCK_KEY", null)
        }

        setupOfflineUnlock()
        startLockTask()
    }

    private fun setupOfflineUnlock() {
        binding.lockIcon.setOnClickListener {
            iconClickCount++
            resetClickCountRunnable?.let { handler.removeCallbacks(it) }
            resetClickCountRunnable = Runnable { iconClickCount = 0 }
            handler.postDelayed(resetClickCountRunnable!!, 2000)

            if (iconClickCount >= 5) {
                binding.keypadContainer.visibility = View.VISIBLE
                binding.mainContent.visibility = View.GONE
                iconClickCount = 0
            }
        }

        binding.keypadSubmitButton.setOnClickListener {
            val enteredKey = binding.keypadInput.text.toString().trim().uppercase(Locale.ROOT)
            val correctKey = offlineUnlockKey

            if (correctKey.isNullOrEmpty()) {
                Toast.makeText(this, "Error: Key not synced. Connect to internet and reopen main app.", Toast.LENGTH_LONG).show()
                val prefs = createDeviceProtectedStorageContext().getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
                val prefsContents = prefs.all.toString()
                Log.e("LockScreen", "Unlock key is null or empty. This can happen if the app was locked via reboot/FCM before a successful sync. Current Prefs: $prefsContents")
            } else if (enteredKey == correctKey) {
                Toast.makeText(this, "Device Unlocked!", Toast.LENGTH_SHORT).show()
                // Save unlock state and send broadcast to finish this activity
                val prefs = createDeviceProtectedStorageContext().getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
                prefs.edit().putBoolean("IS_LOCKED", false).commit()
                sendBroadcast(Intent("com.emiseure.customer.ACTION_UNLOCK"))
            } else {
                Toast.makeText(this, "Incorrect Key.", Toast.LENGTH_LONG).show()
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
