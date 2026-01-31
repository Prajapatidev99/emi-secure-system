const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * Middleware to add unique request ID to each request
 * Useful for tracking requests across logs
 */
const requestIdMiddleware = (req, res, next) => {
    // Generate unique request ID
    req.id = uuidv4();

    // Add request ID to response headers
    res.setHeader('X-Request-ID', req.id);

    // Log incoming request with ID
    logger.info('Incoming request', {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent')
    });

    // Log response when finished
    const startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info('Request completed', {
            requestId: req.id,
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`
        });
    });

    next();
};

module.exports = requestIdMiddleware;
