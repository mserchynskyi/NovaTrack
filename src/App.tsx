import { useState } from 'react';
import { Package as Box } from 'lucide-react';
import { useAccounts } from './lib/useAccounts';
import { useDashboardData } from './lib/useDashboardData';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AccountsModal } from './components/AccountsModal';
import { Onboarding } from './components/Onboarding';
import { AddTtnModal } from './components/AddTtnModal';
import { useAuth } from './lib/AuthContext';
import { AuthScreen } from './components/AuthScreen';

export default function App() {
    const { user } = useAuth();
    const { accounts, saveAccounts, manualTtns, saveManualTtns, isLoaded } = useAccounts();
    const { parcels, loading, error, refresh, lastRefresh } = useDashboardData(accounts, manualTtns);
    const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
    const [isAddTtnModalOpen, setIsAddTtnModalOpen] = useState(false);
    const [autoSelectTtn, setAutoSelectTtn] = useState<string | null>(null);

    if (!isLoaded) {
        return (
            <div className="flex bg-[#1b2b35] min-h-[100dvh] items-center justify-center p-4 antialiased">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-[#e33745]/10 rounded-3xl flex items-center justify-center mb-6 border border-[#e33745]/20 shadow-[0_0_30px_rgba(227,55,69,0.15)] relative">
                        <Box className="w-10 h-10 text-[#e33745] animate-pulse" />
                        <div className="absolute inset-0 rounded-3xl border-2 border-[#e33745]/30 animate-ping opacity-20" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2 animate-pulse">
                        Nova Track
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

    return (
        <Layout 
            onManageAccounts={() => setIsAccountsModalOpen(true)}
            onAddTtn={() => setIsAddTtnModalOpen(true)}
        >
           {accounts.length === 0 ? (
               <Onboarding onAddAccount={() => setIsAccountsModalOpen(true)} />
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
                    autoSelectTtn={autoSelectTtn}
                    onAutoSelectClear={() => setAutoSelectTtn(null)}
                    onAddManualTtn={(ttn) => {
                        // Avoid adding duplicates
                        if (!manualTtns.some(m => m.ttn === ttn)) {
                            saveManualTtns([...manualTtns, { ttn }]);
                        }
                        setAutoSelectTtn(ttn);
                    }}
               />
           )}
           
           <AccountsModal 
                isOpen={isAccountsModalOpen} 
                onClose={() => setIsAccountsModalOpen(false)} 
                accounts={accounts} 
                onSave={saveAccounts} 
           />

           <AddTtnModal
                isOpen={isAddTtnModalOpen}
                onClose={() => setIsAddTtnModalOpen(false)}
                manualTtns={manualTtns}
                onSave={(newTtns, addedTtn) => {
                    saveManualTtns(newTtns);
                    if (addedTtn) {
                        setAutoSelectTtn(addedTtn);
                        setIsAddTtnModalOpen(false); // also good to close it
                    }
                }}
                hasAccounts={accounts.length > 0}
           />
        </Layout>
    );
}
