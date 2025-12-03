require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const { initializeFirebaseAdmin } = require('./firebase/firebaseAdmin');

const authRoutes = require('./routes/auth.routes');
const apiRoutes = require('./routes/api.routes');
const publicApiRoutes = require('./routes/public.api.routes');
const authMiddleware = require('./middleware/auth.middleware');
const config = require('./config/config');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev')); // Log requests

// Initialize Firebase Admin SDK
try {
    initializeFirebaseAdmin();
    console.log('Firebase Admin Initialized');
} catch (error) {
    console.error('Firebase Admin Initialization Warning:', error.message);
}

// Connect to MongoDB
console.log('Attempting to connect to MongoDB...');
mongoose.connect(config.mongodbUri)
.then(() => {
    console.log('MongoDB Connected Successfully');
})
.catch(err => {
    console.error('MongoDB Connection Error:', err.message);
    if (err.name === 'MongooseServerSelectionError') {
        console.error('---------------------------------------------------------');
        console.error('ERROR: Could not connect to MongoDB Atlas.');
        console.error('Likely Cause: Your IP address is not whitelisted.');
        console.error('ACTION REQUIRED: Go to MongoDB Atlas -> Network Access -> Add IP Address -> Add Current IP.');
        console.error('---------------------------------------------------------');
    }
});

// Routes
// 1. Auth routes (Login/Register) - Public
app.use('/api/auth', authRoutes);

// 2. Public Android API routes (Status checks, FCM updates) - Public
app.use('/api/public', publicApiRoutes);

// 3. Main Dashboard routes - Protected by Authentication
app.use('/api', authMiddleware, apiRoutes);

// Health Check
app.get('/', (req, res) => {
    res.send('EMI Secure API is running');
});

const PORT = config.port || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});