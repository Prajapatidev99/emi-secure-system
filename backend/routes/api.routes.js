
const express = require('express');
const admin = require('firebase-admin');
const Customer = require('../models/customer.model');
const { Device, DeviceStatus } = require('../models/device.model');
const { Payment, PaymentStatus } = require('../models/payment.model');
const { validate, validators } = require('../utils/validators');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

const router = express.Router();

// --- Helper function to send FCM message ---
const sendFcmCommand = async (fcmToken, command, message) => {
    const payload = {
        token: fcmToken,
        data: {
            action: command, // 'LOCK', 'UNLOCK', 'WIPE', 'RELEASE_OWNERSHIP'
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
        logger.info(`Successfully sent '${command}' command`, { response });
        return { success: true, response };
    } catch (error) {
        logger.error(`Error sending '${command}' command`, { error: error.message });
        return { success: false, error };
    }
};

// --- Customer Routes ---
router.post('/customers', validate([
    validators.customerName,
    validators.customerPhone,
    validators.customerAddress
]), async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const { name, phone, address, kycDocs } = req.body;
        if (!name || !phone || !address) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Check if customer with this phone already exists for THIS user
        const existingCustomer = await Customer.findOne({ userId, phone });
        if (existingCustomer) {
            return res.status(400).json({ message: 'A customer with this phone number already exists.' });
        }

        if (kycDocs && kycDocs.length > 0) {
            console.log(`[KYC] Adding customer with ${kycDocs.length} documents`);
        } else {
            console.warn('[KYC] Adding customer with NO documents');
        }

        const newCustomer = new Customer({ userId, name, phone, address, kycDocs });
        await newCustomer.save();
        res.status(201).json(newCustomer);
    } catch (error) {
        res.status(400).json({ message: 'Error adding customer', error: error.message });
    }
});

router.get('/customers', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // SECURITY: Only fetch customers for THIS user
        const customers = await Customer.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Customer.countDocuments({ userId });

        res.json({
            customers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Error fetching customers', { error: error.message });
        res.status(500).json({ message: 'Error fetching customers', error: error.message });
    }
});

router.get('/customers/:id', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        // SECURITY: Only fetch if customer belongs to THIS user
        const customer = await Customer.findOne({ _id: req.params.id, userId });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json(customer);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customer', error: error.message });
    }
});

// DELETE Customer (Cascade)
router.delete('/customers/:id', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const customerId = req.params.id;

        // SECURITY: Verify customer belongs to THIS user before deleting
        const customer = await Customer.findOne({ _id: customerId, userId });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // 1. Delete all payments associated with this customer
        await Payment.deleteMany({ customerId });

        // 2. Delete all devices associated with this customer
        await Device.deleteMany({ customerId });

        // 3. Delete the customer record itself
        await Customer.findByIdAndDelete(customerId);

        res.json({ message: 'Customer and all associated data deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting customer', error: error.message });
    }
});

router.get('/customers/:id/devices', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        // SECURITY: Verify customer belongs to this user
        const customer = await Customer.findOne({ _id: req.params.id, userId });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        const devices = await Device.find({ customerId: req.params.id }).sort({ createdAt: -1 });
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
            location: d.location, // Add location data
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        }));
        res.json(response);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customer devices', error: error.message });
    }
});

router.get('/customers/:id/payments', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        // SECURITY: Verify customer belongs to this user
        const customer = await Customer.findOne({ _id: req.params.id, userId });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        const payments = await Payment.find({ customerId: req.params.id })
            .populate({
                path: 'deviceId',
                select: 'model status'
            })
            .sort({ dueDate: 'desc' });

        const response = payments.map(p => ({
            id: p._id,
            _id: p._id,
            deviceModel: p.deviceId ? p.deviceId.model : 'N/A',
            amount: p.amount,
            dueDate: p.dueDate,
            status: p.status,
        }));

        res.json(response);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customer payments', error: error.message });
    }
});

// --- Device and Sale Registration ---
router.post('/devices/register', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const {
            customerId, imei, model,
            totalPrice, downPayment, numberOfEmis, emiStartDate
        } = req.body;

        if (!customerId || !imei || !model || !totalPrice || !downPayment || !numberOfEmis || !emiStartDate) {
            return res.status(400).json({ message: 'All fields including EMI details are required.' });
        }
        if (totalPrice <= downPayment) {
            return res.status(400).json({ message: 'Total price must be greater than the down payment.' });
        }

        // SECURITY: Verify customer belongs to this user
        const customer = await Customer.findOne({ _id: customerId, userId });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
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

// DELETE Device (and its payments)
router.delete('/devices/:id', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const deviceId = req.params.id;

        // SECURITY: Verify device belongs to this user's customer
        const device = await Device.findById(deviceId).populate('customerId');
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) {
            return res.status(403).json({ message: 'Access denied. This device does not belong to you.' });
        }

        // 1. Delete associated payments
        await Payment.deleteMany({ deviceId });

        // 2. Delete device
        await Device.findByIdAndDelete(deviceId);

        res.json({ message: 'Device and its payment records deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting device', error: error.message });
    }
});

