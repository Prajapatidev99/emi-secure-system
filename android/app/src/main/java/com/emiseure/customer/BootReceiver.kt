package com.emiseure.customer

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log
import com.android.volley.Request
import com.android.volley.toolbox.JsonObjectRequest
import com.android.volley.toolbox.Volley
import org.json.JSONObject

class BootReceiver : BroadcastReceiver() {

    private val TAG = "BootReceiver"
    // This IP must match the one in MainActivity
    private val publicBackendUrl = "http://192.168.1.8:3001/api/public" 
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d(TAG, "Device has booted. Checking lock status...")
            checkDeviceStatus(context)
        }
    }

    @SuppressLint("HardwareIds")
    private fun getAndroidId(context: Context): String {
        return Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
    }

    private fun checkDeviceStatus(context: Context) {
        val androidId = getAndroidId(context)
        if (androidId.isNullOrEmpty()) {
            Log.e(TAG, "Could not retrieve Android ID.")
            return
        }

        val requestQueue = Volley.newRequestQueue(context)
        val url = "$publicBackendUrl/device-status"
        val params = JSONObject()
        params.put("androidId", androidId)

        val jsonObjectRequest = JsonObjectRequest(Request.Method.POST, url, params,
            { response ->
                val deviceStatus = response.optString("deviceStatus", "Unknown")
                Log.d(TAG, "Server reports device status: $deviceStatus")

                if (deviceStatus == "Locked") {
                    Log.w(TAG, "Device should be locked. Launching LockScreenActivity.")
                    val lockIntent = Intent(context, LockScreenActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(lockIntent)
                }
            },
            { error ->
                Log.e(TAG, "Error checking device status on boot: ${error.message}")
            }
        )
        requestQueue.add(jsonObjectRequest)
    }
}
