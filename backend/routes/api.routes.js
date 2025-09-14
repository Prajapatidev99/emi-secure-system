

const express = require('express');
const admin = require('firebase-admin');
const Customer = require('../models/customer.model');
const { Device, DeviceStatus } = require('../models/device.model');
const { Payment, PaymentStatus } = require('../models/payment.model');

const router = express.Router();

// --- Helper function to send FCM message ---
const sendFcmCommand = async (fcmToken, command, message) => {
    const payload = {
        token: fcmToken,
        data: {
            action: command, // 'LOCK', 'UNLOCK', or 'WIPE'
            message: message,
        },
        // --- URGENT FIX: Ensure immediate delivery for critical commands ---
        // By setting priority to 'high', we instruct FCM to wake the device
        // and deliver the message immediately, bypassing battery-saving optimizations.
        // This is essential for time-sensitive commands like LOCK and WIPE.
        android: {
            priority: 'high',
        },
        // It's good practice to include APNS config for potential future iOS support
        apns: {
            headers: {
                'apns-priority': '10', // Maps to high priority on iOS
            },
            payload: {
                aps: {
                    'content-available': 1, // Wakes up the app on iOS
                },
            },
        },
    };

    try {
        const response = await admin.messaging().send(payload);
        console.log(`Successfully sent '${command}' command:`, response);
        return { success: true, response };
    } catch (error) {
        console.error(`Error sending '${command}' command:`, error);
        return { success: false, error };
    }
};

// --- Customer Routes ---
router.post('/customers', async (req, res) => {
    try {
        const { name, phone, address } = req.body;
        if (!name || !phone || !address) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        
        const existingCustomer = await Customer.findOne({ phone });
        if (existingCustomer) {
            return res.status(400).json({ message: 'A customer with this phone number already exists.' });
        }

        const newCustomer = new Customer({ name, phone, address });
        await newCustomer.save();
        res.status(201).json(newCustomer);
    } catch (error) {
        res.status(400).json({ message: 'Error adding customer', error: error.message });
    }
});

router.get('/customers', async (req, res) => {
    try {
        const customers = await Customer.find({}).sort({ createdAt: -1 });
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customers', error: error.message });
    }
});

// NEW: Get a single customer by ID
router.get('/customers/:id', async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json(customer);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customer', error: error.message });
    }
});

// NEW: Get all devices for a specific customer
router.get('/customers/:id/devices', async (req, res) => {
    try {
        const devices = await Device.find({ customerId: req.params.id }).sort({ createdAt: -1 });
        res.json(devices);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customer devices', error: error.message });
    }
});


// NEW: Get all payments for a specific customer
router.get('/customers/:id/payments', async (req, res) => {
    try {
        const payments = await Payment.find({ customerId: req.params.id })
            .populate('deviceId', 'model')
            .sort({ dueDate: 'desc' });
        
        const response = payments.map(p => ({
            id: p._id,
            deviceModel: p.deviceId ? p.deviceId.model : 'N/A',
            amount: p.amount,
            dueDate: p.dueDate.toISOString().split('T')[0],
            status: p.status,
            // Add other fields needed by the frontend that aren't sensitive
            customerName: '',
            deviceImei: '',
            deviceId: '',
            deviceStatus: '',
            customerId: p.customerId,
        }));

        res.json(response);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customer payments', error: error.message });
    }
});



// --- Device and Sale Registration ---
router.post('/devices/register', async (req, res) => {
    try {
        const { 
            customerId, imei, androidId, model,
            totalPrice, downPayment, numberOfEmis, emiStartDate 
        } = req.body;

        // --- Validation ---
        if (!customerId || !imei || !model || !totalPrice || !downPayment || !numberOfEmis || !emiStartDate || !androidId) {
             return res.status(400).json({ message: 'All fields including EMI details and Android ID are required.' });
        }
        if (totalPrice <= downPayment) {
            return res.status(400).json({ message: 'Total price must be greater than the down payment.' });
        }

        // --- Step 1: Register or Update Device ---
        let device = await Device.findOne({ imei });
        if (device) {
            device.customerId = customerId;
            device.model = model;
            device.androidId = androidId;
            device.status = DeviceStatus.Active; // Reactivate on new sale
        } else {
            // Note: fcmToken is now set by the app itself, not here.
            device = new Device({ customerId, imei, androidId, model });
        }
        await device.save();
        
        // --- Step 2: Generate EMI Payment Schedule ---
        const loanAmount = totalPrice - downPayment;
        const emiAmount = loanAmount / numberOfEmis;
        const startDate = new Date(emiStartDate);
        
        const paymentPromises = [];

        for (let i = 1; i <= numberOfEmis; i++) {
            const dueDate = new Date(startDate);
            // The first EMI (i=1) is due one month after the start date.
            // The second EMI (i=2) is due two months after, and so on.
            dueDate.setMonth(dueDate.getMonth() + i);

            const newPayment = new Payment({
                customerId,
                deviceId: device._id,
                amount: emiAmount,
                dueDate,
                status: PaymentStatus.Pending,
            });
            paymentPromises.push(newPayment.save());
        }

        await Promise.all(paymentPromises);

        res.status(201).json({ message: 'Device registered and EMI plan created successfully.', device });

    } catch (error) {
        console.error("Error in device registration:", error);
        res.status(400).json({ message: 'Error registering device', error: error.message });
    }
});

