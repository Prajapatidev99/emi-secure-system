package com.emiseure.customer.utils

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.emiseure.customer.MainActivity
import java.util.*

/**
 * Payment Reminder Manager
 * Schedules local notifications for upcoming EMI payments (offline capable).
 * Sends reminders 3 days before, 1 day before, and on the due date.
 */
object PaymentReminderManager {

    private const val TAG = "PaymentReminder"
    private const val CHANNEL_ID = "payment_reminders"
    private const val CHANNEL_NAME = "Payment Reminders"
    
    // Request codes for different reminder types
    private const val REQUEST_CODE_3_DAYS = 1001
    private const val REQUEST_CODE_1_DAY = 1002
    private const val REQUEST_CODE_DUE_DATE = 1003

    /**
     * Create notification channel (required for Android 8.0+)
     */
    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Reminders for upcoming EMI payments"
                enableVibration(true)
                enableLights(true)
            }

            val notificationManager = context.getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
            Log.d(TAG, "Notification channel created")
        }
    }

    /**
     * Schedule all payment reminders
     * @param dueDateString Due date in format "YYYY-MM-DD"
     * @param amount Payment amount
     */
    fun scheduleReminders(context: Context, dueDateString: String, amount: Double) {
        try {
            // Parse due date
            val parts = dueDateString.split("-")
            if (parts.size != 3) {
                Log.e(TAG, "Invalid date format: $dueDateString")
                return
            }

            val calendar = Calendar.getInstance().apply {
                set(Calendar.YEAR, parts[0].toInt())
                set(Calendar.MONTH, parts[1].toInt() - 1) // Month is 0-indexed
                set(Calendar.DAY_OF_MONTH, parts[2].toInt())
                set(Calendar.HOUR_OF_DAY, 10) // 10 AM
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            val dueDate = calendar.timeInMillis
            val now = System.currentTimeMillis()

            // Schedule 3 days before
            val threeDaysBefore = dueDate - (3 * 24 * 60 * 60 * 1000L)
            if (threeDaysBefore > now) {
                scheduleNotification(
                    context,
                    threeDaysBefore,
                    "EMI Payment Reminder",
                    "Your EMI payment of ₹${String.format("%.2f", amount)} is due in 3 days",
                    REQUEST_CODE_3_DAYS
                )
                Log.d(TAG, "Scheduled 3-day reminder")
            }

            // Schedule 1 day before
            val oneDayBefore = dueDate - (24 * 60 * 60 * 1000L)
            if (oneDayBefore > now) {
                scheduleNotification(
                    context,
                    oneDayBefore,
                    "EMI Payment Reminder",
                    "Your EMI payment of ₹${String.format("%.2f", amount)} is due tomorrow!",
                    REQUEST_CODE_1_DAY
                )
                Log.d(TAG, "Scheduled 1-day reminder")
            }

            // Schedule on due date
            if (dueDate > now) {
                scheduleNotification(
                    context,
                    dueDate,
                    "EMI Payment Due Today!",
                    "Your EMI payment of ₹${String.format("%.2f", amount)} is due today. Please pay to avoid device lock.",
                    REQUEST_CODE_DUE_DATE
                )
                Log.d(TAG, "Scheduled due-date reminder")
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error scheduling reminders", e)
        }
    }

    /**
     * Schedule a single notification
     */
    private fun scheduleNotification(
        context: Context,
        triggerTime: Long,
        title: String,
        message: String,
        requestCode: Int
    ) {
        val intent = Intent(context, PaymentReminderReceiver::class.java).apply {
            putExtra("title", title)
            putExtra("message", message)
            putExtra("requestCode", requestCode)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // Use setExactAndAllowWhileIdle for precise timing even in Doze mode
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerTime,
                pendingIntent
            )
        } else {
            alarmManager.setExact(
                AlarmManager.RTC_WAKEUP,
                triggerTime,
                pendingIntent
            )
        }

        Log.d(TAG, "Notification scheduled for ${Date(triggerTime)}")
    }

    /**
     * Cancel all scheduled reminders
     */
    fun cancelAllReminders(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        listOf(REQUEST_CODE_3_DAYS, REQUEST_CODE_1_DAY, REQUEST_CODE_DUE_DATE).forEach { code ->
            val intent = Intent(context, PaymentReminderReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                code,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pendingIntent)
        }

        Log.d(TAG, "All reminders cancelled")
    }
}
