package com.emiseure.customer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import java.util.Timer
import java.util.TimerTask

/**
 * 🔐 CRITICAL FIX #5: Software-Based USB Security (Works Without Device Owner)
 *
 * Problem: USB security relies entirely on DevicePolicyManager restrictions
 * If Device Owner is removed, user can connect USB and format device
 *
 * Solution: Implement software-based USB detection and enforcement that works
 * even without device owner permissions using:
 * 1. USB broadcast receiver monitoring
 * 2. Continuous polling of USB state
 * 3. Settings.Global monitoring for ADB enable
 * 4. Immediate lock screen on USB detection
 * 5. Backend reporting for audit
 */
class SoftwareBasedUsbSecurityManager(private val context: Context) {

    companion object {
        private const val TAG = "SwUsbSecurity"
        private const val PREFS_NAME = "USB_SECURITY_SOFTWARE"
        private const val USB_STATE_BROADCAST = "android.hardware.usb.action.USB_STATE"
        private const val ADB_ENABLED_SETTING = "adb_enabled"
        private const val POLLING_INTERVAL_MS = 5000L // Check every 5 seconds
    }

    private val prefs = context.createDeviceProtectedStorageContext()
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private var pollingTimer: Timer? = null
    private var isUsbConnected = false
    private var isAdbEnabled = false
    private var lastDetectionTime = 0L

    /**
     * 🚀 Start software-based USB security monitoring
     * Call from MainActivity or BootReceiver
     */
    fun startUsbMonitoring() {
        Log.d(TAG, "Starting software-based USB security monitoring")

        try {
            // Register for immediate USB state broadcasts
            registerUsbBroadcastReceiver()

            // Start periodic polling (more reliable than broadcasts alone)
            startUsbPollingThread()

            Log.d(TAG, "✅ USB monitoring initialized")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start USB monitoring", e)
        }
    }

    /**
     * 🚀 Stop monitoring (call on unlock or app close)
     */
    fun stopUsbMonitoring() {
        try {
            pollingTimer?.cancel()
            pollingTimer = null
            
            // FIX: Unregister receiver to prevent memory/context leak
            try {
                context.unregisterReceiver(usbStateReceiver)
                Log.d(TAG, "USB broadcast receiver unregistered")
            } catch (e: Exception) {
                // Ignore if not registered
            }
            
            Log.d(TAG, "USB monitoring stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping monitoring", e)
        }
    }

    /**
     * ✅ Get current USB connection status
     */
    fun isUsbConnected(): Boolean = isUsbConnected

    /**
     * ✅ Get ADB status
     */
    fun isAdbEnabled(): Boolean = isAdbEnabled

    /**
     * 🔴 Immediately lock device if USB attack detected
     */
    private fun lockDeviceOnUsbDetection(reason: String) {
        try {
            Log.w(TAG, "🚨 USB ATTACK DETECTED: $reason - Locking device immediately")

            // Record security event
            TamperDetectionManager.recordTamperAttempt(
                context,
                "USB_$reason"
            )

            // Enforce lock via backend
            DeviceOwnerFallbackManager(context).enforceServerSideLock()

            // Send alert to backend
            reportUsbSecurityEvent(reason)
        } catch (e: Exception) {
            Log.e(TAG, "Error locking device on USB detection", e)
        }
    }

    /**
     * 📡 Register for USB state broadcasts
     */
    private fun registerUsbBroadcastReceiver() {
        val filter = IntentFilter(USB_STATE_BROADCAST).apply {
            addAction(Intent.ACTION_BATTERY_CHANGED) // Also check for charging state
            addAction("android.hardware.usb.action.USB_DEVICE_ATTACHED")
            addAction("android.hardware.usb.action.USB_DEVICE_DETACHED")
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(usbStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                context.registerReceiver(usbStateReceiver, filter)
            }
            Log.d(TAG, "USB broadcast receiver registered")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register USB receiver", e)
        }
    }

