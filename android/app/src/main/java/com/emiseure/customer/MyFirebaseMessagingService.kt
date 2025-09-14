package com.emiseure.customer

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d("FCM", "From: ${remoteMessage.from}")

        remoteMessage.data.isNotEmpty().let {
            Log.d("FCM", "Message data payload: " + remoteMessage.data)
            
            when (remoteMessage.data["action"]) {
                "LOCK" -> handleLockCommand()
                "UNLOCK" -> handleUnlockCommand()
                "WIPE" -> handleWipeCommand()
            }
        }
    }

    private fun handleLockCommand() {
        Log.d("FCM_Action", "Received LOCK command.")
        val lockIntent = Intent(this, LockScreenActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        startActivity(lockIntent)
    }

    private fun handleUnlockCommand() {
        Log.d("FCM_Action", "Received UNLOCK command.")
        // Send a broadcast to the LockScreenActivity to close itself
        val unlockIntent = Intent(LockScreenActivity.ACTION_UNLOCK)
        sendBroadcast(unlockIntent)
    }

    private fun handleWipeCommand() {
        Log.d("FCM_Action", "Received WIPE command.")
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val deviceAdmin = ComponentName(this, MyDeviceAdminReceiver::class.java)
        
        // Check if the app is the device owner before wiping
        if (dpm.isDeviceOwnerApp(packageName)) {
            Log.w("FCM_Action", "Executing factory reset.")
            dpm.wipeData(0)
        } else {
            Log.e("FCM_Action", "WIPE command received, but app is not device owner.")
        }
    }
    
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCM", "Refreshed token: $token")
        // You would typically send this new token to your server here
        // The MainActivity already handles sending the token on startup, which is sufficient for this app's lifecycle.
    }
}