router.post('/devices/:deviceId/link', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const { deviceId } = req.params;
        const { androidId } = req.body;

        if (!androidId) {
            return res.status(400).json({ message: 'Android ID is required.' });
        }

        const device = await Device.findById(deviceId).populate('customerId');
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        // SECURITY: Verify device belongs to this user's customer
        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) {
            return res.status(403).json({ message: 'Access denied. This device does not belong to you.' });
        }

        const existingDeviceWithAndroidId = await Device.findOne({ androidId });
        if (existingDeviceWithAndroidId && existingDeviceWithAndroidId._id.toString() !== deviceId) {
            return res.status(400).json({ message: 'This Android ID is already linked to another device.' });
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

router.post('/devices/:deviceId/compromised', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        // SECURITY: Verify device belongs to this user's customer
        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) {
            return res.status(403).json({ message: 'Access denied. This device does not belong to you.' });
        }

        device.isCompromised = true;
        device.status = DeviceStatus.Compromised;
        await device.save();

        res.status(200).json({ message: 'Device status updated to compromised.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/payments/pending', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware

        // SECURITY: Get only customers for this user
        const userCustomers = await Customer.find({ userId }).select('_id');
        const customerIds = userCustomers.map(c => c._id);

        // Get pending payments only for THIS user's customers
        const pendingPayments = await Payment.find({
            customerId: { $in: customerIds },
            status: { $in: ['Pending', 'Overdue'] }
        })
            .populate('customerId', 'name')
            .populate('deviceId', 'imei model status')
            .sort({ dueDate: 'asc' });

        const response = pendingPayments
            .filter(p => p.customerId && p.deviceId)
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
        const userId = req.userId; // From auth middleware
        const payment = await Payment.findById(req.params.paymentId).populate('customerId');
        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found.' });
        }

        // SECURITY: Verify payment belongs to this user's customer
        const customer = await Customer.findOne({ _id: payment.customerId._id, userId });
        if (!customer) {
            return res.status(403).json({ message: 'Access denied. This payment does not belong to you.' });
        }

        if (payment.status === PaymentStatus.Paid) {
            return res.status(200).json({ message: 'Payment was already marked as paid.' });
        }

        payment.status = PaymentStatus.Paid;
        await payment.save();

        const customerId = payment.customerId._id;

        const pendingPaymentsCount = await Payment.countDocuments({
            customerId: customerId,
            status: { $in: [PaymentStatus.Pending, PaymentStatus.Overdue] }
        });

        if (pendingPaymentsCount === 0) {
            const devicesToRelease = await Device.find({
                customerId: customerId,
                status: { $ne: DeviceStatus.Released }
            });

            for (const device of devicesToRelease) {
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

// --- Dashboard Stats (with 2-minute cache) ---
router.get('/stats', cache.middleware(2 * 60 * 1000), async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware

        // SECURITY: Get only customers for this user
        const userCustomers = await Customer.find({ userId }).select('_id');
        const customerIds = userCustomers.map(c => c._id);

        // Get devices for this user's customers
        const userDevices = await Device.find({ customerId: { $in: customerIds } }).select('_id');
        const deviceIds = userDevices.map(d => d._id);

        // Count overdue payments for this user's devices
        const overduePayments = await Payment.countDocuments({
            deviceId: { $in: deviceIds },
            status: PaymentStatus.Overdue
        });

        // Count locked devices for this user's customers
        const lockedDevices = await Device.countDocuments({
            customerId: { $in: customerIds },
            status: DeviceStatus.Locked
        });

        // Calculate total EMI collected for this user
        const totalResult = await Payment.aggregate([
            {
                $match: {
                    deviceId: { $in: deviceIds },
                    status: PaymentStatus.Paid
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalEmiCollected = totalResult.length > 0 ? totalResult[0].total : 0;

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

router.post('/devices/:deviceId/lock', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        // SECURITY: Verify device belongs to this user's customer
        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) {
            return res.status(403).json({ message: 'Access denied. This device does not belong to you.' });
        }

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
        const userId = req.userId; // From auth middleware
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        // SECURITY: Verify device belongs to this user's customer
        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) {
            return res.status(403).json({ message: 'Access denied. This device does not belong to you.' });
        }

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
        const userId = req.userId; // From auth middleware
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        // SECURITY: Verify device belongs to this user's customer
        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) {
            return res.status(403).json({ message: 'Access denied. This device does not belong to you.' });
        }

        if (!device.fcmToken) return res.status(400).json({ message: 'Device has no FCM token. Cannot send command.' });

        const result = await sendFcmCommand(device.fcmToken, 'WIPE', 'This device is being factory reset due to non-compliance.');

        if (result.success) {
            console.log(`Hard Reset command sent to device ${device.imei}.`);
            device.status = DeviceStatus.Compromised;
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
        const userId = req.userId; // From auth middleware
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        // SECURITY: Verify device belongs to this user's customer
        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) {
            return res.status(403).json({ message: 'Access denied. This device does not belong to you.' });
        }

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
        const userId = req.userId; // From auth middleware
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        // SECURITY: Verify device belongs to this user's customer
        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) {
            return res.status(403).json({ message: 'Access denied. This device does not belong to you.' });
        }

        if (!device.unlockKey) {
            return res.status(404).json({ message: 'No unlock key is set for this device.' });
        }
        res.json({ unlockKey: device.unlockKey });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


router.get('/devices', async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware

        // SECURITY: Get only customers for this user
        const userCustomers = await Customer.find({ userId }).select('_id');
        const customerIds = userCustomers.map(c => c._id);

        // Get devices only for THIS user's customers
        const devices = await Device.find({ customerId: { $in: customerIds } })
            .populate('customerId', 'name')
            .sort({ createdAt: -1 });
        res.json(devices);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching devices', error: error.message });
    }
});


module.exports = router;
