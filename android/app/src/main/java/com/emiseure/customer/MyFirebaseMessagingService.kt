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

    // +++ MODIFIED: Function to save the lock state to device-protected storage +++
    private fun setLockedState(context: Context, isLocked: Boolean) {
        val deviceContext = context.createDeviceProtectedStorageContext()
        val prefs = deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("IS_LOCKED", isLocked).apply()
        Log.d(TAG, "Device locked state saved as: $isLocked")
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        // ... (rest of the function is the same, calling the updated setLockedState) ...
        
        val action = remoteMessage.data["action"]
        when (action) {
            "LOCK" -> {
                Log.w(TAG, "DEVICE LOCK COMMAND RECEIVED!")
                setLockedState(this, true)
                val lockIntent = Intent(this, LockScreenActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(lockIntent)
            }
            "UNLOCK" -> {
                Log.i(TAG, "DEVICE UNLOCK COMMAND RECEIVED!")
                setLockedState(this, false)
                val unlockIntent = Intent("com.emiseure.customer.ACTION_UNLOCK")
                sendBroadcast(unlockIntent)
            }
            // ...
        }
    }
}
