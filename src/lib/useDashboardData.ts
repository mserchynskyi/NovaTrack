import { useState, useEffect, useCallback, useRef } from 'react';
import { NpAccount, Parcel } from '../types';
import { fetchAccountParcels, fetchManualParcels } from './np-api';
import { ManualTtn, AutoTtn } from './useAccounts';

export function useDashboardData(
    accounts: NpAccount[], 
    manualTtns: ManualTtn[] = [], 
    autoTtns: AutoTtn[] = [],
    onAutoAddTtns?: (ttns: { ttn: string; accountId?: string }[]) => void
) {
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    
    const parcelsRef = useRef<Parcel[]>([]);
    const lastRefreshRef = useRef<number>(0);
    const previousStatusesRef = useRef<Map<string, string>>(new Map());

    const onAutoAddTtnsRef = useRef(onAutoAddTtns);
    useEffect(() => {
        onAutoAddTtnsRef.current = onAutoAddTtns;
    }, [onAutoAddTtns]);

    useEffect(() => {
        parcelsRef.current = parcels;
    }, [parcels]);

    const accountsStr = JSON.stringify(accounts);
    const manualTtnsStr = JSON.stringify(manualTtns);
    const autoTtnsStr = JSON.stringify(autoTtns);

    const refresh = useCallback(async (force = false) => {
        const parsedAccounts = JSON.parse(accountsStr) as NpAccount[];
        const parsedManual = JSON.parse(manualTtnsStr) as ManualTtn[];
        const parsedAuto = JSON.parse(autoTtnsStr) as AutoTtn[];

        if (parsedAccounts.length === 0) {
            setParcels([]);
            return;
        }

        const now = Date.now();
        // Cooldown of 15 seconds for non-forced refreshes to strictly prevent rate limiting
        if (!force && (now - lastRefreshRef.current < 15000) && parcelsRef.current.length > 0) {
            console.log("Auto-refresh throttled (15s cooldown to prevent 429 rate limit exceeded)");
            return;
        }
        lastRefreshRef.current = now;

        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        setLoading(true);
        setError(null);
        try {
            const flatParcels: Parcel[] = [];
            const fetchErrors: string[] = [];

            for (const account of parsedAccounts) {
                try {
                    const accountParcels = await fetchAccountParcels(account, force);
                    flatParcels.push(...accountParcels);
                } catch (e: any) {
                    console.error(`Error fetching for ${account.name}:`, e);
                    fetchErrors.push(`Error fetching for ${account.name}: ${e.message}`);
                }
            }

            const combinedToFetch = [
                ...parsedManual.map(m => ({ ...m, isAutoAdded: false })),
                ...parsedAuto.map(a => ({ ...a, isAutoAdded: true }))
            ];

            if (combinedToFetch.length > 0) {
                try {
                    const manualParcels = await fetchManualParcels(parsedAccounts, combinedToFetch, force);
                    flatParcels.push(...manualParcels);
                } catch (e: any) {
                    console.error("Error fetching manual/auto-added parcels:", e);
                    fetchErrors.push(`Помилка завантаження вручну доданих або авто-знайдених ТТН: ${e.message}`);
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

            // Deduplicate parcels by TTN
            const uniqueParcelsMap = new Map<string, Parcel>();
            for (const p of flatParcels) {
                // If duplicate, manual typically overwrites but let's keep the one that might have more data.
                // Right now we just ensure uniqueness.
                uniqueParcelsMap.set(p.ttn, p);
            }
            const uniqueParcels = Array.from(uniqueParcelsMap.values());

            const sortedParcels = uniqueParcels.sort((a, b) => {
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

            // Auto track redirection and return basis TTNs if any
            if (onAutoAddTtnsRef.current) {
                const basisTtnsToAutoAdd = new Map<string, string>(); // ttn -> accountId
                flatParcels.forEach(p => {
                    const cleanBasisTtn = p.basisTtn ? p.basisTtn.trim() : "";
                    if (cleanBasisTtn && cleanBasisTtn.length === 14 && /^\d+$/.test(cleanBasisTtn)) {
                        if (p.accountId) {
                            basisTtnsToAutoAdd.set(cleanBasisTtn, p.accountId);
                        }
                    }
                    if (p.basisChain && Array.isArray(p.basisChain)) {
                        p.basisChain.forEach(c => {
                            const cleanChainTtn = c.ttn ? c.ttn.trim() : "";
                            if (cleanChainTtn && cleanChainTtn.length === 14 && /^\d+$/.test(cleanChainTtn)) {
                                if (p.accountId) {
                                    basisTtnsToAutoAdd.set(cleanChainTtn, p.accountId);
                                }
                            }
                        });
                    }
                });

                const alreadyTracked = new Set<string>();
                flatParcels.forEach(p => alreadyTracked.add(p.ttn.trim()));
                parsedManual.forEach(m => alreadyTracked.add(m.ttn.trim()));
                parsedAuto.forEach(a => alreadyTracked.add(a.ttn.trim()));

                const ttnsToAdd: { ttn: string; accountId?: string }[] = [];
                basisTtnsToAutoAdd.forEach((accountId, ttn) => {
                    if (!alreadyTracked.has(ttn)) {
                        ttnsToAdd.push({ ttn, accountId });
                    }
                });

                if (ttnsToAdd.length > 0) {
                    console.log("Automatically adding redirected/returned TTNs to tracking:", ttnsToAdd);
                    onAutoAddTtnsRef.current(ttnsToAdd);
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to load data from Nova Poshta API");
        } finally {
            setLoading(false);
        }
    }, [accountsStr, manualTtnsStr, autoTtnsStr]);

    const isFirstRun = useRef(true);

    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            refresh(true); // Force real update on startup
        } else {
            refresh();
        }
    }, [refresh]);

    return { parcels, loading, error, refresh, lastRefresh };
}
