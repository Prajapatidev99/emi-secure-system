const config = require('./config/config'); // Use centralized config
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const apiRoutes = require('./routes/api.routes');
const publicApiRoutes = require('./routes/public.api.routes');
const authMiddleware = require('./middleware/auth.middleware');
const { initializeFirebaseAdmin } = require('./firebase/firebaseAdmin');

const app = express();
const PORT = config.port;

// --- Middleware ---
const corsOptions = {
  origin: '*', // In production, you should restrict this to your frontend's domain
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json());

// --- Initialize Firebase Admin SDK ---
try {
  initializeFirebaseAdmin();
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  process.exit(1);
}

// --- Database Connection ---
mongoose.connect(config.mongodbUri)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// --- API Routes Setup (Refactored for Correctness and Simplicity) ---

// 1. PUBLIC ROUTES - No token required.
// These are defined first and will not be affected by the auth middleware below.
app.use('/api/auth', authRoutes);
app.use('/api/public', publicApiRoutes);

// 2. PROTECTED ROUTES - Token is required.
// The authMiddleware is applied to all routes in `apiRoutes`.
// This router will handle all requests to /api that were not handled by the public routers above.
app.use('/api', authMiddleware, apiRoutes);


// --- Root Endpoint ---
app.get('/', (req, res) => {
  res.send('EMI Secure Backend is running.');
});

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and accessible on your network at port ${PORT}`);
});
