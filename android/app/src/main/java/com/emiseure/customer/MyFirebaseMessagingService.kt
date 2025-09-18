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

    private fun setLockedState(context: Context, isLocked: Boolean) {
        // Use device-protected storage to be accessible before the user unlocks the phone
        val deviceContext = context.createDeviceProtectedStorageContext()
        val prefs = deviceContext.getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("IS_LOCKED", isLocked).commit()
        Log.d(TAG, "Device locked state saved synchronously as: $isLocked")
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "From: ${remoteMessage.from}")

        if (remoteMessage.data.isNotEmpty()) {
            Log.d(TAG, "Message data payload: " + remoteMessage.data)

            val action = remoteMessage.data["action"]
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(this, MyDeviceAdminReceiver::class.java)

            val isAdmin = dpm.isDeviceOwnerApp(applicationContext.packageName) || dpm.isAdminActive(adminComponent)
            if (!isAdmin) {
                Log.e(TAG, "Action '$action' ignored: App is not a device admin.")
                return
            }

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
                "WIPE" -> {
                    Log.e(TAG, "DEVICE WIPE COMMAND RECEIVED! THIS IS IRREVERSIBLE.")
                    if (dpm.isDeviceOwnerApp(applicationContext.packageName)) {
                        try {
                            dpm.wipeData(0)
                        } catch (e: SecurityException) {
                            Log.e(TAG, "Failed to wipe device even as device owner", e)
                        }
                    } else {
                        Log.e(TAG, "WIPE COMMAND FAILED: App is not the device owner.")
                    }
                }
            }
        }
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "Refreshed token: $token")
    }
}
