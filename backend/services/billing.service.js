const admin = require('firebase-admin');
const { Payment, PaymentStatus } = require('../models/payment.model');
const { Device, DeviceStatus } = require('../models/device.model');
const logger = require('../utils/logger');

// --- Helper function to send FCM message ---
const sendFcmCommand = async (fcmToken, command, message, extraData = {}) => {
    if (!fcmToken) return { success: false, error: 'No FCM token' };
    
    // Merge command, message, and extraData into the FCM payload
    const dataPayload = {
        action: command,
        message: message || '',
        ...extraData
    };

    const payload = {
        token: fcmToken,
        data: dataPayload,
        android: {
            priority: 'high',
        },
        apns: {
            headers: {
                'apns-priority': '10',
            },
            payload: {
                aps: {
                    'content-available': 1,
                },
            },
        },
    };

    try {
        const response = await admin.messaging().send(payload);
        logger.info(`Successfully sent '${command}' command via FCM`, { response });
        return { success: true, response };
    } catch (error) {
        logger.error(`Error sending '${command}' command via FCM`, { error: error.message });
        return { success: false, error };
    }
};

/**
 * 3-Day Grace Period Automated Billing Logic:
 * Runs daily at midnight.
 * - Due Today: Status=Pending. Sends REMINDER.
 * - 1 Day Late: Status=Overdue. Sends WARNING.
 * - 3 Days Late: Status=Overdue. Sends LOCK. Device locks.
 */
const processDailyBilling = async () => {
    logger.info('Starting daily automated billing script...');
    
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate thresholds
        const startOfYesterday = new Date(today);
        startOfYesterday.setDate(today.getDate() - 1);
        
        const startOfThreeDaysAgo = new Date(today);
        startOfThreeDaysAgo.setDate(today.getDate() - 3);

        // BUG-05 FIX: Use $gte/$lt range instead of exact date equality.
        // MongoDB stores dates with time components, so { dueDate: today } always returns 0 results.
        // --- 1. Due Today (Reminder) ---
        const dueToday = await Payment.find({
            dueDate: { $gte: today, $lt: startOfYesterday < today ? new Date(today.getTime() + 86400000) : startOfYesterday },
            status: PaymentStatus.Pending
        }).populate('deviceId');

        // Simpler: due between today midnight and tomorrow midnight
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const dueTodayFixed = await Payment.find({
            dueDate: { $gte: today, $lt: tomorrow },
            status: PaymentStatus.Pending
        }).populate('deviceId');
        
        logger.info(`Found ${dueTodayFixed.length} payments due today.`);
        for (const p of dueTodayFixed) {
            if (p.deviceId && p.deviceId.fcmToken) {
                await sendFcmCommand(p.deviceId.fcmToken, 'REMINDER', 'Gentle reminder: Your EMI payment is due today.');
            }
        }

        // --- 2. 1 Day Overdue (Warning Phase) ---
        // Find payments due between yesterday midnight and today midnight, still Pending
        const oneDayLate = await Payment.find({
            dueDate: { $gte: startOfYesterday, $lt: today },
            status: PaymentStatus.Pending
        }).populate('deviceId');

        logger.info(`Found ${oneDayLate.length} payments exactly 1 day late.`);
        for (const p of oneDayLate) {
            p.status = PaymentStatus.Overdue;
            await p.save();
            
            if (p.deviceId && p.deviceId.fcmToken) {
                await sendFcmCommand(p.deviceId.fcmToken, 'WARNING', 'Warning: Your EMI payment is overdue. Your device will lock in 2 days if not paid.');
            }
        }

        // Catch any stray older Pending payments and mark Overdue
        await Payment.updateMany(
            { dueDate: { $lt: startOfYesterday }, status: PaymentStatus.Pending },
            { $set: { status: PaymentStatus.Overdue } }
        );

        // --- 3. 3 Days Overdue (Hard Lock Phase) ---
        // Find payments due 3+ days ago, still Overdue, device not already locked/released
        const startOfFourDaysAgo = new Date(today);
        startOfFourDaysAgo.setDate(today.getDate() - 4);

        const totallyLatePayments = await Payment.find({
            dueDate: { $lt: startOfThreeDaysAgo },  // strictly before 3 days ago midnight
            status: PaymentStatus.Overdue
        }).populate('deviceId');

        logger.info(`Found ${totallyLatePayments.length} payments 3+ days late.`);
        
        for (const p of totallyLatePayments) {
            // BUG-16 FIX: Also skip Released devices to prevent re-locking paid-off devices
            if (p.deviceId &&
                p.deviceId.status !== DeviceStatus.Locked &&
                p.deviceId.status !== DeviceStatus.Compromised &&
                p.deviceId.status !== DeviceStatus.Released) {  // BUG-16
                // Lock it
                if (p.deviceId.fcmToken) {
                    await sendFcmCommand(p.deviceId.fcmToken, 'LOCK', 'Your device has been locked due to missing EMI payments. Please contact your shop.');
                }
                
                // Update device DB status
                await Device.findByIdAndUpdate(p.deviceId._id, { status: DeviceStatus.Locked });
                logger.info(`Device ${p.deviceId.imei} automatically locked due to unpaid EMI.`);
            }
        }

        logger.info('Daily automated billing script completed successfully.');

    } catch (error) {
        logger.error('Error running daily billing automation:', { error: error.message, stack: error.stack });
    }
};

module.exports = {
    processDailyBilling,
    sendFcmCommand
};
