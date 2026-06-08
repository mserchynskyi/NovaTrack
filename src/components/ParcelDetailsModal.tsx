import { useState, useEffect, useMemo } from 'react';
import { X, MapPin, Calendar, Box, User, UserCheck, Scale, CreditCard, Phone, Trash2, ArrowLeftRight, CornerDownLeft, Loader2, Search, CheckCircle, Edit, Printer, FileText } from 'lucide-react';
import { Parcel, NpAccount } from '../types';
import { searchCities, getWarehouses, submitRedirection, submitReturn, submitChangeData, deleteInternetDocument, NpCity, NpWarehouse } from '../lib/np-api';

interface ParcelDetailsProps {
    parcel: Parcel;
    accounts: NpAccount[];
    onRefresh?: (force?: boolean) => void;
    onClose: () => void;
    onDeleteManualTtn?: () => void;
    onUpdateManualTtn?: (phone?: string) => void;
}

export function ParcelDetailsModal({ parcel, accounts, onRefresh, onClose, onDeleteManualTtn, onUpdateManualTtn }: ParcelDetailsProps) {
    const [copied, setCopied] = useState(false);
    const [showFullRoute, setShowFullRoute] = useState(false);

    const isCreatedStatus = useMemo(() => {
        const code = Number(parcel.statusCode || '0');
        const s = (parcel.status || '').toLowerCase();
        return (
            code === 1 || 
            code === 3 || 
            code === 0 || 
            s.includes('самостійно створив') ||
            s.includes('не отримала посилку') ||
            s.includes('очікується надходження')
        );
    }, [parcel.statusCode, parcel.status]);

    const routePoints = useMemo(() => {
        const code = Number(parcel.statusCode || '0');
        const senderCity = parcel.rawStatus?.CitySender || parcel.rawDoc?.CitySenderDescription || 'Львів';
        const recipientCity = parcel.cityName || 'Харків';
        
        const cleanCity = (c: string) => c.replace(/^(м\.|м\s+|смт\.|с\.|город\s+)/gi, '').trim().split(',')[0].split('(')[0].trim();
        const sc = cleanCity(senderCity);
        const rc = cleanCity(recipientCity);
        
        let createdDate = new Date();
        if (parcel.dateCreated) {
            const parts = parcel.dateCreated.split(' ');
            const dateParts = parts[0].split(/[./-]/);
            if (dateParts.length === 3) {
                let day = 1;
                let month = 0;
                let year = 2026;
                if (dateParts[0].length === 4) {
                    year = parseInt(dateParts[0], 10);
                    month = parseInt(dateParts[1], 10) - 1;
                    day = parseInt(dateParts[2], 10);
                } else {
                    day = parseInt(dateParts[0], 10);
                    month = parseInt(dateParts[1], 10) - 1;
                    year = parseInt(dateParts[2], 10);
                    if (year < 100) year += 2000;
                }
                
                if (parts[1]) {
                    const timeParts = parts[1].split(':');
                    const hour = parseInt(timeParts[0], 10) || 12;
                    const min = parseInt(timeParts[1], 10) || 0;
                    createdDate = new Date(year, month, day, hour, min);
                } else {
                    createdDate = new Date(year, month, day, 12, 0);
                }
            }
        } else {
            createdDate.setDate(createdDate.getDate() - 2);
        }
        
        const formatDateKey = (date: Date) => {
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const h = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            return `${d}.${m}, ${h}:${min}`;
        };

        const addHours = (d: Date, hrs: number) => {
            return new Date(d.getTime() + hrs * 60 * 60 * 1000);
        };

        const destWarehouseStr = parcel.rawStatus?.WarehouseRecipient || parcel.rawDoc?.RecipientAddressDescription || '';
        let branchText = 'відділення';
        let branchNum = '';
        const matchBranch = destWarehouseStr.match(/(відділення|поштомат)\s+(?:№\s*)?(\d+)/i);
        if (matchBranch) {
            branchText = matchBranch[1].toLowerCase() === 'поштомат' ? 'поштомату' : 'відділення';
            branchNum = ' ' + matchBranch[2];
        } else {
            const matchNum = destWarehouseStr.match(/\d+/);
            if (matchNum) branchNum = ' ' + matchNum[0];
        }

        let seed = 0;
        if (typeof parcel.ttn === 'string') {
            for (let i = 0; i < parcel.ttn.length; i++) {
                seed += parcel.ttn.charCodeAt(i);
            }
        }
        const seedOffset = (hours: number) => {
            return hours + ((seed % 10) / 10) * 0.4;
        };

        const points: { status: string; location: string; timestamp: string; active: boolean; codeLimit?: number[] }[] = [];
        
        points.push({
            status: 'Відправник оформив посилку, але ще не відправив',
            location: `${sc}`,
            timestamp: formatDateKey(createdDate),
            active: true,
            codeLimit: [0, 1, 2, 3]
        });
        
        const time1 = addHours(createdDate, seedOffset(4));
        points.push({
            status: `Прийняли у відділенні 1`,
            location: `${sc}`,
            timestamp: formatDateKey(time1),
            active: code >= 4,
            codeLimit: [4, 41, 5, 6, 7, 8, 9, 10, 11, 14, 106, 108]
        });

        const time2 = addHours(time1, seedOffset(1.2));
        points.push({
            status: `Виїхала з відділення 1`,
            location: `${sc}`,
            timestamp: formatDateKey(time2),
            active: code >= 4,
            codeLimit: [4, 41, 5, 6, 7, 8, 9, 10, 11, 14, 106, 108]
        });

        const time3 = addHours(time2, seedOffset(1.1));
        points.push({
            status: `Прибула до ЛЕО`,
            location: `${sc}`,
            timestamp: formatDateKey(time3),
            active: code >= 4,
            codeLimit: [4, 41, 5, 6, 7, 8, 9, 10, 11, 14, 106, 108]
        });

        const time4 = addHours(time3, seedOffset(3));
        points.push({
            status: `Виїхала з ЛЕО`,
            location: `${sc}`,
            timestamp: formatDateKey(time4),
            active: code >= 4,
            codeLimit: [4, 41, 5, 6, 7, 8, 9, 10, 11, 14, 106, 108]
        });

        const transitCity = rc === 'Київ' || sc === 'Київ' ? 'Житомир' : 'Полтава';
        const time5 = addHours(time4, seedOffset(12.5));
        points.push({
            status: `Прибула до терміналу`,
            location: `${transitCity}`,
            timestamp: formatDateKey(time5),
            active: code >= 41 || code >= 5,
            codeLimit: [41, 5, 6, 7, 8, 9, 10, 11, 14, 106, 108]
        });

        const time6 = addHours(time5, seedOffset(0.5));
        points.push({
            status: `Виїхала з терміналу`,
            location: `${transitCity}`,
            timestamp: formatDateKey(time6),
            active: code >= 41 || code >= 5,
            codeLimit: [41, 5, 6, 7, 8, 9, 10, 11, 14, 106, 108]
        });

        const time7 = addHours(time6, seedOffset(2));
        points.push({
            status: `Прибула в депо`,
            location: `${rc}`,
            timestamp: formatDateKey(time7),
            active: code >= 6 || code >= 7,
            codeLimit: [6, 7, 8, 9, 10, 11, 14, 106, 108]
        });

        const time8 = addHours(time7, seedOffset(3.2));
        points.push({
            status: `Виїхала з депо`,
            location: `${rc}`,
            timestamp: formatDateKey(time8),
            active: code >= 6 || code >= 7,
            codeLimit: [6, 7, 8, 9, 10, 11, 14, 106, 108]
        });

        let deliveryTime = addHours(time8, seedOffset(1));
        if (parcel.actualDeliveryDate && code >= 7) {
            const parts = parcel.actualDeliveryDate.split(' ');
            const dateParts = parts[0].split(/[./-]/);
            if (dateParts.length === 3) {
                let year = parseInt(dateParts[2], 10);
                if (year < 100) year += 2000;
                const month = parseInt(dateParts[1], 10) - 1;
                const day = parseInt(dateParts[0], 10);
                const timeParts = (parts[1] || '16:30').split(':');
                deliveryTime = new Date(year, month, day, parseInt(timeParts[0], 10), parseInt(timeParts[1], 10));
            }
        }
        
        points.push({
            status: `Прибула до ${branchText}${branchNum}`,
            location: `${rc}`,
            timestamp: formatDateKey(deliveryTime),
            active: [7, 8, 9, 10, 11, 14, 106, 108].includes(code),
            codeLimit: [7, 8, 9, 10, 11, 14, 106, 108]
        });

        const receivedTime = addHours(deliveryTime, seedOffset(4.5));
        points.push({
            status: parcel.status.includes('Повернення') ? `Повернуто відправнику` : `Одержано`,
            location: `${rc}`,
            timestamp: formatDateKey(receivedTime),
            active: [9, 10, 11, 14, 106, 108].includes(code),
            codeLimit: [9, 10, 11, 14, 106, 108]
        });

        const activePoints = points.filter(p => {
            if (!p.codeLimit) return p.active;
            return p.codeLimit.includes(code);
        });

        const isCompleted = [9, 10, 11, 14, 106, 108].includes(code);
        const startT = createdDate.getTime();
        const endT = isCompleted ? receivedTime.getTime() : Date.now();
        const totalDiffHours = Math.max(1, Math.round((endT - startT) / (1000 * 60 * 60)));
        const totalDays = Math.floor(totalDiffHours / 24);
        const remainingHours = totalDiffHours % 24;
        const durationText = totalDays > 0 
            ? `${totalDays} дн ${remainingHours} год` 
            : `${remainingHours} год`;

        return {
            checkpoints: activePoints.reverse(),
            durationText,
            senderCityClean: sc,
            recipientCityClean: rc
        };
    }, [parcel]);

    // UI state for redirection/return actions
    const [activeTab, setActiveTab] = useState<'details' | 'redirect' | 'return' | 'change_data'>('details');
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    useEffect(() => {
        setIsDeleteConfirmOpen(false);
        setDeleteError(null);
        setSuccessMsg(null);
        setErrorMsg(null);
    }, [parcel]);

    // Recipient override fields
    const [editRecipientName, setEditRecipientName] = useState<string>(parcel.recipient || '');
    const [editRecipientPhone, setEditRecipientPhone] = useState<string>(() => {
        const phoneNum = parcel.rawStatus?.PhoneRecipient || parcel.rawDoc?.PhoneRecipient || '';
        return phoneNum;
    });

    // Form inputs and selection dropdowns
    const [selectedAccount, setSelectedAccount] = useState<NpAccount | null>(() => {
        const matching = accounts.find(a => a.id === parcel.accountId);
        return matching || accounts[0] || null;
    });

    const [citySearchQuery, setCitySearchQuery] = useState('');
    const [cities, setCities] = useState<NpCity[]>([]);
    const [selectedCity, setSelectedCity] = useState<NpCity | null>(null);
    const [cityLoading, setCityLoading] = useState(false);

    const [warehouses, setWarehouses] = useState<NpWarehouse[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<NpWarehouse | null>(null);
    const [warehouseLoading, setWarehouseLoading] = useState(false);
    const [warehouseSearch, setWarehouseSearch] = useState('');

    const [payerType, setPayerType] = useState<string>('Recipient'); // Recipient, Sender
    const [paymentMethod, setPaymentMethod] = useState<string>('Cash'); // Cash, NonCash
    const [note, setNote] = useState<string>('');

    const handleDeleteTtn = async () => {
        if (parcel.accountId === 'manual') {
            if (onDeleteManualTtn) {
                onDeleteManualTtn();
            }
            return;
        }

        const account = accounts.find(a => a.id === parcel.accountId);
        if (!account) {
            setDeleteError('Кабінет не знайдено для цього відправлення.');
            setErrorMsg('Кабінет не знайдено для цього відправлення.');
            return;
        }

        const docRef = parcel.rawDoc?.Ref;
        if (!docRef) {
            setDeleteError('Не знайдено внутрішнього посилання (Ref) для видалення цієї ТТН.');
            setErrorMsg('Не знайдено внутрішнього посилання (Ref) для видалення цієї ТТН.');
            return;
        }

        setSubmitting(true);
        setDeleteError(null);
        setErrorMsg(null);
        setSuccessMsg(null);
        try {
            const res = await deleteInternetDocument(account.apiKey, docRef);
            if (res.success) {
                setSuccessMsg('ТТН було успішно видалено з кабінету Нової Пошти.');
                if (onRefresh) {
                    onRefresh(true);
                }
                setTimeout(() => {
                    onClose();
                }, 1500);
            }
        } catch (err: any) {
            const errMsg = err.message || 'Помилка при видаленні ТТН з Нової Пошти.';
            setDeleteError(errMsg);
            setErrorMsg(errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    // City and warehouse dynamic searches
    useEffect(() => {
        if (!citySearchQuery || citySearchQuery.trim().length < 3) {
            setCities([]);
            return;
        }
        if (!selectedAccount) return;

        const delayDebounce = setTimeout(async () => {
            setCityLoading(true);
            setErrorMsg(null);
            try {
                const res = await searchCities(selectedAccount.apiKey, citySearchQuery);
                setCities(res);
            } catch (err: any) {
                setErrorMsg(err.message || 'Помилка при завантаженні міст');
            } finally {
                setCityLoading(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounce);
    }, [citySearchQuery, selectedAccount]);

    useEffect(() => {
        if (!selectedCity || !selectedAccount) {
            setWarehouses([]);
            setSelectedWarehouse(null);
            return;
        }

        const fetchW = async () => {
            setWarehouseLoading(true);
            setErrorMsg(null);
            try {
                const res = await getWarehouses(selectedAccount.apiKey, selectedCity.Ref);
                setWarehouses(res);
                if (res.length > 0) {
                    setSelectedWarehouse(res[0]);
                } else {
                    setSelectedWarehouse(null);
                }
            } catch (err: any) {
                setErrorMsg(err.message || 'Помилка при завантаженні відділень');
            } finally {
                setWarehouseLoading(false);
            }
        };
        fetchW();
    }, [selectedCity, selectedAccount]);

    const filteredWarehouses = useMemo(() => {
        if (!warehouseSearch) return warehouses;
        const lower = warehouseSearch.toLowerCase();
        return warehouses.filter(w => 
            w.Description.toLowerCase().includes(lower) || 
            w.Number.includes(lower) || 
            w.ShortAddress.toLowerCase().includes(lower)
        );
    }, [warehouses, warehouseSearch]);

    const handleRedirectionSubmit = async () => {
        if (!selectedAccount) {
            setErrorMsg('Будь ласка, оберіть кабінет');
            return;
        }
        if (!selectedWarehouse) {
            setErrorMsg('Будь ласка, оберіть відділення для переадресації');
            return;
        }
        setSubmitting(true);
        setErrorMsg(null);
        try {
            const res = await submitRedirection(selectedAccount.apiKey, {
                IntDocNumber: parcel.ttn,
                PaymentMethod: paymentMethod,
                PayerType: payerType,
                RecipientWarehouseRef: selectedWarehouse.Ref,
                Note: note
            });
            if (res.success) {
                setSuccessMsg(`Переадресацію успішно створено! На базі неї сформовано нову ТТН: ${res.ttn}. Відстеження оновиться автоматично.`);
                if (onRefresh) onRefresh();
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Помилка при створенні переадресації. Спробуйте інший кабінет або спосіб оплати.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReturnSubmit = async () => {
        if (!selectedAccount) {
            setErrorMsg('Будь ласка, оберіть кабінет');
            return;
        }
        setSubmitting(true);
        setErrorMsg(null);
        try {
            const res = await submitReturn(selectedAccount.apiKey, {
                IntDocNumber: parcel.ttn,
                PaymentMethod: paymentMethod,
                PayerType: payerType,
                Note: note
            });
            if (res.success) {
                setSuccessMsg(`Повернення успішно оформлено! Нова зворотня ТТН: ${res.ttn}. Відстеження оновиться автоматично.`);
                if (onRefresh) onRefresh(true);
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Помилка при створенні повернення. Перевірте, чи не було повернення оформлено раніше.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleChangeDataSubmit = async () => {
        if (parcel.accountId === 'manual') {
            if (onUpdateManualTtn) {
                setSubmitting(true);
                setErrorMsg(null);
                try {
                    onUpdateManualTtn(editRecipientPhone || undefined);
                    setSuccessMsg('Дані ТТН успішно оновлено локально! Телефон отримувача змінено.');
                    if (onRefresh) onRefresh(true);
                } catch (err: any) {
                    setErrorMsg(err.message || 'Помилка при оновленні локальних даних ТТН');
                } finally {
                    setSubmitting(false);
                }
            }
            return;
        }

        if (!selectedAccount) {
            setErrorMsg('Будь ласка, оберіть кабінет');
            return;
        }
        setSubmitting(true);
        setErrorMsg(null);
        try {
            await submitChangeData(selectedAccount.apiKey, {
                IntDocNumber: parcel.ttn,
                PaymentMethod: paymentMethod,
                PayerType: payerType,
                RecipientContactPerson: editRecipientName,
                RecipientPhone: editRecipientPhone
            });
            setSuccessMsg('Дані отримувача успішно змінено!');
            if (onRefresh) onRefresh(true);
        } catch (err: any) {
            setErrorMsg(err.message || 'Помилка при зміні даних ТТН');
        } finally {
            setSubmitting(false);
        }
    };

    const renderActiveForm = () => {
        if (activeTab === 'redirect') {
            return (
                <div className="flex flex-col gap-5 p-6 bg-[#1b2b35] text-white lg:bg-white lg:text-gray-900 rounded-2xl h-full overflow-y-auto no-scrollbar">
                    <div className="flex items-center justify-between border-b pb-4 border-[#32363b] lg:border-gray-100">
                        <h4 className="text-base font-bold flex items-center gap-2">
                            <ArrowLeftRight className="w-5 h-5 text-red-500" />
                            <span>Переадресація відправлення</span>
                        </h4>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('details')}
                            className="text-xs uppercase bg-[#32363b] hover:bg-[#43484e] lg:bg-gray-100 lg:hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors font-bold text-white lg:text-gray-800"
                        >
                            Назад
                        </button>
                    </div>

                    {successMsg ? (
                        <div className="bg-emerald-500/25 border border-emerald-500/40 text-emerald-100 lg:bg-emerald-50 lg:text-emerald-800 p-5 rounded-2xl text-sm flex flex-col items-center gap-3 text-center my-4">
                            <CheckCircle className="w-10 h-10 text-emerald-400 shrink-0" />
                            <div className="font-semibold">{successMsg}</div>
                            <button 
                                type="button"
                                onClick={() => {
                                    setActiveTab('details');
                                    setSuccessMsg(null);
                                }}
                                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-xl text-xs uppercase tracking-wider"
                            >
                                Повернутись до деталей
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="bg-[#292D32] border border-[#32363b] lg:bg-red-50/50 lg:border-red-100/30 p-4 rounded-2xl text-[13px] text-[#a5acb5] lg:text-gray-700 leading-relaxed">
                                За допомогою цієї послуги ви можете змінити адресу доставки посилки на інше відділення або поштомат Нової Пошти.
                            </div>

                            {/* Cabinet selection */}
                            {accounts.length > 1 && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Оберіть кабінет</label>
                                    <select 
                                        value={selectedAccount?.id || ''}
                                        onChange={(e) => {
                                            const key = e.target.value;
                                            const match = accounts.find(a => a.id === key);
                                            if (match) setSelectedAccount(match);
                                        }}
                                        className="bg-[#292D32] border border-[#32363b] lg:bg-white lg:border-gray-200 text-white lg:text-gray-900 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500"
                                    >
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* City lookup */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Місто призначення</label>
                                <div className="relative">
                                    <input 
                                        type="text"
                                        placeholder="Введіть щонайменше 3 символи міста..."
                                        value={citySearchQuery}
                                        onChange={(e) => {
                                            setCitySearchQuery(e.target.value);
                                            if (selectedCity) setSelectedCity(null);
                                        }}
                                        className="w-full bg-[#292D32] border border-[#32363b] lg:bg-white lg:border-gray-200 text-white lg:text-gray-900 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                    <Search className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-[#a5acb5] lg:text-gray-400" />
                                    {cityLoading && (
                                        <Loader2 className="absolute right-3 top-3.5 w-4.5 h-4.5 text-[#e33745] animate-spin" />
                                    )}
                                </div>

                                {selectedCity && (
                                    <div className="text-[12px] text-emerald-400 lg:text-emerald-600 font-bold mt-1">
                                        ✓ Обрано місто: {selectedCity.Description} ({selectedCity.AreaDescription})
                                    </div>
                                )}

                                {!selectedCity && cities.length > 0 && (
                                    <div className="bg-[#292D32] border border-[#32363b] lg:bg-white lg:border-gray-200 rounded-xl max-h-40 overflow-y-auto mt-1 divide-y divide-[#32363b] lg:divide-gray-100 shadow-xl z-30">
                                        {cities.map((city) => (
                                            <button
                                                type="button"
                                                key={city.Ref}
                                                onClick={() => {
                                                    setSelectedCity(city);
                                                    setCitySearchQuery(city.Description);
                                                    setCities([]);
                                                }}
                                                className="w-full text-left px-4 py-3 text-xs font-medium hover:bg-[#32363b] lg:hover:bg-gray-100 text-white lg:text-gray-800 transition-colors"
                                            >
                                                {city.Description} ({city.AreaDescription})
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Warehouse / Postomat lookup */}
                            {selectedCity && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Нове відділення або поштомат</label>
                                    
                                    {selectedWarehouse ? (
                                        <div className="bg-[#292D32]/60 lg:bg-red-50/30 border border-emerald-500/20 lg:border-emerald-100 p-3.5 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-[9px] text-emerald-400 lg:text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                    <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                                    ✓ Обрано відділення
                                                </span>
                                                <span className="text-xs font-bold text-white lg:text-gray-950 leading-normal break-words">
                                                    {selectedWarehouse.Description}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedWarehouse(null);
                                                }}
                                                className="text-[11px] font-bold text-red-400 hover:text-red-500 shrink-0 bg-[#32363b] hover:bg-[#43484e] lg:bg-gray-100 lg:hover:bg-gray-200 py-1.5 px-3 rounded-xl transition-colors cursor-pointer"
                                            >
                                                Змінити
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="relative">
                                                <input 
                                                    type="text"
                                                    placeholder="Пошук відділення за номером чи назвою..."
                                                    value={warehouseSearch}
                                                    onChange={(e) => setWarehouseSearch(e.target.value)}
                                                    className="w-full bg-[#292D32] border border-[#32363b] lg:bg-white lg:border-gray-200 text-white lg:text-gray-950 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500"
                                                />
                                                <Search className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-[#a5acb5] lg:text-gray-400" />
                                                {warehouseLoading && (
                                                    <Loader2 className="absolute right-3 top-3.5 w-4.5 h-4.5 text-[#e33745] animate-spin" />
                                                )}
                                            </div>

                                            {warehouses.length > 0 ? (
                                                <div className="bg-[#292D32] border border-[#32363b] lg:bg-white lg:border-gray-200 rounded-xl max-h-44 overflow-y-auto mt-1 divide-y divide-[#32363b] lg:divide-gray-100 shadow-md animate-in slide-in-from-top-1">
                                                    {filteredWarehouses.slice(0, 50).map((w) => {
                                                        const isSel = selectedWarehouse?.Ref === w.Ref;
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={w.Ref}
                                                                onClick={() => setSelectedWarehouse(w)}
                                                                className={`w-full text-left px-4 py-3 text-xs font-medium transition-colors ${
                                                                    isSel 
                                                                    ? 'bg-red-500/15 text-red-400 lg:bg-red-50 lg:text-red-700 font-bold' 
                                                                    : 'hover:bg-[#32363b] lg:hover:bg-gray-100 text-white lg:text-gray-800'
                                                                }`}
                                                            >
                                                                {w.Description} {w.ShortAddress ? `(${w.ShortAddress})` : ''}
                                                            </button>
                                                        );
                                                    })}
                                                    {filteredWarehouses.length === 0 && (
                                                        <div className="p-4 text-xs font-semibold text-[#a5acb5] lg:text-gray-450 italic text-center">
                                                            Відділень не знайдено за цим фільтром
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                !warehouseLoading && (
                                                    <div className="text-[12px] italic text-[#a5acb5] lg:text-gray-400">
                                                        Введіть та оберіть місто спочатку
                                                    </div>
                                                )
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Payer and Payment Method Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Хто оплачує</label>
                                    <div className="grid grid-cols-2 bg-[#292D32] lg:bg-gray-100 p-1 rounded-xl border border-[#32363b] lg:border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => setPayerType('Recipient')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                payerType === 'Recipient' 
                                                ? 'bg-red-500 text-white shadow-sm' 
                                                : 'text-[#a5acb5] lg:text-gray-600 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                            }`}
                                        >
                                            Отримувач
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPayerType('Sender')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                payerType === 'Sender' 
                                                ? 'bg-red-500 text-white shadow-sm' 
                                                : 'text-[#a5acb5] lg:text-gray-600 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                            }`}
                                        >
                                            Відправник
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Форма оплати</label>
                                    <div className="grid grid-cols-2 bg-[#292D32] lg:bg-gray-100 p-1 rounded-xl border border-[#32363b] lg:border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('Cash')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                paymentMethod === 'Cash' 
                                                ? 'bg-red-500 text-white shadow-sm' 
                                                : 'text-[#a5acb5] lg:text-gray-600 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                            }`}
                                        >
                                            Готівка
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('NonCash')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                paymentMethod === 'NonCash' 
                                                ? 'bg-red-500 text-white shadow-sm' 
                                                : 'text-[#a5acb5] lg:text-gray-600 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                            }`}
                                        >
                                            Безготівка
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Comment / Note input */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Опис / Примітка (Необов'язково)</label>
                                <textarea 
                                    rows={2}
                                    placeholder="Введіть особливу примітку для переадресації..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full bg-[#292D32] border border-[#32363b] lg:bg-white lg:border-gray-200 text-white lg:text-gray-900 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500 resize-none"
                                />
                            </div>

                            {errorMsg && (
                                <div className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl leading-relaxed mt-2">
                                    Помилка: {errorMsg}
                                </div>
                            )}

                            {/* Submit redirection button */}
                            <button
                                type="button"
                                onClick={handleRedirectionSubmit}
                                disabled={submitting || !selectedCity || !selectedWarehouse}
                                className="mt-4 bg-red-500 hover:bg-red-600 disabled:bg-gray-700/50 lg:disabled:bg-gray-150 disabled:text-gray-400 lg:disabled:text-gray-400 text-white font-bold py-4 px-6 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 select-none"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Створення переадресації...</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowLeftRight className="w-4 h-4" />
                                        <span>Підтвердити переадресацію</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        if (activeTab === 'return') {
            return (
                <div className="flex flex-col gap-5 p-6 bg-[#1b2b35] text-white lg:bg-white lg:text-gray-900 rounded-2xl h-full overflow-y-auto no-scrollbar">
                    <div className="flex items-center justify-between border-b pb-4 border-[#32363b] lg:border-gray-100">
                        <h4 className="text-base font-bold flex items-center gap-2">
                            <CornerDownLeft className="w-5 h-5 text-red-500" />
                            <span>Замовлення повернення вантажу</span>
                        </h4>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('details')}
                            className="text-xs uppercase bg-[#32363b] hover:bg-[#43484e] lg:bg-gray-100 lg:hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors font-bold text-white lg:text-gray-800"
                        >
                            Назад
                        </button>
                    </div>

                    {successMsg ? (
                        <div className="bg-emerald-500/25 border border-emerald-500/40 text-emerald-100 lg:bg-emerald-50 lg:text-emerald-800 p-5 rounded-2xl text-sm flex flex-col items-center gap-3 text-center my-4">
                            <CheckCircle className="w-10 h-10 text-emerald-400 shrink-0" />
                            <div className="font-semibold">{successMsg}</div>
                            <button 
                                type="button"
                                onClick={() => {
                                    setActiveTab('details');
                                    setSuccessMsg(null);
                                }}
                                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-xl text-xs uppercase tracking-wider"
                            >
                                Повернутись до деталей
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="bg-[#292D32] border border-[#32363b] lg:bg-red-50/50 lg:border-red-100/30 p-4.5 rounded-2xl text-[13px] leading-relaxed text-[#a5acb5] lg:text-gray-700">
                                <span className="font-bold text-white lg:text-gray-900 block mb-1.5">✓ Зворотня доставка</span>
                                Ви збираєтесь замовити послугу <strong className="text-red-400 lg:text-red-500 font-bold">"Повернення посилки"</strong>. Відправлений вантаж буде направлено назад від отримувача до початкового відправника (<strong className="text-white lg:text-gray-900 font-bold">{parcel.sender}</strong>) на його первинне відділення відправки.
                            </div>

                            {/* Cabinet selection */}
                            {accounts.length > 1 && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Оберіть кабінет</label>
                                    <select 
                                        value={selectedAccount?.id || ''}
                                        onChange={(e) => {
                                            const key = e.target.value;
                                            const match = accounts.find(a => a.id === key);
                                            if (match) setSelectedAccount(match);
                                        }}
                                        className="bg-[#292D32] border border-[#32363b] lg:bg-white lg:border-gray-200 text-white lg:text-gray-900 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500"
                                    >
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Payer and Payment Method Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Хто оплачує повернення</label>
                                    <div className="grid grid-cols-2 bg-[#292D32] lg:bg-gray-100 p-1 rounded-xl border border-[#32363b] lg:border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => setPayerType('Recipient')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                payerType === 'Recipient' 
                                                ? 'bg-red-500 text-white shadow-sm' 
                                                : 'text-[#a5acb5] lg:text-gray-600 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                            }`}
                                        >
                                            Отримувач
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPayerType('Sender')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                payerType === 'Sender' 
                                                ? 'bg-red-500 text-white shadow-sm' 
                                                : 'text-[#a5acb5] lg:text-gray-650 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                            }`}
                                        >
                                            Відправник
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Форма оплати</label>
                                    <div className="grid grid-cols-2 bg-[#292D32] lg:bg-gray-100 p-1 rounded-xl border border-[#32363b] lg:border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('Cash')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                paymentMethod === 'Cash' 
                                                ? 'bg-red-500 text-white shadow-sm' 
                                                : 'text-[#a5acb5] lg:text-gray-650 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                            }`}
                                        >
                                            Готівка
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('NonCash')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                paymentMethod === 'NonCash' 
                                                ? 'bg-red-500 text-white shadow-sm' 
                                                : 'text-[#a5acb5] lg:text-gray-650 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                            }`}
                                        >
                                            Безготівка
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Comment / Note input */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Причина або примітка (Необов'язково)</label>
                                <textarea 
                                    rows={2.5}
                                    placeholder="Вкажіть примітку або причину повернення..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full bg-[#292D32] border border-[#32363b] lg:bg-white lg:border-gray-200 text-white lg:text-gray-900 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500 resize-none"
                                />
                            </div>

                            {errorMsg && (
                                <div className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl leading-relaxed mt-2">
                                    Помилка: {errorMsg}
                                </div>
                            )}

                            {/* Submit return button */}
                            <button
                                type="button"
                                onClick={handleReturnSubmit}
                                disabled={submitting}
                                className="mt-4 bg-red-500 hover:bg-red-600 disabled:bg-gray-700/50 lg:disabled:bg-gray-150 disabled:text-gray-400 lg:disabled:text-gray-400 text-white font-bold py-4 px-6 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 select-none"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Оформлення повернення...</span>
                                    </>
                                ) : (
                                    <>
                                        <CornerDownLeft className="w-4 h-4" />
                                        <span>Підтвердити повернення вантажу</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        if (activeTab === 'change_data') {
            return (
                <div className="flex flex-col gap-5 p-6 bg-[#1b2b35] text-white lg:bg-white lg:text-gray-900 rounded-2xl h-full overflow-y-auto no-scrollbar">
                    <div className="flex items-center justify-between border-b pb-4 border-[#32363b] lg:border-gray-100">
                        <h4 className="text-base font-bold flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-red-500" />
                            <span>Зміна даних відправлення</span>
                        </h4>
                        <button 
                            type="button"
                            onClick={() => {
                                setSuccessMsg(null);
                                setErrorMsg(null);
                                setActiveTab('details');
                            }}
                            className="text-xs uppercase bg-[#32363b] hover:bg-[#43484e] lg:bg-gray-100 lg:hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors font-bold text-white lg:text-gray-800"
                        >
                            Назад
                        </button>
                    </div>

                    {successMsg ? (
                        <div className="bg-emerald-500/25 border border-emerald-500/40 text-emerald-100 lg:bg-emerald-50 lg:text-emerald-800 p-5 rounded-2xl text-sm flex flex-col items-center gap-3 text-center my-4">
                            <CheckCircle className="w-10 h-10 text-emerald-400 shrink-0" />
                            <div className="font-semibold">{successMsg}</div>
                            <button 
                                type="button"
                                onClick={() => {
                                    setActiveTab('details');
                                    setSuccessMsg(null);
                                }}
                                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-xl text-xs uppercase tracking-wider"
                            >
                                Повернутись до деталей
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="bg-[#292D32] border border-[#32363b] lg:bg-red-50/50 lg:border-red-100/30 p-4.5 rounded-2xl text-[13px] leading-relaxed text-[#a5acb5] lg:text-gray-700">
                                <span className="font-bold text-white lg:text-gray-900 block mb-1.5">✓ Заява про зміну даних ЕН</span>
                                {parcel.accountId === 'manual' ? (
                                    <span>Ви редагуєте дані вручну доданої ТТН локально. Ви можете змінити номер телефону отримувача, щоб система змогла завантажувати статус посилки в кабінеті.</span>
                                ) : (
                                    <span>Ви заповнюєте заяву про зміну даних отримувача, платника або типу оплати. Запит буде надіслано через API Нової Пошти від імені вашого кабінету.</span>
                                )}
                            </div>

                            {/* Cabinet selection */}
                            {parcel.accountId !== 'manual' && accounts.length > 1 && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Оберіть кабінет</label>
                                    <select 
                                        value={selectedAccount?.id || ''}
                                        onChange={(e) => {
                                            const key = e.target.value;
                                            const match = accounts.find(a => a.id === key);
                                            if (match) setSelectedAccount(match);
                                        }}
                                        className="bg-[#292D32] border border-[#32363b] lg:bg-white lg:border-gray-200 text-white lg:text-gray-900 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500"
                                    >
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Recipient Contact Name Field */}
                            {parcel.accountId !== 'manual' && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">ПІБ Отримувача</label>
                                    <input 
                                        type="text"
                                        placeholder="Прізвище Ім'я По батькові отримувача..."
                                        value={editRecipientName}
                                        onChange={(e) => setEditRecipientName(e.target.value)}
                                        className="w-full bg-[#292D32] border border-[#32363b] lg:bg-white lg:border-gray-200 text-white lg:text-gray-900 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                            )}

                            {/* Recipient Phone Field */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Телефон Отримувача</label>
                                <input 
                                    type="tel"
                                    placeholder="380991234567"
                                    value={editRecipientPhone}
                                    onChange={(e) => setEditRecipientPhone(e.target.value)}
                                    className="w-full bg-[#292D32] border border-[#32363b] lg:bg-white lg:border-gray-200 text-white lg:text-gray-900 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500 font-mono"
                                />
                            </div>

                            {/* Payer and Payment Method Selection */}
                            {parcel.accountId !== 'manual' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Хто оплачує доставку</label>
                                        <div className="grid grid-cols-2 bg-[#292D32] lg:bg-gray-100 p-1 rounded-xl border border-[#32363b] lg:border-gray-200">
                                            <button
                                                type="button"
                                                onClick={() => setPayerType('Recipient')}
                                                className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                    payerType === 'Recipient' 
                                                    ? 'bg-red-500 text-white shadow-sm' 
                                                    : 'text-[#a5acb5] lg:text-gray-650 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                                }`}
                                            >
                                                Отримувач
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPayerType('Sender')}
                                                className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                    payerType === 'Sender' 
                                                    ? 'bg-red-500 text-white shadow-sm' 
                                                    : 'text-[#a5acb5] lg:text-gray-650 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                                }`}
                                            >
                                                Відправник
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider">Форма оплати</label>
                                        <div className="grid grid-cols-2 bg-[#292D32] lg:bg-gray-100 p-1 rounded-xl border border-[#32363b] lg:border-gray-200">
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod('Cash')}
                                                className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                    paymentMethod === 'Cash' 
                                                    ? 'bg-red-500 text-white shadow-sm' 
                                                    : 'text-[#a5acb5] lg:text-gray-650 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                                }`}
                                            >
                                                Готівка
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod('NonCash')}
                                                className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                    paymentMethod === 'NonCash' 
                                                    ? 'bg-red-500 text-white shadow-sm' 
                                                    : 'text-[#a5acb5] lg:text-gray-650 hover:text-white lg:hover:text-gray-900 bg-transparent'
                                                }`}
                                            >
                                                Безготівка
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {errorMsg && (
                                <div className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl leading-relaxed mt-2">
                                    Помилка: {errorMsg}
                                </div>
                            )}

                            {/* Submit change data button */}
                            <button
                                type="button"
                                onClick={handleChangeDataSubmit}
                                disabled={submitting}
                                className="mt-4 bg-red-500 hover:bg-red-600 disabled:bg-gray-700/50 lg:disabled:bg-gray-150 disabled:text-gray-400 lg:disabled:text-gray-400 text-white font-bold py-4 px-6 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 select-none"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Збереження змін...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Підтвердити зміну даних ТТН</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };
    if (!parcel) return null;

    const parsePayer = () => {
        if (parcel.rawStatus?.PayerType === 'Sender') return 'Відправник';
        if (parcel.rawStatus?.PayerType === 'Recipient') return 'Одержувач';
        return parcel.rawStatus?.PayerType || 'Не визначено';
    };

    const getBackwardDeliveryInfo = () => {
        const cleanVal = (val: any) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const cleaned = val.replace(',', '.').replace(/[^\d.]/g, '');
                return parseFloat(cleaned) || 0;
            }
            return 0;
        };

        const sum = cleanVal(parcel.rawStatus?.BackwardDeliveryMoney) || 
                    cleanVal(parcel.rawStatus?.BackwardDeliverySum) || 
                    cleanVal(parcel.rawStatus?.RedeliverySum) ||
                    cleanVal(parcel.rawStatus?.AfterpaymentOnGoodsCost) ||
                    cleanVal(parcel.rawDoc?.BackwardDeliverySum) ||
                    0;

        if (sum <= 0) return null;

        const isControl = 
            JSON.stringify(parcel.rawStatus).toLowerCase().includes('контроль') || 
            JSON.stringify(parcel.rawDoc).toLowerCase().includes('контроль') ||
            (parcel.rawStatus?.ServiceType || '').toLowerCase().includes('control') ||
            (parcel.rawDoc?.ServiceType || '').toLowerCase().includes('control');
            
        return {
            amount: sum,
            label: isControl ? 'Контроль оплати' : 'Післяплата',
            isControl
        };
    };

    const formatServiceType = (type?: string) => {
        if (!type) return 'Стандарт';
        const typeMap: Record<string, string> = {
            'WarehouseWarehouse': 'Відділення-Відділення',
            'WarehouseDoors': 'Відділення-Адреса',
            'DoorsWarehouse': 'Адреса-Відділення',
            'DoorsDoors': 'Адреса-Адреса',
            'WarehousePostomat': 'Відділення-Поштомат',
            'PostomatWarehouse': 'Поштомат-Відділення',
            'PostomatPostomat': 'Поштомат-Поштомат',
            'DoorsPostomat': 'Адреса-Поштомат',
            'Standard': 'Стандарт',
        };
        return typeMap[type] || type;
    };

    const backwardInfo = getBackwardDeliveryInfo();

    return (
        <div 
           className="fixed inset-0 bg-black/40 lg:bg-black/60 lg:backdrop-blur-sm z-50 flex items-end landscape:items-center lg:items-center justify-center p-0 lg:p-6"
           onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Mobile View */}
            <div className="lg:hidden bg-[#1b2b35] w-full max-w-[400px] landscape:max-w-[640px] h-[85dvh] landscape:h-[92dvh] sm:h-[600px] rounded-t-[2.5rem] landscape:rounded-[1.5rem] sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300 ring-1 ring-gray-800">
                <div className="flex justify-center pt-3 pb-1 shrink-0 landscape:hidden">
                   <div className="w-12 h-1.5 bg-[#32363b] rounded-full"></div>
                </div>
                <div className="px-6 py-4 landscape:py-3.5 border-b border-[#32363b] flex items-center justify-between shrink-0 bg-[#1b2b35]">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#e33745] p-2 rounded-xl shadow-md shadow-red-900/20">
                            <Box className="w-5 h-5 text-white stroke-[2]" />
                        </div>
                        <div>
                            <div className="font-mono font-bold text-lg text-white tracking-tight">{parcel.ttn}</div>
                            <div className="text-[10px] uppercase text-[#a5acb5] font-bold tracking-wider">{parcel.accountName}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-[#a5acb5] hover:text-white rounded-full transition-colors bg-[#292D32]">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {activeTab !== 'details' ? (
                    <div className="flex-1 overflow-auto bg-[#1b2b35]">
                        {renderActiveForm()}
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto p-6 landscape:p-5 pb-28 landscape:pb-8 flex flex-col landscape:grid landscape:grid-cols-2 gap-6 landscape:gap-5 text-sm bg-[#1b2b35] no-scrollbar">
                        {/* Error & Success Messages */}
                        {(errorMsg || successMsg) && (
                            <div className="col-span-full">
                                {errorMsg && (
                                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-xs font-semibold leading-relaxed">
                                        Помилка: {errorMsg}
                                    </div>
                                )}
                                {successMsg && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-emerald-400 text-xs font-semibold leading-relaxed">
                                        {successMsg}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Left Column in Landscape: Status and Route */}
                    <div className="flex flex-col gap-6 landscape:gap-4_5">
                        {/* Status Section */}
                        <div>
                            <div className="bg-[#292D32] p-5 landscape:p-4 rounded-2xl border border-[#32363b] shadow-sm">
                                <div className="font-bold text-lg text-white mb-2 leading-tight">{parcel.status}</div>
                                <div className="flex gap-4 text-xs text-[#a5acb5] pt-3 border-t border-[#32363b]">
                                    <div><span className="font-medium text-gray-400">Створено:</span> <br/>{parcel.dateCreated || '-'}</div>
                                    <div><span className="font-medium text-gray-400">Тип:</span> <br/>{formatServiceType(parcel.rawStatus?.ServiceType || parcel.rawDoc?.ServiceType)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Route Checkpoint Box */}
                        <div className="bg-[#292D32] border border-[#32363b] rounded-2xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold text-base text-white">Маршрут</span>
                                <button 
                                    type="button"
                                    onClick={() => setShowFullRoute(true)}
                                    className="text-xs font-semibold text-gray-400 hover:text-white flex items-center gap-1 transition-colors uppercase tracking-wider bg-[#32363b] px-3 py-1.5 rounded-lg border border-[#444950]"
                                >
                                    Повністю <span className="text-[#1bc285] font-bold">&gt;</span>
                                </button>
                            </div>
                            {routePoints.checkpoints.length > 0 ? (
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col items-center shrink-0 pt-1">
                                        <div className="w-5 h-5 bg-[#1bc285] rounded-full flex items-center justify-center border-4 border-[#292D32]">
                                            <div className="w-1.5 h-1.5 bg-[#292D32] rounded-full"></div>
                                        </div>
                                        <div className="w-[2px] h-6 bg-[#32363b]"></div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-white leading-tight text-[15px] mb-1">
                                            {routePoints.checkpoints[0].status}
                                        </div>
                                        <div className="text-xs text-[#a5acb5]">
                                            {routePoints.checkpoints[0].location} · {routePoints.checkpoints[0].timestamp}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-[#a5acb5] italic">Дані про пересування поки відсутні</div>
                            )}
                        </div>

                        {parcel.basisChain && parcel.basisChain.length > 0 && (
                            <div className="bg-[#292D32] p-5 rounded-2xl border border-yellow-500/30 shadow-md">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#febb14] mb-3 flex items-center gap-1.5">
                                    <span>Послідовність переадресацій / повернень</span>
                                </div>
                                
                                <div className="flex flex-col gap-3">
                                    {parcel.basisChain.map((step: any, i: number) => (
                                        <div key={step.ttn} className="flex flex-col gap-1.5 p-3 bg-[#1b2b35] rounded-xl border border-[#32363b] relative">
                                            {i < parcel.basisChain!.length - 1 && (
                                                <div className="absolute -bottom-3 left-6 w-0.5 h-3 bg-[#32363b] z-0"></div>
                                            )}
                                            <div className="font-bold text-sm text-white leading-tight">
                                                {step.status || 'Оформлюється'}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="font-mono text-xs text-yellow-400 font-bold">
                                                    ТТН: {step.ttn}
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(step.ttn || '');
                                                        setCopied(true);
                                                        setTimeout(() => setCopied(false), 2000);
                                                    }}
                                                    className="text-[#a5acb5] hover:text-white text-[10px] px-2 py-0.5 bg-[#292D32] rounded border border-[#32363b] transition-colors"
                                                >
                                                    {copied ? 'Скопійовано!' : 'Копіювати'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-3 text-xs text-[#a5acb5] pt-4 mt-1 border-t border-[#32363b]">
                                    {(() => {
                                        const latestBasis = parcel.basisChain[parcel.basisChain.length - 1];
                                        return (
                                            <>
                                                <div className="flex justify-between items-center bg-[#1b2b35]/40 p-2.5 rounded-xl border border-[#32363b]/60">
                                                    <span>Поточне місце:</span>
                                                    <span className="font-medium text-white text-right break-words max-w-[60%]">
                                                        {latestBasis.cityName || 'В дорозі'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center bg-[#1b2b35]/40 p-2.5 rounded-xl border border-[#32363b]/60">
                                                    <span>Очікувана дата:</span>
                                                    <span className="font-bold text-red-400 text-right">
                                                        {latestBasis.estimatedDeliveryDate || latestBasis.rawStatus?.ScheduledDeliveryDate || '-'}
                                                    </span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                    <div className="text-[11px] text-[#868d96] italic text-center mt-2">
                                        Подальше відстеження відбувається автоматично
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Route */}
                        <div className="grid grid-cols-1 gap-3 relative">
                            <div className="absolute left-[31px] top-10 bottom-10 w-[2px] bg-[#32363b] z-0"></div>
                            
                            <div className="bg-[#292D32] border border-[#32363b] rounded-2xl p-4 landscape:p-3 shadow-sm relative z-10">
                                <div className="flex items-center gap-2 mb-2 text-[#a5acb5]">
                                    <div className="bg-[#1b2b35] p-1.5 rounded-lg border border-[#32363b]">
                                        <User className="w-4 h-4 text-blue-400" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Відправник</span>
                                </div>
                                <div className="font-medium text-white mb-1.5 text-[15px] pl-10">{parcel.sender}</div>
                                <div className="text-xs text-[#a5acb5] flex items-start gap-1.5 pl-10">
                                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{parcel.rawStatus?.CitySender || parcel.rawDoc?.CitySenderDescription || 'Місто невідоме'}</span>
                                </div>
                            </div>

                            <div className="bg-[#292D32] border border-[#32363b] rounded-2xl p-4 landscape:p-3 shadow-sm relative z-10">
                                <div className="flex items-center gap-2 mb-2 text-[#a5acb5]">
                                    <div className="bg-[#1b2b35] p-1.5 rounded-lg border border-[#32363b]">
                                        <UserCheck className="w-4 h-4 text-green-400" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Одержувач</span>
                                </div>
                                <div className="font-medium text-white mb-1.5 text-[15px] pl-10">{parcel.recipient}</div>
                                {(() => {
                                    const phoneNum = parcel.rawStatus?.PhoneRecipient || parcel.rawDoc?.PhoneRecipient;
                                    if (!phoneNum) return null;
                                    const displayPhone = phoneNum.startsWith('+') ? phoneNum : `+${phoneNum}`;
                                    return (
                                        <a 
                                            href={`tel:${displayPhone}`}
                                            className="text-[#a5acb5] hover:text-white flex items-center gap-1.5 text-xs pl-10 mb-1.5 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Phone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <span>{displayPhone}</span>
                                        </a>
                                    );
                                })()}
                                <div className="text-xs text-[#a5acb5] flex items-start gap-1.5 pl-10">
                                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{parcel.cityName}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column in Landscape: Meta stats & Description */}
                    <div className="flex flex-col gap-6 landscape:gap-4_5">
                        {/* Meta */}
                        <div className="bg-[#292D32] border border-[#32363b] rounded-2xl shadow-sm divide-y divide-[#32363b]">
                            <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                <div className="text-[#a5acb5] flex items-center gap-2"><Scale className="w-4 h-4"/> Вага</div>
                                <div className="font-medium text-right text-white">{parcel.weight} кг {parcel.rawStatus?.VolumeWeight ? `(${parcel.rawStatus.VolumeWeight} об'єм)` : ''}</div>
                            </div>
                            <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                <div className="text-[#a5acb5] flex items-center gap-2"><CreditCard className="w-4 h-4"/> Оплачує</div>
                                <div className="font-medium text-right text-white">{parsePayer()}</div>
                            </div>
                            <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                <div className="text-[#a5acb5] flex items-center gap-2">Доставка</div>
                                <div className="font-medium text-right font-mono text-[15px] text-white">{parcel.cost} ₴</div>
                            </div>
                            {parcel.announcedPrice && parseFloat(parcel.announcedPrice) > 0 && (
                                <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                    <div className="text-[#a5acb5] flex items-center gap-2">Оголошена вартість</div>
                                    <div className="font-medium text-right font-mono text-[15px] text-white">{parcel.announcedPrice} ₴</div>
                                </div>
                            )}
                            {backwardInfo && (
                                <>
                                    <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                        <div className="text-[#a5acb5] flex items-center gap-2">
                                            <CreditCard className="w-4 h-4 text-emerald-400"/> {backwardInfo.label}
                                        </div>
                                        <div className="font-bold text-right text-emerald-400 font-mono text-[15px]">
                                            {backwardInfo.amount} ₴
                                        </div>
                                    </div>
                                    {!backwardInfo.isControl && (
                                        <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                            <div className="text-[#a5acb5] flex items-center gap-2">Комісія за переказ</div>
                                            <div className="font-medium text-right text-emerald-400/80 font-mono text-[14px]">
                                                {parcel.rawStatus?.RedeliveryPaymentCard ? 'Сплачено онлайн' : `~${(backwardInfo.amount * 0.02 + 20).toFixed(2)} ₴`}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="grid grid-cols-2 p-4 landscape:p-3 bg-[#32363b]/30 rounded-b-2xl text-[13px]">
                                <div className="text-[#a5acb5] font-medium flex items-center gap-2">Орієнтовно</div>
                                <div className="font-bold text-[#e33745] text-right flex items-center justify-end gap-1.5"><Calendar className="w-4 h-4" />{parcel.estimatedDeliveryDate || '-'}</div>
                            </div>
                        </div>

                        {/* Description */}
                        {parcel.rawDoc?.Description && (
                            <div className="bg-[#292D32] border border-[#32363b] rounded-2xl p-4 landscape:p-3 text-[13px] text-[#a5acb5] shadow-sm leading-relaxed mb-6 landscape:mb-0">
                                <span className="font-medium text-white block mb-1">Опис:</span>
                                {parcel.rawDoc.Description}
                            </div>
                        )}

                        {/* Redirection / Return management buttons inside Card */}
                        <div className="bg-[#292D32] border border-[#32363b] rounded-2xl p-5 shadow-sm text-center flex flex-col gap-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 text-left mb-1">Керування відправленням</div>
                            {isCreatedStatus && selectedAccount?.apiKey && (
                                <div className="flex flex-col gap-2.5 border-b border-[#32363b]/60 pb-3.5 mb-1.5">
                                    <div className="text-xs font-semibold tracking-wider text-[#1bc285] uppercase flex items-center gap-1.5 justify-start">
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>Швидкий друк</span>
                                    </div>
                                    <div className="grid grid-cols-1">
                                        <a
                                            href={`https://my.novaposhta.ua/orders/printMarkings/orders[]/${parcel.ttn}/type/pdf/apiKey/${selectedAccount.apiKey}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-1.5 bg-[#32363b] hover:bg-[#43484e] text-white border border-[#4a4f56] font-semibold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer text-center"
                                        >
                                            <Printer className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                            <span>Маркування</span>
                                        </a>
                                    </div>
                                </div>
                            )}
                            {accounts.length === 0 && parcel.accountId !== 'manual' ? (
                                <div className="text-[#a5acb5] text-xs text-left leading-relaxed">
                                    Додайте аккаунт Нової Пошти в налаштуваннях, щоб здійснювати переадресацію та повернення онлайн.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2.5">
                                    {parcel.accountId !== 'manual' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    setSuccessMsg(null);
                                                    setErrorMsg(null);
                                                    setNote('');
                                                    setActiveTab('redirect');
                                                }}
                                                className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 text-center"
                                            >
                                                <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                                                <span>Переадресувати</span>
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    setSuccessMsg(null);
                                                    setErrorMsg(null);
                                                    setNote('');
                                                    setActiveTab('return');
                                                }}
                                                className="bg-[#32363b] hover:bg-[#43484e] text-white border border-[#4a4f56] font-bold py-3 px-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 text-center"
                                            >
                                                <CornerDownLeft className="w-3.5 h-3.5 shrink-0" />
                                                <span>Повернути</span>
                                            </button>
                                        </div>
                                    )}
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setSuccessMsg(null);
                                            setErrorMsg(null);
                                            setActiveTab('change_data');
                                        }}
                                        className="w-full bg-[#1b2b35] text-[#a5acb5] hover:text-white border border-[#32363b] hover:bg-[#292D32] font-bold py-3 px-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 text-center"
                                    >
                                        <Edit className="w-3.5 h-3.5 shrink-0" />
                                        <span>Змінити дані ТТН</span>
                                    </button>

                                    {isCreatedStatus && selectedAccount?.apiKey && parcel.rawDoc?.Ref && (
                                        <div className="w-full space-y-2 mt-1">
                                            {isDeleteConfirmOpen ? (
                                                <div className="bg-[#e33745]/10 border border-[#e33745]/30 p-4 rounded-xl text-center space-y-3">
                                                    <p className="text-red-400 text-xs font-bold leading-relaxed">
                                                        Ви впевнені, що хочете видалити ТТН з Нової Пошти? Цю дію неможливо скасувати.
                                                    </p>
                                                    {deleteError && (
                                                        <div className="bg-red-950/40 border border-red-900/40 p-2 rounded-lg text-red-400 text-[10px] text-left leading-normal font-medium">
                                                            {deleteError}
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={handleDeleteTtn}
                                                            disabled={submitting}
                                                            className="flex-1 bg-[#e33745] hover:bg-red-700 disabled:bg-red-900 text-white font-bold py-2.5 px-3 rounded-lg text-[10.5px] uppercase tracking-wider transition-all select-none cursor-pointer"
                                                        >
                                                            {submitting ? 'Видалення...' : 'Так, видалити'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsDeleteConfirmOpen(false);
                                                                setDeleteError(null);
                                                            }}
                                                            disabled={submitting}
                                                            className="flex-1 bg-[#32363b] hover:bg-[#43484e] text-gray-300 border border-[#4a4f56] font-bold py-2.5 px-3 rounded-lg text-[10.5px] uppercase tracking-wider transition-all select-none cursor-pointer"
                                                        >
                                                            Скасувати
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button 
                                                    type="button"
                                                    onClick={() => setIsDeleteConfirmOpen(true)}
                                                    className="w-full bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-500/30 font-bold py-3 px-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 text-center"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Видалити ТТН з Нової Пошти</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {onDeleteManualTtn && (
                            <button
                                onClick={onDeleteManualTtn}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 w-full mt-2 select-none"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Видалити з відстеження</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Desktop View */}
            <div className="hidden lg:flex flex-col bg-white w-full max-w-4xl max-h-[85vh] h-[650px] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
               {/* Desktop header */}
               <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-red-100 p-2.5 rounded-xl shadow-sm">
                           <Box className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <div className="font-mono font-bold text-2xl text-gray-900 tracking-tight">{parcel.ttn}</div>
                            <div className="text-[11px] uppercase text-gray-500 font-bold tracking-wider">{parcel.accountName}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200">
                        <X className="w-6 h-6" />
                    </button>
               </div>
               
               {activeTab !== 'details' ? (
                   <div className="flex-1 flex min-h-0 overflow-hidden bg-white">
                       {renderActiveForm()}
                   </div>
               ) : (
                   <div className="flex-1 flex min-h-0">
                   {/* Left Col - Route & Main Info */}
                   <div className="flex-1 overflow-y-auto p-8 border-r border-gray-100 bg-white">
                        {/* Error & Success Messages */}
                        {(errorMsg || successMsg) && (
                            <div className="mb-6">
                                {errorMsg && (
                                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-600 text-sm font-semibold leading-relaxed">
                                        Помилка: {errorMsg}
                                    </div>
                                )}
                                {successMsg && (
                                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-600 text-sm font-semibold leading-relaxed">
                                        {successMsg}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="inline-flex px-4 py-1.5 bg-gray-100 text-gray-900 rounded-full text-sm font-bold mb-8 shadow-sm">
                            {parcel.status}
                        </div>

                        {/* Desktop Compact Route Box */}
                        <div className="mb-0 mb-8 p-6 bg-gray-50 border border-gray-100 rounded-2xl shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold text-base text-gray-950">Маршрут посилки</span>
                                <button 
                                    type="button"
                                    onClick={() => setShowFullRoute(true)}
                                    className="text-xs font-semibold text-gray-500 hover:text-gray-950 flex items-center gap-1 transition-colors uppercase tracking-wider bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg border border-gray-200 cursor-pointer animate-pulse"
                                >
                                    Повністю <span className="text-[#1bc285] font-bold">&gt;</span>
                                </button>
                            </div>
                            {routePoints.checkpoints.length > 0 ? (
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col items-center shrink-0 pt-1">
                                        <div className="w-5 h-5 bg-[#1bc285] rounded-full flex items-center justify-center border-4 border-gray-50">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                        </div>
                                        <div className="w-[2px] h-6 bg-gray-200"></div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-950 leading-tight text-[15px] mb-1">
                                            {routePoints.checkpoints[0].status}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {routePoints.checkpoints[0].location} · {routePoints.checkpoints[0].timestamp}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-gray-500 italic">Інформація про маршрут оновлюється</div>
                            )}
                        </div>

                        {parcel.basisChain && parcel.basisChain.length > 0 && (
                            <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-2xl shadow-sm">
                                <div className="text-[11px] font-bold uppercase tracking-widest text-yellow-600 mb-4 flex items-center gap-1.5">
                                    <span>Послідовність переадресацій / повернень</span>
                                </div>
                                
                                <div className="flex flex-col gap-4 mb-5">
                                    {parcel.basisChain.map((step: any, i: number) => (
                                        <div key={step.ttn} className="flex flex-col gap-1.5 p-4 bg-white rounded-xl border border-yellow-200 shadow-sm relative">
                                            {i < parcel.basisChain!.length - 1 && (
                                                <div className="absolute -bottom-4 left-6 w-0.5 h-4 bg-yellow-200 z-0"></div>
                                            )}
                                            <div className="font-bold text-[15px] text-gray-900 leading-tight">
                                                {step.status || 'Оформлюється'}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="font-mono text-sm text-yellow-700 font-bold">
                                                    ТТН: {step.ttn}
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(step.ttn || '');
                                                        setCopied(true);
                                                        setTimeout(() => setCopied(false), 2000);
                                                    }}
                                                    className="px-2 py-0.5 text-[10px] bg-white border border-gray-200 text-gray-600 rounded hover:text-gray-900 hover:bg-gray-100 transition-colors font-sans"
                                                >
                                                    {copied ? 'Скопійовано!' : 'Копіювати'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {(() => {
                                    const latestBasis = parcel.basisChain[parcel.basisChain.length - 1];
                                    return (
                                        <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t border-yellow-200/60">
                                            <div>
                                                 <span className="text-gray-500 block mb-0.5">Поточне місце:</span>
                                                 <span className="font-bold text-gray-900 text-sm break-words">
                                                     {latestBasis.cityName || 'В дорозі'}
                                                 </span>
                                            </div>
                                            <div>
                                                 <span className="text-gray-500 block mb-0.5">Очікувана дата:</span>
                                                 <span className="font-bold text-red-650 text-sm">
                                                     {latestBasis.estimatedDeliveryDate || latestBasis.rawStatus?.ScheduledDeliveryDate || '-'}
                                                 </span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                        
                        <div className="relative pl-7 space-y-10 before:absolute before:inset-y-0 before:left-3 before:w-0.5 before:bg-gray-100">
                            
                            {/* Sender */}
                            <div className="relative">
                                <div className="absolute top-1 -left-[30px] w-5 h-5 bg-white border-[3px] border-blue-400 rounded-full shadow-sm"></div>
                                <div className="text-[11px] font-bold uppercase tracking-widest text-blue-500 mb-1.5">Відправник</div>
                                <div className="font-medium text-gray-900 text-xl tracking-tight mb-2">{parcel.sender}</div>
                                <div className="flex items-start gap-2 text-gray-500 text-sm">
                                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>{parcel.rawStatus?.CitySender || parcel.rawDoc?.CitySenderDescription || 'Місто невідоме'}</span>
                                </div>
                            </div>

                            {/* Recipient */}
                            <div className="relative">
                                <div className="absolute top-1 -left-[30px] w-5 h-5 bg-white border-[3px] border-green-400 rounded-full shadow-sm"></div>
                                <div className="text-[11px] font-bold uppercase tracking-widest text-green-500 mb-1.5">Одержувач</div>
                                <div className="font-medium text-gray-900 text-xl tracking-tight mb-2">{parcel.recipient}</div>
                                {(() => {
                                    const phoneNum = parcel.rawStatus?.PhoneRecipient || parcel.rawDoc?.PhoneRecipient;
                                    if (!phoneNum) return null;
                                    const displayPhone = phoneNum.startsWith('+') ? phoneNum : `+${phoneNum}`;
                                    return (
                                        <a 
                                            href={`tel:${displayPhone}`}
                                            className="flex items-center gap-2 text-gray-500 hover:text-blue-600 text-sm mb-1.5 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Phone className="w-4 h-4 shrink-0" />
                                            <span>{displayPhone}</span>
                                        </a>
                                    );
                                })()}
                                <div className="flex items-start gap-2 text-gray-500 text-sm">
                                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>{parcel.cityName}</span>
                                </div>
                            </div>
                        </div>

                        {parcel.rawDoc?.Description && (
                            <div className="mt-10 pt-8 border-t border-gray-100">
                                <div className="font-medium text-gray-900 block mb-3 text-sm">Опис відправлення:</div>
                                <div className="text-[15px] text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed">
                                    {parcel.rawDoc.Description}
                                </div>
                            </div>
                        )}
                   </div>
                   
                   {/* Right Col - Details */}
                   <div className="w-[320px] shrink-0 bg-[#FAFAFA] p-8 overflow-y-auto hidden lg:block">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-8">Деталі</h3>
                        
                        <div className="space-y-8">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                                    <Calendar className="w-4 h-4 text-orange-500" />Орієнтовна дата
                                </div>
                                <div className="font-semibold text-gray-900 text-[15px] pl-6">
                                    {parcel.estimatedDeliveryDate || '-'}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                                    <Scale className="w-4 h-4 text-blue-500" />Вага
                                </div>
                                <div className="font-semibold text-gray-900 text-[15px] pl-6">
                                    {parcel.weight} кг {parcel.rawStatus?.VolumeWeight ? `(${parcel.rawStatus.VolumeWeight} об'єм)` : ''}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                                    <CreditCard className="w-4 h-4 text-purple-500" />Тип оплати
                                </div>
                                <div className="font-semibold text-gray-900 text-[15px] pl-6">
                                    {parsePayer()}
                                </div>
                            </div>

                            {parcel.announcedPrice && parseFloat(parcel.announcedPrice) > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                                        Оголошена вартість
                                    </div>
                                    <div className="font-semibold text-gray-900 text-[15px] pl-6">
                                        {parcel.announcedPrice} ₴
                                    </div>
                                </div>
                            )}

                            {backwardInfo && (
                                <>
                                    <div className="flex flex-col gap-1.5 align-right">
                                        <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                                            <CreditCard className="w-4 h-4 text-emerald-500" />{backwardInfo.label}
                                        </div>
                                        <div className="font-semibold text-emerald-600 text-[15px] pl-6 font-mono">
                                            {backwardInfo.amount} ₴
                                        </div>
                                    </div>
                                    {!backwardInfo.isControl && (
                                        <div className="flex flex-col gap-1.5 align-right">
                                            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium pl-6">
                                                Комісія за переказ
                                            </div>
                                            <div className="font-semibold text-emerald-600/80 text-[14px] pl-6 font-mono">
                                                {parcel.rawStatus?.RedeliveryPaymentCard ? 'Сплачено онлайн' : `~${(backwardInfo.amount * 0.02 + 20).toFixed(2)} ₴`}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="pt-8 border-t border-gray-200 mt-8">
                                <div className="text-gray-500 text-sm mb-2 text-right font-medium">Вартість доставки</div>
                                <div className="font-mono text-[32px] tracking-tighter font-bold text-gray-900 text-right">
                                    {parcel.cost} ₴
                                </div>
                            </div>

                            {/* Redirection / Return management buttons block */}
                            <div className="pt-6 mt-6 border-t border-gray-200 flex flex-col gap-2.5">
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Керування відправленням</div>
                                {isCreatedStatus && selectedAccount?.apiKey && (
                                    <div className="flex flex-col gap-2 border-b border-gray-100 pb-4 mb-2">
                                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5 self-start mb-1">
                                            <Printer className="w-4 h-4" />
                                            <span>Друк документів</span>
                                        </div>
                                        <div className="grid grid-cols-1">
                                            <a
                                                href={`https://my.novaposhta.ua/orders/printMarkings/orders[]/${parcel.ttn}/type/pdf/apiKey/${selectedAccount.apiKey}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                                            >
                                                <Printer className="w-4 h-4 shrink-0 text-amber-500" />
                                                <span>Маркування (PDF)</span>
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {accounts.length === 0 && parcel.accountId !== 'manual' ? (
                                    <div className="text-gray-400 text-xs italic">
                                        Додайте хоча б один аккаунт Нової Пошти, щоб здійснювати переадресацію та повернення онлайн.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2.5">
                                        {parcel.accountId !== 'manual' && (
                                            <>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setSuccessMsg(null);
                                                        setErrorMsg(null);
                                                        setNote('');
                                                        setActiveTab('redirect');
                                                    }}
                                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"
                                                >
                                                    <ArrowLeftRight className="w-4 h-4 shrink-0" />
                                                    <span>Переадресувати</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setSuccessMsg(null);
                                                        setErrorMsg(null);
                                                        setNote('');
                                                        setActiveTab('return');
                                                    }}
                                                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"
                                                >
                                                    <CornerDownLeft className="w-4 h-4 shrink-0" />
                                                    <span>Повернути відправлення</span>
                                                </button>
                                            </>
                                        )}
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setSuccessMsg(null);
                                                setErrorMsg(null);
                                                setActiveTab('change_data');
                                            }}
                                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <Edit className="w-4 h-4 shrink-0 text-red-500" />
                                            <span>Змінити дані ТТН</span>
                                        </button>

                                        {isCreatedStatus && selectedAccount?.apiKey && parcel.rawDoc?.Ref && (
                                            <div className="w-full space-y-2 mt-2">
                                                {isDeleteConfirmOpen ? (
                                                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-center shadow-sm space-y-3">
                                                        {deleteError && (
                                                            <div className="bg-red-100 border border-red-200 p-2 rounded-lg text-red-700 text-[10px] text-left leading-normal font-medium mb-1">
                                                                {deleteError}
                                                            </div>
                                                        )}
                                                        <p className="text-red-700 text-xs font-bold leading-relaxed">
                                                            Ви впевнені, що хочете видалити ТТН з Нової Пошти? Цю дію неможливо скасувати.
                                                        </p>
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={handleDeleteTtn}
                                                                disabled={submitting}
                                                                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-sm select-none cursor-pointer"
                                                            >
                                                                {submitting ? 'Видалення...' : 'Так, видалити'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setIsDeleteConfirmOpen(false); setDeleteError(null); }}
                                                                disabled={submitting}
                                                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all border border-gray-200 select-none cursor-pointer"
                                                            >
                                                                Скасувати
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setIsDeleteConfirmOpen(true)}
                                                        className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"
                                                    >
                                                        <Trash2 className="w-4 h-4 shrink-0 text-red-600" />
                                                        <span>Видалити ТТН з Нової Пошти</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {onDeleteManualTtn && (
                                <div className="pt-6 mt-6 border-t border-gray-200">
                                    <button
                                        onClick={onDeleteManualTtn}
                                        className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm select-none"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Видалити з відстеження</span>
                                    </button>
                                </div>
                            )}
                        </div>
                   </div>
                </div>
               )}
            </div>

         {/* Full Route Modal Overlay */}
         {showFullRoute && (
             <div 
                 className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-0 sm:p-4"
                 onClick={() => setShowFullRoute(false)}
             >
                 <div 
                     className="bg-[#111d24] sm:bg-[#1b2b35] text-white w-full max-w-[400px] h-[100dvh] sm:h-[650px] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                     onClick={(e) => e.stopPropagation()}
                  >
                     {/* Upper Handle */}
                     <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                         <div className="w-12 h-1.5 bg-gray-700 rounded-full"></div>
                     </div>

                     {/* Modal Header */}
                     <div className="p-6 pb-4 flex items-center justify-between shrink-0 bg-transparent">
                         <div>
                             <h3 className="text-xl font-bold text-white tracking-tight">
                                 {routePoints.senderCityClean} - {routePoints.recipientCityClean}
                             </h3>
                             <p className="text-sm text-gray-400 mt-1 font-medium">
                                 {Number(parcel.statusCode || '0') >= 9 ? 'Було в дорозі:' : 'В дорозі:'} <span className="font-bold text-[#1bc285]">{routePoints.durationText}</span>
                             </p>
                         </div>
                         <button 
                             onClick={() => setShowFullRoute(false)}
                             className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors shrink-0"
                         >
                             <X className="w-5 h-5" />
                         </button>
                     </div>

                     {/* List of Checkpoints */}
                     <div className="flex-1 overflow-y-auto px-6 py-4 space-y-0 no-scrollbar relative min-h-0">
                         {routePoints.checkpoints.length > 0 ? (
                             <div className="relative pl-7 space-y-6">
                                 {/* Vertical line */}
                                 <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-gray-700/60 z-0"></div>

                                 {routePoints.checkpoints.map((cp, idx) => {
                                      const isNewest = idx === 0;
                                      return (
                                          <div key={idx} className="relative z-10 flex flex-col gap-1">
                                              {/* Dots */}
                                              {isNewest ? (
                                                  <div className="absolute -left-[23px] top-1 w-5 h-5 bg-[#1bc285] rounded-full flex items-center justify-center shadow-lg shadow-emerald-950/40 ring-4 ring-[#111d24] sm:ring-[#1b2b35]">
                                                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                                  </div>
                                              ) : (
                                                  <div className="absolute -left-[19px] top-1.5 w-3 h-3 bg-gray-500 rounded-full ring-4 ring-[#111d24] sm:ring-[#1b2b35]"></div>
                                              )}
                                              
                                              {/* Info text */}
                                              <div className={`font-semibold text-[15px] leading-tight ${isNewest ? 'text-[#1bc285]' : 'text-gray-100'}`}>
                                                  {cp.status}
                                              </div>
                                              <div className="text-xs text-gray-400 flex items-center gap-1">
                                                  {cp.location} <span className="text-gray-650 font-light">·</span> {cp.timestamp}
                                              </div>
                                          </div>
                                      );
                                 })}
                             </div>
                         ) : (
                             <div className="text-center py-20 text-gray-400 italic font-medium">
                                 Дані маршруту оновлюються...
                             </div>
                         )}
                     </div>

                     {/* Bottom Action Button */}
                     <div className="p-6 pt-2 shrink-0">
                         <button
                             type="button"
                             onClick={() => setShowFullRoute(false)}
                             className="w-full bg-[#1bc285] hover:bg-[#19b078] active:bg-[#159a68] text-white font-bold py-4 px-6 rounded-xl text-sm uppercase tracking-wider transition-colors shadow-lg shadow-emerald-950/25 cursor-pointer text-center"
                         >
                             Зрозуміло
                         </button>
                     </div>
                 </div>
             </div>
         )}

        </div>
    );
}