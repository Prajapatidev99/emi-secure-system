const express = require('express');
const User = require('../models/user.model');
const { Transaction, TransactionType } = require('../models/transaction.model');
const { RechargeRequest, RechargeRequestStatus } = require('../models/recharge-request.model');
const mongoose = require('mongoose');

const router = express.Router();

// Middleware: SuperAdmin only guard
const superAdminOnly = (req, res, next) => {
    if (req.userRole !== 'SuperAdmin') {
        return res.status(403).json({ message: 'Access denied. SuperAdmin only.' });
    }
    next();
};

// @route  GET /api/admin/shopkeepers
// @desc   List all shopkeepers with their wallet balance
// @access SuperAdmin
router.get('/shopkeepers', superAdminOnly, async (req, res) => {
    try {
        const shopkeepers = await User.find({ role: 'Shopkeeper' })
            .select('-password')
            .sort({ createdAt: -1 });

        res.json(shopkeepers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching shopkeepers', error: error.message });
    }
});

// @route  POST /api/admin/recharge
// @desc   Recharge a shopkeeper's wallet
// @access SuperAdmin
router.post('/recharge', superAdminOnly, async (req, res) => {
    const { shopkeeperId, amount, description } = req.body;

    if (!shopkeeperId || !amount || amount <= 0) {
        return res.status(400).json({ message: 'shopkeeperId and a positive amount are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(shopkeeperId)) {
        return res.status(400).json({ message: 'Invalid shopkeeperId.' });
    }

    try {
        // Atomically increment wallet balance
        const updatedUser = await User.findByIdAndUpdate(
            shopkeeperId,
            { $inc: { walletBalance: amount } },
            { new: true, select: '-password' }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'Shopkeeper not found.' });
        }

        // Log the transaction
        await Transaction.create({
            shopkeeperId,
            type: TransactionType.Recharge,
            amount,
            balanceAfter: updatedUser.walletBalance,
            description: description || `Manual recharge of ₹${amount}`,
        });

        res.json({
            message: `Wallet recharged successfully. New balance: ₹${updatedUser.walletBalance}`,
            shopkeeper: {
                _id: updatedUser._id,
                shopName: updatedUser.shopName,
                email: updatedUser.email,
                walletBalance: updatedUser.walletBalance,
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Error recharging wallet', error: error.message });
    }
});

// @route  GET /api/admin/transactions
// @desc   Get all transactions for a specific shopkeeper (for SuperAdmin audit)
// @access SuperAdmin
router.get('/transactions/:shopkeeperId', superAdminOnly, async (req, res) => {
    const { shopkeeperId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(shopkeeperId)) {
        return res.status(400).json({ message: 'Invalid shopkeeperId.' });
    }

    try {
        const transactions = await Transaction.find({ shopkeeperId })
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching transactions', error: error.message });
    }
});

// @route  GET /api/admin/wallet/transactions
// @desc   Get current shopkeeper's own transaction history
// @access Authenticated (any role)
router.get('/wallet/transactions', async (req, res) => {
    try {
        const transactions = await Transaction.find({ shopkeeperId: req.userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching wallet transactions', error: error.message });
    }
});

// @route  POST /api/admin/recharge-requests
// @desc   Submit a new recharge request (Shopkeeper)
// @access Authenticated
router.post('/recharge-requests', async (req, res) => {
    const { amount, transactionId } = req.body;

    if (!amount || !transactionId) {
        return res.status(400).json({ message: 'Amount and Transaction ID (UTR) are required.' });
    }

    try {
        const newRequest = await RechargeRequest.create({
            shopkeeperId: req.userId,
            amount,
            transactionId: transactionId.trim(),
            status: RechargeRequestStatus.Pending,
        });

        res.status(201).json({
            message: 'Recharge request submitted successfully. Please wait for admin approval.',
            request: newRequest,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'This Transaction ID (UTR) has already been submitted.' });
        }
        res.status(500).json({ message: 'Error submitting request', error: error.message });
    }
});

// @route  GET /api/admin/recharge-requests/my
// @desc   Get current shopkeeper's own recharge requests
// @access Authenticated
router.get('/recharge-requests/my', async (req, res) => {
    try {
        const requests = await RechargeRequest.find({ shopkeeperId: req.userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching requests', error: error.message });
    }
});

// @route  GET /api/admin/all-recharge-requests
// @desc   List all recharge requests (SuperAdmin)
// @access SuperAdmin
router.get('/all-recharge-requests', superAdminOnly, async (req, res) => {
    const { status } = req.query;
    const filter = status ? { status } : {};

    try {
        const requests = await RechargeRequest.find(filter)
            .populate('shopkeeperId', 'shopName email')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching requests', error: error.message });
    }
});

// @route  PATCH /api/admin/recharge-requests/:id
// @desc   Approve or Reject a recharge request (SuperAdmin)
// @access SuperAdmin
router.patch('/recharge-requests/:id', superAdminOnly, async (req, res) => {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    if (![RechargeRequestStatus.Approved, RechargeRequestStatus.Rejected].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be Approved or Rejected.' });
    }

    try {
        const request = await RechargeRequest.findById(id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found.' });
        }

        if (request.status !== RechargeRequestStatus.Pending) {
            return res.status(400).json({ message: `Request has already been ${request.status.toLowerCase()}.` });
        }

        if (status === RechargeRequestStatus.Approved) {
            // 1. Update wallet
            const updatedUser = await User.findByIdAndUpdate(
                request.shopkeeperId,
                { $inc: { walletBalance: request.amount } },
                { new: true }
            );

            // 2. Log transaction
            await Transaction.create({
                shopkeeperId: request.shopkeeperId,
                type: TransactionType.Recharge,
                amount: request.amount,
                balanceAfter: updatedUser.walletBalance,
                description: `Online recharge approved (UTR: ${request.transactionId})`,
            });
        }

        // 3. Update request status
        request.status = status;
        if (adminNote) request.adminNote = adminNote;
        await request.save();

        res.json({
            message: `Request ${status.toLowerCase()} successfully.`,
            request,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating request', error: error.message });
    }
});

module.exports = router;
