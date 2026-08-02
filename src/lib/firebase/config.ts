import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDOcv2DKL4hdb0npTw-FYYxZDDa28GwO74",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "matri-a4757.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "matri-a4757",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "matri-a4757.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "98005104354",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:98005104354:web:96828a5df7b419f54390bb",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-EZPL3W51W1"
};

// Initialize Firebase app singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with auto-detect long polling enabled to prevent net::ERR_QUIC_PROTOCOL_ERROR
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export default app;
