import { useState, useEffect } from 'react';
import { Package as Box } from 'lucide-react';
import { useAccounts } from './lib/useAccounts';
import { useDashboardData } from './lib/useDashboardData';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AccountsModal } from './components/AccountsModal';
import { Onboarding } from './components/Onboarding';
import { AddTtnModal } from './components/AddTtnModal';
import { CreateTtnModal } from './components/CreateTtnModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { useAuth } from './lib/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { useTheme } from './lib/useTheme';
import { useSubscription } from './lib/useSubscription';
import { SubscriptionPaywall } from './components/SubscriptionPaywall';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { Parcel } from './types';

export default function App() {
    useTheme(); // Initialize theme logic globally

    // Check if we are on the privacy policy page
    if (window.location.pathname === '/privacy' || window.location.pathname === '/privacy/') {
        return <PrivacyPolicyPage />;
    }

    const { user } = useAuth();
    const { subscription, loading: subLoading, activateSubscription, isAccessAllowed } = useSubscription();
    const { accounts, saveAccounts, manualTtns, saveManualTtns, isLoaded } = useAccounts();
    const { parcels, loading, error, refresh, lastRefresh } = useDashboardData(accounts, manualTtns, (newTtns) => {
        const updated = [...manualTtns];
        let changed = false;
        newTtns.forEach(newTtn => {
            if (!updated.some(item => item.ttn === newTtn)) {
                updated.push({ ttn: newTtn });
                changed = true;
            }
        });
        if (changed) {
            saveManualTtns(updated);
        }
    });

    useEffect(() => {
        if (!user) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('payment') === 'success') {
            activateSubscription(params.get('order') || undefined).then(() => {
                const newUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            });
        }
    }, [user]);

    const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    const [accountsModalTab, setAccountsModalTab] = useState<'profile' | 'api'>('api');
    const [isAddTtnModalOpen, setIsAddTtnModalOpen] = useState(false);
    const [isCreateTtnModalOpen, setIsCreateTtnModalOpen] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [autoSelectTtn, setAutoSelectTtn] = useState<string | null>(null);
    const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);

    const closeAllModals = () => {
        setIsAccountsModalOpen(false);
        setIsSubscriptionModalOpen(false);
        setIsAddTtnModalOpen(false);
        setIsCreateTtnModalOpen(false);
        setIsMapOpen(false);
        setSelectedParcel(null);
    };

    const openAccountsModal = (tab: 'profile' | 'api') => {
        closeAllModals();
        setAccountsModalTab(tab);
        setIsAccountsModalOpen(true);
    };

    const openSubscriptionModal = () => {
        closeAllModals();
        setIsSubscriptionModalOpen(true);
    };

    const openAddTtnModal = () => {
        closeAllModals();
        setIsAddTtnModalOpen(true);
    };

    const openCreateTtnModal = () => {
        closeAllModals();
        setIsCreateTtnModalOpen(true);
    };

    const openMapModal = () => {
        closeAllModals();
        setIsMapOpen(true);
    };

    if (!isLoaded || subLoading) {
        return (
            <div className="flex bg-[var(--bg-main)] h-full w-full overflow-hidden items-center justify-center p-4 antialiased">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-[#e33745]/10 rounded-3xl flex items-center justify-center mb-6 border border-[#e33745]/20 shadow-[0_0_30px_rgba(227,55,69,0.15)] relative">
                        <Box className="w-10 h-10 text-[#e33745] animate-pulse" />
                        <div className="absolute inset-0 rounded-3xl border-2 border-[#e33745]/30 animate-ping opacity-20" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight mb-2 animate-pulse">
                        МультиПошта
                    </h1>
                    <div className="flex gap-1.5 mt-4">
                        <div className="w-2 h-2 rounded-full bg-[#e33745] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-[#e33745] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-[#e33745] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return <AuthScreen />;
    }

    if (!isAccessAllowed()) {
        return <SubscriptionPaywall />;
    }

    return (
        <Layout 
            onManageAccounts={() => openAccountsModal('profile')}
            onManageApiKeys={() => openAccountsModal('api')}
            onManageSubscription={openSubscriptionModal}
            onAddTtn={openAddTtnModal}
            onCreateTtn={openCreateTtnModal}
            onRefresh={() => refresh(true)}
            loading={loading}
            isMapOpen={isMapOpen}
            onMapOpenChange={(open) => {
                if (open) {
                    openMapModal();
                } else {
                    setIsMapOpen(false);
                }
            }}
            onGoToDashboard={closeAllModals}
        >
           {accounts.length === 0 ? (
               <Onboarding onAddAccount={() => openAccountsModal('api')} />
           ) : (
                <Dashboard 
                     parcels={parcels} 
                     loading={loading} 
                     error={error} 
                     onRefresh={refresh} 
                     lastRefresh={lastRefresh} 
                     onDeleteManualTtn={(ttn) => {
                         const updated = manualTtns.filter(item => item.ttn !== ttn);
                         saveManualTtns(updated);
                     }}
                     onUpdateManualTtn={(ttn, phone, accountId, afterpaymentSum, afterpaymentType, prolongDate, prolongDays) => {
                         const updated = manualTtns.map(item => {
                             if (item.ttn === ttn) {
                                 return { ...item, phone, accountId, afterpaymentSum, afterpaymentType, prolongDate, prolongDays };
                             }
                             return item;
                         });
                         saveManualTtns(updated);
                     }}
                     autoSelectTtn={autoSelectTtn}
                     onAutoSelectClear={() => setAutoSelectTtn(null)}
                     selectedParcel={selectedParcel}
                     onSelectParcel={setSelectedParcel}
                     onAddManualTtn={(rawTtn) => {
                         const ttn = rawTtn.trim();
                         // Avoid adding duplicates
                         let needsRefresh = false;
                         if (!manualTtns.some(m => m.ttn === ttn)) {
                             saveManualTtns([...manualTtns, { ttn }]);
                             needsRefresh = true;
                         } else if (!parcels.some(p => p.ttn === ttn)) {
                             needsRefresh = true;
                         }
                         if (needsRefresh) refresh(true);
                         
                         setAutoSelectTtn(ttn);
                     }}
                     accounts={accounts}
                     onCreateTtn={openCreateTtnModal}
                />
           )}
           
           <AccountsModal 
                isOpen={isAccountsModalOpen} 
                onClose={() => setIsAccountsModalOpen(false)} 
                accounts={accounts} 
                onSave={saveAccounts} 
                initialTab={accountsModalTab}
           />

           <SubscriptionModal 
                isOpen={isSubscriptionModalOpen}
                onClose={() => setIsSubscriptionModalOpen(false)}
           />

           <AddTtnModal
                isOpen={isAddTtnModalOpen}
                onClose={() => setIsAddTtnModalOpen(false)}
                manualTtns={manualTtns}
                onSave={(newTtns, addedTtn) => {
                    saveManualTtns(newTtns);
                    if (addedTtn) {
                        setAutoSelectTtn(addedTtn);

                    }
                }}
                hasAccounts={accounts.length > 0}
                parcels={parcels}
                loading={loading}
                 accounts={accounts}
                onCreateNewTtn={openCreateTtnModal}
           />

           <CreateTtnModal
                isOpen={isCreateTtnModalOpen}
                onClose={() => setIsCreateTtnModalOpen(false)}
                accounts={accounts}
                onTtnCreated={(newTtn) => {
                    if (!manualTtns.some(m => m.ttn === newTtn)) {
                        saveManualTtns([...manualTtns, { ttn: newTtn }]);
                    }
                    setAutoSelectTtn(newTtn);
                }}
           />
        </Layout>
    );
}
