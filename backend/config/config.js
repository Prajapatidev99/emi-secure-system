require('dotenv').config();

// Perform strict validation to ensure the server doesn't start with a broken configuration.
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'FIREBASE_SERVICE_ACCOUNT_PATH'];
const missingOrEmptyVars = requiredEnvVars.filter(varName => !process.env[varName] || process.env[varName].trim() === '');

if (missingOrEmptyVars.length > 0) {
    console.error('FATAL ERROR: The following required environment variables are missing or empty in your .env file:');
    missingOrEmptyVars.forEach(varName => console.error(`- ${varName}`));
    console.error('Please ensure your .env file in the /backend directory is correctly configured.');
    process.exit(1);
}

module.exports = {
    mongodbUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    port: process.env.PORT || 3001,
};
