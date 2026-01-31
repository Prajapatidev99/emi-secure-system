require('dotenv').config();

// Perform strict validation to ensure the server doesn't start with a broken configuration.
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingOrEmptyVars = requiredEnvVars.filter(varName => !process.env[varName] || process.env[varName].trim() === '');

if (missingOrEmptyVars.length > 0) {
    console.error('FATAL ERROR: The following required environment variables are missing or empty in your .env file:');
    missingOrEmptyVars.forEach(varName => console.error(`- ${varName}`));
    console.error('Please ensure your .env file in the /backend directory is correctly configured.');
    process.exit(1);
}

// Special check for Firebase credentials. We need one of the two methods to be configured.
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    console.error('FATAL ERROR: Firebase credentials are not configured.');
    console.error('Please set either FIREBASE_SERVICE_ACCOUNT_JSON (for production) or FIREBASE_SERVICE_ACCOUNT_PATH (for local development) in your environment.');
    process.exit(1);
}

// Validate MongoDB URI format
if (!process.env.MONGODB_URI.startsWith('mongodb://') && !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    console.error('FATAL ERROR: MONGODB_URI must start with "mongodb://" or "mongodb+srv://"');
    console.error('Current value does not appear to be a valid MongoDB connection string.');
    process.exit(1);
}

// Validate JWT secret strength
if (process.env.JWT_SECRET.length < 32) {
    console.error('FATAL ERROR: JWT_SECRET must be at least 32 characters long for security.');
    console.error('Current length:', process.env.JWT_SECRET.length);
    console.error('Generate a strong secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
}


module.exports = {
    mongodbUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    // The firebaseAdmin module will handle deciding which one to use.
    firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    port: process.env.PORT || 3001,
};