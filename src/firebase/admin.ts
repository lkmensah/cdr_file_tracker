import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

// This variable will hold the singleton instance of the Firebase Admin App.
let adminApp: App | undefined;

/**
 * Initializes and returns the Firebase Admin SDK App instance.
 */
export function initializeAdmin(): App {
  if (adminApp) {
    return adminApp;
  }

  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
    return adminApp;
  }
  
  const serviceAccount = {
    projectId: process.env.APP_PROJECT_ID,
    clientEmail: process.env.APP_CLIENT_EMAIL,
    privateKey: process.env.APP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  // The storage bucket is required for Admin SDK file operations.
  const storageBucket = process.env.APP_STORAGE_BUCKET || 'studio-6909063998-5b0ac.firebasestorage.app';

  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error('Firebase Admin SDK credentials are not set in environment variables.');
    throw new Error('Firebase Admin SDK credentials are not set in environment variables.');
  }

  try {
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: storageBucket,
    });
    return adminApp;
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
    throw new Error("Failed to initialize Firebase Admin SDK.");
  }
}
