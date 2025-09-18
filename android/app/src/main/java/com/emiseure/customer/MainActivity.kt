package com.emiseure.customer

import android.annotation.SuppressLint
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
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
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    
    // Use a lazy delegate to initialize SharedPreferences with device-protected storage context.
    private val prefs by lazy {
        createDeviceProtectedStorageContext().getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
    }

    companion object {
        private const val PUBLIC_BACKEND_URL = "https://emi-secure-system.onrender.com/api/public"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val androidId = getAndroidId()
        Log.d("MainActivity", "Device Android ID: $androidId")

        binding.androidIdTextView.text = getString(R.string.your_device_id, androidId)
        
        checkDeviceAdminStatus()
        registerForPushNotifications(androidId)
        fetchDeviceStatus(androidId)

        binding.retryButton.setOnClickListener {
            fetchDeviceStatus(androidId)
        }
    }

    override fun onResume() {
        super.onResume()
        // Refresh status every time the app is brought to the foreground for robustness.
        fetchDeviceStatus(getAndroidId())
    }

    private fun checkDeviceAdminStatus() {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(this, MyDeviceAdminReceiver::class.java)
        val isDeviceOwner = dpm.isDeviceOwnerApp(packageName)

        if (isDeviceOwner) {
            binding.deviceAdminStatusTextView.text = getString(R.string.device_admin_active)
            binding.deviceAdminStatusTextView.setTextColor(ContextCompat.getColor(this, R.color.status_paid))

            // Whitelist this app for Lock Task (Kiosk) Mode. This is critical for the hard lock.
            try {
                dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))
                Log.d("DeviceAdmin", "App is device owner and whitelisted for Lock Task Mode.")
            } catch (e: SecurityException) {
                Log.e("DeviceAdmin", "Failed to whitelist for Lock Task Mode", e)
            }
            
            // Block user from adding/removing accounts to prevent FRP bypass.
            try {
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_MODIFY_ACCOUNTS)
                Log.d("DeviceAdmin", "Account modification has been disabled.")
            } catch (e: SecurityException) {
                Log.e("DeviceAdmin", "Failed to disable account modification", e)
            }

        } else if (dpm.isAdminActive(adminComponent)) {
            // This is a fallback case - Kiosk mode won't work, but basic admin is active.
            binding.deviceAdminStatusTextView.text = getString(R.string.device_admin_active)
            binding.deviceAdminStatusTextView.setTextColor(ContextCompat.getColor(this, R.color.status_paid))
            Log.w("DeviceAdmin", "App is an admin, but NOT the device owner. Hard lock (Kiosk Mode) will not function.")
        } else {
            binding.deviceAdminStatusTextView.text = getString(R.string.device_admin_inactive)
            binding.deviceAdminStatusTextView.setTextColor(ContextCompat.getColor(this, R.color.status_overdue))
        }
    }
    
    @SuppressLint("HardwareIds")
    private fun getAndroidId(): String {
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
    }

    private fun registerForPushNotifications(androidId: String) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener(OnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w("FCM", "Fetching FCM registration token failed", task.exception)
                return@OnCompleteListener
            }

            val fcmToken = task.result
            Log.d("FCM", "FCM Token: $fcmToken")
            
            sendFcmTokenToServer(androidId, fcmToken)
        })
    }

    private fun sendFcmTokenToServer(androidId: String, fcmToken: String) {
        val requestQueue = Volley.newRequestQueue(this)
        val url = "$PUBLIC_BACKEND_URL/devices/fcm-update"
        val params = JSONObject()
        params.put("androidId", androidId)
        params.put("fcmToken", fcmToken)

        val jsonObjectRequest = JsonObjectRequest(Request.Method.POST, url, params,
            { response ->
                Log.d("FCM", "Successfully updated FCM token on server: $response")
            },
            { error ->
                Log.e("FCM", "Error updating FCM token on server: ${error.message}")
            }
        )
        requestQueue.add(jsonObjectRequest)
    }

    private fun fetchDeviceStatus(androidId: String) {
        showLoading(true)
        binding.syncStatusTextView.text = getString(R.string.sync_status_syncing)
        binding.syncStatusTextView.setTextColor(ContextCompat.getColor(this, R.color.status_pending))

        val requestQueue = Volley.newRequestQueue(this)
        val url = "$PUBLIC_BACKEND_URL/device-status"
        val params = JSONObject()
        params.put("androidId", androidId)

        val jsonObjectRequest = JsonObjectRequest(Request.Method.POST, url, params,
            { response ->
                showLoading(false)
                Log.d("API_SUCCESS", response.toString())
                
                // Update sync status on success
                val currentTime = java.text.SimpleDateFormat("hh:mm:ss a", Locale.getDefault()).format(java.util.Date())
                binding.syncStatusTextView.text = getString(R.string.sync_status_success, currentTime)
                binding.syncStatusTextView.setTextColor(ContextCompat.getColor(this, R.color.status_paid))

                // Save the latest unlock key from the server to device-protected storage
                if (response.has("unlockKey")) {
                    val key = response.getString("unlockKey")
                    prefs.edit().putString("UNLOCK_KEY", key).apply()
                    Log.d("MainActivity", "Saved unlock key to device-protected storage: $key")
                }
                
                checkAndSyncLockState(response)
                updateUiWithStatus(response)
            },
            { error ->
                showLoading(false)
                Log.e("API_ERROR", error.toString())
                
                // Update sync status on failure
                binding.syncStatusTextView.text = getString(R.string.sync_status_failed)
                binding.syncStatusTextView.setTextColor(ContextCompat.getColor(this, R.color.status_overdue))

                var errorMessage = "Could not connect to the server. Please check your network and ensure the IP address in the MainActivity.kt file is correct."
                if (error.networkResponse != null) {
                    val errorData = String(error.networkResponse.data)
                    try {
                        val errorJson = JSONObject(errorData)
                        errorMessage = errorJson.optString("message", "An error occurred.")
                    } catch (e: Exception) {
                        Log.e("JSON_PARSE_ERROR", "Failed to parse error response", e)
                    }
                }
                showError(errorMessage)
            }
        )
        requestQueue.add(jsonObjectRequest)
    }

    private fun checkAndSyncLockState(status: JSONObject) {
        val serverStatus = status.optString("deviceStatus", "Unknown")
        val isServerLocked = serverStatus == "Locked"
        val isLocalLocked = prefs.getBoolean("IS_LOCKED", false)

        Log.d("LockSync", "Server state: $serverStatus, Local state: $isLocalLocked")

        if (isServerLocked && !isLocalLocked) {
            // Server says lock, but we are unlocked. LOCK NOW.
            Log.w("LockSync", "Discrepancy found. Locking device to match server state.")
            prefs.edit().putBoolean("IS_LOCKED", true).apply()
            val lockIntent = Intent(this, LockScreenActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(lockIntent)
        } else if (!isServerLocked && isLocalLocked) {
            // Server says unlock, but we are locked. UNLOCK NOW.
            Log.i("LockSync", "Discrepancy found. Unlocking device to match server state.")
            prefs.edit().putBoolean("IS_LOCKED", false).apply()
            val unlockIntent = Intent("com.emiseure.customer.ACTION_UNLOCK")
            sendBroadcast(unlockIntent)
        }
    }

    private fun showLoading(isLoading: Boolean) {
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.statusCard.visibility = if (isLoading) View.GONE else View.VISIBLE
        binding.errorLayout.visibility = View.GONE
    }

    private fun showError(message: String) {
        binding.progressBar.visibility = View.GONE
        binding.statusCard.visibility = View.GONE
        binding.errorLayout.visibility = View.VISIBLE
        binding.errorTextView.text = message
    }

    private fun updateUiWithStatus(status: JSONObject) {
        binding.customerNameTextView.text = getString(R.string.welcome_customer, status.optString("customerName", "Customer"))

        val paymentStatus = status.optString("paymentStatus", "Unknown")
        val deviceStatus = status.optString("deviceStatus", "Unknown")

        binding.deviceStatusTextView.text = getString(R.string.device_status_label, deviceStatus)

        when (paymentStatus) {
            "All Clear" -> {
                binding.statusTitle.text = getString(R.string.status_all_clear)
                binding.statusTitle.setTextColor(ContextCompat.getColor(this, R.color.status_paid))
                binding.statusDetailsLayout.visibility = View.GONE
                binding.statusMessage.text = status.optString("message", "Thank you!")
                binding.statusMessage.visibility = View.VISIBLE
            }
            "Pending" -> {
                binding.statusTitle.text = getString(R.string.status_pending)
                binding.statusTitle.setTextColor(ContextCompat.getColor(this, R.color.status_pending))
                binding.dueDateLabel.text = getString(R.string.next_due_date)
                binding.dueDateTextView.text = status.optString("nextDueDate", "N/A")
                binding.amountDueTextView.text = "₹${status.optDouble("amountDue", 0.0)}"
                binding.statusDetailsLayout.visibility = View.VISIBLE
                binding.statusMessage.visibility = View.GONE
            }
            "Overdue" -> {
                binding.statusTitle.text = getString(R.string.status_overdue)
                binding.statusTitle.setTextColor(ContextCompat.getColor(this, R.color.status_overdue))
                binding.dueDateLabel.text = getString(R.string.payment_was_due)
                binding.dueDateTextView.text = status.optString("nextDueDate", "N/A")
                binding.amountDueTextView.text = "₹${status.optDouble("amountDue", 0.0)}"
                binding.statusDetailsLayout.visibility = View.VISIBLE
                binding.statusMessage.visibility = View.GONE
            }
            else -> {
                 showError("Your device status could not be determined. Please contact support.")
            }
        }
    }
}
