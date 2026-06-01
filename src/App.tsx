import { useState } from 'react';
import { useAccounts } from './lib/useAccounts';
import { useDashboardData } from './lib/useDashboardData';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AccountsModal } from './components/AccountsModal';
import { Onboarding } from './components/Onboarding';
import { AddTtnModal } from './components/AddTtnModal';

export default function App() {
    const { accounts, saveAccounts, manualTtns, saveManualTtns, isLoaded } = useAccounts();
    const { parcels, loading, error, refresh, lastRefresh } = useDashboardData(accounts, manualTtns);
    const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
    const [isAddTtnModalOpen, setIsAddTtnModalOpen] = useState(false);

    if (!isLoaded) return null; // wait for hydration from localStorage

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
                onSave={saveManualTtns}
                hasAccounts={accounts.length > 0}
           />
        </Layout>
    );
}
