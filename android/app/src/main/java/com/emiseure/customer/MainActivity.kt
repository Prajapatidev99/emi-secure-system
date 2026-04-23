package com.emiseure.customer

import android.accounts.AccountManager
import android.annotation.SuppressLint
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.DialogInterface
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.UserManager
import android.os.PowerManager
import android.net.Uri
import android.provider.Settings
import android.util.Log
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import android.app.AlertDialog
import androidx.core.content.ContextCompat
import com.android.volley.Request
import com.android.volley.toolbox.JsonObjectRequest
import com.android.volley.toolbox.Volley
import com.emiseure.customer.BuildConfig
import com.emiseure.customer.databinding.ActivityMainBinding
import com.google.android.gms.tasks.OnCompleteListener
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.messaging.FirebaseMessaging
import com.emiseure.customer.utils.SimInfoManager
import com.emiseure.customer.utils.OfflineUnlockKeyManager
import com.emiseure.customer.utils.SecurityAuditManager
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat

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

        // 🛡️ PRIVACY SHIELD: Block screenshots and screen recording
        window.setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE, android.view.WindowManager.LayoutParams.FLAG_SECURE)

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

        // 🔄 POST-FACTORY-RESET CHECK
        // If no Device Owner and no lock prefs → fresh install after reset
        // The server still knows this device is Locked → fetchDeviceStatus will enforce it
        if (ZeroTouchProvisioningHelper.isPostFactoryResetInstall(this)) {
            Log.w("Security", "🚨 POST-FACTORY-RESET detected — device was wiped! Syncing with server...")
            // Mark so PostResetReprovisionReceiver knows this was handled
            getSharedPreferences("EMI_REPROVISION", Context.MODE_PRIVATE)
                .edit().putBoolean("FIRST_BOOT_HANDLED", true).apply()
            // Don't finish() here — let fetchDeviceStatus detect the server-side lock
            // and launch LockScreenActivity. This provides lock even without Device Owner.
        }
        
        setContentView(binding.root)

        // 🛠️ CHINESE ROM AUTOSTART FIX
        AutoStartHelper.checkAndPromptAutoStart(this)

        // 🔋 BATTERY OPTIMIZATION FIX (Critical for Redmi)
        checkBatteryOptimizations()

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

        // 📱 PERMISSIONS: Request all required permissions (Telephony, Location, Notifications)
        requestRequiredPermissions()

        binding.retryButton.setOnClickListener {
            fetchDeviceStatus(androidId)
        }
    }

    private fun requestRequiredPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_PHONE_NUMBERS,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        // Android 13+ Notification Permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val missingPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missingPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missingPermissions.toTypedArray(), 102)
        } else {
            // All foreground permissions granted, check background location
            requestBackgroundLocationPermission()
        }
    }

    private fun requestBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                // Show a brief explanation or just request
                AlertDialog.Builder(this)
                    .setTitle("Background Location Required")
                    .setMessage("To track the device if it's lost or stolen, please select 'Allow all the time' in the next screen.")
                    .setPositiveButton("Configure") { _, _ ->
                        ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION), 103)
                    }
                    .setNegativeButton("Cancel") { dialog, _ -> dialog.dismiss() }
                    .show()
            } else {
                startSecurityServices()
            }
        } else {
            startSecurityServices()
        }
    }

    private fun startSecurityServices() {
        // Start LockMonitorService to begin location tracking and security enforcement
        try {
            val serviceIntent = Intent(this, LockMonitorService::class.java).apply {
                action = "START_MONITORING"
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
            Log.d("MainActivity", "🔒 LockMonitorService started for security & location")
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to start LockMonitorService", e)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            102 -> {
                // Foreground permissions complete
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    syncMetadataWithServer(getAndroidId(), currentFcmToken)
                }
                // Now check for background location
                requestBackgroundLocationPermission()
            }
            103 -> {
                // Background location result
                startSecurityServices()
            }
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
            // 🛡️ NEW: MAXIMUM SYSTEM LOCKDOWN
            // This prevents hard reset bypassing and enforces strict FRP
            ZeroTouchProvisioningHelper.enforceFullSystemLockdown(this)
            
            // 🛡️ FRP POST-RESET PROTECTION:
            // Prevents setup wizard bypass after a manual hard reset
            FactoryResetProtectionManager(this).blockUnauthorizedSetup()

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
                syncMetadataWithServer(androidId, token)
            })
    }

    private fun syncMetadataWithServer(androidId: String, token: String?) {
        val queue = Volley.newRequestQueue(this)
        val url = "${BuildConfig.BACKEND_URL}/api/public/devices/sync-metadata"

        val simManager = SimInfoManager(this)
        val body = JSONObject().apply {
            put("androidId", androidId)
            if (token != null) put("fcmToken", token)
            
            // Collect SIM and Hardware Details
            put("imei2", simManager.getImei2())
            put("simDetails", simManager.getFullSimDetails())

            // 🛡️ SECURITY AUDIT STATUS
            val securityReport = SecurityAuditManager.getSecurityReport(this@MainActivity)
            val securityJson = JSONObject()
            securityReport.forEach { (key, value) ->
                securityJson.put(key, value)
            }
            put("metadata", securityJson)
        }

        queue.add(
            JsonObjectRequest(
                Request.Method.POST,
                url,
                body,
                { Log.d("Metadata", "Device metadata synced to server") },
                { Log.e("Metadata", "Metadata sync failed", it) }
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
                    
                    // ✅ Self-Healing: Resync full metadata if we have a status (ensures server is up to date)
                    syncMetadataWithServer(androidId, currentFcmToken)
                    Log.d("Metadata", "Full metadata resync after status fetch")

                    // ✅ SAFE PARSING (NO Nothing?)
                    val unlockKey: String? =
                        if (response.has("unlockKey") && !response.isNull("unlockKey")) {
                            response.getString("unlockKey")
                        } else {
                            null
                        }

                    if (!unlockKey.isNullOrEmpty()) {
                        // 1. Store in plain-text prefs (legacy/Direct Boot fallback)
                        prefs.edit()
                            .putString("UNLOCK_KEY", unlockKey)
                            .commit()
                            
                        // 2. 🔐 Synchronize with hardware-backed secure vault
                        try {
                            val keyManager = OfflineUnlockKeyManager(this@MainActivity)
                            if (keyManager.storeUnlockKey(unlockKey)) {
                                Log.d("Security", "Unlock key synchronized to hardware vault")
                            }
                        } catch (e: Exception) {
                            Log.e("Security", "Failed to sync key to vault", e)
                        }
                    }

                    checkAndSyncLockState(response, unlockKey)
                    updateUiWithStatus(response)
                    
                    // ✅ Dynamic Support Details
                    val supportPhone = response.optString("support_phone", "")
                    val supportName = response.optString("support_name", "Support")
                    if (supportPhone.isNotEmpty()) {
                        prefs.edit()
                            .putString("SUPPORT_PHONE", supportPhone)
                            .putString("SUPPORT_NAME", supportName)
                            .apply()
                        Log.d("Metadata", "Support contact updated: $supportName ($supportPhone)")
                    }

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

    private fun checkBatteryOptimizations() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                AlertDialog.Builder(this)
                    .setTitle("🔋 Disable Battery Savings")
                    .setMessage("To ensure EMI Secure protects this device 24/7, you must set battery optimization to 'No Restrictions' (especially on Redmi devices).\n\nPlease tap 'Allow' on the next screen.")
                    .setCancelable(false)
                    .setPositiveButton("Configure") { _, _ ->
                        try {
                            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                                data = Uri.parse("package:$packageName")
                            }
                            startActivity(intent)
                        } catch (e: Exception) {
                            Log.e("Security", "Failed to launch battery settings", e)
                        }
                    }
                    .show()
            }
        }
    }
}
