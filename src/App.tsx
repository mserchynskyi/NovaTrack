import { useState } from 'react';
import { useAccounts } from './lib/useAccounts';
import { useDashboardData } from './lib/useDashboardData';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AccountsModal } from './components/AccountsModal';
import { Onboarding } from './components/Onboarding';

export default function App() {
    const { accounts, saveAccounts, isLoaded } = useAccounts();
    const { parcels, loading, error, refresh, lastRefresh } = useDashboardData(accounts);
    const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);

    if (!isLoaded) return null; // wait for hydration from localStorage

    return (
        <Layout onManageAccounts={() => setIsAccountsModalOpen(true)}>
           {accounts.length === 0 ? (
               <Onboarding onAddAccount={() => setIsAccountsModalOpen(true)} />
           ) : (
               <Dashboard 
                    parcels={parcels} 
                    loading={loading} 
                    error={error} 
                    onRefresh={refresh} 
                    lastRefresh={lastRefresh} 
               />
           )}
           
           <AccountsModal 
                isOpen={isAccountsModalOpen} 
                onClose={() => setIsAccountsModalOpen(false)} 
                accounts={accounts} 
                onSave={saveAccounts} 
           />
        </Layout>
    );
}
