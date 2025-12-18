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

    // ------------------------------
    // 🔐 DIRECT BOOT SAFE STORAGE
    // ------------------------------
    private fun getSecurePrefs(context: Context) =
        context.createDeviceProtectedStorageContext()
            .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

    private fun saveLockState(context: Context, locked: Boolean) {
        getSecurePrefs(context)
            .edit()
            .putBoolean("IS_LOCKED", locked)
            .commit() // MUST be sync (reboot safety)
        Log.d(TAG, "IS_LOCKED saved as $locked")
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        if (data.isEmpty()) return

        val action = data["action"]
        val unlockKey = data["unlock_key"] // Server-synced offline key

        Log.d(TAG, "FCM received → action=$action")

        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(this, MyDeviceAdminReceiver::class.java)

        val isAuthorized =
            dpm.isDeviceOwnerApp(packageName) || dpm.isAdminActive(adminComponent)

        if (!isAuthorized) {
            Log.e(TAG, "Command ignored. App is not Device Owner / Admin.")
            return
        }

        val prefs = getSecurePrefs(this)

        // ------------------------------------
        // 🔑 UPDATE OFFLINE MASTER KEY (IF ANY)
        // ------------------------------------
        unlockKey?.let {
            prefs.edit().putString("UNLOCK_KEY", it).apply()
            Log.d(TAG, "Offline unlock key updated from server")
        }

        // ------------------------------
        // 🚨 COMMAND HANDLER
        // ------------------------------
        when (action) {

            "LOCK" -> {
                Log.w(TAG, "LOCK command received")

                saveLockState(this, true)

                val lockIntent = Intent(this, LockScreenActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    putExtra("UNLOCK_KEY_VIA_INTENT", unlockKey)
                }
                startActivity(lockIntent)
            }

            "UNLOCK" -> {
                Log.i(TAG, "UNLOCK command received")

                saveLockState(this, false)

                sendBroadcast(
                    Intent("com.emiseure.customer.ACTION_UNLOCK")
                )
            }

            "WIPE" -> {
                Log.e(TAG, "WIPE command received")

                if (dpm.isDeviceOwnerApp(packageName)) {
                    try {
                        dpm.wipeData(0)
                    } catch (e: SecurityException) {
                        Log.e(TAG, "Device wipe failed", e)
                    }
                } else {
                    Log.e(TAG, "WIPE denied. Not device owner.")
                }
            }

            else -> {
                Log.w(TAG, "Unknown action: $action")
            }
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token: $token")
        // Send token to your server here
    }
}
