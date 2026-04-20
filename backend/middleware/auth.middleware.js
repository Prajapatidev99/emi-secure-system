const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');
const User = require('../models/user.model');

// Refactored for improved clarity and robustness.
// Also attaches req.userRole for role-based access control downstream.
const authMiddleware = async (req, res, next) => {
    // Allow CORS preflight requests to pass through without authentication.
    if (req.method === 'OPTIONS') {
        return next();
    }

    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorized, no token provided or token is malformed' });
    }

    try {
        const token = authHeader.replace('Bearer ', '');
        const secret = jwtSecret; // Use secret from centralized config
        
        const decoded = jwt.verify(token, secret);

        req.userId = decoded.id;

        // Attach role for downstream role-based guards (e.g., SuperAdmin routes)
        const user = await User.findById(decoded.id).select('role').lean();
        req.userRole = user ? user.role : 'Shopkeeper';
        
        next();
    } catch (error) {
        const logger = require('../utils/logger');
        logger.warn('Authentication error:', { error: error.message, name: error.name });

        let message = 'Not authorized, token failed verification';
        if (error.name === 'JsonWebTokenError') {
            message = 'Authentication error: jwt malformed';
        } else if (error.name === 'TokenExpiredError') {
            message = 'Authentication error: jwt has expired';
        }
        
        return res.status(401).json({ message });
    }
};

module.exports = authMiddleware;
