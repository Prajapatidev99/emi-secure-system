const express = require('express');
const https = require('https');
const { Device, DeviceStatus } = require('../models/device.model');
const { Payment, PaymentStatus } = require('../models/payment.model');

const router = express.Router();

// --- Diagnostic Route to get Server's Public IP ---
// This is used to help whitelist the correct IP in MongoDB Atlas
router.get('/get-ip', (_req, res) => {
    https.get('https://api.ipify.org', (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', () => {
            res.json({ publicIp: data });
        });
    }).on("error", (err) => {
        console.error("Error fetching public IP: ", err.message);
        res.status(500).json({ message: "Could not fetch the server's public IP address.", error: err.message });
    });
});

// --- Route for Android App to Register/Update its FCM Token ---
router.post('/devices/fcm-update', async (req, res) => {
    const { androidId, fcmToken } = req.body;
    if (!androidId || !fcmToken) {
        return res.status(400).json({ message: 'Android ID and FCM Token are required.' });
    }
    try {
        const device = await Device.findOneAndUpdate(
            { androidId: androidId },
            { fcmToken: fcmToken },
            { new: true, upsert: false } // Find by androidId and update.
        );

        if (!device) {
            return res.status(404).json({ message: 'Device not found. Please register the device from the dashboard first.' });
        }
        res.status(200).json({ message: 'FCM token updated successfully.' });

    } catch (error) {
        console.error('FCM update error:', error);
        res.status(500).json({ message: 'Server error during FCM token update.', error: error.message });
    }
});

// --- Public route for Android app to get its own status ---
router.post('/device-status', async (req, res) => {
    const { androidId } = req.body;
    if (!androidId) {
        return res.status(400).json({ message: 'Device Android ID is required.' });
    }
    try {
        const device = await Device.findOne({ androidId }).populate('customerId', 'name');
        if (!device) {
            return res.status(404).json({ message: 'This device is not registered.' });
        }

        const nextPayment = await Payment.findOne({
            deviceId: device._id,
            status: { $in: [PaymentStatus.Pending, PaymentStatus.Overdue] }
        }).sort({ dueDate: 'asc' });

        if (nextPayment) {
            res.json({
                deviceStatus: device.status,
                paymentStatus: nextPayment.status,
                nextDueDate: nextPayment.dueDate.toISOString().split('T')[0],
                amountDue: nextPayment.amount,
                customerName: device.customerId ? device.customerId.name : 'N/A',
            });
        } else {
             res.json({
                deviceStatus: device.status,
                paymentStatus: 'All Clear',
                message: 'All EMIs have been paid. Thank you!',
                customerName: device.customerId ? device.customerId.name : 'N/A',
            });
        }
    } catch(error) {
        console.error('Error fetching device status:', error);
        res.status(500).json({ message: 'Server error while fetching device status.' });
    }
});

module.exports = router;