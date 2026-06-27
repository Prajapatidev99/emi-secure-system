package com.emiseure.customer

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.view.WindowManager
import androidx.localbroadcastmanager.content.LocalBroadcastManager

/**
 * 🔐 CRITICAL FIX #4: Lock Screen Stickiness Manager
 *
 * Problem: System might dismiss lock screen via:
 * - Home button press
 * - Power button
 * - System gestures
 * - Activity destruction
 * - App crashes
 *
 * Solution: Monitor lock screen and immediately re-launch if destroyed
 * This service runs persistently and ensures lock stays on top
 */
class LockScreenStickinessService : Service() {

    companion object {
        private const val TAG = "LockStickiness"
        const val ACTION_LOCK_DESTROYED = "com.emiseure.customer.LOCK_DESTROYED"
        const val ACTION_KEEP_LOCK_ALIVE = "com.emiseure.customer.KEEP_LOCK_ALIVE"

        fun start(context: Context) {
            try {
                val intent = Intent(context, LockScreenStickinessService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                Log.d(TAG, "Lock stickiness service started")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start service", e)
            }
        }

        fun stop(context: Context) {
            try {
                val intent = Intent(context, LockScreenStickinessService::class.java)
                context.stopService(intent)
                Log.d(TAG, "Lock stickiness service stopped")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to stop service", e)
            }
        }
    }

    private var isMonitoring = false
    @Volatile private var monitorThread: Thread? = null  // BUG-08: volatile ref to interrupt stale threads

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service created")

        // Register to monitor lock screen destruction
        val filter = IntentFilter().apply {
            addAction(ACTION_LOCK_DESTROYED)
            addAction(ACTION_KEEP_LOCK_ALIVE)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(lockMonitorReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(lockMonitorReceiver, filter)
            }
            isMonitoring = true
            Log.d(TAG, "Lock monitor receiver registered")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register receiver", e)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service started with command")

        // Create notification for foreground service (required for Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundServiceNotification()
        }

        // Start monitoring lock screen health
        startMonitoringLockScreen()

        return START_STICKY // Restart if killed
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null // Not a bound service
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.w(TAG, "Service destroyed - attempting to restart")

        // BUG-08: Interrupt monitor thread BEFORE unregistering so it exits cleanly
        isMonitoring = false
        monitorThread?.interrupt()
        monitorThread = null

        try {
            unregisterReceiver(lockMonitorReceiver)
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering receiver", e)
        }

