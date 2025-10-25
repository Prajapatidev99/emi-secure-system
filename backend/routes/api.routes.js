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
            action: command, // 'LOCK', 'UNLOCK', 'WIPE', 'RELEASE_OWNERSHIP'
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
        const { name, phone, address, kycDocs } = req.body;
        if (!name || !phone || !address) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        
        const existingCustomer = await Customer.findOne({ phone });
        if (existingCustomer) {
            return res.status(400).json({ message: 'A customer with this phone number already exists.' });
        }

        const newCustomer = new Customer({ name, phone, address, kycDocs });
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
        // DEFINITIVE FIX: Manually map the response to ensure the '_id' field is always
        // present and correctly formatted as a string. This prevents issues with
        // Mongoose's toJSON virtuals in some environments.
        const response = devices.map(d => ({
            id: d._id.toString(),
            _id: d._id.toString(),
            imei: d.imei,
            androidId: d.androidId,
            model: d.model,
            status: d.status,
            customerId: d.customerId,
            fcmToken: d.fcmToken,
            unlockKey: d.unlockKey,
            isCompromised: d.isCompromised,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        }));
        res.json(response);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customer devices', error: error.message });
    }
});


// NEW: Get all payments for a specific customer
router.get('/customers/:id/payments', async (req, res) => {
    try {
        const payments = await Payment.find({ customerId: req.params.id })
            .populate({
                path: 'deviceId',
                select: 'model status' // Include status along with model
            })
            .sort({ dueDate: 'desc' });
        
        const response = payments.map(p => ({
            id: p._id,
            _id: p._id,
            deviceModel: p.deviceId ? p.deviceId.model : 'N/A',
            deviceStatus: p.deviceId ? p.deviceId.status : 'N/A',
            amount: p.amount,
            dueDate: p.dueDate.toISOString().split('T')[0],
            status: p.status,
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
            customerId, imei, model,
            totalPrice, downPayment, numberOfEmis, emiStartDate 
        } = req.body;

        // --- Validation ---
        if (!customerId || !imei || !model || !totalPrice || !downPayment || !numberOfEmis || !emiStartDate) {
             return res.status(400).json({ message: 'All fields including EMI details are required.' });
        }
        if (totalPrice <= downPayment) {
            return res.status(400).json({ message: 'Total price must be greater than the down payment.' });
        }

        const existingDevice = await Device.findOne({ imei });
        if (existingDevice) {
            return res.status(400).json({ message: 'A device with this IMEI already exists.' });
        }
        
        const unlockKey = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const device = new Device({ customerId, imei, model, unlockKey });
        await device.save();
        
        const loanAmount = totalPrice - downPayment;
        const emiAmount = loanAmount / numberOfEmis;
        const startDate = new Date(emiStartDate);
        
        const paymentPromises = [];

        for (let i = 1; i <= numberOfEmis; i++) {
            const dueDate = new Date(startDate);
            dueDate.setMonth(dueDate.getMonth() + i);

            const newPayment = new Payment({
                customerId,
                deviceId: device._id,
                amount: emiAmount,
                dueDate: dueDate,
                status: PaymentStatus.Pending,
            });
            paymentPromises.push(newPayment.save());
        }

        await Promise.all(paymentPromises);

        res.status(201).json({ message: 'Device registered and EMI plan created successfully.', device });

    } catch (error) {
        console.error("Error in device registration:", error);
        if (error.code === 11000) {
             return res.status(400).json({ message: 'A device with this IMEI already exists.' });
        }
        res.status(400).json({ message: 'Error registering device', error: error.message });
    }
});

// NEW: Link an Android ID to a device after provisioning
router.post('/devices/:deviceId/link', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { androidId } = req.body;
        
        if (!androidId) {
            return res.status(400).json({ message: 'Android ID is required.' });
        }

        // Check if another device is already using this Android ID
        const existingDeviceWithAndroidId = await Device.findOne({ androidId });
        if (existingDeviceWithAndroidId && existingDeviceWithAndroidId._id.toString() !== deviceId) {
            return res.status(400).json({ message: 'This Android ID is already linked to another device.' });
        }

        const device = await Device.findById(deviceId);
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }
        
        device.androidId = androidId;
        await device.save();

        res.status(200).json({ message: 'Device linked successfully.', device });

    } catch (error) {
         if (error.code === 11000) {
             return res.status(400).json({ message: 'This Android ID is already linked to another device.' });
        }
        res.status(500).json({ message: 'Server error during device linking.', error: error.message });
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
        if (payment.status === PaymentStatus.Paid) {
            return res.status(200).json({ message: 'Payment was already marked as paid.' });
        }

        // 1. Update Payment Status
        payment.status = PaymentStatus.Paid;
        await payment.save();

        const customerId = payment.customerId;

        // 2. Check if all payments for this customer are now paid.
        const pendingPaymentsCount = await Payment.countDocuments({
            customerId: customerId,
            status: { $in: [PaymentStatus.Pending, PaymentStatus.Overdue] }
        });

        // 3. If all payments are cleared, release devices. Otherwise, just unlock the specific device.
        if (pendingPaymentsCount === 0) {
            console.log(`All payments cleared for customer ${customerId}. Initiating device release process.`);
            const devicesToRelease = await Device.find({
                customerId: customerId,
                status: { $ne: DeviceStatus.Released } // Find devices not already released
            });

            for (const device of devicesToRelease) {
                console.log(`Releasing device ${device.model} (${device.imei})`);
                if (device.fcmToken) {
                    await sendFcmCommand(
                        device.fcmToken,
                        'RELEASE_OWNERSHIP',
                        'All payments are cleared. Device security has been removed. You can uninstall this app.'
                    );
                }
                device.status = DeviceStatus.Released;
                await device.save();
            }
            res.status(200).json({ message: 'Final payment processed. All associated customer devices have been released.' });

        } else {
            // Not the final payment, just unlock the specific device if it was locked.
            const device = await Device.findById(payment.deviceId);
            if (device && device.status === DeviceStatus.Locked) {
                device.status = DeviceStatus.Active;
                await device.save();
                if (device.fcmToken) {
                    await sendFcmCommand(device.fcmToken, 'UNLOCK', 'Your device has been unlocked. Thank you for your payment.');
                }
            }
            res.status(200).json({ message: 'Payment marked as paid and device unlocked if applicable.' });
        }

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

// --- Security Routes: Lock, Unlock, Hard Reset, Release ---
router.post('/devices/:deviceId/lock', async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId);
        if (!device) return res.status(404).json({ message: 'Device not found' });
        if (device.status === DeviceStatus.Compromised || device.status === DeviceStatus.Released) return res.status(400).json({ message: 'Cannot lock a device that is compromised or released.' });
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

router.post('/devices/:deviceId/unlock', async (req, res) => {
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

router.post('/devices/:deviceId/reset', async (req, res) => {
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

router.post('/devices/:deviceId/release', async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId);
        if (!device) return res.status(404).json({ message: 'Device not found' });
        if (!device.fcmToken) return res.status(400).json({ message: 'Device has no FCM token. Cannot send release command.' });
        
        const result = await sendFcmCommand(device.fcmToken, 'RELEASE_OWNERSHIP', 'Device ownership has been released.');

        if (result.success) {
            device.status = DeviceStatus.Released;
            await device.save();
            res.status(200).json({ message: 'Device release command sent successfully.' });
        } else {
            res.status(500).json({ message: 'Failed to send release command via FCM.', error: result.error });
        }

    } catch (error) {
        res.status(500).json({ message: 'Server error during device release.', error: error.message });
    }
});


router.get('/devices/:deviceId/unlock-key', async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId);
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }
        if (!device.unlockKey) {
            return res.status(404).json({ message: 'No unlock key is set for this device.' });
        }
        res.json({ unlockKey: device.unlockKey });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// NEW: Get QR code data for provisioning a device
router.get('/devices/:deviceId/provisioning-qr', async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId);
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }
        if (!device.unlockKey) {
            return res.status(400).json({ message: 'Device is missing required provisioning data (Unlock Key).' });
        }

        const backendBaseUrl = 'https://emi-secure-system.onrender.com';

        const qrData = {
            "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.emiseure.customer/.MyDeviceAdminReceiver",
            "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://github.com/aistudio-co/gemini-build-a-phone-emi-management-security-system/releases/latest/download/app-release.apk",
            "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "466Q4i13d2i4a514Z18e2g3j4334c13k4b424A78g2i4d3e4g5g2e4k3",
            "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
            "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": true,
            "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
                "backend_url": backendBaseUrl,
                "device_id": device._id.toString(), // Pass the DB id to link back
                "unlock_key": device.unlockKey
            }
        };

        res.json({ qrCodeData: JSON.stringify(qrData) });
    } catch (error) {
        console.error('Error fetching QR data:', error);
        res.status(500).json({ message: 'Server error fetching QR data', error: error.message });
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