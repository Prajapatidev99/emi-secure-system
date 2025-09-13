const admin = require('firebase-admin');
const path = require('path');

function initializeFirebaseAdmin() {
  // Path to your service account key file from environment variable
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable is not set. Please create a .env file in the backend directory and set the variable.');
  }

  // Construct the absolute path to the service account key file
  const absolutePath = path.resolve(process.cwd(), serviceAccountPath);

  try {
    // The robust way: Initialize Firebase Admin by passing the file path directly.
    // The SDK is designed to handle reading the file from a path in a secure manner.
    admin.initializeApp({
      credential: admin.credential.cert(absolutePath),
    });

  } catch (error) {
    console.error(`Failed to initialize Firebase Admin SDK with key from path: ${absolutePath}`);
    console.error('This usually means the file path is incorrect or the JSON file is malformed.');
    console.error('Original Error:', error);
    // Re-throw the error to ensure the server fails to start if Firebase isn't configured.
    throw error;
  }
}

module.exports = { initializeFirebaseAdmin, admin };