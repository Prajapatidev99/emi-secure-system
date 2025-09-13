const admin = require('firebase-admin');
const path = require('path');

function initializeFirebaseAdmin() {
  // Path to your service account key file from environment variable
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable is not set. Please create a .env file in the backend directory and set the variable.');
  }

  const absolutePath = path.resolve(process.cwd(), serviceAccountPath);
  let serviceAccount;

  try {
    serviceAccount = require(absolutePath);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
        console.error(`Failed to load Firebase service account key from: ${absolutePath}`);
        console.error('Please ensure the path in your .env file is correct and the JSON file exists.');
    }
    throw error;
  }


  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = { initializeFirebaseAdmin, admin };