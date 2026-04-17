require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cron = require('node-cron');
const { initializeFirebaseAdmin } = require('./firebase/firebaseAdmin');
const logger = require('./utils/logger');
const requestIdMiddleware = require('./utils/requestId');
const cache = require('./utils/cache');

const authRoutes = require('./routes/auth.routes');
const apiRoutes = require('./routes/api.routes');
const publicApiRoutes = require('./routes/public.api.routes');
const authMiddleware = require('./middleware/auth.middleware');
const config = require('./config/config');
const { Payment, PaymentStatus } = require('./models/payment.model');

const app = express();

// Middleware
app.use(cors());
app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '10mb' }));
app.use(requestIdMiddleware); // Add request ID to all requests
app.use(morgan('dev')); // Log requests

// Serve static files with explicit MIME type for APKs
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.apk')) {
            res.setHeader('Content-Type', 'application/vnd.android.package-archive');
            res.setHeader('Content-Disposition', 'attachment; filename="EMI-Secure.apk"');
        }
    }
}));

// Initialize Firebase Admin SDK
try {
    initializeFirebaseAdmin();
    logger.info('Firebase Admin Initialized');
} catch (error) {
    logger.error('Firebase Admin Initialization Warning:', { error: error.message });
}

// Connect to MongoDB
logger.info('Attempting to connect to MongoDB...');
mongoose.connect(config.mongodbUri)
    .then(() => {
        logger.info('MongoDB Connected Successfully');
    })
    .catch(err => {
        logger.error('MongoDB Connection Error:', { error: err.message });
        if (err.name === 'MongooseServerSelectionError') {
            logger.error('---------------------------------------------------------');
            logger.error('ERROR: Could not connect to MongoDB Atlas.');
            logger.error('Likely Cause: Your IP address is not whitelisted.');
            logger.error('ACTION REQUIRED: Go to MongoDB Atlas -> Network Access -> Add IP Address -> Add Current IP.');
            logger.error('---------------------------------------------------------');
        }
    });

// Rate limiting for login attempts (stricter)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per window
    message: 'Too many login attempts from this IP, please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiting for registration (more lenient)
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 registration attempts per hour
    message: 'Too many registration attempts from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// General API rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
});

// Cron job for payment checks
cron.schedule('0 0 * * *', async () => {
    try {
        logger.info('Running daily payment check...');
        const response = await fetch(`http://localhost:${PORT}/api/payments/check-overdue`, {
            method: 'POST',
        });
        if (response.ok) {
            logger.info('Payment check completed successfully');
        }
    } catch (error) {
        logger.error('Cron Job Error:', { error: error.message });
    }
});

// Routes
// 1. Auth routes with separate limiters for login and registration
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth', (req, res, next) => {
    // Public routes: login, register (already rate-limited above)
    if (req.path === '/login' || req.path === '/register') {
        return next();
    }
    // Protected routes: profile, password, account
    authMiddleware(req, res, next);
}, authRoutes);

// 2. Public Android API routes (Status checks, FCM updates) - Public with general rate limiting
app.use('/api/public', apiLimiter, publicApiRoutes);

// 3. Main Dashboard routes - Protected by Authentication with rate limiting
app.use('/api', apiLimiter, authMiddleware, apiRoutes);

// Health Check with detailed status
app.get('/', (req, res) => {
    const uptime = process.uptime();
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    res.json({
        status: 'ok',
        message: 'EMI Secure API is running',
        uptime: `${Math.floor(uptime / 60)} minutes`,
        timestamp: new Date().toISOString(),
        database: mongoStatus,
        version: '1.0.0'
    });
});

// Detailed health check endpoint
app.get('/health', (req, res) => {
    const healthCheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        checks: {
            database: mongoose.connection.readyState === 1,
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
        }
    };

    try {
        res.status(200).json(healthCheck);
    } catch (error) {
        healthCheck.message = error.message;
        res.status(503).json(healthCheck);
    }
});

const PORT = config.port || 3001;
const startTime = new Date();
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Started at: ${startTime.toISOString()}`);
});