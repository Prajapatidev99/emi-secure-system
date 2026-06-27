
const express = require('express');
const crypto = require('crypto');  // BUG-20: for cryptographically secure random keys
const admin = require('firebase-admin');
const Customer = require('../models/customer.model');
const { Device, DeviceStatus } = require('../models/device.model');
const { Payment, PaymentStatus } = require('../models/payment.model');
const { Transaction, TransactionType } = require('../models/transaction.model');
const User = require('../models/user.model');
const { validate, validators } = require('../utils/validators');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

const router = express.Router();

const { sendFcmCommand } = require('../services/billing.service');

// --- Customer Routes ---
router.post('/customers', validate([
    validators.customerName,
    validators.customerPhone,
    validators.customerAddress
]), async (req, res) => {
    try {
        const userId = req.userId;
        const { name, phone, address, kycDocs } = req.body;
        if (!name || !phone || !address) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const existingCustomer = await Customer.findOne({ userId, phone });
        if (existingCustomer) {
            return res.status(400).json({ message: 'A customer with this phone number already exists.' });
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
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

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
        res.status(500).json({ message: 'Error fetching customers', error: error.message });
    }
});

router.get('/customers/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const customer = await Customer.findOne({ _id: req.params.id, userId });
        if (!customer) return res.status(404).json({ message: 'Customer not found' });
        res.json(customer);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customer', error: error.message });
    }
});

router.delete('/customers/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const customerId = req.params.id;

        const customer = await Customer.findOne({ _id: customerId, userId });
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        await Payment.deleteMany({ customerId });
        await Device.deleteMany({ customerId });
        await Customer.findByIdAndDelete(customerId);

        res.json({ message: 'Customer and all associated data deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting customer', error: error.message });
    }
});

router.get('/customers/:id/devices', async (req, res) => {
    try {
        const userId = req.userId;
        const customer = await Customer.findOne({ _id: req.params.id, userId });
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        const devices = await Device.find({ customerId: req.params.id }).sort({ createdAt: -1 });
        res.json(devices);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customer devices', error: error.message });
    }
});

router.get('/customers/:id/payments', async (req, res) => {
    try {
        const userId = req.userId;
        const customer = await Customer.findOne({ _id: req.params.id, userId });
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        const payments = await Payment.find({ customerId: req.params.id })
            .populate({ path: 'deviceId', select: 'model status' })
            .sort({ dueDate: 'desc' });

        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customer payments', error: error.message });
    }
});

// --- Device and Sale Registration ---
const DEVICE_REGISTRATION_FEE = 200;

router.post('/devices/register', async (req, res) => {
    try {
        const userId = req.userId;
        const {
            customerId, imei, model,
            totalPrice, downPayment, numberOfEmis, emiStartDate
        } = req.body;

        if (!customerId || !imei || !model || !totalPrice || !downPayment || !numberOfEmis || !emiStartDate) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const shopkeeper = await User.findById(userId).select('walletBalance role');
        if (!shopkeeper) return res.status(404).json({ message: 'User account not found.' });

        if (shopkeeper.role !== 'SuperAdmin' && shopkeeper.walletBalance < DEVICE_REGISTRATION_FEE) {
            return res.status(402).json({ message: 'Insufficient wallet balance.' });
        }

        const customer = await Customer.findOne({ _id: customerId, userId });
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        // BUG-20 FIX: Use crypto.randomBytes (CSPRNG) instead of Math.random() (predictable PRNG)
        const unlockKey = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars, cryptographically secure
        const device = new Device({ customerId, imei, model, unlockKey });
        await device.save();

        const loanAmount = totalPrice - downPayment;
        const emiAmount = loanAmount / numberOfEmis;
        const startDate = new Date(emiStartDate);

        for (let i = 1; i <= numberOfEmis; i++) {
            const dueDate = new Date(startDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            await new Payment({
                customerId, deviceId: device._id, amount: emiAmount, dueDate, status: PaymentStatus.Pending
            }).save();
        }

        if (shopkeeper.role !== 'SuperAdmin') {
            const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { walletBalance: -DEVICE_REGISTRATION_FEE } }, { new: true });
            await Transaction.create({
                shopkeeperId: userId, type: TransactionType.Deduction, amount: DEVICE_REGISTRATION_FEE,
                balanceAfter: updatedUser.walletBalance, description: `Device registration fee: ${imei}`
            });
        }

        res.status(201).json({ message: 'Device registered successfully.', device });
    } catch (error) {
        res.status(400).json({ message: 'Error registering device', error: error.message });
    }
});

router.post('/devices/:deviceId/link', async (req, res) => {
    try {
        const userId = req.userId;
        const { androidId } = req.body;
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) return res.status(403).json({ message: 'Access denied.' });

        device.androidId = androidId;
        await device.save();
        res.status(200).json({ message: 'Device linked successfully.', device });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/devices', async (req, res) => {
    try {
        const userId = req.userId;
        const userCustomers = await Customer.find({ userId }).select('_id');
        const customerIds = userCustomers.map(c => c._id);
        const devices = await Device.find({ customerId: { $in: customerIds } }).populate('customerId', 'name').sort({ createdAt: -1 });
        res.json(devices);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching devices', error: error.message });
    }
});

