import { useState, useEffect } from 'react';
import { NpAccount } from '../types';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export interface ManualTtn {
  ttn: string;
  phone?: string;
}

export function useAccounts() {
    const { user, loading: authLoading } = useAuth();
    const [accounts, setAccounts] = useState<NpAccount[]>([]);
    const [manualTtns, setManualTtns] = useState<ManualTtn[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        if (user) {
            // Subscribe to Firestore for sync
            const docRef = doc(db, 'userAccounts', user.uid);
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    
                    // Merge Firestore data with any un-synced localStorage data
                    const saved = localStorage.getItem('np_accounts');
                    const savedManual = localStorage.getItem('np_manual_ttns');
                    const localAccounts = saved ? JSON.parse(saved) : [];
                    const localManual = savedManual ? JSON.parse(savedManual) : [];
                    
                    let mergedAccounts = [...(data.tokens || [])];
                    let mergedManual = [...(data.manualTtns || [])];
                    let needsSync = false;

                    console.log("Firestore sync pulled accounts:", mergedAccounts);

                    localAccounts.forEach((la: any) => {
                        if (!mergedAccounts.some(a => (a as any).apiKey === la.apiKey)) {
                            mergedAccounts.push(la);
                            needsSync = true;
                        }
                    });

                    localManual.forEach((lm: any) => {
                        if (!mergedManual.some(m => m.ttn === lm.ttn)) {
                            mergedManual.push(lm);
                            needsSync = true;
                        }
                    });
                    
                    if (needsSync) {
                        console.log("Pushing local accounts to Firestore (merge)...");
                        setDoc(docRef, { userId: user.uid, tokens: mergedAccounts, manualTtns: mergedManual }, { merge: true });
                    }
                    
                    setAccounts(mergedAccounts);
                    setManualTtns(mergedManual);
                    localStorage.setItem('np_accounts', JSON.stringify(mergedAccounts));
                    localStorage.setItem('np_manual_ttns', JSON.stringify(mergedManual));
                } else {
                    // Try to restore from local storage once if Firestore is empty
                    const saved = localStorage.getItem('np_accounts');
                    const savedManual = localStorage.getItem('np_manual_ttns');
                    const localAccounts = saved ? JSON.parse(saved) : [];
                    const localManual = savedManual ? JSON.parse(savedManual) : [];
                    setAccounts(localAccounts);
                    setManualTtns(localManual);
                    setDoc(docRef, { userId: user.uid, tokens: localAccounts, manualTtns: localManual });
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
            const savedManual = localStorage.getItem('np_manual_ttns');
            if (savedManual) {
                try { setManualTtns(JSON.parse(savedManual)); } catch (e) {}
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

