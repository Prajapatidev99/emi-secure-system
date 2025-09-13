const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');

// Refactored for improved clarity and robustness.
const authMiddleware = (req, res, next) => {
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
        
        next();
    } catch (error) {
        console.error('Authentication error:', error.message);

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
