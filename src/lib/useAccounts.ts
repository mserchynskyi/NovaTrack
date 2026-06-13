import { useState, useEffect } from 'react';
import { NpAccount } from '../types';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import CryptoJS from 'crypto-js';

export interface ManualTtn {
  ttn: string;
  phone?: string;
  accountId?: string;
}

function getEncryptionKey(uid: string): string {
    return CryptoJS.SHA256(uid + "_np_secure_salt_2026").toString();
}

export function encryptApiKey(apiKey: string, uid: string): string {
    if (!apiKey) return '';
    if (apiKey.startsWith('enc:')) return apiKey;
    
    const key = getEncryptionKey(uid);
    const encrypted = CryptoJS.AES.encrypt(apiKey.trim(), key).toString();
    return `enc:${encrypted}`;
}

export function decryptApiKey(encryptedApiKey: string, uid: string): string {
    if (!encryptedApiKey) return '';
    if (!encryptedApiKey.startsWith('enc:')) {
        return encryptedApiKey;
    }
    
    try {
        const cipherText = encryptedApiKey.slice(4);
        const key = getEncryptionKey(uid);
        const bytes = CryptoJS.AES.decrypt(cipherText, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted) {
            return decrypted;
        }
    } catch (e) {
        console.error("Decryption failed:", e);
    }
    return encryptedApiKey;
}

function mergeAccounts(local: NpAccount[], remote: NpAccount[]): NpAccount[] {
    const merged = [...remote];
    for (const loc of local) {
        if (!merged.some(rem => rem.apiKey === loc.apiKey || rem.id === loc.id)) {
            merged.push(loc);
        }
    }
    return merged;
}

function mergeManualTtns(local: ManualTtn[], remote: ManualTtn[]): ManualTtn[] {
    const merged = [...remote];
    for (const loc of local) {
        if (!merged.some(rem => rem.ttn === loc.ttn)) {
            merged.push(loc);
        }
    }
    return merged;
}

