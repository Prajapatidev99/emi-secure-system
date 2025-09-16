package com.emiseure.customer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.emiseure.customer.databinding.ActivityLockScreenBinding

class LockScreenActivity : AppCompatActivity() {

    // This binding object is the key to accessing UI elements.
    private lateinit var binding: ActivityLockScreenBinding

    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.emiseure.customer.ACTION_UNLOCK") {
                unlockDevice()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Inflate the layout using the binding object
        binding = ActivityLockScreenBinding.inflate(layoutInflater)
        // Set the content view to the root of the binding
        setContentView(binding.root)

        startLockTask()

        val intentFilter = IntentFilter("com.emiseure.customer.ACTION_UNLOCK")
        // Use the modern, safer way to register the receiver
        ContextCompat.registerReceiver(this, unlockReceiver, intentFilter, ContextCompat.RECEIVER_NOT_EXPORTED)


        // --- THIS IS THE DEFINITIVE FIX ---
        // All UI elements are now accessed via `binding.`
        binding.unlockButton.setOnClickListener {
            val enteredKey = binding.unlockKeyInput.text.toString().trim()
            val savedKey = getUnlockKey()

            if (savedKey == null) {
                Toast.makeText(this, "Error: No offline key found for this device.", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            
            // Perform a case-insensitive comparison
            if (enteredKey.isNotEmpty() && enteredKey.equals(savedKey, ignoreCase = true)) {
                unlockDevice()
            } else {
                Toast.makeText(this, "Incorrect key. Please try again.", Toast.LENGTH_SHORT).show()
                binding.unlockKeyInput.error = "Incorrect key"
            }
        }
    }

    private fun getUnlockKey(): String? {
        // Use device-protected storage for security
        val deviceContext = createDeviceProtectedStorageContext()
        val prefs = deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
        return prefs.getString("UNLOCK_KEY", null)
    }

    private fun unlockDevice() {
        Toast.makeText(this, "Device Unlocked!", Toast.LENGTH_SHORT).show()
        // Correctly exit kiosk mode before finishing the activity
        stopLockTask()
        finishAndRemoveTask()
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(unlockReceiver)
    }

    override fun onBackPressed() {
        // Explicitly disable the back button to prevent escaping the lock screen
        Toast.makeText(this, "This action is disabled.", Toast.LENGTH_SHORT).show()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus) {
            // Close system dialogs (like the notification shade) if the window loses focus
            val closeDialogs = Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS)
            sendBroadcast(closeDialogs)
        }
    }

    @Suppress("DEPRECATION")
    override fun onResume() {
        super.onResume()
        // Enforce immersive fullscreen mode
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            val controller = window.insetsController
            controller?.hide(android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars())
            controller?.systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else {
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN)
        }
    }
}
