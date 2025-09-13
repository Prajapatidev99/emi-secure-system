package com.emiseure.customer.utils

import android.content.Context
import android.content.SharedPreferences

object DeviceLockManager {

    private const val PREFS_NAME = "DeviceLockPrefs"
    private const val IS_LOCKED_KEY = "isLocked"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun setLocked(context: Context, isLocked: Boolean) {
        getPrefs(context).edit().putBoolean(IS_LOCKED_KEY, isLocked).apply()
    }

    fun isLocked(context: Context): Boolean {
        return getPrefs(context).getBoolean(IS_LOCKED_KEY, false)
    }
}