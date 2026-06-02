import { useState, useEffect } from 'react';
import { NpAccount } from '../types';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

export interface ManualTtn {
  ttn: string;
  phone?: string;
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
                    const firestoreAccounts = data.tokens || [];
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
                            await setDoc(docRef, { 
                                userId: user.uid, 
                                tokens: mergedAccounts, 
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
                            await setDoc(docRef, { 
                                userId: user.uid, 
                                tokens: initialLocalAccounts, 
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
                await setDoc(docRef, { userId: user.uid, tokens: newAccounts }, { merge: true });
            } catch (error) {
                console.error("Failed to save accounts to Firestore:", error);
            }
        }
    };

    const saveManualTtns = async (newManualTtns: ManualTtn[]) => {
        setManualTtns(newManualTtns);
        localStorage.setItem('np_manual_ttns', JSON.stringify(newManualTtns));
        
        if (user) {
            try {
                const docRef = doc(db, 'userAccounts', user.uid);
                await setDoc(docRef, { userId: user.uid, manualTtns: newManualTtns }, { merge: true });
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

