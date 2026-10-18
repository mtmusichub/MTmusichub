// Firebase web configuration. These values are not server secrets.
// Replace each placeholder with the config from Firebase Console > Project settings > Your apps.
export const firebaseConfig = {
  apiKey: "PASTE_FIREBASE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  appId: "PASTE_FIREBASE_APP_ID"
};

// Create this Firestore document manually in Firebase Console:
// collection: admins, document ID: your Firebase Authentication user UID
// fields: { active: true }
// Never let the public client create or edit documents in the admins collection.
