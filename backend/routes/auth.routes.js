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

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({ email, password, shopName });

        res.status(201).json({
            _id: user._id,
            email: user.email,
            shopName: user.shopName,
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

            const token = jwt.sign({ id: user._id }, secret, {
                expiresIn: '1d', // Token expires in 1 day
            });

            res.json({
                _id: user._id,
                email: user.email,
                shopName: user.shopName,
                token,
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error on login', error: error.message });
    }
});

module.exports = router;
