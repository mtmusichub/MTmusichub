// Firebase web configuration. These values are not server secrets.
// Replace each placeholder with the config from Firebase Console > Project settings > Your apps.
const firebaseConfig = {
  apiKey: "AIzaSyAR1xWLQnmICzNtrDnPbFKm6sxCk3JM_l0",
  authDomain: "mt-musichub-91298.firebaseapp.com",
  projectId: "mt-musichub-91298",
  storageBucket: "mt-musichub-91298.firebasestorage.app",
  messagingSenderId: "1046068498959",
  appId: "1:1046068498959:web:f650d3c10171a74b6c897a"
};

// Create this Firestore document manually in Firebase Console:
// collection: admins, document ID: your Firebase Authentication user UID
// fields: { active: true }
// Never let the public client create or edit documents in the admins collection.
