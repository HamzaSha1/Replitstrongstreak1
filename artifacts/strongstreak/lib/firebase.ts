import { initializeApp, getApps, getApp } from "@firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "@firebase/auth";
import { initializeFirestore, getFirestore } from "@firebase/firestore";
import { getStorage } from "@firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function getAuthInstance() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = getAuthInstance();

try {
  initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  // already initialized on hot reload
}
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