router.get('/devices/:deviceId/unlock-key', async (req, res) => {
    try {
        const userId = req.userId;
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) return res.status(403).json({ message: 'Access denied.' });

        res.json({ unlockKey: device.unlockKey });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.delete('/devices/:deviceId', async (req, res) => {
    try {
        const userId = req.userId;
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) return res.status(403).json({ message: 'Access denied.' });

        await Payment.deleteMany({ deviceId: req.params.deviceId });
        await Device.findByIdAndDelete(req.params.deviceId);
        res.json({ message: 'Device deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting device', error: error.message });
    }
});

// --- Remote Commands ---
router.post('/devices/:deviceId/lock', async (req, res) => {
    try {
        const userId = req.userId;
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) return res.status(403).json({ message: 'Access denied.' });

        if (!device.fcmToken) return res.status(400).json({ message: 'No FCM token.' });

        const result = await sendFcmCommand(device.fcmToken, 'LOCK', 'Device locked due to overdue payment.');
        if (result.success) {
            device.status = DeviceStatus.Locked;
            await device.save();
            res.json({ message: 'Lock command sent.' });
        } else {
            res.status(500).json({ message: 'FCM failed', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/devices/:deviceId/unlock', async (req, res) => {
    try {
        const userId = req.userId;
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) return res.status(403).json({ message: 'Access denied.' });

        if (!device.fcmToken) return res.status(400).json({ message: 'No FCM token.' });

        const result = await sendFcmCommand(device.fcmToken, 'UNLOCK', 'Device unlocked.');
        if (result.success) {
            device.status = DeviceStatus.Active;
            await device.save();
            res.json({ message: 'Unlock command sent.' });
        } else {
            res.status(500).json({ message: 'FCM failed', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/devices/:deviceId/reset', async (req, res) => {
    try {
        const userId = req.userId;
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) return res.status(403).json({ message: 'Access denied.' });

        if (!device.fcmToken) return res.status(400).json({ message: 'No FCM token.' });

        const result = await sendFcmCommand(device.fcmToken, 'WIPE', 'Factory reset initiated.');
        if (result.success) {
            device.status = DeviceStatus.Compromised;
            await device.save();
            res.json({ message: 'Reset command sent.' });
        } else {
            res.status(500).json({ message: 'FCM failed', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/devices/:deviceId/release', async (req, res) => {
    try {
        const userId = req.userId;
        const device = await Device.findById(req.params.deviceId).populate('customerId');
        if (!device) return res.status(404).json({ message: 'Device not found' });

        const customer = await Customer.findOne({ _id: device.customerId._id, userId });
        if (!customer) return res.status(403).json({ message: 'Access denied.' });

        if (!device.fcmToken) return res.status(400).json({ message: 'No FCM token.' });

        const result = await sendFcmCommand(device.fcmToken, 'RELEASE_OWNERSHIP', 'Ownership released.');
        if (result.success) {
            device.status = DeviceStatus.Released;
            await device.save();
            res.json({ message: 'Release command sent.' });
        } else {
            res.status(500).json({ message: 'FCM failed', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/devices/update-ota', async (req, res) => {
    try {
        const userId = req.userId;
        const { apkUrl } = req.body;

        if (!apkUrl) return res.status(400).json({ message: 'APK URL is required.' });

        const userCustomers = await Customer.find({ userId }).select('_id');
        const customerIds = userCustomers.map(c => c._id);
        const devices = await Device.find({ 
            customerId: { $in: customerIds },
            fcmToken: { $exists: true, $ne: '' }
        });

        if (devices.length === 0) return res.status(404).json({ message: 'No devices found.' });

        const updatePromises = devices.map(device => 
            sendFcmCommand(device.fcmToken, 'UPDATE', 'Installing update...', { apk_url: apkUrl })
        );

        const results = await Promise.all(updatePromises);
        res.json({ message: `Update sent to ${results.filter(r => r.success).length} devices.` });
    } catch (error) {
        res.status(500).json({ message: 'Failed to send update', error: error.message });
    }
});

// --- Dashboard Stats ---
router.get('/stats', cache.middleware(2 * 60 * 1000), async (req, res) => {
    try {
        const userId = req.userId;
        const userCustomers = await Customer.find({ userId }).select('_id');
        const customerIds = userCustomers.map(c => c._id);
        const userDevices = await Device.find({ customerId: { $in: customerIds } }).select('_id');
        const deviceIds = userDevices.map(d => d._id);

        const overduePayments = await Payment.countDocuments({ deviceId: { $in: deviceIds }, status: PaymentStatus.Overdue });
        const lockedDevices = await Device.countDocuments({ customerId: { $in: customerIds }, status: DeviceStatus.Locked });
        
        const totalResult = await Payment.aggregate([
            { $match: { deviceId: { $in: deviceIds }, status: PaymentStatus.Paid } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalEmiCollected = totalResult.length > 0 ? totalResult[0].total : 0;

        // BUG-11 FIX: Real monthly revenue aggregated from DB instead of fake hardcoded multipliers
        const currentYear = new Date().getFullYear();
        const monthlyResult = await Payment.aggregate([
            {
                $match: {
                    deviceId: { $in: deviceIds },
                    status: PaymentStatus.Paid,
                    updatedAt: { $gte: new Date(`${currentYear}-01-01`), $lte: new Date(`${currentYear}-12-31`) }
                }
            },
            {
                $group: {
                    _id: { month: { $month: '$updatedAt' } },
                    revenue: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.month': 1 } }
        ]);

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        // Build a full 12-month array, filling in 0 for months with no payments
        const monthlyData = monthNames.map((name, idx) => {
            const found = monthlyResult.find(r => r._id.month === idx + 1);
            return { name, revenue: found ? Math.round(found.revenue) : 0 };
        });

        res.json({ totalEmiCollected, overduePayments, lockedDevices, monthlyData });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stats', error: error.message });
    }
});

// --- Payments ---
router.get('/payments/pending', async (req, res) => {
    try {
        const userId = req.userId;
        const userCustomers = await Customer.find({ userId }).select('_id');
        const customerIds = userCustomers.map(c => c._id);

        const pendingPayments = await Payment.find({
            customerId: { $in: customerIds },
            status: { $in: ['Pending', 'Overdue'] }
        })
        .populate('customerId', 'name')
        .populate('deviceId', 'imei model status simDetails metadata')
        .sort({ dueDate: 'asc' });

        const response = pendingPayments.map(p => ({
            id: p._id,
            customerId: p.customerId._id,
            customerName: p.customerId.name,
            deviceId: p.deviceId._id,
            deviceImei: p.deviceId.imei,
            deviceModel: p.deviceId.model,
            deviceStatus: p.deviceId.status,
            simDetails: p.deviceId.simDetails,
            metadata: p.deviceId.metadata,
            amount: p.amount,
            dueDate: p.dueDate,
            status: p.status
        }));

        res.json(response);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pending payments', error: error.message });
    }
});

router.post('/payments/:paymentId/remind', async (req, res) => {
    try {
        const userId = req.userId;
        const payment = await Payment.findById(req.params.paymentId).populate('customerId').populate('deviceId');
        if (!payment) return res.status(404).json({ message: 'Payment not found.' });

        const customer = await Customer.findOne({ _id: payment.customerId._id, userId });
        if (!customer) return res.status(403).json({ message: 'Access denied.' });

        if (!payment.deviceId.fcmToken) return res.status(400).json({ message: 'No FCM token.' });

        const isOverdue = payment.status === PaymentStatus.Overdue;
        const command = isOverdue ? 'WARNING' : 'REMINDER';
        const msg = isOverdue ? 'Warning: Payment Overdue' : 'Friendly Reminder: Payment Due';

        const result = await sendFcmCommand(payment.deviceId.fcmToken, command, msg);
        if (result.success) {
            res.json({ message: 'Reminder sent.' });
        } else {
            res.status(500).json({ message: 'FCM failed', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error sending reminder', error: error.message });
    }
});

router.patch('/payments/:paymentId/pay', async (req, res) => {
    try {
        const userId = req.userId;
        const payment = await Payment.findById(req.params.paymentId).populate('customerId');
        if (!payment) return res.status(404).json({ message: 'Payment not found.' });

        const customer = await Customer.findOne({ _id: payment.customerId._id, userId });
        if (!customer) return res.status(403).json({ message: 'Access denied.' });

        payment.status = PaymentStatus.Paid;
        await payment.save();

        // BUG-07 FIX: Check pending payments per-device, not per-customer.
        // A customer may have multiple devices; paying off one device's last EMI
        // must NOT automatically release other devices that still have outstanding payments.
        const devicePendingCount = await Payment.countDocuments({
            deviceId: payment.deviceId,
            status: { $in: [PaymentStatus.Pending, PaymentStatus.Overdue] }
        });

        if (devicePendingCount === 0) {
            // All EMIs for THIS specific device are cleared — release only that device
            const device = await Device.findById(payment.deviceId);
            if (device && device.fcmToken) {
                await sendFcmCommand(device.fcmToken, 'RELEASE_OWNERSHIP', 'Cleared! App can be removed.');
            }
            if (device) {
                device.status = DeviceStatus.Released;
                await device.save();
            }
        }
        res.json({ message: 'Payment recorded.' });
    } catch (error) {
        res.status(500).json({ message: 'Payment failed', error: error.message });
    }
});

module.exports = router;
