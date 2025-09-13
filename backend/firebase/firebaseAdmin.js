const admin = require('firebase-admin');
const path = require('path');

function initializeFirebaseAdmin() {
  let serviceAccount;

  // --- Production/Staging Method (More Robust) ---
  // Try to load from a single environment variable first.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      console.log('Attempting to initialize Firebase from FIREBASE_SERVICE_ACCOUNT_JSON environment variable...');
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON. Make sure it is a valid, single-line JSON string.');
      throw error;
    }
  } 
  // --- Local Development Method (Fallback) ---
  // Fallback to using a file path, which is convenient for local dev.
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    console.log(`Attempting to initialize Firebase from file path: ${process.env.FIREBASE_SERVICE_ACCOUNT_PATH}`);
    const serviceAccountPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    serviceAccount = serviceAccountPath; // The SDK can take a path directly
  } 
  // --- Failure ---
  else {
    throw new Error('Firebase credentials are not configured. Please set either FIREBASE_SERVICE_ACCOUNT_JSON (for production) or FIREBASE_SERVICE_ACCOUNT_PATH (for local development) in your environment.');
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK.');
    console.error('This usually means the provided credentials (either from the environment variable or the file) are invalid or malformed.');
    console.error('Original Error:', error);
    // Re-throw the error to ensure the server fails to start if Firebase isn't configured.
    throw error;
  }
}

module.exports = { initializeFirebaseAdmin, admin };