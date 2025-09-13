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


module.exports = {
    mongodbUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    // The firebaseAdmin module will handle deciding which one to use.
    firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    port: process.env.PORT || 3001,
};