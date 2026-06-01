import { useState, useEffect, useCallback, useRef } from 'react';
import { NpAccount, Parcel } from '../types';
import { fetchAccountParcels, fetchManualParcels } from './np-api';
import { ManualTtn } from './useAccounts';

export function useDashboardData(accounts: NpAccount[], manualTtns: ManualTtn[] = []) {
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const previousStatusesRef = useRef<Map<string, string>>(new Map());

    const refresh = useCallback(async () => {
        if (accounts.length === 0) {
            setParcels([]);
            return;
        }

        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        setLoading(true);
        setError(null);
        try {
            const flatParcels: Parcel[] = [];
            const fetchErrors: string[] = [];

            for (const account of accounts) {
                try {
                    const accountParcels = await fetchAccountParcels(account);
                    flatParcels.push(...accountParcels);
                } catch (e: any) {
                    console.error(`Error fetching for ${account.name}:`, e);
                    fetchErrors.push(`Error fetching for ${account.name}: ${e.message}`);
                }
            }

            if (manualTtns.length > 0) {
                try {
                    const manualParcels = await fetchManualParcels(accounts[0].apiKey, manualTtns);
                    flatParcels.push(...manualParcels);
                } catch (e: any) {
                    console.error("Error fetching manual parcels:", e);
                    fetchErrors.push(`Помилка завантаження вручну доданих ТТН: ${e.message}`);
                }
            }
            
            if (fetchErrors.length > 0) {
                setError(fetchErrors.join('\n'));
            }
            
            // Notification Logic
            const newStatuses = new Map<string, string>();
            flatParcels.forEach(p => newStatuses.set(p.ttn, p.statusCode));
            
            if (previousStatusesRef.current.size > 0) {
                flatParcels.forEach(p => {
                    const oldStatus = previousStatusesRef.current.get(p.ttn);
                    if (oldStatus && oldStatus !== p.statusCode) {
                        // Status changed
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification(`Parcel Update: ${p.ttn}`, {
                                body: `New Status: ${p.status}`
                            });
                        }
                    }
                });
            }
            previousStatusesRef.current = newStatuses;

            const sortedParcels = flatParcels.sort((a, b) => {
                const parseDate = (d: string) => {
                    if (!d) return 0;
                    const parts = d.split(' ')[0]?.split('.');
                    if (parts && parts.length === 3) {
                        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
                    }
                    return 0;
                };
                const tA = parseDate(a.dateCreated);
                const tB = parseDate(b.dateCreated);
                if (tA !== tB) return tB - tA;
                return b.ttn.localeCompare(a.ttn);
            });
            
            setParcels(sortedParcels);
            setLastRefresh(new Date());
        } catch (err: any) {
            setError(err.message || "Failed to load data from Nova Poshta API");
        } finally {
            setLoading(false);
        }
    }, [accounts]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { parcels, loading, error, refresh, lastRefresh };
}
