const express = require('express');
const router = express.Router();
const assistantService = require('../services/assistant.service');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/ask', authMiddleware, async (req, res) => {
    try {
        const { query, lang } = req.body;
        if (!query) return res.status(400).json({ message: 'Query is required' });

        const answer = await assistantService.getAnswer(query, lang || 'en');
        res.json({ answer });
    } catch (error) {
        res.status(500).json({ message: 'Error processing assistant request' });
    }
});

module.exports = router;
