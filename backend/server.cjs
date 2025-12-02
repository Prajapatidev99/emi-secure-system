require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { initializeFirebaseAdmin } = require('./firebase/firebaseAdmin');

const authRoutes = require('./routes/auth.routes');
const apiRoutes = require('./routes/api.routes');
const publicApiRoutes = require('./routes/public.api.routes');
const config = require('./config/config');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
    console.error('MongoDB Connection Error:', err);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/public', publicApiRoutes);
app.use('/api', apiRoutes); // Protected routes

// Health Check
app.get('/', (req, res) => {
    res.send('EMI Secure API is running');
});

const PORT = config.port || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});