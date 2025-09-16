package com.emiseure.customer

import android.app.admin.DevicePolicyManager
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

    private lateinit var binding: ActivityLockScreenBinding
    
    // Receiver to handle the unlock command from the FCM service
    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.emiseure.customer.ACTION_UNLOCK") {
                unlockDevice()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLockScreenBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Enter kiosk mode (Lock Task Mode)
        startLockTask()

        // Register the unlock receiver
        val intentFilter = IntentFilter("com.emiseure.customer.ACTION_UNLOCK")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.registerReceiver(this, unlockReceiver, intentFilter, ContextCompat.RECEIVER_NOT_EXPORTED)
        } else {
            // For older versions, the flag isn't available, but the behavior is similar for manifest-declared receivers.
            // For code-registered ones, this is the standard way.
            registerReceiver(unlockReceiver, intentFilter)
        }


        binding.unlockButton.setOnClickListener {
            val enteredKey = binding.unlockKeyInput.text.toString().trim()
            val savedKey = getUnlockKey()

            if (savedKey == null) {
                Toast.makeText(this, "Error: No offline key found for this device.", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            
            // --- CRITICAL FIX: Make the key comparison case-insensitive ---
            // The key from the server is uppercase, but the user might type it in lowercase.
            if (enteredKey.isNotEmpty() && enteredKey.equals(savedKey, ignoreCase = true)) {
                // Correct key entered
                unlockDevice()
            } else {
                // Incorrect key
                Toast.makeText(this, "Incorrect key. Please try again.", Toast.LENGTH_SHORT).show()
                binding.unlockKeyInput.error = "Incorrect key"
            }
        }
    }

    private fun getUnlockKey(): String? {
        // Since this activity might run before the user unlocks the phone after a reboot,
        // we MUST read from device-protected storage.
        val deviceContext = createDeviceProtectedStorageContext()
        val prefs = deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
        return prefs.getString("UNLOCK_KEY", null)
    }

    private fun unlockDevice() {
        Toast.makeText(this, "Device Unlocked!", Toast.LENGTH_SHORT).show()
        // It's crucial to exit kiosk mode BEFORE trying to close the activity.
        stopLockTask()
        // finishAndRemoveTask() is a more definitive way to close the activity
        // and remove it from the recent tasks list.
        finishAndRemoveTask()
    }

    override fun onDestroy() {
        super.onDestroy()
        // Unregister the receiver to prevent memory leaks
        unregisterReceiver(unlockReceiver)
    }
    
    // --- Kiosk Mode Management ---
    // Prevent the user from leaving the app
    override fun onBackPressed() {
        // By overriding this method and doing nothing, we disable the back button.
        // You could optionally show a Toast message.
        Toast.makeText(this, "This action is disabled.", Toast.LENGTH_SHORT).show()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus) {
            // This attempts to close system dialogs (like the power menu)
            // that might take focus away from the app.
            val closeDialogs = Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS)
            sendBroadcast(closeDialogs)
        }
    }

    // Hide navigation bar and status bar for a more immersive lock screen
    @Suppress("DEPRECATION")
    override fun onResume() {
        super.onResume()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            val controller = window.insetsController
            if (controller != null) {
                controller.hide(android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
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
