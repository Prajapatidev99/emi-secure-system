package com.emiseure.customer

import android.accounts.AccountManager
import android.annotation.SuppressLint
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
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
import com.emiseure.customer.databinding.ActivityMainBinding
import com.google.android.gms.tasks.OnCompleteListener
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
        private const val PUBLIC_BACKEND_URL =
            "https://emi-secure-system.onrender.com/api/public"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        adminComponent = ComponentName(this, MyDeviceAdminReceiver::class.java)

        val androidId = getAndroidId()
        Log.d("MainActivity", "Android ID: $androidId")

        binding.androidIdTextView.text =
            getString(R.string.your_device_id, androidId)

        checkDeviceAdminStatus()
        enforceSecurityPolicies()

        registerForPushNotifications(androidId)
        fetchDeviceStatus(androidId)

        binding.retryButton.setOnClickListener {
            fetchDeviceStatus(androidId)
        }
    }

    override fun onResume() {
        super.onResume()
        fetchDeviceStatus(getAndroidId())
    }

    // =====================================
    // 🔐 DEVICE OWNER SECURITY
    // =====================================
    private fun enforceSecurityPolicies() {
        if (!dpm.isDeviceOwnerApp(packageName)) return

        try {
            dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET)
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT)
            
            // 🔒 Critical Security: Prevent Uninstall
            if (BuildConfig.DEBUG) {
                // 🔓 Debug Mode: Allow Uninstall for testing
                dpm.setUninstallBlocked(adminComponent, packageName, false)
                dpm.clearUserRestriction(adminComponent, UserManager.DISALLOW_UNINSTALL_APPS)
                Log.w("Security", "⚠️ DEBUG MODE: Skipping uninstall block for testing")
            } else {
                // 🔒 Release Mode: Block Uninstall strict
                dpm.setUninstallBlocked(adminComponent, packageName, true)
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_UNINSTALL_APPS)
            }
            
            Log.d("Security", "Critical restrictions applied (Uninstall Blocked)")
        } catch (e: SecurityException) {
            Log.e("Security", "Failed to apply restrictions", e)
        }

        // FRP / account protection
        val am = AccountManager.get(this)
        val hasGoogleAccount =
            am.getAccountsByType("com.google").isNotEmpty()

        if (hasGoogleAccount) {
            dpm.addUserRestriction(
                adminComponent,
                UserManager.DISALLOW_MODIFY_ACCOUNTS
            )
        } else {
            dpm.clearUserRestriction(
                adminComponent,
                UserManager.DISALLOW_MODIFY_ACCOUNTS
            )
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
        val url = "$PUBLIC_BACKEND_URL/devices/fcm-update"

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
        val url = "$PUBLIC_BACKEND_URL/device-status"

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
        binding.customerNameTextView.text =
            getString(
                R.string.welcome_customer,
                status.optString("customerName", "Customer")
            )
    }
}
