package com.emiseure.customer.utils

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.emiseure.customer.MainActivity
import com.emiseure.customer.R

/**
 * Payment Reminder Receiver
 * Receives alarm broadcasts and displays payment reminder notifications.
 */
class PaymentReminderReceiver : BroadcastReceiver() {

    private val TAG = "PaymentReminderRx"

    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra("title") ?: "EMI Reminder"
        val message = intent.getStringExtra("message") ?: "Payment reminder"
        val requestCode = intent.getIntExtra("requestCode", 0)

        Log.d(TAG, "Showing notification: $title")

        showNotification(context, title, message, requestCode)
    }

    private fun showNotification(context: Context, title: String, message: String, notificationId: Int) {
        // Intent to open app when notification is clicked
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build notification
        val notification = NotificationCompat.Builder(context, "payment_reminders")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setVibrate(longArrayOf(0, 500, 200, 500))
            .build()

        // Show notification
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(notificationId, notification)

        Log.d(TAG, "Notification displayed: ID=$notificationId")
    }
}
