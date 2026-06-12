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
    onUpdateManualTtn?: (phone?: string, accountId?: string) => void;
}

const getBackwardDeliveryInfo = (parcel: any) => {
    if (!parcel) return null;
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
        JSON.stringify(parcel.rawStatus || {}).toLowerCase().includes('контроль') || 
        JSON.stringify(parcel.rawDoc || {}).toLowerCase().includes('контроль') ||
        (parcel.rawStatus?.ServiceType || '').toLowerCase().includes('control') ||
        (parcel.rawDoc?.ServiceType || '').toLowerCase().includes('control');
        
    return {
        amount: sum,
        label: isControl ? 'Контроль оплати' : 'Післяплата',
        isControl
    };
};

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

    // Backward Delivery States
    const [hasAfterpayment, setHasAfterpayment] = useState<boolean>(() => {
        return !!getBackwardDeliveryInfo(parcel);
    });
    const [afterpaymentType, setAfterpaymentType] = useState<'Money' | 'PaymentControl'>(() => {
        return getBackwardDeliveryInfo(parcel)?.isControl ? 'PaymentControl' : 'Money';
    });
    const [afterpaymentSum, setAfterpaymentSum] = useState<string>(() => {
        const bd = getBackwardDeliveryInfo(parcel);
        return bd ? String(bd.amount) : '';
    });
    const [afterpaymentPayer, setAfterpaymentPayer] = useState<string>(() => {
        const bdList = parcel.rawStatus?.BackwardDeliveryData || parcel.rawDoc?.BackwardDeliveryData;
        if (bdList && bdList[0]?.PayerType) {
            return bdList[0].PayerType;
        }
        if (parcel.rawStatus?.RedeliveryPayerType) {
            return parcel.rawStatus.RedeliveryPayerType;
        }
        return 'Recipient';
    });

    // Form inputs and selection dropdowns
    const [selectedAccount, setSelectedAccount] = useState<NpAccount | null>(() => {
        const matching = accounts.find(a => a.id === parcel.accountId);
        return matching || accounts[0] || null;
    });

    const [selectedAccountIdForEdit, setSelectedAccountIdForEdit] = useState<string>(() => {
        return parcel.accountId || accounts[0]?.id || '';
    });

    useEffect(() => {
        const matching = accounts.find(a => a.id === selectedAccountIdForEdit);
        if (matching) {
            setSelectedAccount(matching);
        }
    }, [selectedAccountIdForEdit, accounts]);

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

    // Sync change data states when parcel changes
    useEffect(() => {
        setEditRecipientName(parcel.recipient || '');
        const phoneNum = parcel.rawStatus?.PhoneRecipient || parcel.rawDoc?.PhoneRecipient || '';
        setEditRecipientPhone(phoneNum);

        const bd = getBackwardDeliveryInfo(parcel);
        setHasAfterpayment(!!bd);
        setAfterpaymentType(bd?.isControl ? 'PaymentControl' : 'Money');
        setAfterpaymentSum(bd ? String(bd.amount) : '');

        const bdList = parcel.rawStatus?.BackwardDeliveryData || parcel.rawDoc?.BackwardDeliveryData;
        if (bdList && bdList[0]?.PayerType) {
            setAfterpaymentPayer(bdList[0].PayerType);
        } else if (parcel.rawStatus?.RedeliveryPayerType) {
            setAfterpaymentPayer(parcel.rawStatus.RedeliveryPayerType);
        } else {
            setAfterpaymentPayer('Recipient');
        }
    }, [parcel]);

    const handleDeleteTtn = async () => {
        if (parcel.isManual) {
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
        if (parcel.isManual) {
            if (onUpdateManualTtn) {
                setSubmitting(true);
                setErrorMsg(null);
                try {
                    onUpdateManualTtn(editRecipientPhone || undefined, selectedAccountIdForEdit || undefined);
                    setSuccessMsg('Дані ТТН успішно оновлено локально! Кабінет та телефон змінено.');
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

        let backwardDeliveryData;
        let afterpaymentOnGoodsCost;

        if (hasAfterpayment) {
            const sumVal = String(Math.round(parseFloat(afterpaymentSum) || 0));
            if (!sumVal || sumVal === '0') {
                setErrorMsg('Будь ласка, вкажіть коректну суму післяплати');
                return;
            }

            if (afterpaymentType === 'PaymentControl') {
                afterpaymentOnGoodsCost = sumVal;
                backwardDeliveryData = [{
                    PayerType: afterpaymentPayer,
                    CargoType: 'Money',
                    RedeliveryString: sumVal
                }];
            } else {
                backwardDeliveryData = [{
                    PayerType: afterpaymentPayer,
                    CargoType: 'Money',
                    RedeliveryString: sumVal
                }];
            }
        } else {
            backwardDeliveryData = [];
            afterpaymentOnGoodsCost = "";
        }

        setSubmitting(true);
        setErrorMsg(null);
        try {
            await submitChangeData(selectedAccount.apiKey, {
                IntDocNumber: parcel.ttn,
                PaymentMethod: paymentMethod,
                PayerType: payerType,
                RecipientContactPerson: editRecipientName,
                RecipientPhone: editRecipientPhone,
                BackwardDeliveryData: backwardDeliveryData,
                AfterpaymentOnGoodsCost: afterpaymentOnGoodsCost
            });
            setSuccessMsg('Заяву про зміну даних ЕН (включаючи зворотну доставку) успішно надіслано!');
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
                <div className="flex flex-col gap-5 p-6 bg-[var(--bg-main)] text-[var(--text-main)]  rounded-2xl h-full overflow-y-auto no-scrollbar">
                    <div className="flex items-center justify-between border-b pb-4 border-[var(--border-color)] border-[var(--border-color)]">
                        <h4 className="text-base font-bold flex items-center gap-2">
                            <ArrowLeftRight className="w-5 h-5 text-red-500" />
                            <span>Переадресація відправлення</span>
                        </h4>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('details')}
                            className="text-xs uppercase bg-[var(--bg-hover)] hover:bg-[var(--progress-track)] px-3 py-1.5 rounded-lg transition-colors font-bold text-[var(--text-main)]"
                        >
                            Назад
                        </button>
                    </div>

                    {successMsg ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 p-5 rounded-2xl text-sm flex flex-col items-center gap-3 text-center my-4">
                            <CheckCircle className="w-10 h-10 text-emerald-500 shrink-0" />
                            <div className="font-semibold">{successMsg}</div>
                            <button 
                                type="button"
                                onClick={() => {
                                    setActiveTab('details');
                                    setSuccessMsg(null);
                                }}
                                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-[var(--text-main)] font-bold py-2 px-5 rounded-xl text-xs uppercase tracking-wider"
                            >
                                Повернутись до деталей
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="bg-[var(--bg-card-alt)] border border-[var(--border-color)]/50/30 p-4 rounded-2xl text-[13px] text-[var(--text-muted)] leading-relaxed">
                                За допомогою цієї послуги ви можете змінити адресу доставки посилки на інше відділення або поштомат Нової Пошти.
                            </div>

                            {/* City lookup */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Місто призначення</label>
                                <div className="relative">
                                    <input 
                                        type="text"
                                        placeholder="Введіть щонайменше 3 символи міста..."
                                        value={citySearchQuery}
                                        onChange={(e) => {
                                            setCitySearchQuery(e.target.value);
                                            if (selectedCity) setSelectedCity(null);
                                        }}
                                        className="w-full bg-[var(--bg-card-alt)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                    <Search className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-[var(--text-muted)]" />
                                    {cityLoading && (
                                        <Loader2 className="absolute right-3 top-3.5 w-4.5 h-4.5 text-[#e33745] animate-spin" />
                                    )}
                                </div>

                                {selectedCity && (
                                    <div className="text-[12px] text-emerald-500 font-bold mt-1">
                                        ✓ Обрано місто: {selectedCity.Description} ({selectedCity.AreaDescription})
                                    </div>
                                )}

                                {!selectedCity && cities.length > 0 && (
                                    <div className="bg-[var(--bg-card-alt)] border border-[var(--border-color)] rounded-xl max-h-40 overflow-y-auto mt-1 divide-y divide-[var(--border-color)] lg:divide-gray-100 shadow-xl z-30">
                                        {cities.map((city) => (
                                            <button
                                                type="button"
                                                key={city.Ref}
                                                onClick={() => {
                                                    setSelectedCity(city);
                                                    setCitySearchQuery(city.Description);
                                                    setCities([]);
                                                }}
                                                className="w-full text-left px-4 py-3 text-xs font-medium hover:bg-[var(--bg-hover)] text-[var(--text-main)] transition-colors"
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
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Нове відділення або поштомат</label>
                                    
                                    {selectedWarehouse ? (
                                        <div className="bg-[var(--bg-card-alt)]/60/30 border border-emerald-500/20 p-3.5 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                    <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                                    ✓ Обрано відділення
                                                </span>
                                                <span className="text-xs font-bold text-[var(--text-main)] leading-normal break-words">
                                                    {selectedWarehouse.Description}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedWarehouse(null);
                                                }}
                                                className="text-[11px] font-bold text-red-500 hover:text-red-500 shrink-0 bg-[var(--bg-hover)] hover:bg-[var(--progress-track)] py-1.5 px-3 rounded-xl transition-colors cursor-pointer"
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
                                                    className="w-full bg-[var(--bg-card-alt)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500"
                                                />
                                                <Search className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-[var(--text-muted)]" />
                                                {warehouseLoading && (
                                                    <Loader2 className="absolute right-3 top-3.5 w-4.5 h-4.5 text-[#e33745] animate-spin" />
                                                )}
                                            </div>

                                            {warehouses.length > 0 ? (
                                                <div className="bg-[var(--bg-card-alt)] border border-[var(--border-color)] rounded-xl max-h-44 overflow-y-auto mt-1 divide-y divide-[var(--border-color)] lg:divide-gray-100 shadow-md animate-in slide-in-from-top-1">
                                                    {filteredWarehouses.slice(0, 50).map((w) => {
                                                        const isSel = selectedWarehouse?.Ref === w.Ref;
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={w.Ref}
                                                                onClick={() => setSelectedWarehouse(w)}
                                                                className={`w-full text-left px-4 py-3 text-xs font-medium transition-colors ${
                                                                    isSel 
                                                                    ? 'bg-red-500/15 text-red-500 font-bold' 
                                                                    : 'hover:bg-[var(--bg-hover)] text-[var(--text-main)]'
                                                                }`}
                                                            >
                                                                {w.Description} {w.ShortAddress ? `(${w.ShortAddress})` : ''}
                                                            </button>
                                                        );
                                                    })}
                                                    {filteredWarehouses.length === 0 && (
                                                        <div className="p-4 text-xs font-semibold text-[var(--text-muted)] italic text-center">
                                                            Відділень не знайдено за цим фільтром
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                !warehouseLoading && (
                                                    <div className="text-[12px] italic text-[var(--text-muted)]">
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
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Хто оплачує</label>
                                    <div className="grid grid-cols-2 bg-[var(--bg-card-alt)] p-1 rounded-xl border border-[var(--border-color)]">
                                        <button
                                            type="button"
                                            onClick={() => setPayerType('Recipient')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                payerType === 'Recipient' 
                                                ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                            }`}
                                        >
                                            Отримувач
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPayerType('Sender')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                payerType === 'Sender' 
                                                ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                            }`}
                                        >
                                            Відправник
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Форма оплати</label>
                                    <div className="grid grid-cols-2 bg-[var(--bg-card-alt)] p-1 rounded-xl border border-[var(--border-color)]">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('Cash')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                paymentMethod === 'Cash' 
                                                ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                            }`}
                                        >
                                            Готівка
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('NonCash')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                paymentMethod === 'NonCash' 
                                                ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                            }`}
                                        >
                                            Безготівка
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Comment / Note input */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Опис / Примітка (Необов'язково)</label>
                                <textarea 
                                    rows={2}
                                    placeholder="Введіть особливу примітку для переадресації..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full bg-[var(--bg-card-alt)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500 resize-none"
                                />
                            </div>

                            {errorMsg && (
                                <div className="text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl leading-relaxed mt-2">
                                    Помилка: {errorMsg}
                                </div>
                            )}

                            {/* Submit redirection button */}
                            <button
                                type="button"
                                onClick={handleRedirectionSubmit}
                                disabled={submitting || !selectedCity || !selectedWarehouse}
                                className="mt-4 bg-red-500 hover:bg-red-600 disabled:bg-gray-700/50 disabled:text-[var(--text-muted)] text-[#ffffff] font-bold py-4 px-6 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 select-none"
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
                <div className="flex flex-col gap-5 p-6 bg-[var(--bg-main)] text-[var(--text-main)]  rounded-2xl h-full overflow-y-auto no-scrollbar">
                    <div className="flex items-center justify-between border-b pb-4 border-[var(--border-color)] border-[var(--border-color)]">
                        <h4 className="text-base font-bold flex items-center gap-2">
                            <CornerDownLeft className="w-5 h-5 text-red-500" />
                            <span>Замовлення повернення вантажу</span>
                        </h4>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('details')}
                            className="text-xs uppercase bg-[var(--bg-hover)] hover:bg-[var(--progress-track)] px-3 py-1.5 rounded-lg transition-colors font-bold text-[var(--text-main)]"
                        >
                            Назад
                        </button>
                    </div>

                    {successMsg ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 p-5 rounded-2xl text-sm flex flex-col items-center gap-3 text-center my-4">
                            <CheckCircle className="w-10 h-10 text-emerald-500 shrink-0" />
                            <div className="font-semibold">{successMsg}</div>
                            <button 
                                type="button"
                                onClick={() => {
                                    setActiveTab('details');
                                    setSuccessMsg(null);
                                }}
                                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-[var(--text-main)] font-bold py-2 px-5 rounded-xl text-xs uppercase tracking-wider"
                            >
                                Повернутись до деталей
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="bg-[var(--bg-card-alt)] border border-[var(--border-color)]/50/30 p-4.5 rounded-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
                                <span className="font-bold text-[var(--text-main)] block mb-1.5">✓ Зворотня доставка</span>
                                Ви збираєтесь замовити послугу <strong className="text-red-500 font-bold">"Повернення посилки"</strong>. Відправлений вантаж буде направлено назад від отримувача до початкового відправника (<strong className="text-[var(--text-main)] font-bold">{parcel.sender}</strong>) на його первинне відділення відправки.
                            </div>

                            {/* Payer and Payment Method Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Хто оплачує повернення</label>
                                    <div className="grid grid-cols-2 bg-[var(--bg-card-alt)] p-1 rounded-xl border border-[var(--border-color)]">
                                        <button
                                            type="button"
                                            onClick={() => setPayerType('Recipient')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                payerType === 'Recipient' 
                                                ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                            }`}
                                        >
                                            Отримувач
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPayerType('Sender')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                payerType === 'Sender' 
                                                ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                            }`}
                                        >
                                            Відправник
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Форма оплати</label>
                                    <div className="grid grid-cols-2 bg-[var(--bg-card-alt)] p-1 rounded-xl border border-[var(--border-color)]">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('Cash')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                paymentMethod === 'Cash' 
                                                ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                            }`}
                                        >
                                            Готівка
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('NonCash')}
                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                paymentMethod === 'NonCash' 
                                                ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                            }`}
                                        >
                                            Безготівка
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Comment / Note input */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Причина або примітка (Необов'язково)</label>
                                <textarea 
                                    rows={2.5}
                                    placeholder="Вкажіть примітку або причину повернення..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full bg-[var(--bg-card-alt)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500 resize-none"
                                />
                            </div>

                            {errorMsg && (
                                <div className="text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl leading-relaxed mt-2">
                                    Помилка: {errorMsg}
                                </div>
                            )}

                            {/* Submit return button */}
                            <button
                                type="button"
                                onClick={handleReturnSubmit}
                                disabled={submitting}
                                className="mt-4 bg-red-500 hover:bg-red-600 disabled:bg-gray-700/50 disabled:text-[var(--text-muted)] text-[#ffffff] font-bold py-4 px-6 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 select-none"
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
                <div className="flex flex-col gap-5 p-6 bg-[var(--bg-main)] text-[var(--text-main)]  rounded-2xl h-full overflow-y-auto no-scrollbar">
                    <div className="flex items-center justify-between border-b pb-4 border-[var(--border-color)] border-[var(--border-color)]">
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
                            className="text-xs uppercase bg-[var(--bg-hover)] hover:bg-[var(--progress-track)] px-3 py-1.5 rounded-lg transition-colors font-bold text-[var(--text-main)]"
                        >
                            Назад
                        </button>
                    </div>

                    {successMsg ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 p-5 rounded-2xl text-sm flex flex-col items-center gap-3 text-center my-4">
                            <CheckCircle className="w-10 h-10 text-emerald-500 shrink-0" />
                            <div className="font-semibold">{successMsg}</div>
                            <button 
                                type="button"
                                onClick={() => {
                                    setActiveTab('details');
                                    setSuccessMsg(null);
                                }}
                                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-[var(--text-main)] font-bold py-2 px-5 rounded-xl text-xs uppercase tracking-wider"
                            >
                                Повернутись до деталей
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="bg-[var(--bg-card-alt)] border border-[var(--border-color)]/50/30 p-4.5 rounded-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
                                <span className="font-bold text-[var(--text-main)] block mb-1.5">✓ Заява про зміну даних ЕН</span>
                                {parcel.isManual ? (
                                    <span>Ви редагуєте дані вручну доданої ТТН локально. Ви можете змінити пов'язаний кабінет (API ключ) та номер телефону отримувача, щоб система завантажувала статус цієї посилки.</span>
                                ) : (
                                    <span>Ви заповнюєте заяву про зміну даних отримувача, платника або типу оплати. Запит буде надіслано через API Нової Пошти від імені вашого кабінету.</span>
                                )}
                            </div>

                            {/* Recipient Contact Name Field */}
                            {!parcel.isManual && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">ПІБ Отримувача</label>
                                    <input 
                                        type="text"
                                        placeholder="Прізвище Ім'я По батькові отримувача..."
                                        value={editRecipientName}
                                        onChange={(e) => setEditRecipientName(e.target.value)}
                                        className="w-full bg-[var(--bg-card-alt)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                            )}

                            {/* Profile (API Key) Selection for manual parcel */}
                            {parcel.isManual && accounts.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Кабінет для відстеження</label>
                                    <select
                                        className="w-full bg-[var(--bg-card-alt)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500"
                                        value={selectedAccountIdForEdit}
                                        onChange={(e) => setSelectedAccountIdForEdit(e.target.value)}
                                    >
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Recipient Phone Field */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Телефон Отримувача</label>
                                <input 
                                    type="tel"
                                    placeholder="380991234567"
                                    value={editRecipientPhone}
                                    onChange={(e) => setEditRecipientPhone(e.target.value)}
                                    className="w-full bg-[var(--bg-card-alt)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500 font-mono"
                                />
                            </div>

                            {/* Payer and Payment Method Selection */}
                            {!parcel.isManual && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Хто оплачує доставку</label>
                                        <div className="grid grid-cols-2 bg-[var(--bg-card-alt)] p-1 rounded-xl border border-[var(--border-color)]">
                                            <button
                                                type="button"
                                                onClick={() => setPayerType('Recipient')}
                                                className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                    payerType === 'Recipient' 
                                                    ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                                }`}
                                            >
                                                Отримувач
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPayerType('Sender')}
                                                className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                    payerType === 'Sender' 
                                                    ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                                }`}
                                            >
                                                Відправник
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Форма оплати</label>
                                        <div className="grid grid-cols-2 bg-[var(--bg-card-alt)] p-1 rounded-xl border border-[var(--border-color)]">
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod('Cash')}
                                                className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                    paymentMethod === 'Cash' 
                                                    ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                                }`}
                                            >
                                                Готівка
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod('NonCash')}
                                                className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                    paymentMethod === 'NonCash' 
                                                    ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                                }`}
                                            >
                                                Безготівка
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Backward Delivery (Afterpayment / Payment Control) */}
                            {!parcel.isManual && (
                                <div className="border border-[var(--border-color)]/80 rounded-2xl p-4 flex flex-col gap-4 bg-[var(--bg-card-alt)]/40/60 shadow-inner">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
                                            <CreditCard className="w-4 h-4 text-red-500" />
                                            <span>Зворотна доставка (Післяплата)</span>
                                        </span>
                                        <label className="relative inline-flex items-center cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={hasAfterpayment}
                                                onChange={(e) => setHasAfterpayment(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-[var(--bg-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                                        </label>
                                    </div>

                                    {hasAfterpayment && (
                                        <div className="flex flex-col gap-4 border-t border-[var(--border-color)]/80 pt-4 animate-in fade-in duration-200">
                                            {/* Afterpayment Type */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Тип послуги</label>
                                                <div className="grid grid-cols-2 bg-[var(--bg-card-alt)] p-1 rounded-xl border border-[var(--border-color)]">
                                                    <button
                                                        type="button"
                                                        onClick={() => setAfterpaymentType('Money')}
                                                        className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                            afterpaymentType === 'Money' 
                                                            ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                                        }`}
                                                    >
                                                        Післяплата
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAfterpaymentType('PaymentControl')}
                                                        className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                            afterpaymentType === 'PaymentControl' 
                                                            ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                                        }`}
                                                    >
                                                        Контроль оплати
                                                    </button>
                                                </div>
                                                {afterpaymentType === 'PaymentControl' && (
                                                    <div className="text-[10px] leading-tight text-amber-500 font-medium bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 mt-1">
                                                        * Послуга "Контроль оплати" доступна лише для бізнес-кабінетів з активованим NovaPay.
                                                    </div>
                                                )}
                                            </div>

                                            {/* Afterpayment Sum & Payer */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Сума (грн)</label>
                                                    <input 
                                                        type="number"
                                                        placeholder="Сума..."
                                                        value={afterpaymentSum}
                                                        onChange={(e) => setAfterpaymentSum(e.target.value)}
                                                        className="w-full bg-[var(--bg-card-alt)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500"
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Платник комісії післяплати</label>
                                                    <div className="grid grid-cols-2 bg-[var(--bg-card-alt)] p-1 rounded-xl border border-[var(--border-color)]">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAfterpaymentPayer('Recipient')}
                                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                                afterpaymentPayer === 'Recipient' 
                                                                ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                                            }`}
                                                        >
                                                            Отримувач
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAfterpaymentPayer('Sender')}
                                                            className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                                                                afterpaymentPayer === 'Sender' 
                                                                ? 'bg-red-500 text-[#ffffff] shadow-sm' 
                                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent'
                                                            }`}
                                                        >
                                                            Відправник
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {errorMsg && (
                                <div className="text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl leading-relaxed mt-2">
                                    Помилка: {errorMsg}
                                </div>
                            )}

                            {/* Submit change data button */}
                            <button
                                type="button"
                                onClick={handleChangeDataSubmit}
                                disabled={submitting}
                                className="mt-4 bg-red-500 hover:bg-red-600 disabled:bg-gray-700/50 disabled:text-[var(--text-muted)] text-[#ffffff] font-bold py-4 px-6 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 select-none"
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

    const backwardInfo = getBackwardDeliveryInfo(parcel);

    return (
        <div 
           className="fixed inset-0 bg-[#0c0d10]/95 backdrop-blur-md z-50 flex items-center justify-center p-0 sm:p-2 overflow-hidden sm:overflow-y-auto no-scrollbar"
           onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Unified View */}
            <div className="bg-[var(--bg-main)] w-full max-w-lg lg:max-w-4xl h-[100dvh] sm:h-[880px] lg:h-[85vh] rounded-none sm:rounded-[32px] shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300 border border-[var(--border-color)] relative font-sans overflow-hidden">
                <div className="px-6 py-4 lg:py-5 lg:px-8 border-b border-[var(--border-color)] flex items-center justify-between shrink-0 bg-[var(--bg-main)]">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#e33745] p-2 rounded-xl shadow-md shadow-red-900/20">
                            <Box className="w-5 h-5 text-[var(--text-main)] stroke-[2]" />
                        </div>
                        <div>
                            <div className="font-mono font-bold text-lg text-[var(--text-main)] tracking-tight">{parcel.ttn}</div>
                            <div className="text-[10px] uppercase text-[var(--text-muted)] font-bold tracking-wider">{parcel.accountName}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-full transition-colors bg-[var(--bg-card-alt)]">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {activeTab !== 'details' ? (
                    <div className="flex-1 overflow-auto bg-[var(--bg-main)]">
                        {renderActiveForm()}
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto p-6 lg:p-8 pb-28 lg:pb-8 flex flex-col lg:grid lg:grid-cols-2 gap-6 lg:gap-8 text-sm bg-[var(--bg-main)] no-scrollbar">
                        {/* Error & Success Messages */}
                        {(errorMsg || successMsg) && (
                            <div className="col-span-full">
                                {errorMsg && (
                                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-xs font-semibold leading-relaxed">
                                        Помилка: {errorMsg}
                                    </div>
                                )}
                                {successMsg && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-emerald-500 text-xs font-semibold leading-relaxed">
                                        {successMsg}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Left Column in Landscape: Status and Route */}
                    <div className="flex flex-col gap-6 landscape:gap-4_5">
                        {/* Status Section */}
                        <div>
                            <div className="bg-[var(--bg-card-alt)] p-5 landscape:p-4 rounded-2xl border border-[var(--border-color)] shadow-sm">
                                <div className="font-bold text-lg text-[var(--text-main)] mb-2 leading-tight">{parcel.status}</div>
                                <div className="flex gap-4 text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-color)]">
                                    <div><span className="font-medium text-[var(--text-muted)]">Створено:</span> <br/>{parcel.dateCreated || '-'}</div>
                                    <div><span className="font-medium text-[var(--text-muted)]">Тип:</span> <br/>{formatServiceType(parcel.rawStatus?.ServiceType || parcel.rawDoc?.ServiceType)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Route Checkpoint Box */}
                        <div className="bg-[var(--bg-card-alt)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold text-base text-[var(--text-main)]">Маршрут</span>
                                <button 
                                    type="button"
                                    onClick={() => setShowFullRoute(true)}
                                    className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1 transition-colors uppercase tracking-wider bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] px-3 py-1.5 rounded-lg border border-[var(--border-color)]"
                                >
                                    Повністю <span className="text-[#1bc285] font-bold">&gt;</span>
                                </button>
                            </div>
                            {routePoints.checkpoints.length > 0 ? (
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col items-center shrink-0 pt-1">
                                        <div className="w-5 h-5 bg-[#1bc285] rounded-full flex items-center justify-center border-4 border-[#292D32]">
                                            <div className="w-1.5 h-1.5 bg-[var(--bg-card-alt)] rounded-full"></div>
                                        </div>
                                        <div className="w-[2px] h-6 bg-[var(--bg-hover)]"></div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-[var(--text-main)] leading-tight text-[15px] mb-1">
                                            {routePoints.checkpoints[0].status}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)]">
                                            {routePoints.checkpoints[0].location} · {routePoints.checkpoints[0].timestamp}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-[var(--text-muted)] italic">Дані про пересування поки відсутні</div>
                            )}
                        </div>

                        {parcel.basisChain && parcel.basisChain.length > 0 && (
                            <div className="bg-[var(--bg-card-alt)] p-5 rounded-2xl border border-yellow-500/30 shadow-md">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#febb14] mb-3 flex items-center gap-1.5">
                                    <span>Послідовність переадресацій / повернень</span>
                                </div>
                                
                                <div className="flex flex-col gap-3">
                                    {parcel.basisChain.map((step: any, i: number) => (
                                        <div key={step.ttn} className="flex flex-col gap-1.5 p-3 bg-[var(--bg-main)] rounded-xl border border-[var(--border-color)] relative">
                                            {i < parcel.basisChain!.length - 1 && (
                                                <div className="absolute -bottom-3 left-6 w-0.5 h-3 bg-[var(--bg-hover)] z-0"></div>
                                            )}
                                            <div className="font-bold text-sm text-[var(--text-main)] leading-tight">
                                                {step.status || 'Оформлюється'}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="font-mono text-xs text-yellow-500 font-bold">
                                                    ТТН: {step.ttn}
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(step.ttn || '');
                                                        setCopied(true);
                                                        setTimeout(() => setCopied(false), 2000);
                                                    }}
                                                    className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-[10px] px-2 py-0.5 bg-[var(--bg-card-alt)] rounded border border-[var(--border-color)] transition-colors"
                                                >
                                                    {copied ? 'Скопійовано!' : 'Копіювати'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-3 text-xs text-[var(--text-muted)] pt-4 mt-1 border-t border-[var(--border-color)]">
                                    {(() => {
                                        const latestBasis = parcel.basisChain[parcel.basisChain.length - 1];
                                        return (
                                            <>
                                                <div className="flex justify-between items-center bg-[var(--bg-main)]/40 p-2.5 rounded-xl border border-[var(--border-color)]/60">
                                                    <span>Поточне місце:</span>
                                                    <span className="font-medium text-[var(--text-main)] text-right break-words max-w-[60%]">
                                                        {latestBasis.cityName || 'В дорозі'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center bg-[var(--bg-main)]/40 p-2.5 rounded-xl border border-[var(--border-color)]/60">
                                                    <span>Очікувана дата:</span>
                                                    <span className="font-bold text-red-500 text-right">
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
                            <div className="absolute left-[31px] top-10 bottom-10 w-[2px] bg-[var(--bg-hover)] z-0"></div>
                            
                            <div className="bg-[var(--bg-card-alt)] border border-[var(--border-color)] rounded-2xl p-4 landscape:p-3 shadow-sm relative z-10">
                                <div className="flex items-center gap-2 mb-2 text-[var(--text-muted)]">
                                    <div className="bg-[var(--bg-main)] p-1.5 rounded-lg border border-[var(--border-color)]">
                                        <User className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Відправник</span>
                                </div>
                                <div className="font-medium text-[var(--text-main)] mb-1.5 text-[15px] pl-10">{parcel.sender}</div>
                                <div className="text-xs text-[var(--text-muted)] flex items-start gap-1.5 pl-10">
                                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{parcel.rawStatus?.CitySender || parcel.rawDoc?.CitySenderDescription || 'Місто невідоме'}</span>
                                </div>
                            </div>

                            <div className="bg-[var(--bg-card-alt)] border border-[var(--border-color)] rounded-2xl p-4 landscape:p-3 shadow-sm relative z-10">
                                <div className="flex items-center gap-2 mb-2 text-[var(--text-muted)]">
                                    <div className="bg-[var(--bg-main)] p-1.5 rounded-lg border border-[var(--border-color)]">
                                        <UserCheck className="w-4 h-4 text-green-500" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Одержувач</span>
                                </div>
                                <div className="font-medium text-[var(--text-main)] mb-1.5 text-[15px] pl-10">{parcel.recipient}</div>
                                {(() => {
                                    const phoneNum = parcel.rawStatus?.PhoneRecipient || parcel.rawDoc?.PhoneRecipient;
                                    if (!phoneNum) return null;
                                    const displayPhone = phoneNum.startsWith('+') ? phoneNum : `+${phoneNum}`;
                                    return (
                                        <a 
                                            href={`tel:${displayPhone}`}
                                            className="text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 text-xs pl-10 mb-1.5 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Phone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <span>{displayPhone}</span>
                                        </a>
                                    );
                                })()}
                                <div className="text-xs text-[var(--text-muted)] flex items-start gap-1.5 pl-10">
                                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{parcel.cityName}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column in Landscape: Meta stats & Description */}
                    <div className="flex flex-col gap-6 landscape:gap-4_5">
                        {/* Meta */}
                        <div className="bg-[var(--bg-card-alt)] border border-[var(--border-color)] rounded-2xl shadow-sm divide-y divide-[var(--border-color)]">
                            <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                <div className="text-[var(--text-muted)] flex items-center gap-2"><Scale className="w-4 h-4"/> Вага</div>
                                <div className="font-medium text-right text-[var(--text-main)]">{parcel.weight} кг {parcel.rawStatus?.VolumeWeight ? `(${parcel.rawStatus.VolumeWeight} об'єм)` : ''}</div>
                            </div>
                            <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                <div className="text-[var(--text-muted)] flex items-center gap-2"><CreditCard className="w-4 h-4"/> Оплачує</div>
                                <div className="font-medium text-right text-[var(--text-main)]">{parsePayer()}</div>
                            </div>
                            <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                <div className="text-[var(--text-muted)] flex items-center gap-2">Доставка</div>
                                <div className="font-medium text-right font-mono text-[15px] text-[var(--text-main)]">{parcel.cost} ₴</div>
                            </div>
                            {parcel.announcedPrice && parseFloat(parcel.announcedPrice) > 0 && (
                                <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                    <div className="text-[var(--text-muted)] flex items-center gap-2">Оголошена вартість</div>
                                    <div className="font-medium text-right font-mono text-[15px] text-[var(--text-main)]">{parcel.announcedPrice} ₴</div>
                                </div>
                            )}
                            {backwardInfo && (
                                <>
                                    <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                        <div className="text-[var(--text-muted)] flex items-center gap-2">
                                            <CreditCard className="w-4 h-4 text-emerald-500"/> {backwardInfo.label}
                                        </div>
                                        <div className="font-bold text-right text-emerald-500 font-mono text-[15px]">
                                            {backwardInfo.amount} ₴
                                        </div>
                                    </div>
                                    {!backwardInfo.isControl && (
                                        <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                            <div className="text-[var(--text-muted)] flex items-center gap-2">Комісія за переказ</div>
                                            <div className="font-medium text-right text-emerald-500/80 font-mono text-[14px]">
                                                {parcel.rawStatus?.RedeliveryPaymentCard ? 'Сплачено онлайн' : `~${(backwardInfo.amount * 0.02 + 20).toFixed(2)} ₴`}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="grid grid-cols-2 p-4 landscape:p-3 bg-[var(--bg-hover)] rounded-b-2xl text-[13px]">
                                <div className="text-[var(--text-muted)] font-medium flex items-center gap-2">Орієнтовно</div>
                                <div className="font-bold text-[#e33745] text-right flex items-center justify-end gap-1.5"><Calendar className="w-4 h-4" />{parcel.estimatedDeliveryDate || '-'}</div>
                            </div>
                        </div>

                        {/* Description */}
                        {parcel.rawDoc?.Description && (
                            <div className="bg-[var(--bg-card-alt)] border border-[var(--border-color)] rounded-2xl p-4 landscape:p-3 text-[13px] text-[var(--text-muted)] shadow-sm leading-relaxed mb-6 landscape:mb-0">
                                <span className="font-medium text-[var(--text-main)] block mb-1">Опис:</span>
                                {parcel.rawDoc.Description}
                            </div>
                        )}

                        {/* Redirection / Return management buttons inside Card */}
                        <div className="bg-[var(--bg-card-alt)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm text-center flex flex-col gap-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] text-left mb-1">Керування відправленням</div>
                            {isCreatedStatus && selectedAccount?.apiKey && (
                                <div className="flex flex-col gap-2.5 border-b border-[var(--border-color)]/60 pb-3.5 mb-1.5">
                                    <div className="text-xs font-semibold tracking-wider text-[#1bc285] uppercase flex items-center gap-1.5 justify-start">
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>Швидкий друк</span>
                                    </div>
                                    <div className="grid grid-cols-1">
                                        <a
                                            href={`https://my.novaposhta.ua/orders/printMarkings/orders[]/${parcel.ttn}/type/pdf/apiKey/${selectedAccount.apiKey}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-1.5 bg-[var(--bg-hover)] hover:bg-[var(--progress-track)] text-[var(--text-main)] border border-[var(--progress-track)] font-semibold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer text-center"
                                        >
                                            <Printer className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                            <span>Маркування</span>
                                        </a>
                                    </div>
                                </div>
                            )}
                            {accounts.length === 0 ? (
                                <div className="text-[var(--text-muted)] text-xs text-left leading-relaxed">
                                    Додайте аккаунт Нової Пошти в налаштуваннях, щоб здійснювати переадресацію та повернення онлайн.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2.5">
                                    {selectedAccount && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    setSuccessMsg(null);
                                                    setErrorMsg(null);
                                                    setNote('');
                                                    setActiveTab('redirect');
                                                }}
                                                className="bg-red-500 hover:bg-red-600 text-[#ffffff] font-bold py-3 px-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 text-center"
                                            >
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
                                                className="bg-[var(--bg-hover)] hover:bg-[var(--progress-track)] text-[var(--text-main)] border border-[var(--progress-track)] font-bold py-3 px-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 text-center"
                                            >
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
                                        className="w-full bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)] hover:bg-[var(--bg-card-alt)] font-bold py-3 px-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 text-center"
                                    >
                                        <Edit className="w-3.5 h-3.5 shrink-0" />
                                        <span>Змінити дані ТТН</span>
                                    </button>

                                    {isCreatedStatus && selectedAccount?.apiKey && parcel.rawDoc?.Ref && (
                                        <div className="w-full space-y-2 mt-1">
                                            {isDeleteConfirmOpen ? (
                                                <div className="bg-[#e33745]/10 border border-[#e33745]/30 p-4 rounded-xl text-center space-y-3">
                                                    <p className="text-red-500 text-xs font-bold leading-relaxed">
                                                        Ви впевнені, що хочете видалити ТТН з Нової Пошти? Цю дію неможливо скасувати.
                                                    </p>
                                                    {deleteError && (
                                                        <div className="bg-red-500/20 border border-red-500/30 p-2 rounded-lg text-red-500 text-[10px] text-left leading-normal font-medium">
                                                            {deleteError}
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={handleDeleteTtn}
                                                            disabled={submitting}
                                                            className="flex-1 bg-[#e33745] hover:bg-red-700 disabled:bg-red-900 text-[#ffffff] font-bold py-2.5 px-3 rounded-lg text-[10.5px] uppercase tracking-wider transition-all select-none cursor-pointer"
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
                                                            className="flex-1 bg-[var(--bg-hover)] hover:bg-[var(--progress-track)] text-[var(--text-muted)] border border-[var(--progress-track)] font-bold py-2.5 px-3 rounded-lg text-[10.5px] uppercase tracking-wider transition-all select-none cursor-pointer"
                                                        >
                                                            Скасувати
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button 
                                                    type="button"
                                                    onClick={() => setIsDeleteConfirmOpen(true)}
                                                    className="w-full bg-red-500/20 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-bold py-3 px-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 text-center"
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
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 w-full mt-2 select-none"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Видалити з відстеження</span>
                            </button>
                        )}
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
                     className="bg-[var(--bg-nav)] sm:bg-[var(--bg-main)] text-[var(--text-main)] w-full max-w-[400px] h-[100dvh] sm:h-[650px] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                     onClick={(e) => e.stopPropagation()}
                  >
                     {/* Upper Handle */}
                     <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                         <div className="w-12 h-1.5 bg-gray-700 rounded-full"></div>
                     </div>

                     {/* Modal Header */}
                     <div className="p-6 pb-4 flex items-center justify-between shrink-0 bg-transparent">
                         <div>
                             <h3 className="text-xl font-bold text-[var(--text-main)] tracking-tight">
                                 {routePoints.senderCityClean} - {routePoints.recipientCityClean}
                             </h3>
                             <p className="text-sm text-[var(--text-muted)] mt-1 font-medium">
                                 {Number(parcel.statusCode || '0') >= 9 ? 'Було в дорозі:' : 'В дорозі:'} <span className="font-bold text-[#1bc285]">{routePoints.durationText}</span>
                             </p>
                         </div>
                         <button 
                             onClick={() => setShowFullRoute(false)}
                             className="p-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-gray-800 rounded-full transition-colors shrink-0"
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
                                                  <div className="absolute -left-[23px] top-1 w-5 h-5 bg-[#1bc285] rounded-full flex items-center justify-center shadow-lg shadow-emerald-950/40 ring-4 ring-[var(--bg-main)]">
                                                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                                  </div>
                                              ) : (
                                                  <div className="absolute -left-[19px] top-1.5 w-3 h-3 bg-gray-500 rounded-full ring-4 ring-[var(--bg-main)]"></div>
                                              )}
                                              
                                              {/* Info text */}
                                              <div className={`font-semibold text-[15px] leading-tight ${isNewest ? 'text-emerald-500' : 'text-[var(--text-main)]'}`}>
                                                  {cp.status}
                                              </div>
                                              <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                                                  {cp.location} <span className="text-gray-650 font-light">·</span> {cp.timestamp}
                                              </div>
                                          </div>
                                      );
                                 })}
                             </div>
                         ) : (
                             <div className="text-center py-20 text-[var(--text-muted)] italic font-medium">
                                 Дані маршруту оновлюються...
                             </div>
                         )}
                     </div>

                     {/* Bottom Action Button */}
                     <div className="p-6 pt-2 shrink-0">
                         <button
                             type="button"
                             onClick={() => setShowFullRoute(false)}
                             className="w-full bg-[#1bc285] hover:bg-[#19b078] active:bg-[#159a68] text-[var(--text-main)] font-bold py-4 px-6 rounded-xl text-sm uppercase tracking-wider transition-colors shadow-lg shadow-emerald-950/25 cursor-pointer text-center"
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