    /**
     * 🔄 Continuous polling of USB and ADB status
     */
    private fun startUsbPollingThread() {
        pollingTimer = Timer("UsbSecurityPolling", true)
        pollingTimer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                try {
                    // Check USB state via Settings
                    checkUsbViaSettings()

                    // Check ADB enabled status
                    checkAdbStatus()

                    // Check for rapid USB connect/disconnect (attack pattern)
                    detectRapidUsbToggling()
                } catch (e: Exception) {
                    Log.e(TAG, "Error in USB polling", e)
                }
            }
        }, 0, POLLING_INTERVAL_MS)
    }

    /**
     * 📌 Check USB status via Settings.Global
     */
    private fun checkUsbViaSettings() {
        try {
            // Try to read USB configuration
            val usbConfig = try {
                Settings.Global.getString(context.contentResolver, "usb_config") ?: ""
            } catch (e: Exception) {
                ""
            }

            // USB modes: adb, mtp, ptp, midi, accessory, etc.
            val wasConnected = isUsbConnected
            isUsbConnected = usbConfig.isNotEmpty() && 
                    (usbConfig.contains("adb") || 
                     usbConfig.contains("mtp") || 
                     usbConfig.contains("ptp"))

            if (isUsbConnected && !wasConnected) {
                Log.w(TAG, "⚠️ USB connected (mode: $usbConfig)")
                lastDetectionTime = System.currentTimeMillis()
                
                // FIX: Increment the recent connections counter for rapid toggling detection
                val recent = prefs.getInt("RECENT_USB_CONNECTIONS", 0)
                prefs.edit().putInt("RECENT_USB_CONNECTIONS", recent + 1).commit()
                
                lockDeviceOnUsbDetection("USB_CONNECTED")
            } else if (!isUsbConnected && wasConnected) {
                Log.d(TAG, "✅ USB disconnected")
            }
        } catch (e: Exception) {
            Log.d(TAG, "Could not read USB config from Settings (expected on some devices)")
        }
    }

    /**
     * 📌 Check if ADB is enabled
     */
    private fun checkAdbStatus() {
        try {
            val adbEnabled = try {
                Settings.Global.getInt(context.contentResolver, ADB_ENABLED_SETTING, 0) == 1
            } catch (e: Exception) {
                false
            }

            if (adbEnabled && !isAdbEnabled) {
                Log.w(TAG, "🚨 ADB ENABLED - Potential attack!")
                isAdbEnabled = true
                lockDeviceOnUsbDetection("ADB_ENABLED")

                // Try to disable ADB again (requires device owner)
                tryDisableAdb()
            } else if (!adbEnabled && isAdbEnabled) {
                Log.d(TAG, "✅ ADB disabled")
                isAdbEnabled = false
            }
        } catch (e: Exception) {
            Log.d(TAG, "Could not check ADB status")
        }
    }

    /**
     * 📌 Detect rapid USB connect/disconnect (attack pattern)
     */
    private fun detectRapidUsbToggling() {
        if (!isUsbConnected) return

        val timeSinceLastDetection = System.currentTimeMillis() - lastDetectionTime
        
        // FIX: Clear counter if last detection was more than 60s ago
        if (timeSinceLastDetection > 60000) {
            prefs.edit().putInt("RECENT_USB_CONNECTIONS", 0).commit()
            return
        }
        
        val recentConnections = prefs.getInt("RECENT_USB_CONNECTIONS", 0)

        // If more than 5 USB connections in the last 60 seconds = attack
        if (recentConnections > 5) {
            Log.e(TAG, "🚨 RAPID USB TOGGLING DETECTED - Possible attack!")
            lockDeviceOnUsbDetection("RAPID_USB_TOGGLING")

            // Reset counter
            prefs.edit().putInt("RECENT_USB_CONNECTIONS", 0).commit()
        }
    }

    /**
     * 🔄 Try to disable ADB (requires device owner but good to try)
     */
    private fun tryDisableAdb() {
        try {
            // Attempt to disable ADB via settings
            Settings.Global.putInt(context.contentResolver, ADB_ENABLED_SETTING, 0)
            Log.d(TAG, "Attempted to disable ADB via Settings")
        } catch (e: Exception) {
            Log.d(TAG, "Could not disable ADB (expected without device owner)")
        }

        // Report to backend for remote enforcement
        reportUsbSecurityEvent("ADB_DISABLE_ATTEMPTED")
    }

    /**
     * 📡 Broadcast receiver for USB events
     */
    private val usbStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            try {
                when (intent?.action) {
                    USB_STATE_BROADCAST -> {
                        Log.d(TAG, "USB state broadcast received: ${intent.extras}")
                        checkUsbViaSettings()
                    }
                    "android.hardware.usb.action.USB_DEVICE_ATTACHED" -> {
                        Log.w(TAG, "🚨 USB device attached")
                        lockDeviceOnUsbDetection("USB_DEVICE_ATTACHED")
                    }
                    "android.hardware.usb.action.USB_DEVICE_DETACHED" -> {
                        Log.d(TAG, "USB device detached")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in USB broadcast receiver", e)
            }
        }
    }

    /**
     * 📊 Report USB security event to backend
     */
    private fun reportUsbSecurityEvent(eventType: String) {
        Handler(Looper.getMainLooper()).post {
            try {
                val request = org.json.JSONObject().apply {
                    put("action", "USB_SECURITY_EVENT")
                    put("eventType", eventType)
                    put("timestamp", System.currentTimeMillis())
                    put("usbConnected", isUsbConnected)
                    put("adbEnabled", isAdbEnabled)
                }

                // FIX: Send real request using SecureNetworkClient instead of stub
                Log.d(TAG, "USB event reported: $eventType")
                val url = "https://emi-secure-system.onrender.com/api/public/devices/security-event"
                com.emiseure.customer.utils.SecureNetworkClient.post(
                    url = url,
                    body = request,
                    onSuccess = { Log.d(TAG, "USB event successfully sent to backend") },
                    onError = { Log.e(TAG, "Failed to send USB event: $it") }
                )
            } catch (e: Exception) {
                Log.e(TAG, "Error reporting USB event", e)
            }
        }
    }

    /**
     * 🛡️ Get USB security statistics
     */
    fun getUsbStats(): Map<String, Any> {
        return mapOf(
            "usbConnected" to isUsbConnected,
            "adbEnabled" to isAdbEnabled,
            "isMonitoring" to (pollingTimer != null),
            "lastDetectionTime" to lastDetectionTime
        )
    }
}

/**
 * 🚀 Initialize software USB security from MainActivity
 */
fun initializeSwUsbSecurity(context: Context) {
    try {
        val manager = SoftwareBasedUsbSecurityManager(context)
        manager.startUsbMonitoring()
        Log.d("UsbSecurityInit", "Software USB security initialized")
    } catch (e: Exception) {
        Log.e("UsbSecurityInit", "Failed to initialize", e)
    }
}
