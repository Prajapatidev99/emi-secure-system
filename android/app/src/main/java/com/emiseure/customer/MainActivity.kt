package com.emiseure.customer

import android.accounts.AccountManager
import android.annotation.SuppressLint
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.UserManager
import android.provider.Settings
import android.util.Log
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.android.volley.Request
import com.android.volley.toolbox.JsonObjectRequest
import com.android.volley.toolbox.Volley
import com.emiseure.customer.BuildConfig
import com.emiseure.customer.databinding.ActivityMainBinding
import com.google.android.gms.tasks.OnCompleteListener
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    // 🔔 FCM Token Cache
    private var currentFcmToken: String? = null

    // 🔐 Device Owner
    private lateinit var dpm: DevicePolicyManager
    private lateinit var adminComponent: ComponentName

    // 🔐 Direct-Boot safe storage
    private val prefs by lazy {
        createDeviceProtectedStorageContext()
            .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
    }

    companion object {
        // Backend URL is now loaded from BuildConfig (local.properties)
        private val PUBLIC_BACKEND_URL = "${BuildConfig.BACKEND_URL}/api/public"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        // 🔒 IMMEDIATE SECURITY CHECK
        // Check local lock state BEFORE doing anything else
        // CRITICAL: Must use Device-Protected Storage (same as FCM/BootReceiver)
        val deviceContext = createDeviceProtectedStorageContext()
        val securePrefs = deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
        
        if (securePrefs.getBoolean("IS_LOCKED", false)) {
            Log.w("Security", "Device is locally MARKED AS LOCKED. Launching lock screen immediately.")
            val lockIntent = Intent(this, LockScreenActivity::class.java)
            lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            startActivity(lockIntent)
            finish() // Close MainActivity so user can't interact
            return
        }
        
        setContentView(binding.root)

        // 📊 Initialize Crashlytics with device metadata for cross-device crash reporting
        val crashlytics = FirebaseCrashlytics.getInstance()
        crashlytics.setCustomKey("device_model", android.os.Build.MODEL)
        crashlytics.setCustomKey("device_manufacturer", android.os.Build.MANUFACTURER)
        crashlytics.setCustomKey("android_version", android.os.Build.VERSION.RELEASE)
        crashlytics.setCustomKey("android_sdk", android.os.Build.VERSION.SDK_INT)
        crashlytics.setCustomKey("device_brand", android.os.Build.BRAND)
        crashlytics.setCustomKey("device_product", android.os.Build.PRODUCT)

        dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        adminComponent = ComponentName(this, MyDeviceAdminReceiver::class.java)

        val androidId = getAndroidId()
        Log.d("MainActivity", "Android ID: $androidId")

        binding.androidIdTextView.text =
            getString(R.string.your_device_id, androidId)

        checkDeviceAdminStatus()
        enforceSecurityPolicies()

        // 📅 Create notification channel for payment reminders
        PaymentReminderManager.createNotificationChannel(this)

        registerForPushNotifications(androidId)
        fetchDeviceStatus(androidId)

        binding.retryButton.setOnClickListener {
            fetchDeviceStatus(androidId)
        }
    }

    override fun onResume() {
        super.onResume()
        fetchDeviceStatus(getAndroidId())
        enforceAccountRestriction() // Re-check account state when app returns
    }

    // =====================================
    // 🔐 DEVICE OWNER SECURITY
    // =====================================
    private fun enforceSecurityPolicies() {
        if (!dpm.isDeviceOwnerApp(packageName)) return

        try {
            dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))
            
            // 🔒 Critical Security Restrictions
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT)
            
            // 🔐 ADVANCED: Block ALL debugging features (ADB, Developer Options, etc.)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_DEBUGGING_FEATURES)
            
            // 🔐 ADVANCED: Block installing apps from unknown sources
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES)
            
            // 🛡️ Extra Security: Block physical media and extra users
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_ADD_USER)
            
            // 🔒 CRITICAL: Prevent app uninstallation
            try {
                dpm.setUninstallBlocked(adminComponent, packageName, true)
                Log.d("Security", "✅ App uninstallation BLOCKED")
            } catch (e: Exception) {
                Log.e("Security", "Failed to block uninstallation", e)
            }

            // 🛡️ FACTORY RESET PROTECTION (FRP)
            // Ensure that if forced reset happens, only specific accounts can unlock (or none if list empty)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    // TODO: Replace with actual Admin Google IDs if available. 
                    // Empty list implies default FRP behavior (Google account on device).
                    // To strictly LOCK it, we would need specific IDs.
                    // For now, we rely on DISALLOW_FACTORY_RESET and DISALLOW_REMOVE_USER.
                    dpm.setFactoryResetProtectionPolicy(adminComponent, null) // Use default or specific policy
                    Log.d("Security", "✅ FRP Policy configured")
                } catch (e: Exception) {
                    Log.e("Security", "Failed to set FRP policy", e)
                }
            }

            Log.d("Security", "✅ All security policies enforced")
        } catch (e: SecurityException) {
            Log.e("Security", "Failed to apply restrictions", e)
        }

        // FRP / account protection: ONE-TIME ACCOUNT ADDITION ONLY
        enforceAccountRestriction()
    }

    private fun enforceAccountRestriction() {
        if (!dpm.isDeviceOwnerApp(packageName)) return

        try {
            val accountAlreadyAdded = prefs.getBoolean("GOOGLE_ACCOUNT_ADDED", false)
            
            val am = AccountManager.get(this)
            val googleAccounts = am.getAccountsByType("com.google")
            
            when {
                googleAccounts.isNotEmpty() && !accountAlreadyAdded -> {
                    // First Google account added - lock it permanently
                    prefs.edit().putBoolean("GOOGLE_ACCOUNT_ADDED", true).commit()
                    dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_MODIFY_ACCOUNTS)
                    Log.d("AccountSecurity", "✅ Google account added - restrictions enabled permanently")
                }
                accountAlreadyAdded -> {
                    // Account was added before - maintain restrictions
                    dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_MODIFY_ACCOUNTS)
                    Log.d("AccountSecurity", "🔒 Maintaining permanent account restrictions")
                }
                else -> {
                    // No account yet - allow adding ONCE
                    dpm.clearUserRestriction(adminComponent, UserManager.DISALLOW_MODIFY_ACCOUNTS)
                    Log.d("AccountSecurity", "⚠️ Waiting for first Google account (ONE TIME ONLY)")
                }
            }
        } catch (e: Exception) {
            Log.e("AccountSecurity", "Failed to enforce account restriction", e)
        }
    }

    // =====================================
    // 🔍 ADMIN STATUS UI
    // =====================================
    private fun checkDeviceAdminStatus() {
        val isOwner = dpm.isDeviceOwnerApp(packageName)
        val isAdmin = dpm.isAdminActive(adminComponent)

        when {
            isOwner || isAdmin -> {
                binding.deviceAdminStatusTextView.text =
                    getString(R.string.device_admin_active)
                binding.deviceAdminStatusTextView.setTextColor(
                    ContextCompat.getColor(this, R.color.status_paid)
                )
            }
            else -> {
                binding.deviceAdminStatusTextView.text =
                    getString(R.string.device_admin_inactive)
                binding.deviceAdminStatusTextView.setTextColor(
                    ContextCompat.getColor(this, R.color.status_overdue)
                )
            }
        }
    }

    // =====================================
    // 🆔 ANDROID ID
    // =====================================
    @SuppressLint("HardwareIds")
    private fun getAndroidId(): String {
        return Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ANDROID_ID
        )
    }

    // =====================================
    // 🔔 FCM
    // =====================================
    private fun registerForPushNotifications(androidId: String) {
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener(OnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.e("FCM", "Token fetch failed", task.exception)
                    return@OnCompleteListener
                }
                val token = task.result
                currentFcmToken = token // Cache it
                sendFcmTokenToServer(androidId, token)
            })
    }

    private fun sendFcmTokenToServer(androidId: String, token: String) {
        val queue = Volley.newRequestQueue(this)
        val url = "${BuildConfig.BACKEND_URL}/api/public/devices/fcm-update"

        val body = JSONObject().apply {
            put("androidId", androidId)
            put("fcmToken", token)
        }

        queue.add(
            JsonObjectRequest(
                Request.Method.POST,
                url,
                body,
                { Log.d("FCM", "Token synced") },
                { Log.e("FCM", "Token sync failed", it) }
            )
        )
    }

    // =====================================
    // 🌐 SERVER SYNC (FIXED WITH RETRY)
    // =====================================
    private fun fetchDeviceStatus(androidId: String, retryCount: Int = 0) {
        showLoading(true)

        val queue = Volley.newRequestQueue(this)
        val url = "${BuildConfig.BACKEND_URL}/api/public/device-status"

        val body = JSONObject().apply {
            put("androidId", androidId)
        }

        queue.add(
            JsonObjectRequest(
                Request.Method.POST,
                url,
                body,
                { response ->
                    showLoading(false)

                    val time = SimpleDateFormat(
                        "hh:mm:ss a",
                        Locale.getDefault()
                    ).format(Date())

                    binding.syncStatusTextView.text =
                        getString(R.string.sync_status_success, time)
                    
                    // ✅ Self-Healing: Resend FCM token if we have one (in case device was just linked)
                    currentFcmToken?.let { token ->
                        sendFcmTokenToServer(androidId, token)
                        // Clear it so we don't spam updates? No, idempotent updates are fine/safer.
                        // But maybe log it.
                        Log.d("FCM", "Resyncing FCM token after status fetch")
                    }

                    // ✅ SAFE PARSING (NO Nothing?)
                    val unlockKey: String? =
                        if (response.has("unlockKey") && !response.isNull("unlockKey")) {
                            response.getString("unlockKey")
                        } else {
                            null
                        }

                    if (!unlockKey.isNullOrEmpty()) {
                        prefs.edit()
                            .putString("UNLOCK_KEY", unlockKey)
                            .commit()
                    }

                    checkAndSyncLockState(response, unlockKey)
                    updateUiWithStatus(response)
                    
                    // 📅 Schedule payment reminders (offline notifications)
                    try {
                        val nextDueDate = response.optString("nextDueDate", "")
                        val amountDue = response.optDouble("amountDue", 0.0)
                        
                        if (nextDueDate.isNotEmpty() && amountDue > 0) {
                            PaymentReminderManager.scheduleReminders(
                                this,
                                nextDueDate,
                                amountDue
                            )
                            Log.d("Notifications", "Payment reminders scheduled for $nextDueDate")
                        }
                    } catch (e: Exception) {
                        Log.e("Notifications", "Failed to schedule reminders", e)
                    }
                },
                { error ->
                    showLoading(false)
                    
                    // Retry logic: retry up to 3 times with exponential backoff
                    if (retryCount < 3) {
                        val delayMs = (retryCount + 1) * 1000L // 1s, 2s, 3s
                        binding.syncStatusTextView.text = getString(R.string.retrying_status, retryCount + 1)
                        
                        Handler(Looper.getMainLooper()).postDelayed({
                            fetchDeviceStatus(androidId, retryCount + 1)
                        }, delayMs)
                    } else {
                        // Better error messages
                        val errorMessage = when {
                            error.networkResponse == null -> getString(R.string.error_no_internet)
                            error.networkResponse.statusCode == 404 -> getString(R.string.error_device_not_found)
                            error.networkResponse.statusCode == 500 -> getString(R.string.error_server_error)
                            error.networkResponse.statusCode >= 400 -> getString(R.string.error_server_code, error.networkResponse.statusCode)
                            else -> error.message ?: getString(R.string.error_connection_failed)
                        }
                        showError(errorMessage)
                    }
                }
            )
        )
    }

    // =====================================
    // 🔐 LOCK STATE SYNC
    // =====================================
    private fun checkAndSyncLockState(
        status: JSONObject,
        unlockKey: String?
    ) {
        val serverLocked =
            status.optString("deviceStatus") == "Locked"
        val localLocked =
            prefs.getBoolean("IS_LOCKED", false)

        if (serverLocked && !localLocked) {
            prefs.edit().putBoolean("IS_LOCKED", true).commit()

            startActivity(
                Intent(this, LockScreenActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    unlockKey?.let {
                        putExtra("UNLOCK_KEY_VIA_INTENT", it)
                    }
                }
            )
        } else if (!serverLocked && localLocked) {
            prefs.edit().putBoolean("IS_LOCKED", false).commit()
            sendBroadcast(Intent("com.emiseure.customer.ACTION_UNLOCK"))
        }
    }

    // =====================================
    // 🎨 UI HELPERS
    // =====================================
    private fun showLoading(isLoading: Boolean) {
        binding.progressBar.visibility =
            if (isLoading) View.VISIBLE else View.GONE
        binding.statusCard.visibility =
            if (isLoading) View.GONE else View.VISIBLE
        binding.errorLayout.visibility = View.GONE
    }

    private fun showError(msg: String) {
        binding.progressBar.visibility = View.GONE
        binding.statusCard.visibility = View.GONE
        binding.errorLayout.visibility = View.VISIBLE
        binding.errorTextView.text = msg
    }

    private fun updateUiWithStatus(status: JSONObject) {
        // Update customer name
        binding.customerNameTextView.text =
            getString(
                R.string.welcome_customer,
                status.optString("customerName", "Customer")
            )

        // Get payment and device status
        val paymentStatus = status.optString("paymentStatus", "")
        val deviceStatus = status.optString("deviceStatus", "Active")
        val nextDueDate = status.optString("nextDueDate", "")
        val amountDue = status.optDouble("amountDue", 0.0)
        val message = status.optString("message", "")

        // Update device status
        binding.deviceStatusTextView.text = getString(R.string.device_status_label, deviceStatus)

        // Handle different payment statuses
        when (paymentStatus) {
            "Overdue" -> {
                // Payment is overdue
                binding.statusTitle.text = getString(R.string.status_overdue)
                binding.statusTitle.setTextColor(ContextCompat.getColor(this, R.color.status_overdue))
                
                binding.dueDateTextView.text = nextDueDate
                binding.amountDueTextView.text = "₹${String.format("%.2f", amountDue)}"
                
                binding.statusDetailsLayout.visibility = View.VISIBLE
                binding.statusMessage.visibility = View.GONE
            }
            
            "Pending" -> {
                // Payment is pending
                binding.statusTitle.text = getString(R.string.status_pending)
                binding.statusTitle.setTextColor(ContextCompat.getColor(this, R.color.status_pending))
                
                binding.dueDateTextView.text = nextDueDate
                binding.amountDueTextView.text = "₹${String.format("%.2f", amountDue)}"
                
                binding.statusDetailsLayout.visibility = View.VISIBLE
                binding.statusMessage.visibility = View.GONE
            }
            
            "Paid" -> {
                // Current payment is paid
                binding.statusTitle.text = getString(R.string.status_all_clear)
                binding.statusTitle.setTextColor(ContextCompat.getColor(this, R.color.status_paid))
                
                if (nextDueDate.isNotEmpty()) {
                    // There's a next payment
                    binding.dueDateTextView.text = nextDueDate
                    binding.amountDueTextView.text = "₹${String.format("%.2f", amountDue)}"
                    binding.statusDetailsLayout.visibility = View.VISIBLE
                } else {
                    binding.statusDetailsLayout.visibility = View.GONE
                }
                
                binding.statusMessage.visibility = View.GONE
            }
            
            "All Clear" -> {
                // All payments are cleared
                binding.statusTitle.text = getString(R.string.status_all_clear)
                binding.statusTitle.setTextColor(ContextCompat.getColor(this, R.color.status_paid))
                
                binding.statusDetailsLayout.visibility = View.GONE
                
                // Show the "All Clear" message
                binding.statusMessage.text = if (message.isNotEmpty()) {
                    message
                } else {
                    "All EMIs have been paid. Thank you!"
                }
                binding.statusMessage.visibility = View.VISIBLE
                
                // Check if device is released
                if (deviceStatus == "Released") {
                    binding.statusMessage.text = getString(R.string.device_released_message)
                }
            }
            
            else -> {
                // Unknown status or no payment info
                binding.statusTitle.text = "Status Unknown"
                binding.statusTitle.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))
                binding.statusDetailsLayout.visibility = View.GONE
                binding.statusMessage.visibility = View.GONE
            }
        }
    }
}
