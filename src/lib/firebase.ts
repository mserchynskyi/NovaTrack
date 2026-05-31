import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
    try {
        if (Capacitor.isNativePlatform()) {
            // Native platform flow (Android APK)
            const googleUser = await GoogleAuth.signIn();
            const idToken = googleUser?.authentication?.idToken;
            if (!idToken) {
                throw new Error("No ID Token received from Google Native sign-in.");
            }
            const credential = GoogleAuthProvider.credential(idToken);
            await signInWithCredential(auth, credential);
        } else {
            // Standard web flow (GitHub Pages / Local Dev preview)
            await signInWithPopup(auth, googleProvider);
        }
    } catch (error: any) {
        if (error?.code !== 'auth/cancelled-popup-request' && error?.code !== 'auth/popup-closed-by-user') {
            console.error("Login failed", error);
        }
    }
};

export const logout = async () => {
    try {
        if (Capacitor.isNativePlatform()) {
            try {
                await GoogleAuth.signOut();
            } catch (e) {
                console.warn("Native logout bypass/fail", e);
            }
        }
        await signOut(auth);
    } catch (error) {
        console.error("Logout failed", error);
    }
};
