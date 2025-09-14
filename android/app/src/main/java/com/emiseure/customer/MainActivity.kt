package com.emiseure.customer

import android.annotation.SuppressLint
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
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

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    
    // CRITICAL: Replace this URL with your live Render backend URL before building the release app.
    private val publicBackendUrl = "https://your-render-backend.onrender.com/api/public"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val androidId = getAndroidId()
        Log.d("MainActivity", "Device Android ID: $androidId")

        binding.androidIdTextView.text = getString(R.string.your_device_id, androidId)
        
        checkDeviceAdminStatusAndApplyPolicies()
        registerForPushNotifications(androidId)
        fetchDeviceStatus(androidId)

        binding.retryButton.setOnClickListener {
            fetchDeviceStatus(androidId)
        }
    }

    private fun checkDeviceAdminStatusAndApplyPolicies() {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(this, MyDeviceAdminReceiver::class.java)
        // We only care if this app is the DEVICE OWNER. Regular admin is not enough.
        val isDeviceOwner = dpm.isDeviceOwnerApp(packageName)

        if (isDeviceOwner) {
            binding.deviceAdminStatusTextView.text = getString(R.string.device_admin_active)
            binding.deviceAdminStatusTextView.setTextColor(ContextCompat.getColor(this, R.color.status_paid))

            // CRITICAL: Programmatically apply security policies now that we are the device owner.
            // This is the correct way to disable the factory reset button in settings.
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET)
            // Prevent adding new users/profiles which could be a bypass vector.
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_ADD_USER)
            // Prevent enabling OEM unlocking in developer options.
            // FIX: Use the direct string value to prevent "Unresolved reference" build error.
            dpm.addUserRestriction(adminComponent, "no_oem_unlock")

            Log.d("DeviceAdmin", "Security policies applied: Factory reset, add user, and OEM unlocking are disabled.")

        } else {
            binding.deviceAdminStatusTextView.text = getString(R.string.device_admin_inactive)
            binding.deviceAdminStatusTextView.setTextColor(ContextCompat.getColor(this, R.color.status_overdue))
            Log.w("DeviceAdmin", "App is not the device owner. Security policies not applied.")
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
        val url = "$publicBackendUrl/devices/fcm-update"
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

        val requestQueue = Volley.newRequestQueue(this)
        val url = "$publicBackendUrl/device-status"
        val params = JSONObject()
        params.put("androidId", androidId)

        val jsonObjectRequest = JsonObjectRequest(Request.Method.POST, url, params,
            { response ->
                showLoading(false)
                Log.d("API_SUCCESS", response.toString())
                updateUiWithStatus(response)
            },
            { error ->
                showLoading(false)
                Log.e("API_ERROR", error.toString())
                var errorMessage = "Could not connect to the server. Please check your network and ensure the IP address in the code is correct."
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
