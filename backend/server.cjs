require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
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
const adminRoutes = require('./routes/admin.routes');
const publicApiRoutes = require('./routes/public.api.routes');
const authMiddleware = require('./middleware/auth.middleware');
const config = require('./config/config');
const { Payment, PaymentStatus } = require('./models/payment.model');

const app = express();
// Ensure Render.com proxy headers are trusted for rate-limiting
app.set('trust proxy', 1);

// Middleware
// Set security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Allow fetching APK
}));

// Tighten CORS
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://emi-secure-system.vercel.app'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        const isAllowed = allowedOrigins.includes(origin) || 
                         origin.endsWith('.vercel.app') || 
                         process.env.NODE_ENV !== 'production';

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`🛑 CORS Blocked Origin: ${origin}`);
            // Don't throw error to avoid 500/400, just deny origin
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// NEW: Production Traffic Logger
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms - ${req.get('origin') || 'no-origin'}`);
    });
    next();
});

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
    max: 1000, // Increased for dashboard stability
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            message: "Too many requests. Please wait a moment before trying again.",
            error: "Rate Limit Exceeded"
        });
    }
});

// Cron job for automated payment checks and device locking (Runs daily at midnight)
cron.schedule('0 0 * * *', async () => {
    try {
        const billingService = require('./services/billing.service');
        await billingService.processDailyBilling();
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

// 4. Admin routes - Protected by Authentication + SuperAdmin role check inside
app.use('/api/admin', apiLimiter, authMiddleware, adminRoutes);

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

// Global error handler to prevent stack trace leaks
app.use((err, req, res, next) => {
    logger.error('Unhandled Error:', { error: err.message, stack: err.stack, path: req.path });
    res.status(err.status || 500).json({
        message: 'An unexpected server error occurred.',
        // Only include error details in development
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
});

const PORT = config.port || 3001;
const startTime = new Date();
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Started at: ${startTime.toISOString()}`);
});