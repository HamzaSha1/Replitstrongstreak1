import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from "@firebase/auth";
import { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, serverTimestamp } from "@firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUri?: string;
  isPrivate: boolean;
  fitnessGoal: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isAdmin: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  isLoading: boolean;
  signUp: (email: string, password: string, displayName: string, handle?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateAppUser: (updates: Partial<AppUser>) => Promise<void>;
  checkHandleAvailable: (handle: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_HANDLE_BASE = "strongstreak";

function generateHandle(displayName: string): string {
  const base = displayName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || DEFAULT_HANDLE_BASE;
  return base + Math.floor(Math.random() * 9000 + 1000);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const docRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const userData = snap.data() as AppUser;
          // Bootstrap owner account to admin on first login
          if (firebaseUser.email === "hamza.shana1@gmail.com" && !userData.isAdmin) {
            await updateDoc(docRef, { isAdmin: true });
            userData.isAdmin = true;
          }
          setAppUser(userData);
        }
      } else {
        setAppUser(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const checkHandleAvailable = async (handle: string): Promise<boolean> => {
    const snap = await getDocs(query(collection(db, "users"), where("handle", "==", handle.toLowerCase())));
    return snap.empty;
  };

  const signUp = async (email: string, password: string, displayName: string, handle?: string) => {
    const finalHandle = handle?.trim() ? handle.trim().toLowerCase() : generateHandle(displayName);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    const newUser: AppUser = {
      uid: cred.user.uid,
      email,
      displayName,
      handle: finalHandle,
      bio: "",
      isPrivate: false,
      fitnessGoal: "",
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      isAdmin: false,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "users", cred.user.uid), { ...newUser, createdAt: serverTimestamp() });
    setAppUser(newUser);
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setAppUser(null);
  };

  const updateAppUser = async (updates: Partial<AppUser>) => {
    if (!user) return;
    const updated = { ...appUser!, ...updates };
    await setDoc(doc(db, "users", user.uid), updated, { merge: true });
    setAppUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, appUser, isLoading, signUp, signIn, signOut, updateAppUser, checkHandleAvailable }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
