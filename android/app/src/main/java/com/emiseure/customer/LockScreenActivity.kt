package com.emiseure.customer

import android.app.AlertDialog
import android.app.admin.DevicePolicyManager
import android.content.*
import android.os.*
import android.os.UserManager
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.content.res.Configuration
import android.util.DisplayMetrics
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.emiseure.customer.databinding.ActivityLockScreenBinding
import com.emiseure.customer.utils.OfflineUnlockKeyManager
import android.annotation.SuppressLint

class LockScreenActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLockScreenBinding

    // Security
    private lateinit var dpm: DevicePolicyManager
    private lateinit var adminComponent: ComponentName

    // 🔐 NEW: Encrypted offline unlock with rate limiting
    private lateinit var keyManager: OfflineUnlockKeyManager
    
    // Offline unlock
    private var offlineUnlockKey: String? = null
    private var iconClickCount = 0
    private val handler = Handler(Looper.getMainLooper())
    private var resetClickRunnable: Runnable? = null
    
    // Track receiver registration state
    private var isReceiverRegistered = false
    private var isInLockTaskMode = false

    // 🔐 Lazy context and prefs for Direct Boot safety
    private val deviceContext by lazy { createDeviceProtectedStorageContext() }
    private val prefs by lazy { deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE) }

    // Unlock broadcast
    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.emiseure.customer.ACTION_UNLOCK") {
                Log.d("LockScreen", "Unlock broadcast received")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && dpm.isDeviceOwnerApp(packageName)) {
                    dpm.setStatusBarDisabled(adminComponent, false)
                }
                safeStopLockTask()
                finishAndRemoveTask()
            }
        }
    }

    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            binding = ActivityLockScreenBinding.inflate(layoutInflater)
            setContentView(binding.root)

            // Force background color in code as fallback
            binding.root.setBackgroundColor(androidx.core.content.ContextCompat.getColor(this, R.color.brand_primary_dark))

            // 🛡️ PRIVACY SHIELD: Block screenshots and screen recording
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
            
            // 🔒 FULLSCREEN & SYSTEM UI BLOCKING
            hideSystemUI()

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
                    registerReceiver(unlockReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
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
                    // 🛡️ Pro-level status bar block (Device Owner only)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        dpm.setStatusBarDisabled(adminComponent, true)
                    }
                    // 🛡️ Enforce comprehensive anti-tampering protections
                    TamperDetectionManager.enforceAntiTamperingLock(this)
                    safeStartLockTask()
                } catch (e: Exception) {
                    Log.e("LockScreen", "Failed to apply restrictions", e)
                }
            }

            // ---- LOAD OFFLINE KEY (DIRECT BOOT SAFE + ENCRYPTED) ----
                // 1. Check for stored hash (Direct Boot Safe & Recommended)
                val storedHash = prefs.getString("UNLOCK_KEY_HASH", null)
                
                // 2. Fallback to older methods for migration
                if (storedHash.isNullOrEmpty()) {
                    // Try to get plain key and migrate to hash
                    val legacyKey = prefs.getString("UNLOCK_KEY", null)
                    if (!legacyKey.isNullOrEmpty()) {
                        val computedHash = hashKey(legacyKey)
                        prefs.edit().putString("UNLOCK_KEY_HASH", computedHash).apply()
                        Log.d("LockScreen", "Migrated legacy key to hash for Direct Boot safety")
                    }
                }
                
                Log.d("LockScreen", "✅ Lock verification system ready (Hash present: ${!prefs.getString("UNLOCK_KEY_HASH", null).isNullOrEmpty()})")
            } catch (e: Exception) {
                Log.e("LockScreen", "Failed to setup lock verification", e)
            }

            setupHiddenUnlock()
            
            // 📞 SETUP DYNAMIC SUPPORT CALL
            setupSupportCall()
            
            // 🌐 SETUP LANGUAGE SWITCHER
            setupLanguageSwitcher()
            
            // 🔐 ENABLE PERSISTENCE (STICKINESS)
            LockScreenPersistenceHelper.enableStickiness(this)
            
            // 🔒 BLOCK NOTIFICATION DRAWER / STATUS BAR EXPANSION
            startDrawerBlocker()
            
        } catch (e: Exception) {
            Log.e("LockScreen", "Critical error in onCreate", e)
        }
    }

    private fun setupSupportCall() {
        val supportPhone = prefs.getString("SUPPORT_PHONE", "")
        val supportName = prefs.getString("SUPPORT_NAME", "Retailer")
        
        if (!supportPhone.isNullOrEmpty()) {
            binding.callSupportButton.visibility = android.view.View.VISIBLE
            binding.callSupportButton.text = "Call $supportName"
            
            binding.callSupportButton.setOnClickListener {
                try {
                    val intent = Intent(Intent.ACTION_DIAL).apply {
                        data = Uri.parse("tel:$supportPhone")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    Log.e("LockScreen", "Failed to start dialer", e)
                }
            }
        }
    }

    private fun setupLanguageSwitcher() {
        // 🔒 HIDDEN TRICK: Long click on lock icon
        binding.lockIcon.setOnLongClickListener {
            showLanguageDialog()
            true
        }
        
        // 🛡️ NEW VISIBLE WAY: Button at bottom
        binding.changeLanguageButton.setOnClickListener {
            showLanguageDialog()
        }
    }

    private fun showLanguageDialog() {
        val languages = arrayOf("English", "हिंदी", "ગુજરાતી")
        val codes = arrayOf("en", "hi", "gu")
        
        AlertDialog.Builder(this)
            .setTitle(R.string.select_language)
            .setItems(languages) { _, which ->
                updateLocale(codes[which])
            }
            .show()
    }

    private fun updateLocale(langCode: String) {
        val locale = java.util.Locale(langCode)
        java.util.Locale.setDefault(locale)
        val config = Configuration()
        config.setLocale(locale)
        @Suppress("DEPRECATION")
        resources.updateConfiguration(config, resources.displayMetrics)
        
        // Restart activity to apply changes
        val intent = intent
        finish()
        startActivity(intent)
    }

    private fun startDrawerBlocker() {
        // Fallback for non-Device Owner or older APIs
        if (!dpm.isDeviceOwnerApp(packageName)) {
            handler.postDelayed(object : Runnable {
                override fun run() {
                    try {
                        @Suppress("DEPRECATION")
                        sendBroadcast(Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS))
                    } catch (e: Exception) {}
                    handler.postDelayed(this, 1000)
                }
            }, 1000)
        }
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let { controller ->
                controller.hide(android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
            )
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus) {
            // User tried to pull something over the lock screen OR open something
            if (!dpm.isDeviceOwnerApp(packageName)) {
                @Suppress("DEPRECATION")
                sendBroadcast(Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS))
            }
            
            // Re-launch to ensure we stay on top
            handler.postDelayed({
                if (!isFinishing && prefs.getBoolean("IS_LOCKED", true)) {
                    val intent = Intent(this, LockScreenActivity::class.java)
                    intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                    startActivity(intent)
                }
            }, 500)
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // Capture Home button press
        if (prefs.getBoolean("IS_LOCKED", true)) {
            val intent = Intent(this, LockScreenActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            startActivity(intent)
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
            // 🛡️ Check if user is locked out due to too many failed attempts
            val lockoutRemaining = keyManager.getLockoutRemaining()
            if (lockoutRemaining > 0) {
                val remainingSec = (lockoutRemaining + 999) / 1000 // Round up
                Toast.makeText(
                    this,
                    "🔒 Security Lockout: Try again in $remainingSec seconds",
                    Toast.LENGTH_LONG
                ).show()
                Log.w("LockScreen", "User locked out: ${remainingSec}s remaining")
                return
            }

            val input = EditText(this).apply {
                hint = "Enter Emergency Key"
            }

            AlertDialog.Builder(this)
                .setTitle("Offline Emergency Unlock")
                .setView(input)
                .setCancelable(false)
                    .setPositiveButton("Verify") { _, _ ->
                    try {
                        val entered = input.text.toString().trim().uppercase(java.util.Locale.ROOT)
                        val storedHash = prefs.getString("UNLOCK_KEY_HASH", null)

                        if (!storedHash.isNullOrEmpty() && hashKey(entered) == storedHash) {
                            // ✅ Correct unlock key entered
                            Log.d("LockScreen", "✅ Offline hash-match successful")
                            keyManager.resetAttempts()
                            
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

                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && dpm.isDeviceOwnerApp(packageName)) {
                                dpm.setStatusBarDisabled(adminComponent, false)
                            }
                            safeStopLockTask()
                            sendBroadcast(Intent("com.emiseure.customer.ACTION_UNLOCK"))
                            finishAndRemoveTask()
                        } else {
                            // ❌ Wrong unlock key
                            keyManager.recordFailedAttempt()
                            val remainingAttempts = 10 - keyManager.getAttemptCount()
                            
                            if (remainingAttempts <= 0) {
                                // 🚨 CRITICAL: Too many failed attempts
                                val lockoutRemainingSec = (keyManager.getLockoutRemaining() + 999) / 1000
                                Toast.makeText(
                                    this,
                                    "🔒 Too many failed attempts. Locked for $lockoutRemainingSec seconds.",
                                    Toast.LENGTH_LONG
                                ).show()
                                Log.w("LockScreen", "🚨 Unlock attempts exhausted - security lockout activated")
                                
                                // Report to backend that tampering was detected
                                 TamperDetectionManager.recordTamperAttempt(
                                     this,
                                     "BRUTE_FORCE_UNLOCK_ATTEMPT"
                                 )
                            } else {
                                Toast.makeText(
                                    this,
                                    "❌ Invalid Key. $remainingAttempts attempts remaining.",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                            Log.w("LockScreen", "❌ Offline unlock failed (Attempt ${keyManager.getAttemptCount()})")
                        }
                    } catch (e: Exception) {
                        Log.e("LockScreen", "Error during unlock verification", e)
                        Toast.makeText(this, "Unlock verification failed", Toast.LENGTH_SHORT).show()
                    }
                }
                .setNegativeButton("Cancel") { dialog, _ -> dialog.dismiss() }
                .show()
        } catch (e: Exception) {
            Log.e("LockScreen", "Failed to show unlock dialog", e)
        }
    }

    // ---- HARD BLOCK BACK BUTTON ----
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Disabled intentionally, but must call super to satisfy linter
        // super.onBackPressed() // Do not call if you want to block it entirely
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
            Log.e("LockScreen", "Error in onDestroy", e)
        }
        
        safeStopLockTask()
        
        // 🚨 If we are being destroyed but the device is still supposed to be locked,
        // notify the stickiness service to re-launch us immediately.
        if (prefs.getBoolean("IS_LOCKED", true) && !isFinishing) {
            LockScreenPersistenceHelper.notifyLockDestroyed(this, "ACTIVITY_DESTROYED")
        }
    }

    private fun hashKey(key: String): String {
        return try {
            val digest = java.security.MessageDigest.getInstance("SHA-256")
            val hash = digest.digest(key.toByteArray(Charsets.UTF_8))
            android.util.Base64.encodeToString(hash, android.util.Base64.NO_WRAP)
        } catch (e: Exception) { "" }
    }
}
