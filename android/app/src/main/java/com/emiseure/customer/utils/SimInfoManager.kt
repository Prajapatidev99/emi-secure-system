package com.emiseure.customer.utils

import android.Manifest
import android.annotation.SuppressLint
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.app.ActivityCompat
import org.json.JSONObject

class SimInfoManager(private val context: Context) {

    private val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
    private val subscriptionManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager

    data class SimSlotInfo(
        val phoneNumber: String?,
        val operator: String?,
        val simSerial: String?,
        val country: String?
    )

    fun getImei2(): String? {
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            return null
        }
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Device Owner can often get multiple IMEIs
                telephonyManager.getImei(1) // 0 is primary, 1 is secondary
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e("SimInfoManager", "Failed to get IMEI2: ${e.message}")
            null
        }
    }

    @SuppressLint("HardwareIds")
    fun getFullSimDetails(): JSONObject {
        val root = JSONObject()
        val slot1 = JSONObject()
        val slot2 = JSONObject()

        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            return root
        }

        try {
            val activeSubscriptions = subscriptionManager.activeSubscriptionInfoList
            activeSubscriptions?.forEachIndexed { index, info ->
                val slot = JSONObject().apply {
                    put("operator", info.displayName)
                    put("simSerial", info.iccId)
                    put("country", info.countryIso)
                    
                    // Fetch phone number if available (API 33+)
                    val number = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        try { subscriptionManager.getPhoneNumber(info.subscriptionId) } catch (e: Exception) { null }
                    } else {
                        info.number // Legacy (often null)
                    }
                    put("phoneNumber", number ?: "")
                }
                
                if (info.simSlotIndex == 0) root.put("slot1", slot)
                if (info.simSlotIndex == 1) root.put("slot2", slot)
            }
        } catch (e: Exception) {
            Log.e("SimInfoManager", "Error fetching SIM details", e)
        }

        return root
    }
}
