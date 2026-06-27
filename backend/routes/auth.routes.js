const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { jwtSecret } = require('../config/config');

const router = express.Router();

// @route   POST api/auth/register
// @desc    Register a new user (shopkeeper)
// @access  Public
router.post('/register', async (req, res) => {
    const { email, password, shopName } = req.body;

    // Validate required fields
    if (!email || !password || !shopName) {
        return res.status(400).json({ message: 'Please provide email, password, and shop name' });
    }

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'prajapatidev9974@gmail.com'; // BUG-12 FIX: use env var
        const isSuperAdmin = email === superAdminEmail;
        const user = await User.create({ 
            email, 
            password, 
            shopName,
            role: isSuperAdmin ? 'SuperAdmin' : 'Shopkeeper'
        });

        // Generate JWT token for auto-login
        const secret = jwtSecret;
        const token = jwt.sign({ id: user._id }, secret, { expiresIn: '1d' });

        res.status(201).json({
            _id: user._id,
            email: user.email,
            shopName: user.shopName,
            role: user.role,
            walletBalance: user.walletBalance,
            token, // Return token for auto-login
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error on registration', error: error.message });
    }
});


// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // FIX: Add validation to ensure both email and password are provided.
    // This provides a clear error message instead of letting the request fail later on.
    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide both email and password.' });
    }

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            const secret = jwtSecret; // Use secret from centralized config

            // BUG-12 FIX: use env var instead of hardcoded email
            const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'prajapatidev9974@gmail.com';
            if (user.email === superAdminEmail && user.role !== 'SuperAdmin') {
                user.role = 'SuperAdmin';
                await user.save();
            }

            const token = jwt.sign({ id: user._id }, secret, {
                expiresIn: '1d', // Token expires in 1 day
            });

            res.json({
                _id: user._id,
                email: user.email,
                shopName: user.shopName,
                role: user.role,
                walletBalance: user.walletBalance,
                token,
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error on login', error: error.message });
    }
});


// @route   PUT api/auth/profile
// @desc    Update user profile (shop name)
// @access  Private
router.put('/profile', async (req, res) => {
    const { shopName } = req.body;
    const userId = req.userId; // Set by auth middleware

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (shopName) {
            user.shopName = shopName;
        }

        await user.save();

        res.json({
            _id: user._id,
            email: user.email,
            shopName: user.shopName,
            role: user.role,
            walletBalance: user.walletBalance,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error updating profile', error: error.message });
    }
});


// @route   PUT api/auth/password
// @desc    Change user password
// @access  Private
router.put('/password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId; // Set by auth middleware

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Please provide both current and new password' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error changing password', error: error.message });
    }
});


// @route   DELETE api/auth/account
// @desc    Delete user account and all associated data
// @access  Private
router.delete('/account', async (req, res) => {
    const userId = req.userId; // Set by auth middleware

    try {
        const Customer = require('../models/customer.model');
        const Device = require('../models/device.model');
        const Payment = require('../models/payment.model');

        // Delete all customers associated with this user
        const customers = await Customer.find({ userId });
        const customerIds = customers.map(c => c._id);

        // Delete all devices for these customers
        await Device.deleteMany({ customerId: { $in: customerIds } });

        // Delete all payments for these customers
        await Payment.deleteMany({ customerId: { $in: customerIds } });

        // Delete all customers
        await Customer.deleteMany({ userId });

        // Delete the user
        await User.findByIdAndDelete(userId);

        res.json({ message: 'Account and all associated data deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error deleting account', error: error.message });
    }
});

// @route   GET api/auth/me
// @desc    Get current user profile (role, wallet balance, etc.)
// @access  Private
router.get('/me', async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            _id: user._id,
            email: user.email,
            shopName: user.shopName,
            role: user.role,
            walletBalance: user.walletBalance,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching profile', error: error.message });
    }
});

module.exports = router;
