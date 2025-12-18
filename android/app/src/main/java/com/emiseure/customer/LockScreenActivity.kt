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

    // Unlock broadcast
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

        // ---- REGISTER UNLOCK RECEIVER ----
        registerReceiver(
            unlockReceiver,
            IntentFilter("com.emiseure.customer.ACTION_UNLOCK"),
            RECEIVER_NOT_EXPORTED
        )

        // ---- APPLY DEVICE OWNER RESTRICTIONS ----
        if (dpm.isDeviceOwnerApp(packageName)) {
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_USB_FILE_TRANSFER)
            startLockTask() // Full kiosk
        }

        // ---- LOAD OFFLINE KEY (DIRECT BOOT SAFE) ----
        val deviceContext = createDeviceProtectedStorageContext()
        val prefs = deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

        val keyFromIntent = intent.getStringExtra("UNLOCK_KEY_VIA_INTENT")
        offlineUnlockKey = if (!keyFromIntent.isNullOrEmpty()) {
            prefs.edit().putString("UNLOCK_KEY", keyFromIntent).apply()
            keyFromIntent
        } else {
            prefs.getString("UNLOCK_KEY", null)
        }

        setupHiddenUnlock()
    }

    // ===============================
    // 🔐 HIDDEN OFFLINE UNLOCK SYSTEM
    // ===============================
    private fun setupHiddenUnlock() {

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
    }

    private fun showOfflineUnlockDialog() {
        val input = EditText(this).apply {
            hint = "Enter Emergency Key"
        }

        AlertDialog.Builder(this)
            .setTitle("Offline Emergency Unlock")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Verify") { _, _ ->
                val entered = input.text.toString().trim().uppercase(Locale.ROOT)
                val stored = offlineUnlockKey

                if (!stored.isNullOrEmpty() && entered == stored) {
                    val prefs = createDeviceProtectedStorageContext()
                        .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

                    prefs.edit().putBoolean("IS_LOCKED", false).commit()

                    if (dpm.isDeviceOwnerApp(packageName)) {
                        dpm.clearUserRestriction(
                            adminComponent,
                            UserManager.DISALLOW_USB_FILE_TRANSFER
                        )
                    }

                    stopLockTask()
                    sendBroadcast(Intent("com.emiseure.customer.ACTION_UNLOCK"))
                } else {
                    Toast.makeText(this, "Invalid Key", Toast.LENGTH_SHORT).show()
                    Log.e("LockScreen", "Offline unlock failed")
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ---- HARD BLOCK BACK BUTTON ----
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Disabled intentionally
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(unlockReceiver)
        stopLockTask()
    }
}
