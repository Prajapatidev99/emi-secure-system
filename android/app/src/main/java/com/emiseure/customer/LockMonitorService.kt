package com.emiseure.customer

import android.Manifest
import android.app.*
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.android.volley.Request
import com.android.volley.toolbox.JsonObjectRequest
import com.android.volley.toolbox.Volley
import com.emiseure.customer.BuildConfig
import com.google.android.gms.location.*
import org.json.JSONObject

class LockMonitorService : Service() {

    private val TAG = "LockMonitorService"
    private lateinit var dpm: DevicePolicyManager
    private lateinit var adminComponent: ComponentName
    private val handler = Handler(Looper.getMainLooper())
    private var monitorRunnable: Runnable? = null
    
    // Location tracking
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "lock_monitor_channel"
        private const val CHECK_INTERVAL_MS = 2000L // Check every 2 seconds
        private const val LOCATION_UPDATE_INTERVAL_MS = 300000L // 5 minutes
        // Backend URL loaded from BuildConfig (local.properties)
        private val BACKEND_URL = "${BuildConfig.BACKEND_URL}/api/public/devices/location"
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "LockMonitorService created")

        dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        adminComponent = ComponentName(this, MyDeviceAdminReceiver::class.java)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "LockMonitorService started")

        val action = intent?.action

        when (action) {
            "START_MONITORING" -> {
                startMonitoring()
                disableADB()
                enableLocationAndStartTracking()
            }
            "STOP_MONITORING" -> {
                stopMonitoring()
                stopLocationTracking()
                enableADB()
                stopSelf()
            }
            else -> {
                startMonitoring()
            }
        }

        return START_STICKY // Service restarts if killed
    }

    private fun startMonitoring() {
        Log.d(TAG, "Starting lock state monitoring")

        monitorRunnable = object : Runnable {
            override fun run() {
                try {
                    val prefs = createDeviceProtectedStorageContext()
                        .getSharedPreferences("EMI_SECURE_PREFS", Context.MODE_PRIVATE)
                    
                    val isLocked = prefs.getBoolean("IS_LOCKED", false)

                    if (isLocked) {
                        ensureLockScreenIsVisible()
                    } else {
                        // Device was unlocked, stop monitoring
                        Log.d(TAG, "Device unlocked, stopping service")
                        stopSelf()
                    }

                } catch (e: Exception) {
                    Log.e(TAG, "Error in monitoring loop", e)
                }

                handler.postDelayed(this, CHECK_INTERVAL_MS)
            }
        }

        handler.post(monitorRunnable!!)
    }

    private fun stopMonitoring() {
        Log.d(TAG, "Stopping lock state monitoring")
        monitorRunnable?.let { handler.removeCallbacks(it) }
        monitorRunnable = null
    }

    private fun ensureLockScreenIsVisible() {
        try {
            // Check if LockScreenActivity is currently running
            val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val tasks = activityManager.appTasks

            var lockScreenVisible = false
            for (task in tasks) {
                val taskInfo = task.taskInfo
                if (taskInfo.topActivity?.className?.contains("LockScreenActivity") == true) {
                    lockScreenVisible = true
                    break
                }
            }

            if (!lockScreenVisible) {
                Log.w(TAG, "Lock screen not visible, relaunching")
                launchLockScreen()
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error checking lock screen visibility", e)
            // If check fails, try to launch anyway
            launchLockScreen()
        }
    }

    private fun launchLockScreen() {
        try {
            val lockIntent = Intent(this, LockScreenActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
            }
            startActivity(lockIntent)
            Log.d(TAG, "Lock screen launched")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch lock screen", e)
        }
    }

    private fun disableADB() {
        if (!dpm.isDeviceOwnerApp(packageName)) {
            Log.w(TAG, "Not device owner, cannot disable ADB")
            return
        }

        try {
            dpm.setGlobalSetting(
                adminComponent,
                Settings.Global.ADB_ENABLED,
                "0"
            )
            Log.d(TAG, "ADB disabled")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to disable ADB", e)
        }
    }

    private fun enableADB() {
        if (!dpm.isDeviceOwnerApp(packageName)) {
            return
        }

        try {
            dpm.setGlobalSetting(
                adminComponent,
                Settings.Global.ADB_ENABLED,
                "1"
            )
            Log.d(TAG, "ADB enabled")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to enable ADB", e)
        }
    }

    // =====================================
    // 📍 LOCATION TRACKING
    // =====================================
    private fun enableLocationAndStartTracking() {
        // Auto-enable location services using Device Owner
        if (dpm.isDeviceOwnerApp(packageName)) {
            try {
                dpm.setLocationEnabled(adminComponent, true)
                Log.d(TAG, "📍 Location services enabled")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to enable location", e)
            }
        }

        startLocationTracking()
    }

    private fun startLocationTracking() {
        // Check permissions
        val hasFineLocation = ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val hasBackgroundLocation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

        if (!hasFineLocation || !hasBackgroundLocation) {
            Log.w(TAG, "⚠️ Location permissions not granted")
            return
        }

        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            LOCATION_UPDATE_INTERVAL_MS
        ).apply {
            setMinUpdateIntervalMillis(LOCATION_UPDATE_INTERVAL_MS)
        }.build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    Log.d(TAG, "📍 Location update: ${location.latitude}, ${location.longitude}")
                    sendLocationToBackend(location.latitude, location.longitude, location.accuracy)
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback!!,
                Looper.getMainLooper()
            )
            Log.d(TAG, "📍 Location tracking started")
        } catch (e: SecurityException) {
            Log.e(TAG, "Failed to request location updates", e)
        }
    }

    private fun stopLocationTracking() {
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
            Log.d(TAG, "📍 Location tracking stopped")
        }
        locationCallback = null
    }

    private fun sendLocationToBackend(latitude: Double, longitude: Double, accuracy: Float) {
        try {
            val androidId = Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ANDROID_ID
            )

            val body = JSONObject().apply {
                put("androidId", androidId)
                put("latitude", latitude)
                put("longitude", longitude)
                put("accuracy", accuracy)
                put("timestamp", System.currentTimeMillis())
            }

            val queue = Volley.newRequestQueue(this)
            queue.add(
                JsonObjectRequest(
                    Request.Method.POST,
                    BACKEND_URL,
                    body,
                    { Log.d(TAG, "📍 Location sent to backend") },
                    { error -> Log.e(TAG, "Failed to send location", error) }
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error sending location to backend", e)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Lock Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors device lock state"
                setShowBadge(false)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Device Security Active")
            .setContentText("EMI Secure is monitoring device lock state")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        stopMonitoring()
        stopLocationTracking()
        Log.d(TAG, "LockMonitorService destroyed")
    }
}
