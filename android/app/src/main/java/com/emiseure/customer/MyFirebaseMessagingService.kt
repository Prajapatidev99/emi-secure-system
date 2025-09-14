package com.emiseure.customer

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    private val TAG = "FCM_Service"

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "From: ${remoteMessage.from}")

        // Check if message contains a data payload.
        if (remoteMessage.data.isNotEmpty()) {
            Log.d(TAG, "Message data payload: " + remoteMessage.data)

            val action = remoteMessage.data["action"]
            val message = remoteMessage.data["message"]
            Log.d(TAG, "Received action: $action with message: $message")

            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(this, MyDeviceAdminReceiver::class.java)

            // Ensure app is device admin before attempting actions
            val isAdmin = dpm.isDeviceOwnerApp(applicationContext.packageName) || dpm.isAdminActive(adminComponent)
            if (!isAdmin) {
                Log.e(TAG, "Action '$action' ignored: App is not a device admin.")
                return
            }

            when (action) {
                "LOCK" -> {
                    Log.w(TAG, "DEVICE LOCK COMMAND RECEIVED!")
                    // Launch the custom lock screen activity
                    val lockIntent = Intent(this, LockScreenActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        // You can pass the message from the push notification if needed
                        // putExtra("lock_message", message)
                    }
                    startActivity(lockIntent)
                }
                "UNLOCK" -> {
                    Log.i(TAG, "DEVICE UNLOCK COMMAND RECEIVED!")
                    // Send a broadcast to the LockScreenActivity to close itself
                    val unlockIntent = Intent("com.emiseure.customer.ACTION_UNLOCK")
                    sendBroadcast(unlockIntent)
                }
                "WIPE" -> {
                    Log.e(TAG, "DEVICE WIPE COMMAND RECEIVED! THIS IS IRREVERSIBLE.")
                    // CRITICAL SECURITY FIX: Only a Device Owner can perform a factory reset.
                    // Check for this permission before attempting the wipe to prevent exceptions.
                    if (dpm.isDeviceOwnerApp(applicationContext.packageName)) {
                        try {
                            // For device owner apps, wipeData(0) performs a factory reset.
                            dpm.wipeData(0)
                        } catch (e: SecurityException) {
                            Log.e(TAG, "Failed to wipe device even as device owner", e)
                        }
                    } else {
                        Log.e(TAG, "WIPE COMMAND FAILED: App is not the device owner. Provisioning was not done correctly.")
                    }
                }
            }
        }
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "Refreshed token: $token")
        // The token is sent to the server on app startup (MainActivity).
    }
}
