package com.emiseure.customer

import android.app.AlertDialog
import android.app.admin.DevicePolicyManager
import android.content.*
import android.os.*
import android.os.UserManager
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.emiseure.customer.databinding.ActivityLockScreenBinding
import java.util.Locale

class LockScreenActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLockScreenBinding

    // Security
    private lateinit var dpm: DevicePolicyManager
    private lateinit var adminComponent: ComponentName

    // Offline unlock
    private var offlineUnlockKey: String? = null
    private var iconClickCount = 0
    private val handler = Handler(Looper.getMainLooper())
    private var resetClickRunnable: Runnable? = null
    
    // Track receiver registration state
    private var isReceiverRegistered = false
    private var isInLockTaskMode = false

    // Unlock broadcast
    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.emiseure.customer.ACTION_UNLOCK") {
                Log.d("LockScreen", "Unlock broadcast received")
                safeStopLockTask()
                finishAndRemoveTask()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            // 🛡️ PRIVACY SHIELD: Block screenshots and screen recording
            window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)

            binding = ActivityLockScreenBinding.inflate(layoutInflater)
            setContentView(binding.root)

            // ---- FULL SCREEN + SHOW OVER LOCK ----
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true)
                setTurnScreenOn(true)
            } else {
                @Suppress("DEPRECATION")
                window.addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                )
            }

            // ---- DEVICE POLICY ----
            dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            adminComponent = ComponentName(this, MyDeviceAdminReceiver::class.java)

            // ---- REGISTER UNLOCK RECEIVER (API SAFE) ----
            try {
                val filter = IntentFilter("com.emiseure.customer.ACTION_UNLOCK")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    registerReceiver(unlockReceiver, filter, RECEIVER_NOT_EXPORTED)
                } else {
                    registerReceiver(unlockReceiver, filter)
                }
                isReceiverRegistered = true
                Log.d("LockScreen", "Unlock receiver registered")
            } catch (e: Exception) {
                Log.e("LockScreen", "Failed to register receiver", e)
            }

            // ---- APPLY DEVICE OWNER RESTRICTIONS & ANTI-TAMPERING ----
            if (dpm.isDeviceOwnerApp(packageName)) {
                try {
                    dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_USB_FILE_TRANSFER)
                    // 🛡️ Enforce comprehensive anti-tampering protections
                    TamperDetectionManager.enforceAntiTamperingLock(this)
                    safeStartLockTask()
                } catch (e: Exception) {
                    Log.e("LockScreen", "Failed to apply restrictions", e)
                }
            }

            // ---- LOAD OFFLINE KEY (DIRECT BOOT SAFE) ----
            try {
                val deviceContext = createDeviceProtectedStorageContext()
                val prefs = deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

                val keyFromIntent = intent.getStringExtra("UNLOCK_KEY_VIA_INTENT")
                offlineUnlockKey = if (!keyFromIntent.isNullOrEmpty()) {
                    prefs.edit().putString("UNLOCK_KEY", keyFromIntent).apply()
                    keyFromIntent
                } else {
                    prefs.getString("UNLOCK_KEY", null)
                }
            } catch (e: Exception) {
                Log.e("LockScreen", "Failed to load unlock key", e)
            }

            setupHiddenUnlock()
            
        } catch (e: Exception) {
            Log.e("LockScreen", "Critical error in onCreate", e)
            // Don't crash, just log and continue
        }
    }

    // ===============================
    // 🔐 SAFE LOCK TASK OPERATIONS
    // ===============================
    private fun safeStartLockTask() {
        try {
            if (!isInLockTaskMode) {
                startLockTask()
                isInLockTaskMode = true
                Log.d("LockScreen", "Lock task mode started")
            }
        } catch (e: IllegalStateException) {
            Log.e("LockScreen", "Failed to start lock task mode", e)
        } catch (e: Exception) {
            Log.e("LockScreen", "Unexpected error starting lock task", e)
        }
    }

    private fun safeStopLockTask() {
        try {
            if (isInLockTaskMode) {
                stopLockTask()
                isInLockTaskMode = false
                Log.d("LockScreen", "Lock task mode stopped")
            }
        } catch (e: IllegalStateException) {
            Log.e("LockScreen", "Failed to stop lock task mode", e)
        } catch (e: Exception) {
            Log.e("LockScreen", "Unexpected error stopping lock task", e)
        }
    }

    // ===============================
    // 🔐 HIDDEN OFFLINE UNLOCK SYSTEM
    // ===============================
    private fun setupHiddenUnlock() {
        try {
            // 5-tap trigger
            binding.lockIcon.setOnClickListener {
                iconClickCount++

                resetClickRunnable?.let { handler.removeCallbacks(it) }
                resetClickRunnable = Runnable { iconClickCount = 0 }
                handler.postDelayed(resetClickRunnable!!, 2000)

                if (iconClickCount >= 5) {
                    showOfflineUnlockDialog()
                    iconClickCount = 0
                }
            }
        } catch (e: Exception) {
            Log.e("LockScreen", "Failed to setup hidden unlock", e)
        }
    }

    private fun showOfflineUnlockDialog() {
        try {
            val input = EditText(this).apply {
                hint = "Enter Emergency Key"
            }

            AlertDialog.Builder(this)
                .setTitle("Offline Emergency Unlock")
                .setView(input)
                .setCancelable(false)
                .setPositiveButton("Verify") { _, _ ->
                    try {
                        val entered = input.text.toString().trim().uppercase(Locale.ROOT)
                        val stored = offlineUnlockKey

                        if (!stored.isNullOrEmpty() && entered == stored) {
                            val prefs = createDeviceProtectedStorageContext()
                                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

                            prefs.edit().putBoolean("IS_LOCKED", false).commit()

                            if (dpm.isDeviceOwnerApp(packageName)) {
                                try {
                                    dpm.clearUserRestriction(
                                        adminComponent,
                                        UserManager.DISALLOW_USB_FILE_TRANSFER
                                    )
                                } catch (e: Exception) {
                                    Log.e("LockScreen", "Failed to clear USB restriction", e)
                                }
                            }

                            safeStopLockTask()
                            sendBroadcast(Intent("com.emiseure.customer.ACTION_UNLOCK"))
                            finishAndRemoveTask()
                        } else {
                            Toast.makeText(this, "Invalid Key", Toast.LENGTH_SHORT).show()
                            Log.e("LockScreen", "Offline unlock failed")
                        }
                    } catch (e: Exception) {
                        Log.e("LockScreen", "Error during unlock verification", e)
                        Toast.makeText(this, "Unlock failed", Toast.LENGTH_SHORT).show()
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        } catch (e: Exception) {
            Log.e("LockScreen", "Failed to show unlock dialog", e)
        }
    }

    // ---- HARD BLOCK BACK BUTTON ----
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Disabled intentionally
    }

    override fun onDestroy() {
        super.onDestroy()
        
        // Safe receiver unregistration
        try {
            if (isReceiverRegistered) {
                unregisterReceiver(unlockReceiver)
                isReceiverRegistered = false
                Log.d("LockScreen", "Unlock receiver unregistered")
            }
        } catch (e: Exception) {
            Log.e("LockScreen", "Error unregistering receiver", e)
        }
        
        safeStopLockTask()
    }
}
