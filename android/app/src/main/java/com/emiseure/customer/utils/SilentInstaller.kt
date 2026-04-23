package com.emiseure.customer.utils

import android.app.DownloadManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.util.Log
import java.io.File
import java.io.FileInputStream

/**
 * 🚀 OTA SILENT INSTALLER
 * 
 * Uses Android PackageInstaller (API 21+) to perform silent background updates.
 * Requires the app to be Device Owner.
 */
object SilentInstaller {
    private const val TAG = "SilentInstaller"
    private const val ACTION_INSTALL_COMPLETE = "com.emiseure.customer.INSTALL_COMPLETE"

    fun startUpdate(context: Context, apkUrl: String) {
        try {
            Log.d(TAG, "Starting OTA Download: $apkUrl")
            
            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val request = DownloadManager.Request(Uri.parse(apkUrl))
                .setTitle("System Update")
                .setDescription("Updating EMI Secure...")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_HIDDEN)
                .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, "update.apk")
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true)

            val downloadId = downloadManager.enqueue(request)

            // Register receiver to handle download completion
            val receiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context, intent: Intent) {
                    val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
                    if (id == downloadId) {
                        Log.i(TAG, "Download complete! Initiating silent install...")
                        context.unregisterReceiver(this)
                        
                        val downloadedFile = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "update.apk")
                        if (downloadedFile.exists()) {
                            performInstall(context, downloadedFile)
                        } else {
                            Log.e(TAG, "Downloaded file not found at ${downloadedFile.absolutePath}")
                        }
                    }
                }
            }
            
            context.registerReceiver(receiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start OTA update", e)
        }
    }

    private fun performInstall(context: Context, apkFile: File) {
        try {
            val packageInstaller = context.packageManager.packageInstaller
            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
            }

            val sessionId = packageInstaller.createSession(params)
            val session = packageInstaller.openSession(sessionId)

            val out = session.openWrite("update", 0, -1)
            val input = FileInputStream(apkFile)
            val buffer = ByteArray(65536)
            var n: Int
            while (input.read(buffer).also { n = it } != -1) {
                out.write(buffer, 0, n)
            }
            session.fsync(out)
            input.close()
            out.close()

            // Prepare intent to receive install status
            val intent = Intent(ACTION_INSTALL_COMPLETE)
            intent.setPackage(context.packageName)
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                sessionId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )

            session.commit(pendingIntent.intentSender)
            session.close()
            Log.i(TAG, "Install session committed: $sessionId")

        } catch (e: Exception) {
            Log.e(TAG, "Silent install failed", e)
        }
    }
}
