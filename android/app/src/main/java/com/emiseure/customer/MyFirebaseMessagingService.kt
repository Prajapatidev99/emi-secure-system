package com.emiseure.customer

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
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
                    try {
                        dpm.lockNow()
                    } catch (e: SecurityException) {
                        Log.e(TAG, "Failed to lock device", e)
                    }
                }
                "UNLOCK" -> {
                    // Unlocking is handled by the user with their password.
                    // This command is a signal that their account is clear.
                    // You could trigger a local notification here if desired.
                    Log.i(TAG, "DEVICE UNLOCK COMMAND RECEIVED! User can now unlock.")
                }
                "WIPE" -> {
                    Log.e(TAG, "DEVICE WIPE COMMAND RECEIVED! THIS IS IRREVERSIBLE.")
                    try {
                         // For device owner apps, wipeData(0) performs a factory reset.
                        dpm.wipeData(0)
                    } catch (e: SecurityException) {
                        Log.e(TAG, "Failed to wipe device", e)
                    }
                }
            }
        }
    }
    
    override fun onNewToken(token: String) {
        Log.d(TAG, "Refreshed token: $token")
        // The token is sent to the server on app startup (MainActivity).
        // If the app is running when the token refreshes, you could add logic here
        // to re-send it to the server immediately.
    }
}
