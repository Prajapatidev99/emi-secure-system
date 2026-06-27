package com.emiseure.customer

import android.app.AlertDialog
import android.app.admin.DevicePolicyManager
import android.content.*
import android.os.*
import android.os.UserManager
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.net.Uri
import android.provider.Settings
import android.content.res.Configuration
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.emiseure.customer.databinding.ActivityLockScreenBinding
import com.emiseure.customer.utils.OfflineUnlockKeyManager
import java.util.Locale

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
    private var isSelfFinishing = false  // Renamed from isFinishing to avoid shadowing Activity.isFinishing()

    // 🔐 Lazy context and prefs for Direct Boot safety
    private val deviceContext by lazy { createDeviceProtectedStorageContext() }
    private val prefs by lazy { deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE) }

    // Unlock broadcast — BUG-15: set isSelfFinishing=true BEFORE finishing
    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.emiseure.customer.ACTION_UNLOCK") {
                Log.d("LockScreen", "Unlock broadcast received")
                isSelfFinishing = true  // BUG-15 FIX: prevent stickiness re-launch after unlock
                safeStopLockTask()
                finishAndRemoveTask()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // BUG-18 FIX: Block back gesture on Android 13+ predictive-back (modern API)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Do nothing — back navigation is intentionally blocked on lock screen
            }
        })

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
                    // 🛡️ Enforce comprehensive anti-tampering protections
                    TamperDetectionManager.enforceAntiTamperingLock(this)
                    safeStartLockTask()
                } catch (e: Exception) {
                    Log.e("LockScreen", "Failed to apply restrictions", e)
                }
            }

            // ---- LOAD OFFLINE KEY (DIRECT BOOT SAFE + ENCRYPTED) ----
            try {
                keyManager = OfflineUnlockKeyManager(this)
                
                // 🔐 Try to load encrypted key first
                offlineUnlockKey = keyManager.getUnlockKey()
                
                // 🔐 If intent contains key (from backend), store it encrypted
                val keyFromIntent = intent.getStringExtra("UNLOCK_KEY_VIA_INTENT")
                if (!keyFromIntent.isNullOrEmpty() && keyFromIntent.length >= 6) {
                    if (keyManager.storeUnlockKey(keyFromIntent)) {
                        offlineUnlockKey = keyFromIntent
                        Log.d("LockScreen", "Unlock key stored encrypted in Keystore")
                    }
                }
            } catch (e: Exception) {
                Log.e("LockScreen", "Failed to load encrypted unlock key", e)
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getSystemService(android.app.LocaleManager::class.java)?.applicationLocales = 
                android.os.LocaleList.forLanguageTags(langCode)
        } else {
            val locale = java.util.Locale(langCode)
            java.util.Locale.setDefault(locale)
            val config = Configuration()
            config.setLocale(locale)
            @Suppress("DEPRECATION")
            resources.updateConfiguration(config, resources.displayMetrics)
        }
        
        // Restart activity to apply language changes
        // Set isSelfFinishing so onDestroy doesn't trigger stickiness re-launch
        isSelfFinishing = true
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
                    // FIX: Use SINGLE_TOP to avoid creating hundreds of instances in a loop
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
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
            // 5-tap on lock icon → show on-screen keypad panel
            binding.lockIcon.setOnClickListener {
                iconClickCount++

                resetClickRunnable?.let { handler.removeCallbacks(it) }
                resetClickRunnable = Runnable { iconClickCount = 0 }
                handler.postDelayed(resetClickRunnable!!, 2000)

                if (iconClickCount >= 5) {
                    showKeypadPanel()
                    iconClickCount = 0
                }
            }

            // Wire Cancel button
            binding.keypadCancelButton.setOnClickListener {
                hideKeypadPanel()
            }

            // Wire Submit button
            binding.keypadSubmitButton.setOnClickListener {
                verifyOfflineKey(binding.keypadInput.text.toString().trim())
            }
        } catch (e: Exception) {
            Log.e("LockScreen", "Failed to setup hidden unlock", e)
        }
    }

    private fun showKeypadPanel() {
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
            binding.keypadInput.setText("")
            binding.mainContent.visibility = android.view.View.GONE
            binding.keypadContainer.visibility = android.view.View.VISIBLE
            binding.keypadInput.requestFocus()
        } catch (e: Exception) {
            Log.e("LockScreen", "Failed to show keypad panel", e)
        }
    }

    private fun hideKeypadPanel() {
        try {
            binding.keypadContainer.visibility = android.view.View.GONE
            binding.mainContent.visibility = android.view.View.VISIBLE
            iconClickCount = 0
        } catch (e: Exception) {
            Log.e("LockScreen", "Failed to hide keypad panel", e)
        }
    }

    private fun verifyOfflineKey(enteredRaw: String) {
        try {
            // Normalize to uppercase on both sides — avoid case-sensitive mismatch
            val entered = enteredRaw.uppercase(Locale.ROOT)
            val stored = offlineUnlockKey?.uppercase(Locale.ROOT)

            if (!stored.isNullOrEmpty() && entered == stored) {
                // ✅ Correct unlock key entered
                Log.d("LockScreen", "✅ Offline unlock successful")
                keyManager.resetAttempts()
                hideKeypadPanel()

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

                isSelfFinishing = true
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
                    hideKeypadPanel()

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
                    binding.keypadInput.setText("")
                }
                Log.w("LockScreen", "❌ Offline unlock failed (Attempt ${keyManager.getAttemptCount()})")
            }
        } catch (e: Exception) {
            Log.e("LockScreen", "Error during unlock verification", e)
            Toast.makeText(this, "Unlock verification failed", Toast.LENGTH_SHORT).show()
        }
    }

    // ---- HARD BLOCK BACK BUTTON (deprecated API, kept for Android < 13 compat) ----
    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        // BUG-18: Also handled by OnBackPressedCallback above for API 33+
        // Disabled intentionally — lock screen cannot be dismissed via back
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
        
        // 🚨 If we are being destroyed but the device is still supposed to be locked,
        // notify the stickiness service to re-launch us immediately.
        // Use isSelfFinishing (NOT Activity.isFinishing()) to track deliberate unlock-finish calls
        if (prefs.getBoolean("IS_LOCKED", true) && !isSelfFinishing) {
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
