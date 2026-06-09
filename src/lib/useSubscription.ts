import { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import CryptoJS from 'crypto-js';

export interface UserSubscription {
  userId: string;
  status: 'trial' | 'active' | 'expired' | 'none';
  trialStartDate: string;
  trialEndDate: string;
  activeEndDate?: string;
  wayforpayCardPan?: string;
  merchantAccount?: string;
  createdAt: string;
  updatedAt: string;
  autoRenew?: boolean;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, userId?: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: userId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Default WayForPay credentials
export const DEFAULT_MERCHANT_ACCOUNT = ((import.meta as any).env?.VITE_WAYFORPAY_MERCHANT as string) || 'novatrack_3891776963_europe_west2_run_app';
export const DEFAULT_MERCHANT_SECRET = ((import.meta as any).env?.VITE_WAYFORPAY_SECRET as string) || 'abd0588f5b0b04237469b17f91c31d704a61a491';

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [merchantAccount, setMerchantAccount] = useState(() => localStorage.getItem('wfp_merchant_account') || DEFAULT_MERCHANT_ACCOUNT);
  const [merchantSecret, setMerchantSecret] = useState(() => localStorage.getItem('wfp_merchant_secret') || DEFAULT_MERCHANT_SECRET);

  const saveMerchantConfig = (acc: string, secret: string) => {
    localStorage.setItem('wfp_merchant_account', acc);
    localStorage.setItem('wfp_merchant_secret', secret);
    setMerchantAccount(acc);
    setMerchantSecret(secret);
  };

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const subDocRef = doc(db, 'userSubscriptions', user.uid);
        let docSnap;
        try {
          docSnap = await getDoc(subDocRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `userSubscriptions/${user.uid}`, user.uid);
          return;
        }

        if (docSnap.exists()) {
          const data = docSnap.data() as UserSubscription;
          
          // Perform automatic expiration check
          let updatedStatus = data.status;
          const now = new Date();
          
          if (data.status === 'trial') {
            const trialEnd = new Date(data.trialEndDate);
            if (now > trialEnd) {
              updatedStatus = 'expired';
            }
          } else if (data.status === 'active' && data.activeEndDate) {
            const activeEnd = new Date(data.activeEndDate);
            if (now > activeEnd) {
              updatedStatus = 'expired';
            }
          }

          if (updatedStatus !== data.status) {
            const updatedSub: Partial<UserSubscription> = {
              status: updatedStatus,
              updatedAt: now.toISOString(),
            };
            try {
              await updateDoc(subDocRef, updatedSub);
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `userSubscriptions/${user.uid}`, user.uid);
            }
            setSubscription({ ...data, ...updatedSub });
          } else {
            setSubscription(data);
          }
        } else {
          // Initialize direct 14-day trial
          const now = new Date();
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + 14);

          const newSub: UserSubscription = {
            userId: user.uid,
            status: 'trial',
            trialStartDate: now.toISOString(),
            trialEndDate: trialEnd.toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };

          try {
            await setDoc(subDocRef, newSub);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `userSubscriptions/${user.uid}`, user.uid);
          }
          setSubscription(newSub);
        }
      } catch (error) {
        console.error('Failed to load subscription status', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user]);

  // Generate WayForPay secure form parameters and sign them
  const getWayForPayParams = () => {
    if (!user) return null;

    const orderReference = `sub_${user.uid}_${Date.now()}`;
    const orderDate = Math.floor(Date.now() / 1000);
    const amount = '100';
    const currency = 'UAH';
    const productName = 'Підписка на МультиПошта';
    const productPrice = '100';
    const productCount = '1';

    // WayForPay expects merchantDomainName without protocol (e.g. your-domain.com).
    // If the merchant account is the user's production Cloud Run merchant, we must pass the registered production domain
    // so that the validation passes even when testing the checkout from AI Studio previews or localhost.
    let merchantDomain = window.location.hostname;
    if (merchantAccount === 'novatrack_3891776963_europe_west2_run_app') {
      merchantDomain = 'novatrack-3891776963-europe-west2.run.app';
    } else if (merchantAccount.includes('_europe_west2_run_app')) {
      merchantDomain = merchantAccount.replace(/_/g, '-').replace('-run-app', '.run.app');
    }

    //WayForPay signature concatenation pattern:
    // merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName[0];productCount[0];productPrice[0]
    const signatureSource = [
      merchantAccount,
      merchantDomain,
      orderReference,
      orderDate.toString(),
      amount,
      currency,
      productName,
      productCount,
      productPrice,
    ].join(';');

    const signature = CryptoJS.HmacMD5(signatureSource, merchantSecret).toString();

    // Success URL redirects back to the current origin (usually the active sandbox or production page)
    const returnUrl = `${window.location.origin}/?payment=success&order=${orderReference}`;

    return {
      action: 'https://secure.wayforpay.com/pay',
      fields: {
        merchantAccount,
        merchantAuthType: 'SimpleSignature',
        merchantDomainName: merchantDomain,
        merchantSignature: signature,
        orderReference,
        orderDate: orderDate.toString(),
        amount,
        currency,
        productName: [productName],
        productPrice: [productPrice],
        productCount: [productCount],
        returnUrl,
        regularMode: 'monthly',
        regularAmount: amount,
        regularOn: 'monthly',
        regularCount: '120', // recurring billing count
      },
    };
  };

  // Directly activate the subscription (triggered upon success redirect or simulated subscription triggers)
  const activateSubscription = async (orderRef?: string) => {
    if (!user) return;
    setLoading(true);
    const now = new Date();
    const activeEnd = new Date();
    activeEnd.setDate(activeEnd.getDate() + 30); // 1 month

    const subDocRef = doc(db, 'userSubscriptions', user.uid);
    const updateData: Partial<UserSubscription> = {
      status: 'active',
      activeEndDate: activeEnd.toISOString(),
      wayforpayCardPan: `**** **** **** ${Math.floor(1000 + Math.random() * 9000)}`,
      autoRenew: true,
      merchantAccount: merchantAccount,
      updatedAt: now.toISOString(),
    };

    try {
      await updateDoc(subDocRef, updateData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `userSubscriptions/${user.uid}`, user.uid);
    }

    if (subscription) {
      setSubscription({ ...subscription, ...updateData });
    }
    setLoading(false);
  };

  // Cancel/deactivate the subscription and remove card details
  const cancelSubscription = async () => {
    if (!user || !subscription) return;
    setLoading(true);
    const now = new Date();

    const subDocRef = doc(db, 'userSubscriptions', user.uid);
    
    // If the subscription is currently active, we keep it active but remove the payment card details (turning off auto-renewal)
    const isCurrentlyActive = subscription.status === 'active';
    const updateData: any = {
      wayforpayCardPan: null,
      autoRenew: false,
      updatedAt: now.toISOString(),
    };

    if (!isCurrentlyActive) {
      updateData.status = 'none';
      updateData.activeEndDate = null;
    }

    try {
      await updateDoc(subDocRef, updateData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `userSubscriptions/${user.uid}`, user.uid);
    }

    setSubscription({ ...subscription, ...updateData });
    setLoading(false);
  };

  // Restet/Reset to expired state (for test purposes)
  const setTrialExpired = async () => {
    if (!user || !subscription) return;
    setLoading(true);
    const now = new Date();
    const expiredSub: Partial<UserSubscription> = {
      status: 'expired',
      trialEndDate: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const subDocRef = doc(db, 'userSubscriptions', user.uid);
    try {
      await updateDoc(subDocRef, expiredSub);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `userSubscriptions/${user.uid}`, user.uid);
    }
    setSubscription({ ...subscription, ...expiredSub });
    setLoading(false);
  };

  // Reset subscription to active trial
  const resetTrial = async () => {
    if (!user || !subscription) return;
    setLoading(true);
    const now = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const freshSub: any = {
      status: 'trial',
      trialStartDate: now.toISOString(),
      trialEndDate: trialEnd.toISOString(),
      activeEndDate: null,
      wayforpayCardPan: null,
      updatedAt: now.toISOString(),
    };

    const subDocRef = doc(db, 'userSubscriptions', user.uid);
    try {
      await updateDoc(subDocRef, freshSub);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `userSubscriptions/${user.uid}`, user.uid);
    }
    setSubscription({ ...subscription, ...freshSub });
    setLoading(false);
  };

  // Check if user has active view limits or is fully blocked
  const isAccessAllowed = () => {
    if (loading) return true; // allow view while loading
    if (!subscription) return true; // let it provision
    return subscription.status === 'trial' || subscription.status === 'active';
  };

  const daysLeft = () => {
    if (!subscription) return 0;
    const now = new Date();
    const end = subscription.status === 'trial' 
      ? new Date(subscription.trialEndDate) 
      : subscription.activeEndDate ? new Date(subscription.activeEndDate) : null;
    
    if (!end) return 0;
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return {
    subscription,
    loading,
    getWayForPayParams,
    activateSubscription,
    cancelSubscription,
    setTrialExpired,
    resetTrial,
    isAccessAllowed,
    daysLeft,
    merchantAccount,
    merchantSecret,
    saveMerchantConfig,
  };
}
