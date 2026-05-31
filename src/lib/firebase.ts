import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// Connect to named Firestore database if provided and not '(default)', otherwise use the default database
export const db = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)')
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize GoogleAuth configuration at startup on native platforms only
if (Capacitor.isNativePlatform()) {
    GoogleAuth.initialize({
        clientId: '259362159478-fl2qsng5b906uac841jvsk5365hs9ck3.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
    });
}

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
