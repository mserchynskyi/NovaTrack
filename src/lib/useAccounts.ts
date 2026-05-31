import { useState, useEffect } from 'react';
import { NpAccount } from '../types';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export function useAccounts() {
    const { user, loading: authLoading } = useAuth();
    const [accounts, setAccounts] = useState<NpAccount[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        if (user) {
            // Subscribe to Firestore for sync
            const docRef = doc(db, 'userAccounts', user.uid);
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    setAccounts(docSnap.data().tokens || []);
                } else {
                    // Try to restore from local storage once if Firestore is empty
                    const saved = localStorage.getItem('np_accounts');
                    if (saved) {
                        try {
                           const localAccounts = JSON.parse(saved);
                           setAccounts(localAccounts);
                           setDoc(docRef, { userId: user.uid, tokens: localAccounts });
                        } catch (e) {}
                    } else {
                       setAccounts([]);
                    }
                }
                setIsLoaded(true);
            }, (error) => {
                console.error("Firestore onSnapshot error:", error);
                setIsLoaded(true);
            });
            return () => unsubscribe();
        } else {
            // Not logged in, use local storage
            const saved = localStorage.getItem('np_accounts');
            if (saved) {
                try { setAccounts(JSON.parse(saved)); } catch (e) {}
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
                await setDoc(docRef, { userId: user.uid, tokens: newAccounts });
            } catch (error) {
                console.error("Failed to save accounts to Firestore:", error);
            }
        }
    };

    return { accounts, saveAccounts, isLoaded: isLoaded && !authLoading };
}