// Security route for Android app to report tampering
router.post('/devices/:deviceId/compromised', async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId);
        if (!device) return res.status(404).json({ message: 'Device not found' });

        device.isCompromised = true;
        device.status = DeviceStatus.Compromised;
        await device.save();
        
        res.status(200).json({ message: 'Device status updated to compromised.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// --- Payment Routes ---
router.get('/payments/pending', async (req, res) => {
    try {
        // This query fetches pending/overdue payments and populates related data
        const pendingPayments = await Payment.find({ status: { $in: ['Pending', 'Overdue'] } })
            .populate('customerId', 'name')
            .populate('deviceId', 'imei model status')
            .sort({ dueDate: 'asc' });
        
        const response = pendingPayments
            .filter(p => p.customerId && p.deviceId) // Filter out payments with missing refs
            .map(p => ({
                id: p._id,
                customerId: p.customerId._id,
                customerName: p.customerId.name,
                deviceId: p.deviceId._id,
                deviceImei: p.deviceId.imei,
                deviceModel: p.deviceId.model,
                deviceStatus: p.deviceId.status,
                amount: p.amount,
                dueDate: p.dueDate.toISOString().split('T')[0],
                status: p.status,
            }));

        res.json(response);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pending payments', error: error.message });
    }
});

router.patch('/payments/:paymentId/pay', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found.' });
        }

        // 1. Update Payment Status
        payment.status = PaymentStatus.Paid;
        await payment.save();

        // 2. Check and Unlock associated device
        const device = await Device.findById(payment.deviceId);
        if (device && device.status === DeviceStatus.Locked) {
            device.status = DeviceStatus.Active;
            await device.save();

            // 3. Send Unlock command if FCM token exists
            if (device.fcmToken) {
                await sendFcmCommand(device.fcmToken, 'UNLOCK', 'Your device has been unlocked. Thank you for your payment.');
            }
        }

        res.status(200).json({ message: 'Payment marked as paid and device unlocked if applicable.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error while processing payment', error: error.message });
    }
});


// --- Dashboard Stats Route ---
router.get('/stats', async (req, res) => {
    try {
        const overduePayments = await Payment.countDocuments({ status: PaymentStatus.Overdue });
        const lockedDevices = await Device.countDocuments({ status: DeviceStatus.Locked });
        
        const totalResult = await Payment.aggregate([
            { $match: { status: PaymentStatus.Paid } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalEmiCollected = totalResult.length > 0 ? totalResult[0].total : 0;

        // Mock data for the chart, as a real implementation would be more complex
        const monthlyData = [
            { name: 'Jan', revenue: 4000 }, { name: 'Feb', revenue: 3000 },
            { name: 'Mar', revenue: 5000 }, { name: 'Apr', revenue: 4500 },
            { name: 'May', revenue: 6000 }, { name: 'Jun', revenue: 5500 },
        ];

        res.json({
            totalEmiCollected,
            overduePayments,
            lockedDevices,
            monthlyData,
        });

    } catch (error) {
        res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
    }
});

// --- Security Routes: Lock, Unlock, Hard Reset ---
router.post('/lock/:deviceId', async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId);
        if (!device) return res.status(404).json({ message: 'Device not found' });
        if (device.status === DeviceStatus.Compromised) return res.status(400).json({ message: 'Cannot lock a compromised device.' });
        if (!device.fcmToken) return res.status(400).json({ message: 'Device has no FCM token. Cannot send command.' });

        const result = await sendFcmCommand(device.fcmToken, 'LOCK', 'Your EMI payment is overdue. Please contact the shop.');
        if (result.success) {
            device.status = DeviceStatus.Locked;
            await device.save();
            res.status(200).json({ message: 'Lock command sent successfully.' });
        } else {
            res.status(500).json({ message: 'Failed to send lock command via FCM.', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/unlock/:deviceId', async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId);
        if (!device) return res.status(404).json({ message: 'Device not found' });
        if (device.status === DeviceStatus.Compromised) return res.status(400).json({ message: 'Cannot unlock a compromised device.' });
        if (!device.fcmToken) return res.status(400).json({ message: 'Device has no FCM token. Cannot send command.' });

        const result = await sendFcmCommand(device.fcmToken, 'UNLOCK', 'Your device has been unlocked. Thank you for your payment.');
         if (result.success) {
            device.status = DeviceStatus.Active;
            await device.save();
            res.status(200).json({ message: 'Unlock command sent successfully.' });
        } else {
            res.status(500).json({ message: 'Failed to send unlock command via FCM.', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/reset/:deviceId', async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId);
        if (!device) return res.status(404).json({ message: 'Device not found' });
        if (!device.fcmToken) return res.status(400).json({ message: 'Device has no FCM token. Cannot send command.' });

        // The WIPE command is irreversible.
        const result = await sendFcmCommand(device.fcmToken, 'WIPE', 'This device is being factory reset due to non-compliance.');
        
        if (result.success) {
            // While we can't confirm the wipe, we can log the action.
            console.log(`Hard Reset command sent to device ${device.imei}.`);
            // Optionally, update status to indicate a reset command was sent.
            device.status = DeviceStatus.Compromised; // Re-purposing status after reset
            await device.save();
            res.status(200).json({ message: 'Hard Reset command sent successfully.' });
        } else {
            res.status(500).json({ message: 'Failed to send Hard Reset command via FCM.', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error during hard reset.', error: error.message });
    }
});

// --- Device List Route ---
router.get('/devices', async (req, res) => {
    try {
        const devices = await Device.find({})
            .populate('customerId', 'name') // Populate customer name
            .sort({ createdAt: -1 });
        res.json(devices);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching devices', error: error.message });
    }
});


module.exports = router;