export function useAccounts() {
    const { user, loading: authLoading } = useAuth();
    
    // Initialize state immediately from localStorage to prevent layout flashing or empty state
    const [accounts, setAccounts] = useState<NpAccount[]>(() => {
        const saved = localStorage.getItem('np_accounts');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return [];
    });

    const [manualTtns, setManualTtns] = useState<ManualTtn[]>(() => {
        const saved = localStorage.getItem('np_manual_ttns');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return [];
    });

    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        if (user) {
            const docRef = doc(db, 'userAccounts', user.uid);
            let active = true;

            const unsubscribe = onSnapshot(docRef, async (docSnap) => {
                if (!active) return;

                const syncKey = `np_synced_${user.uid}`;
                const hasSyncedBefore = localStorage.getItem(syncKey) === 'true';

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const rawTokens = data.tokens || [];
                    const firestoreAccounts = rawTokens.map((acc: NpAccount) => ({
                        ...acc,
                        apiKey: decryptApiKey(acc.apiKey, user.uid)
                    }));
                    const firestoreManual = data.manualTtns || [];

                    if (!hasSyncedBefore) {
                        // First time syncing this account on this device. Migrate local data.
                        const savedLocally = localStorage.getItem('np_accounts');
                        const savedManualLocally = localStorage.getItem('np_manual_ttns');
                        const initialLocalAccounts: NpAccount[] = savedLocally ? JSON.parse(savedLocally) : [];
                        const initialLocalManual: ManualTtn[] = savedManualLocally ? JSON.parse(savedManualLocally) : [];

                        const mergedAccounts = mergeAccounts(initialLocalAccounts, firestoreAccounts);
                        const mergedManual = mergeManualTtns(initialLocalManual, firestoreManual);

                        setAccounts(mergedAccounts);
                        setManualTtns(mergedManual);
                        localStorage.setItem('np_accounts', JSON.stringify(mergedAccounts));
                        localStorage.setItem('np_manual_ttns', JSON.stringify(mergedManual));
                        localStorage.setItem(syncKey, 'true'); // Prevents further merges that resurrect deleted items

                        try {
                            const encryptedAccounts = mergedAccounts.map((acc: NpAccount) => ({
                                ...acc,
                                apiKey: encryptApiKey(acc.apiKey, user.uid)
                            }));
                            await setDoc(docRef, { 
                                userId: user.uid, 
                                tokens: encryptedAccounts, 
                                manualTtns: mergedManual 
                            }, { merge: true });
                        } catch (err) {
                            console.error("Firestore initial merge failed:", err);
                        }
                    } else {
                        // Already synced previously. Accept Firestore as the absolute source of truth.
                        setAccounts(firestoreAccounts);
                        setManualTtns(firestoreManual);
                        localStorage.setItem('np_accounts', JSON.stringify(firestoreAccounts));
                        localStorage.setItem('np_manual_ttns', JSON.stringify(firestoreManual));
                    }
                } else {
                    // Document doesn't exist on Firestore (newly registered user)
                    if (!hasSyncedBefore) {
                        const savedLocally = localStorage.getItem('np_accounts');
                        const savedManualLocally = localStorage.getItem('np_manual_ttns');
                        const initialLocalAccounts: NpAccount[] = savedLocally ? JSON.parse(savedLocally) : [];
                        const initialLocalManual: ManualTtn[] = savedManualLocally ? JSON.parse(savedManualLocally) : [];

                        setAccounts(initialLocalAccounts);
                        setManualTtns(initialLocalManual);
                        localStorage.setItem(syncKey, 'true');

                        try {
                            const encryptedAccounts = initialLocalAccounts.map((acc: NpAccount) => ({
                                ...acc,
                                apiKey: encryptApiKey(acc.apiKey, user.uid)
                            }));
                            await setDoc(docRef, { 
                                userId: user.uid, 
                                tokens: encryptedAccounts, 
                                manualTtns: initialLocalManual 
                            });
                        } catch (err) {
                            console.error("Failed to create initial firestore doc:", err);
                        }
                    }
                }
                setIsLoaded(true);
            }, (error) => {
                console.error("Firestore onSnapshot error:", error);
                setIsLoaded(true);
            });

            return () => {
                active = false;
                unsubscribe();
            };
        } else {
            // Not logged in, load local storage
            const saved = localStorage.getItem('np_accounts');
            if (saved) {
                try { setAccounts(JSON.parse(saved)); } catch (e) {}
            } else {
                setAccounts([]);
            }
            const savedManual = localStorage.getItem('np_manual_ttns');
            if (savedManual) {
                try { setManualTtns(JSON.parse(savedManual)); } catch (e) {}
            } else {
                setManualTtns([]);
            }
            setIsLoaded(true);
        }
    }, [user, authLoading]);

    const saveAccounts = async (newAccounts: NpAccount[]) => {
        setAccounts(newAccounts);
        localStorage.setItem('np_accounts', JSON.stringify(newAccounts));
        
        if (user) {
            try {
                const docRef = doc(db, 'userAccounts', user.uid);
                const encryptedAccounts = newAccounts.map((acc: NpAccount) => ({
                    ...acc,
                    apiKey: encryptApiKey(acc.apiKey, user.uid)
                }));
                await setDoc(docRef, { userId: user.uid, tokens: encryptedAccounts }, { merge: true });
            } catch (error) {
                console.error("Failed to save accounts to Firestore:", error);
            }
        }
    };

    const saveManualTtns = async (newManualTtns: ManualTtn[]) => {
        // Sanitize undefined values out to prevent Firestore "Unsupported field value: undefined" errors
        const sanitizedTtns = newManualTtns.map(t => {
            const sanitized: ManualTtn = { ttn: t.ttn };
            if (t.phone !== undefined) sanitized.phone = t.phone;
            if (t.accountId !== undefined) sanitized.accountId = t.accountId;
            return sanitized;
        });

        setManualTtns(sanitizedTtns);
        localStorage.setItem('np_manual_ttns', JSON.stringify(sanitizedTtns));
        
        if (user) {
            try {
                const docRef = doc(db, 'userAccounts', user.uid);
                await setDoc(docRef, { userId: user.uid, manualTtns: sanitizedTtns }, { merge: true });
            } catch (error) {
                console.error("Failed to save manual TTNs to Firestore:", error);
            }
        }
    };

    return { 
        accounts, 
        saveAccounts, 
        manualTtns, 
        saveManualTtns, 
        isLoaded: isLoaded && !authLoading 
    };
}

