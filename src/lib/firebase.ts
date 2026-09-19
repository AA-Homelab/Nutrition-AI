import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyCCWl2uYmpfkcnPD2dawCrEUnjwxwx4GZc",
  authDomain: "nutritrack-ai-f7298.firebaseapp.com",
  projectId: "nutritrack-ai-f7298",
  storageBucket: "nutritrack-ai-f7298.firebasestorage.app",
  messagingSenderId: "580597410147",
  appId: "1:580597410147:web:ba508e48df539ce2210b56",
  measurementId: "G-RQB5KXQJRD"
};

// Initialize Firebase safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

