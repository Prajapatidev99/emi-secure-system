package com.emiseure.customer

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.UserManager
import android.util.Log

class MyDeviceAdminReceiver : DeviceAdminReceiver() {
    private val TAG = "DeviceAdminReceiver"

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.d(TAG, "Device Admin: Enabled")

        // This is the correct place to apply policies, as this is called only
        // when admin privileges are first granted.
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(context.applicationContext, MyDeviceAdminReceiver::class.java)

        // Check if we are being set as a Device Owner
        if (dpm.isDeviceOwnerApp(context.packageName)) {
            Log.i(TAG, "App has been set as the Device Owner. Applying security policies.")

            // Disable factory reset from settings
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET)

            // Disable adding new users
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_ADD_USER)

            // Disable OEM unlocking in developer options
            dpm.addUserRestriction(adminComponent, "no_oem_unlock")

            Log.i(TAG, "Security policies (Factory Reset, Add User, OEM Unlock) are now active.")
        } else {
            Log.w(TAG, "App was enabled as a standard admin, not a device owner. Security policies not applied.")
        }
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.w(TAG, "Device Admin: Disabled")
    }
}