        // Re-launch lock screen if service is destroyed
        if (isDeviceLocked()) {
            relaunachLockScreen("SERVICE_DESTROYED")
        }
    }

    /**
     * 📌 Monitor lock screen process health
     */
    private fun startMonitoringLockScreen() {
        // BUG-08: Interrupt any previously running monitor thread to prevent doubling up
        monitorThread?.interrupt()

        val thread = Thread {
            try {
                while (isMonitoring && !Thread.currentThread().isInterrupted) {
                    // Check every 2 seconds
                    Thread.sleep(2000)

                    if (!isMonitoring || Thread.currentThread().isInterrupted) break

                    val prefs = createDeviceProtectedStorageContext()
                        .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)

                    if (!prefs.getBoolean("IS_LOCKED", false)) {
                        // Device was unlocked
                        Log.d(TAG, "Device unlocked - stopping stickiness monitoring")
                        break
                    }

                    // Check if lock screen activity is still alive
                    if (!isLockScreenRunning()) {
                        Log.e(TAG, "🚨 Lock screen activity crashed or was dismissed!")
                        relaunachLockScreen("ACTIVITY_DESTROYED")
                    }
                }
            } catch (e: InterruptedException) {
                Log.d(TAG, "Monitor thread interrupted cleanly")
                Thread.currentThread().interrupt() // restore interrupt status
            } catch (e: Exception) {
                Log.e(TAG, "Error in monitoring thread", e)
            }
        }

        thread.isDaemon = true
        thread.name = "LockScreenMonitor"
        monitorThread = thread  // BUG-08: store reference for later interruption
        thread.start()
    }

    /**
     * 📌 Check if lock screen activity is running
     */
    private fun isLockScreenRunning(): Boolean {
        return try {
            val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            // BUG-01: Use topActivity (currently visible) not baseActivity (root of stack)
            val tasks = activityManager.appTasks
            for (task in tasks) {
                val info = task.taskInfo
                if (info.topActivity?.className?.contains("LockScreenActivity") == true) {
                    return true
                }
            }
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error checking if lock screen running", e)
            false
        }
    }

    /**
     * 🚨 Check if device is supposed to be locked
     */
    private fun isDeviceLocked(): Boolean {
        return try {
            val prefs = createDeviceProtectedStorageContext()
                .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
            prefs.getBoolean("IS_LOCKED", false)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking lock state", e)
            false
        }
    }

    /**
     * 🚨 Re-launch lock screen immediately
     */
    private fun relaunachLockScreen(reason: String) {
        try {
            Log.w(TAG, "🚨 Re-launching lock screen (reason: $reason)")

            val lockIntent = Intent(this, LockScreenActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("RELAUNCH_REASON", reason)
            }

            startActivity(lockIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to relaunch lock screen", e)
        }
    }

    /**
     * 📌 Foreground service notification
     */
    private fun startForegroundServiceNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = "lock_service_channel"
            val channelName = "Lock Screen Service"

            val channel = android.app.NotificationChannel(
                channelId,
                channelName,
                android.app.NotificationManager.IMPORTANCE_LOW
            )

            val notificationManager = getSystemService(android.app.NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)

            val notification = android.app.Notification.Builder(this, channelId)
                .setContentTitle("Device Security")
                .setContentText("Lock screen monitoring active")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setAutoCancel(false)
                .build()

            startForeground(1, notification)
        }
    }

    /**
     * 📌 Receiver to monitor lock screen status
     */
    private val lockMonitorReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                ACTION_LOCK_DESTROYED -> {
                    Log.w(TAG, "Received LOCK_DESTROYED broadcast")
                    val reason = intent.getStringExtra("reason") ?: "UNKNOWN"
                    relaunachLockScreen(reason)
                }
                ACTION_KEEP_LOCK_ALIVE -> {
                    Log.d(TAG, "Lock screen alive - good")
                }
            }
        }
    }
}

/**
 * 🔐 Enhanced lock screen with built-in persistence
 * Add this to LockScreenActivity.onCreate() to register stickiness
 */
object LockScreenPersistenceHelper {

    fun enableStickiness(activity: LockScreenActivity) {
        try {
            // Start the stickiness service
            LockScreenStickinessService.start(activity)
            Log.d("LockPersistence", "Lock screen stickiness enabled")
        } catch (e: Exception) {
            Log.e("LockPersistence", "Failed to enable stickiness", e)
        }
    }

    fun disableStickiness(context: Context) {
        try {
            LockScreenStickinessService.stop(context)
            Log.d("LockPersistence", "Lock screen stickiness disabled")
        } catch (e: Exception) {
            Log.e("LockPersistence", "Failed to disable stickiness", e)
        }
    }

    /**
     * 🚨 Call from LockScreenActivity when it detects destruction
     */
    fun notifyLockDestroyed(context: Context, reason: String) {
        try {
            val intent = Intent(LockScreenStickinessService.ACTION_LOCK_DESTROYED).apply {
                putExtra("reason", reason)
                setPackage(context.packageName) // 🔒 Security: Only our app receives this
            }
            context.sendBroadcast(intent)
            Log.w("LockPersistence", "Notified: Lock destroyed ($reason)")
        } catch (e: Exception) {
            Log.e("LockPersistence", "Failed to notify lock destroyed", e)
        }
    }

    /**
     * 🛡️ Call periodically to indicate lock is healthy
     */
    fun notifyLockAlive(context: Context) {
        try {
            val intent = Intent(LockScreenStickinessService.ACTION_KEEP_LOCK_ALIVE).apply {
                setPackage(context.packageName)
            }
            context.sendBroadcast(intent)
        } catch (e: Exception) {
            Log.e("LockPersistence", "Failed to notify lock alive", e)
        }
    }
}
