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
 * 🔌 USB Monitor Receiver
 * Detects USB connections and applies security measures to prevent:
 * - USB debugging/ADB attacks
 * - USB file transfer/formatting
 * - Unauthorized data access
 * - Recovery mode exploitation
 * 
 * Also logs all connections to backend for security monitoring.
 */
class UsbMonitorReceiver : BroadcastReceiver() {

    private val TAG = "UsbMonitor"

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "android.hardware.usb.action.USB_STATE") {
            val connected = intent.extras?.getBoolean("connected") ?: false
            
            Log.d(TAG, "USB State Changed: connected=$connected")
            
            if (connected) {
                Log.w(TAG, "🚨 USB CONNECTED - Enforcing USB security measures")
                
                // 🛡️ Immediately enforce USB security when connection detected
                UsbSecurityManager.enforceUsbSecurity(context)
                
                // 📊 Record the connection for audit trail
                UsbSecurityManager.recordUsbConnection(context, "USB_DEVICE")
                
                // 📡 Report to backend for server-side monitoring
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

            // 📊 Get USB security statistics
            val usbStats = UsbSecurityManager.getUsbConnectionStats(context)

            val body = JSONObject().apply {
                put("androidId", androidId)
                put("event", "USB_CONNECTED")
                put("timestamp", System.currentTimeMillis())
                put("deviceModel", Build.MODEL)
                put("androidVersion", Build.VERSION.RELEASE)
                
                // 🛡️ Include USB security metrics
                put("totalUsbConnections", usbStats["totalConnections"])
                put("rapidAttackCount", usbStats["rapidAttackCount"])
                put("securityAlerts", usbStats["securityAlerts"])
                put("lastConnectionType", usbStats["lastConnectionType"])
                
                // 📱 Device info
                put("deviceBrand", Build.BRAND)
                put("deviceManufacturer", Build.MANUFACTURER)
                put("androidSdk", Build.VERSION.SDK_INT)
            }

            val queue = Volley.newRequestQueue(context)
            val url = "${BuildConfig.BACKEND_URL}/api/public/devices/security-event"

            queue.add(
                JsonObjectRequest(
                    Request.Method.POST,
                    url,
                    body,
                    { 
                        Log.d(TAG, "✅ USB connection reported to backend with security metrics")
                        Log.d(TAG, "📊 USB Stats: $usbStats")
                    },
                    { error -> 
                        Log.e(TAG, "Failed to report USB connection", error)
                        // Still log locally even if server report fails
                        Log.w(TAG, "📊 USB Stats (local only): $usbStats")
                    }
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error reporting USB connection", e)
        }
    }
}
