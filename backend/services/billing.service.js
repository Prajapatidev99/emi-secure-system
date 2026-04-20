const admin = require('firebase-admin');
const { Payment, PaymentStatus } = require('../models/payment.model');
const { Device, DeviceStatus } = require('../models/device.model');
const logger = require('../utils/logger');

// --- Helper function to send FCM message ---
const sendFcmCommand = async (fcmToken, command, message) => {
    if (!fcmToken) return { success: false, error: 'No FCM token' };
    
    const payload = {
        token: fcmToken,
        data: {
            action: command, // 'LOCK', 'UNLOCK', 'WIPE', 'RELEASE_OWNERSHIP', 'REMINDER', 'WARNING'
            message: message,
        },
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
        logger.info(`Successfully sent '${command}' command via cron`, { response });
        return { success: true, response };
    } catch (error) {
        logger.error(`Error sending '${command}' command via cron`, { error: error.message });
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
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(today.getDate() - 3);

        // 1. Due Today (Reminder)
        // Find payments exactly due today, status Pending
        const dueToday = await Payment.find({
            dueDate: today,
            status: PaymentStatus.Pending
        }).populate('deviceId');
        
        logger.info(`Found ${dueToday.length} payments due today.`);
        for (const p of dueToday) {
            if (p.deviceId && p.deviceId.fcmToken) {
                await sendFcmCommand(p.deviceId.fcmToken, 'REMINDER', 'Gentle reminder: Your EMI payment is due today.');
            }
        }

        // 2. 1 Day Overdue (Warning Phase)
        // Find payments that were due yesterday, status still Pending
        const oneDayLate = await Payment.find({
            dueDate: yesterday,
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
            { dueDate: { $lt: yesterday }, status: PaymentStatus.Pending },
            { $set: { status: PaymentStatus.Overdue } }
        );

        // 3. 3 Days Overdue (Hard Lock Phase)
        // Find payments due 3 days ago or earlier, status Overdue, where device isn't Locked already
        const totallyLatePayments = await Payment.find({
            dueDate: { $lte: threeDaysAgo },
            status: PaymentStatus.Overdue
        }).populate('deviceId');

        logger.info(`Found ${totallyLatePayments.length} payments 3+ days late.`);
        
        for (const p of totallyLatePayments) {
            if (p.deviceId && p.deviceId.status !== DeviceStatus.Locked && p.deviceId.status !== DeviceStatus.Compromised) {
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
