import { useState, useEffect, useCallback, useRef } from 'react';
import { NpAccount, Parcel } from '../types';
import { fetchAccountParcels } from './np-api';

export function useDashboardData(accounts: NpAccount[]) {
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
            const allParcelsPromises = accounts.map(account => fetchAccountParcels(account).catch(e => {
                console.error(`Error fetching for ${account.name}:`, e);
                return []; 
            }));
            const results = await Promise.all(allParcelsPromises);
            
            const flatParcels = results.flat();
            
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
