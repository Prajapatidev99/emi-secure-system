package com.emiseure.customer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import com.android.volley.Request
import com.android.volley.toolbox.JsonObjectRequest
import com.android.volley.toolbox.Volley
import com.emiseure.customer.BuildConfig
import org.json.JSONObject

/**
 * USB Monitor Receiver
 * Detects USB connections and logs them to backend for security monitoring.
 * Helps detect potential ADB connection attempts.
 */
class UsbMonitorReceiver : BroadcastReceiver() {

    private val TAG = "UsbMonitor"

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "android.hardware.usb.action.USB_STATE") {
            val connected = intent.extras?.getBoolean("connected") ?: false
            
            Log.d(TAG, "USB State Changed: connected=$connected")
            
            if (connected) {
                Log.w(TAG, "⚠️ USB CONNECTED - Potential ADB attempt")
                reportUsbConnection(context)
            } else {
                Log.d(TAG, "USB disconnected")
            }
        }
    }

    private fun reportUsbConnection(context: Context) {
        try {
            val androidId = android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.ANDROID_ID
            )

            val body = JSONObject().apply {
                put("androidId", androidId)
                put("event", "USB_CONNECTED")
                put("timestamp", System.currentTimeMillis())
                put("deviceModel", Build.MODEL)
                put("androidVersion", Build.VERSION.RELEASE)
            }

            val queue = Volley.newRequestQueue(context)
            val url = "${BuildConfig.BACKEND_URL}/api/public/devices/security-event"

            queue.add(
                JsonObjectRequest(
                    Request.Method.POST,
                    url,
                    body,
                    { Log.d(TAG, "USB connection reported to backend") },
                    { error -> Log.e(TAG, "Failed to report USB connection", error) }
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error reporting USB connection", e)
        }
    }
}
