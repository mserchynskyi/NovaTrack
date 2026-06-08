import { useState, useEffect, FormEvent, useMemo } from 'react';
import { 
    X, 
    CheckCircle, 
    Loader2, 
    Search, 
    ArrowLeft,
    User, 
    Package, 
    Calendar, 
    MapPin, 
    Truck, 
    Info, 
    CreditCard, 
    MessageCircle, 
    Phone, 
    Check,
    ChevronRight,
    Printer,
    FileText,
    Plus,
    Calculator,
    Edit3,
    Trash2,
    CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NpAccount } from '../types';
import { 
    searchCities, 
    getWarehouses, 
    getSenderCounterparties, 
    getCounterpartyContactPersons, 
    submitCreateTtn, 
    NpCity, 
    NpWarehouse,
    SenderCounterparty,
    SenderContactPerson
} from '../lib/np-api';

interface CreateTtnModalProps {
    isOpen: boolean;
    onClose: () => void;
    accounts: NpAccount[];
    onTtnCreated: (ttn: string) => void;
}

interface CubePlace {
    id: string;
    weight: number; // in kg
    length: number; // in cm
    width: number;  // in cm
    height: number; // in cm
    isPacked: boolean;
}

// Preset Sizes
interface SizePreset {
    name: string;
    weight: number;
    length: number;
    width: number;
    height: number;
}

const PRESET_TEMPLATES: SizePreset[] = [
    { name: '1 кг', weight: 1, length: 11, width: 11, height: 11 },
    { name: '2 кг', weight: 2, length: 15, width: 15, height: 15 },
    { name: '5 кг', weight: 5, length: 25, width: 25, height: 20 },
    { name: '10 кг', weight: 10, length: 35, width: 35, height: 30 },
    { name: 'Документи', weight: 0.2, length: 32, width: 23, height: 2 }
];

const QUICK_DESCRIPTIONS = [
    'Одяг',
    'Взуття',
    'Документи',
    'Косметика',
    'Книги',
    'Електроніка',
    'Товар',
    'Іграшки'
];

// Nova Poshta Diamond logo SVG element
function NpLogo({ className = "w-5 h-5 shrink-0" }: { className?: string }) {
    return (
        <svg className={`${className}`} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="20" fill="#E30613" />
            <path d="M50 16L16 50L50 84L84 50L50 16ZM43 43H31V57H43V69H57V57H69V43H57V31H43V43Z" fill="white" />
        </svg>
    );
}

export function CreateTtnModal({ isOpen, onClose, accounts, onTtnCreated }: CreateTtnModalProps) {
    const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
    const activeAccount = accounts.find(a => a.id === selectedAccountId);

    const [isCalculating, setIsCalculating] = useState(false);
    const [calculationSuccess, setCalculationSuccess] = useState(false);

    // Sender details loaded dynamically from API
    const [senderCounterparties, setSenderCounterparties] = useState<SenderCounterparty[]>([]);
    const [selectedSenderRef, setSelectedSenderRef] = useState<string>('');
    const [senderContactRef, setSenderContactRef] = useState<string>('');
    const [senderPhone, setSenderPhone] = useState<string>('');
    const [loadingSender, setLoadingSender] = useState(false);

    // Route Selection - Sender Location (Default Lviv to match high fidelity preview)
    const [senderCitySearch, setSenderCitySearch] = useState('м. Львів');
    const [senderCities, setSenderCities] = useState<NpCity[]>([]);
    const [selectedSenderCity, setSelectedSenderCity] = useState<NpCity | null>({
        Ref: "db5c88f5-391c-11dd-90d9-001a4d5b2d19",
        Description: "м. Львів",
        AreaDescription: "Львівська"
    });
    const [searchingSenderCity, setSearchingSenderCity] = useState(false);
    const [senderWarehouses, setSenderWarehouses] = useState<NpWarehouse[]>([]);
    const [selectedSenderWarehouseRef, setSelectedSenderWarehouseRef] = useState('');
    const [loadingSenderWarehouses, setLoadingSenderWarehouses] = useState(false);

    // Route Selection - Recipient Location (Default Derazhnya to match screenshot)
    const [recipientCitySearch, setRecipientCitySearch] = useState('м. Деражня');
    const [recipientCities, setRecipientCities] = useState<NpCity[]>([]);
    const [selectedRecipientCity, setSelectedRecipientCity] = useState<NpCity | null>({
        Ref: "db5c88cf-391c-11dd-90d9-001a4d5b2d19",
        Description: "м. Деражня",
        AreaDescription: "Хмельницька"
    });
    const [searchingRecipientCity, setSearchingRecipientCity] = useState(false);
    const [recipientWarehouses, setRecipientWarehouses] = useState<NpWarehouse[]>([]);
    const [selectedRecipientWarehouseRef, setSelectedRecipientWarehouseRef] = useState('');
    const [loadingRecipientWarehouses, setLoadingRecipientWarehouses] = useState(false);

    // Delivery and Package Types
    const [deliveryType, setDeliveryType] = useState<'WarehouseWarehouse' | 'WarehousePostomat' | 'WarehouseAddress'>('WarehouseWarehouse');
    const [parcelType, setParcelType] = useState<'Посилка' | 'Документи' | 'Вантаж'>('Посилка');

    // Section Edit states
    const [isEditingSenderInfo, setIsEditingSenderInfo] = useState(false);
    const [isEditingSenderAddress, setIsEditingSenderAddress] = useState(false);
    const [isEditingPayment, setIsEditingPayment] = useState(false);
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [isEditingExtras, setIsEditingExtras] = useState(false);

    // Section 2: Payment details
    const [payerType, setPayerType] = useState<'Sender' | 'Recipient'>('Recipient');
    const [cost, setCost] = useState('998.00'); // matching screenshot
    const [afterpayment, setAfterpayment] = useState(true); // matching "Післяплата: Так"
    const [afterpaymentType, setAfterpaymentType] = useState<'Money' | 'PaymentControl'>('Money');
    const [afterpaymentSum, setAfterpaymentSum] = useState('998.00'); // matching screenshot
    const [afterpaymentPayer, setAfterpaymentPayer] = useState<'Sender' | 'Recipient'>('Recipient');

    // Recipient Details
    const [recipientMode, setRecipientMode] = useState<'other' | 'me'>('other');
    const [recLastName, setRecLastName] = useState('Шевченко');
    const [recFirstName, setRecFirstName] = useState('Тарас');
    const [recMiddleName, setRecMiddleName] = useState('');
    const [recPhone, setRecPhone] = useState('0951234567');

    // Section 4: Extras details
    const getTodayFormattedUk = () => {
        const months = ['січ.', 'лют.', 'берез.', 'квіт.', 'трав.', 'черв.', 'лип.', 'серп.', 'верес.', 'жовт.', 'лист.', 'груд.'];
        const d = new Date();
        return `${d.getDate()} ${months[d.getMonth()]}`;
    };
    const [sendDate, setSendDate] = useState('7 черв.'); // matching screenshot
    const [description, setDescription] = useState('товар'); // matching screenshot
    const [additionalInfo, setAdditionalInfo] = useState('товар'); // matching screenshot

    // Section 5: Places/Packages list with customizable sizes
    const [places, setPlaces] = useState<CubePlace[]>([
        { id: '1', weight: 1, length: 11, width: 11, height: 11, isPacked: false } // matching screenshot "... 1000 г, 11 см, 11 см, 11 см, Без пакування"
    ]);
    const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);

    // Submit response & general states
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [canFallbackToMoney, setCanFallbackToMoney] = useState(false);
    const [successData, setSuccessData] = useState<{ ttn: string; cost: string; date: string } | null>(null);
    const [estimatedCost, setEstimatedCost] = useState(998); // matching screenshot

    // Derived active warehouse labels
    const selectedSenderWarehouseLabel = useMemo(() => {
        const found = senderWarehouses.find(w => w.Ref === selectedSenderWarehouseRef);
        return found ? found.Description : 'Відділення №1: вул. Городоцька, 359';
    }, [senderWarehouses, selectedSenderWarehouseRef]);

    const selectedRecipientWarehouseLabel = useMemo(() => {
        const found = recipientWarehouses.find(w => w.Ref === selectedRecipientWarehouseRef);
        return found ? found.Description : 'Поштомат "Нова Пошта" №41710: вул. Промислова, 9/3 (маг. "Парус"), Деражня';
    }, [recipientWarehouses, selectedRecipientWarehouseRef]);

    // Recalculate estimated cost dynamically or locally
    const performCostEstimation = () => {
        let baseCost = 60;
        // calculate based on volume & weight of all places
        const totalWeight = places.reduce((sum, p) => sum + p.weight, 0);
        baseCost += totalWeight * 5;
        
        // Add packaging markup
        const packedCount = places.filter(p => p.isPacked).length;
        baseCost += packedCount * 15;

        // Cash on delivery percentage (2% + 20 uah)
        if (afterpayment) {
            const sumVal = parseFloat(afterpaymentSum) || 0;
            baseCost += Math.round(sumVal * 0.02 + 20);
        }

        setEstimatedCost(Math.max(80, Math.round(baseCost)));
    };

    useEffect(() => {
        performCostEstimation();
    }, [places, afterpayment, afterpaymentSum, payerType]);

    // Handle "Me" recipient selection
    useEffect(() => {
        if (recipientMode === 'me' && senderCounterparties.length > 0) {
            const primary = senderCounterparties[0];
            if (primary) {
                setRecFirstName(primary.FirstName || '');
                setRecLastName(primary.LastName || '');
                setRecMiddleName(primary.MiddleName || '');
                const cleanPhone = senderPhone.replace(/\D/g, '').slice(-10);
                setRecPhone(cleanPhone || '0951234567');
            }
        }
    }, [recipientMode, senderCounterparties, senderPhone]);

    // Fetch Sender Counterparties when account changes
    useEffect(() => {
        if (!isOpen || !activeAccount) return;

        const loadSenderInfo = async () => {
            setLoadingSender(true);
            setErrorMsg(null);
            try {
                const counterparties = await getSenderCounterparties(activeAccount.apiKey);
                setSenderCounterparties(counterparties);
                if (counterparties.length > 0) {
                    // Try to find the commercial counterparty (FOP / TOV etc) to prevent selecting personal individual by default
                    const bizCp = counterparties.find(cp => 
                        cp.Description && (
                            cp.Description.includes('ФОП') || 
                            cp.Description.includes('ТОВ') || 
                            cp.Description.includes('ПП') || 
                            cp.Description.includes('ТзОВ') ||
                            cp.Description.includes('ЛТД') ||
                            cp.Description.includes('КОНТРАГЕНТ')
                        )
                    );
                    const defaultCp = bizCp || counterparties[0];
                    setSelectedSenderRef(defaultCp.Ref);
                    const contactPersons = await getCounterpartyContactPersons(activeAccount.apiKey, defaultCp.Ref);
                    const firstContact = contactPersons[0];
                    if (firstContact) {
                        setSenderContactRef(firstContact.Ref);
                        setSenderPhone(firstContact.Phones || '');
                    }
                }
            } catch (err: any) {
                console.error(err);
                setErrorMsg('Не вдалося завантажити профіль відправника. Перевірте API-ключ.');
            } finally {
                setLoadingSender(false);
            }
        };

        loadSenderInfo();
    }, [selectedAccountId, isOpen]);

    // Dynamically resolve Lviv and Derazhnya Refs on load to prevent "City not found" in different environments
    useEffect(() => {
        if (!isOpen || !activeAccount) return;

        const resolveDefaultCities = async () => {
            try {
                const lvivResults = await searchCities(activeAccount.apiKey, 'Львів');
                if (lvivResults && lvivResults.length > 0) {
                    const lviv = lvivResults[0];
                    setSelectedSenderCity({
                        Ref: lviv.Ref,
                        Description: lviv.Description,
                        AreaDescription: lviv.AreaDescription
                    });
                }
            } catch (err) {
                console.warn('Error resolving default sender city (Lviv):', err);
            }

            try {
                const derazhnyaResults = await searchCities(activeAccount.apiKey, 'Деражня');
                if (derazhnyaResults && derazhnyaResults.length > 0) {
                    const derazhnya = derazhnyaResults[0];
                    setSelectedRecipientCity({
                        Ref: derazhnya.Ref,
                        Description: derazhnya.Description,
                        AreaDescription: derazhnya.AreaDescription
                    });
                }
            } catch (err) {
                console.warn('Error resolving default recipient city (Derazhnya):', err);
            }
        };

        resolveDefaultCities();
    }, [selectedAccountId, isOpen]);

    const handleSenderChange = async (ref: string) => {
        setSelectedSenderRef(ref);
        if (!activeAccount) return;
        try {
            const contactPersons = await getCounterpartyContactPersons(activeAccount.apiKey, ref);
            const firstContact = contactPersons[0];
            if (firstContact) {
                setSenderContactRef(firstContact.Ref);
                setSenderPhone(firstContact.Phones || '');
            } else {
                setSenderContactRef('');
                setSenderPhone('');
            }
        } catch (err) {
            console.error('Error loading contacts for selected sender:', err);
        }
    };

    // Debounce/Trigger Sender City Search
    useEffect(() => {
        if (!activeAccount || senderCitySearch.trim().length < 2) {
            return;
        }

        const timer = setTimeout(async () => {
            setSearchingSenderCity(true);
            try {
                const res = await searchCities(activeAccount.apiKey, senderCitySearch);
                setSenderCities(res);
            } catch (err) {
                console.error(err);
            } finally {
                setSearchingSenderCity(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [senderCitySearch, selectedAccountId]);

    // Load Sender Warehouses when sender city changes
    useEffect(() => {
        if (!activeAccount || !selectedSenderCity) {
            setSenderWarehouses([]);
            setSelectedSenderWarehouseRef('');
            return;
        }

        const loadWarehouses = async () => {
            setLoadingSenderWarehouses(true);
            try {
                const res = await getWarehouses(activeAccount.apiKey, selectedSenderCity.Ref);
                setSenderWarehouses(res);
                if (res.length > 0) {
                    setSelectedSenderWarehouseRef(res[0].Ref);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingSenderWarehouses(false);
            }
        };

        loadWarehouses();
    }, [selectedSenderCity, selectedAccountId]);

    // Debounce/Trigger Recipient City Search
    useEffect(() => {
        if (!activeAccount || recipientCitySearch.trim().length < 2) {
            return;
        }

        const timer = setTimeout(async () => {
            setSearchingRecipientCity(true);
            try {
                const res = await searchCities(activeAccount.apiKey, recipientCitySearch);
                setRecipientCities(res);
            } catch (err) {
                console.error(err);
            } finally {
                setSearchingRecipientCity(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [recipientCitySearch, selectedAccountId]);

    // Load Recipient Warehouses when recipient city changes
    useEffect(() => {
        if (!activeAccount || !selectedRecipientCity) {
            setRecipientWarehouses([]);
            setSelectedRecipientWarehouseRef('');
            return;
        }

        const loadWarehouses = async () => {
            setLoadingRecipientWarehouses(true);
            try {
                const res = await getWarehouses(activeAccount.apiKey, selectedRecipientCity.Ref);
                setRecipientWarehouses(res);
                if (res.length > 0) {
                    setSelectedRecipientWarehouseRef(res[0].Ref);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingRecipientWarehouses(false);
            }
        };

        loadWarehouses();
    }, [selectedRecipientCity, selectedAccountId]);

    if (!isOpen) return null;

    const handleCalculateCostSubmit = () => {
        setIsCalculating(true);
        setErrorMsg(null);
        setTimeout(() => {
            performCostEstimation();
            setIsCalculating(false);
            setCalculationSuccess(true);
            setTimeout(() => setCalculationSuccess(false), 2000);
        }, 800);
    };

    const validateForm = () => {
        if (!selectedSenderCity) return 'Оберіть місто відправлення';
        if (!selectedSenderWarehouseRef) return 'Оберіть відділення або поштомат відправки відправника';
        if (!selectedRecipientCity) return 'Оберіть місто отримання';
        if (!selectedRecipientWarehouseRef) return 'Оберіть відділення або поштомат отримання';
        
        const cleanPhone = recPhone.replace(/\D/g, '');
        if (cleanPhone.length < 10) return 'Номер телефону отримувача занадто короткий (має бути 10 цифр, наприклад: 0951234567)';
        if (!recLastName.trim()) return 'Вкажіть прізвище отримувача';
        if (!recFirstName.trim()) return 'Вкажіть ім\'я отримувача';
        if (!description.trim()) return 'Опишіть відправлення';

        const parsedCost = parseFloat(cost);
        if (isNaN(parsedCost) || parsedCost < 100) {
            return 'Оголошена цінність має бути не менше 100 ₴';
        }

        if (afterpayment && parcelType === 'Документи') {
            return 'Послуга післяплати недоступна для документів. Оберіть тип відправлення "Посилка" або вимкніть післяплату.';
        }

        return null;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setCanFallbackToMoney(false);
        await performSubmit();
    };

    const handleFallbackToMoney = async () => {
        setAfterpaymentType('Money');
        setCanFallbackToMoney(false);
        await performSubmit('Money');
    };

    const performSubmit = async (overrideAfterpaymentType?: 'Money' | 'PaymentControl') => {
        setErrorMsg(null);

        if (!activeAccount) {
            setErrorMsg('Оберіть кабінет Нової Пошти');
            return;
        }

        const err = validateForm();
        if (err) {
            setErrorMsg(err);
            return;
        }

        const typeToUse = overrideAfterpaymentType || afterpaymentType;

        // Aggregate places values for submission
        const totalWeight = places.reduce((sum, p) => sum + p.weight, 0);
        const totalVolume = places.reduce((sum, p) => sum + (p.length * p.width * p.height) / 1000000, 0);
        const seatsValue = String(places.length);

        const formattedPhone = recPhone.replace(/\D/g, '');
        const recipientPhoneFinal = formattedPhone.length === 10 ? '38' + formattedPhone : formattedPhone;

        const backwardDeliveryData = afterpayment ? [{
            PayerType: typeToUse === 'PaymentControl' ? 'Recipient' : afterpaymentPayer,
            CargoType: typeToUse,
            RedeliveryString: String(Math.round(parseFloat(afterpaymentSum) || 0))
        }] : undefined;

        setSubmitting(true);
        try {
            const apiResult = await submitCreateTInteractive(activeAccount.apiKey, {
                SenderRef: selectedSenderRef,
                SenderAddressRef: selectedSenderWarehouseRef,
                SenderContactRef: senderContactRef,
                SenderPhone: senderPhone,
                CitySenderRef: selectedSenderCity!.Ref,
                
                CityRecipientRef: selectedRecipientCity!.Ref,
                RecipientAddressRef: selectedRecipientWarehouseRef,
                RecipientPhone: recipientPhoneFinal,
                RecipientLastName: recLastName.trim(),
                RecipientFirstName: recFirstName.trim(),
                RecipientMiddleName: recMiddleName.trim() || undefined,
                
                Weight: String(totalWeight),
                VolumeGeneral: String(totalVolume || 0.004),
                SeatsAmount: seatsValue,
                Cost: cost,
                Description: description,
                PayerType: payerType,
                PaymentMethod: 'Cash',
                ServiceType: deliveryType,
                CargoType: parcelType === 'Документи' ? 'Documents' : parcelType === 'Вантаж' ? 'Cargo' : 'Parcel',
                BackwardDeliveryData: backwardDeliveryData
            });

            if (apiResult.success) {
                setSuccessData({
                    ttn: apiResult.ttn,
                    cost: apiResult.cost,
                    date: apiResult.estimatedDeliveryDate
                });
            }
        } catch (err: any) {
            console.error(err);
            let userError = err.message || 'Помилка при створенні ТТН. Перевірте коректність даних.';
            if (userError.includes('Передана послуга Післяплата недоступна') || userError.includes('послуга Післяплата недоступна') || userError.includes('Післяплата') || userError.toLowerCase().includes('afterpayment') || userError.toLowerCase().includes('backwarddelivery') || userError.includes('Invalid enum value') || userError.includes('BackwardDeliveryCargoTypes')) {
                if (typeToUse === 'PaymentControl') {
                    setCanFallbackToMoney(true);
                    userError = `Помилка API: "${err.message}". \n\n👉 Порада: Переконайтеся, що ви обрали ваш бізнес-профіль (ФОП або ТОВ) у розділі "Адреса відправника" -> Редагувати, оскільки послуга "Контроль оплати" за договором не надається для особистих (приватних) профілів фізичних осіб. Також перевірте, чи активовано послугу "Контроль оплати" з NovaPay для вашого ФОП.`;
                } else if (parcelType === 'Документи') {
                    userError = `Помилка API: "${err.message}". \n\n👉 Порада: Послуга зворотньої доставки післяплати недоступна для типу відправлення "Документи". Будь ласка, змініть тип відправлення на "Посилка" або "Вантаж".`;
                } else {
                    userError = `Помилка API: "${err.message}". \n\n👉 Порада: Оскільки ви є бізнес-клієнтом (ФОП), звичайна післяплата може быть недоступна для вашого типу акаунта. Спробуйте змінити тип післяплати на "Контроль оплати", або виберіть правильного контрагента та зверніться до менеджера Нової Пошти.`;
                }
            } else if (userError.toLowerCase().includes('cityrecipient not found') || userError.includes('CityRecipient')) {
                userError = 'Помилка: Місто отримувача не знайдено в базі Нової Пошти. Спробуйте обрати його знову зі списку запропонованих.';
            } else if (userError.toLowerCase().includes('citysender not found') || userError.includes('CitySender')) {
                userError = 'Помилка: Місто відправника не знайдено в базі Нової Пошти. Спробуйте обрати його знову зі списку запропонованих.';
            } else if (userError.toLowerCase().includes('city not found') || userError.includes('City')) {
                userError = 'Помилка: Вказане місто не знайдено в базі Нової Пошти. Спробуйте обрати його знову зі списку.';
            }
            setErrorMsg(userError);
        } finally {
            setSubmitting(false);
        }
    };

    // Proxy helper because of potential API parameters
    const submitCreateTInteractive = async (key: string, data: any) => {
        // Fallback checks and submit payload mapping
        return await submitCreateTtn(key, data);
    };

    const resetForm = () => {
        setSuccessData(null);
        setErrorMsg(null);
        setRecLastName('Шевченко');
        setRecFirstName('Тарас');
        setRecMiddleName('');
        setRecPhone('0951234567');
        setCost('998.00');
        setAfterpaymentSum('998.00');
        setPlaces([{ id: '1', weight: 1, length: 11, width: 11, height: 11, isPacked: false }]);
        setIsEditingSenderInfo(false);
        setIsEditingSenderAddress(false);
        setIsEditingPayment(false);
        setIsEditingAddress(false);
        setIsEditingExtras(false);
    };

    const addCargoPlace = () => {
        const id = Math.random().toString(36).substr(2, 9);
        const preset = PRESET_TEMPLATES[selectedTemplateIndex] || PRESET_TEMPLATES[0];
        setPlaces(prev => [...prev, {
            id,
            weight: preset.weight,
            length: preset.length,
            width: preset.width,
            height: preset.height,
            isPacked: false
        }]);
    };

    const removeCargoPlace = (placeId: string) => {
        if (places.length <= 1) return;
        setPlaces(prev => prev.filter(p => p.id !== placeId));
    };

    const handlePresetChange = (index: number) => {
        setSelectedTemplateIndex(index);
        const preset = PRESET_TEMPLATES[index];
        if (preset) {
            // Apply preset params to first cargo place for high fidelity
            setPlaces(prev => prev.map((p, idx) => idx === 0 ? {
                ...p,
                weight: preset.weight,
                length: preset.length,
                width: preset.width,
                height: preset.height
            } : p));
        }
    };

    return (
        <div id="create-ttn-modal-overlay" className="fixed inset-0 bg-[#0c0d10]/90 backdrop-blur-md z-[100] flex items-center justify-center p-0 sm:p-2 overflow-hidden sm:overflow-y-auto no-scrollbar">
            
            {/* Phone simulator boundary wrapper with exact colors shown in the screenshot */}
            <div id="create-ttn-phone-boundary" className="bg-[#1c1d21] text-zinc-150 w-full max-w-lg sm:rounded-[32px] shadow-2xl flex flex-col h-[100dvh] sm:h-[880px] overflow-hidden border border-[#2e3138] relative font-sans">
                
                {/* Fixed Premium Header */}
                <div id="ttn-modal-header" className="px-5 py-4 border-b border-[#2d3139]/40 flex items-center justify-between bg-[#1c1d21] shrink-0 z-20">
                    <button 
                        id="btn-close-ttn-via-arrow"
                        onClick={onClose}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span className="font-bold text-lg text-white font-sans tracking-tight">Створення ТТН</span>
                    <button 
                        id="btn-close-ttn-via-x"
                        onClick={onClose} 
                        className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {successData ? (
                    /* RESPONSE SUCCESS VIEW */
                    <div id="ttn-creation-success-view" className="p-6 flex-1 overflow-y-auto flex flex-col items-center justify-center text-center space-y-6 no-scrollbar">
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/30 relative"
                        >
                            <CheckCircle className="w-11 h-11 text-emerald-400" />
                            <div className="absolute inset-0 rounded-full border border-emerald-400/20 animate-ping opacity-25" />
                        </motion.div>
                        
                        <div className="space-y-2 max-w-sm">
                            <h3 className="text-xl font-bold text-white tracking-tight">Електронну накладну створено</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Номер накладної успішно зареєстровано в системі Нової Пошти. Ви можете роздрукувати її прямо зараз.
                            </p>
                        </div>

                        <div className="bg-[#262a30] border border-[#2e3138] rounded-3xl p-6 w-full space-y-4 shadow-md">
                            <div>
                                <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase block">НОМЕР ТТН</span>
                                <span className="text-2xl font-bold tracking-widest text-[#0ea5e9] block mt-1 font-mono">{successData.ttn}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#2e3138]/60 text-left">
                                <div>
                                    <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase block">Вартість доставки</span>
                                    <span className="text-sm font-bold text-white mt-1 block font-mono">{successData.cost} ₴</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase block">Планова дата</span>
                                    <span className="text-sm font-bold text-white mt-1 block">{successData.date || 'В найближчі дні'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Print action buttons */}
                        <div className="bg-[#262a30] border border-[#2e3138] rounded-3xl p-4.5 w-full space-y-3 text-left shadow-sm">
                            <span className="text-[10px] text-zinc-400 font-extrabold tracking-wider uppercase block">Прямий друк документів</span>
                            <div className="grid grid-cols-1">
                                <a
                                    href={`https://my.novaposhta.ua/orders/printMarkings/orders[]/${successData.ttn}/type/pdf/apiKey/${activeAccount?.apiKey}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-1.5 bg-[#2d3139] hover:bg-zinc-700 border border-[#3e424c] text-white font-bold py-3 px-3 rounded-xl text-xs transition-colors cursor-pointer text-center"
                                >
                                    <Printer className="w-4 h-4 shrink-0 text-amber-500" />
                                    <span>Маркування</span>
                                </a>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2.5 w-full pt-4">
                            <button
                                id="btn-close-success"
                                onClick={() => {
                                    onTtnCreated(successData.ttn);
                                    onClose();
                                }}
                                className="w-full bg-[#0ea5e9] hover:bg-[#0c94d2] text-white font-bold py-3.5 px-6 rounded-2xl text-xs transition-colors cursor-pointer uppercase tracking-wider"
                            >
                                Переглянути на головній
                            </button>
                            <button
                                id="btn-recreate-ttn"
                                onClick={resetForm}
                                className="w-full bg-transparent hover:bg-zinc-800 text-[#0ea5e9] border border-[#2e3138] font-bold py-3.5 px-6 rounded-2xl text-xs transition-colors cursor-pointer uppercase tracking-wider"
                            >
                                Створити ще одну ТТН
                            </button>
                        </div>
                    </div>
                ) : (
                    /* SCROLLABLE FORM WIZARD FLOW OVERVIEW */
                    <form id="ttn-interactive-scrollable-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar flex flex-col justify-between">
                        <div className="space-y-4">
                            {errorMsg && (
                                <div id="ttn-form-error-banner" className="bg-red-500/10 border border-red-500/35 text-red-350 p-3.5 rounded-2xl text-xs leading-relaxed font-semibold flex flex-col gap-3">
                                    <p className="whitespace-pre-line">{errorMsg}</p>
                                    {canFallbackToMoney && (
                                        <button
                                            type="button"
                                            onClick={handleFallbackToMoney}
                                            className="w-full bg-[#0ea5e9] hover:bg-[#0c91cc] text-white font-bold py-2.5 py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg hover:shadow-[#0ea5e9]/20"
                                        >
                                            Створити зі «Звичайною післяплатою» (Money)
                                        </button>
                                    )}
                                </div>
                            )}

                            {loadingSender && (
                                <div id="sender-loading-indicator" className="py-2.5 flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 text-[#0ea5e9] animate-spin" />
                                    <span className="text-[11px] text-zinc-400 font-medium">Завантаження кабінету відправника...</span>
                                </div>
                            )}

                            {/* SECTION 1: ОСНОВНА ІНФОРМАЦІЯ */}
                            <div id="section-primary-info" className="space-y-2.5">
                                <h3 className="text-white font-bold text-sm tracking-tight px-1 uppercase text-zinc-400 tracking-wider">Основна інформація</h3>
                                
                                {/* 1.1 Служба доставки selection (accounts) */}
                                <div className="space-y-1">
                                    <label className="text-[11px] text-zinc-500 font-bold block">Служба доставки</label>
                                    <div 
                                        id="interactive-account-picker"
                                        className="bg-[#262a30] hover:bg-zinc-800/80 rounded-2xl p-4 border border-[#2e3138] flex items-center justify-between cursor-pointer transition-colors"
                                        onClick={() => setIsEditingSenderInfo(!isEditingSenderInfo)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <NpLogo className="w-5 h-5 shrink-0" />
                                            <span className="text-white text-sm font-semibold">{activeAccount?.name || 'Вадим НП'}</span>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${isEditingSenderInfo ? 'rotate-90' : ''}`} />
                                    </div>
                                </div>

                                {/* Dynamic expandable accounts list */}
                                <AnimatePresence>
                                    {isEditingSenderInfo && accounts.length > 1 && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden bg-[#2d313a] border border-[#2e3138] rounded-2xl p-2.5 space-y-2 shadow-inner"
                                        >
                                            <label className="text-[10px] text-zinc-400 font-black block uppercase tracking-widest px-1">Обрати інший кабінет</label>
                                            <div className="grid grid-cols-1 gap-1.5">
                                                {accounts.map(acc => (
                                                    <div 
                                                        key={acc.id}
                                                        onClick={() => {
                                                            setSelectedAccountId(acc.id);
                                                            setIsEditingSenderInfo(false);
                                                        }}
                                                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                                                            acc.id === selectedAccountId 
                                                            ? 'bg-[#0ea5e9]/10 text-[#0ea5e9]' 
                                                            : 'text-zinc-300 hover:bg-zinc-700/60'
                                                        }`}
                                                    >
                                                        <span>{acc.name}</span>
                                                        {acc.id === selectedAccountId && <Check className="w-3.5 h-3.5" />}
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* 1.2 Тип доставки select */}
                                <div className="space-y-1">
                                    <label className="text-[11px] text-zinc-500 font-bold block">Тип доставки</label>
                                    <div 
                                        id="interactive-delivery-type-picker"
                                        className="bg-[#262a30] hover:bg-zinc-800/80 rounded-2xl p-4 border border-[#2e3138] flex items-center justify-between cursor-pointer transition-colors"
                                        onClick={() => {
                                            // Toggle through options for super fast editing
                                            const options: ('WarehouseWarehouse' | 'WarehousePostomat' | 'WarehouseAddress')[] = ['WarehouseWarehouse', 'WarehousePostomat', 'WarehouseAddress'];
                                            const nextIdx = (options.indexOf(deliveryType) + 1) % options.length;
                                            setDeliveryType(options[nextIdx]);
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Truck className="w-5 h-5 text-zinc-400 shrink-0" />
                                            <span className="text-white text-sm font-semibold">
                                                {deliveryType === 'WarehouseWarehouse' ? 'Відділення-Відділення' :
                                                 deliveryType === 'WarehousePostomat' ? 'Відділення-Поштомат' : 'Відділення-Адреса'}
                                            </span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                                    </div>
                                </div>

                                {/* 1.4 Тип посилки select */}
                                <div className="space-y-1">
                                    <label className="text-[11px] text-zinc-500 font-bold block">Тип посилки</label>
                                    <div 
                                        id="interactive-parcel-type-picker"
                                        className="bg-[#262a30] hover:bg-zinc-800/80 rounded-2xl p-4 border border-[#2e3138] flex items-center justify-between cursor-pointer transition-colors"
                                        onClick={() => {
                                            const options: ('Посилка' | 'Документи' | 'Вантаж')[] = ['Посилка', 'Документи', 'Вантаж'];
                                            const nextIdx = (options.indexOf(parcelType) + 1) % options.length;
                                            setParcelType(options[nextIdx]);
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Package className="w-5 h-5 text-zinc-400 shrink-0" />
                                            <span className="text-white text-sm font-semibold">{parcelType}</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 1.5: АДРЕСА ВІДПРАВНИКА */}
                            <div id="section-sender-address" className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-zinc-400 font-bold text-sm uppercase tracking-wider">Адреса відправника</h3>
                                    <button 
                                        id="btn-edit-sender-address"
                                        type="button"
                                        onClick={() => setIsEditingSenderAddress(!isEditingSenderAddress)}
                                        className="bg-[#0ea5e9] text-white p-2.5 rounded-xl transition-all hover:bg-sky-500 shrink-0 shadow-md flex items-center justify-center cursor-pointer"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <AnimatePresence mode="wait">
                                    {!isEditingSenderAddress ? (
                                        <motion.div 
                                            key="sender-summary"
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 4 }}
                                            onClick={() => setIsEditingSenderAddress(true)}
                                            className="bg-[#262a30] hover:bg-zinc-800/80 rounded-2xl p-4 border border-[#2e3138] flex items-start gap-3.5 cursor-pointer transition-colors relative group"
                                        >
                                            <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/15">
                                                <MapPin className="w-4 h-4 text-red-500" />
                                            </div>
                                            <div className="space-y-1 overflow-hidden min-w-0 pr-6">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white text-xs font-bold leading-none tracking-tight">
                                                        {selectedSenderCity ? selectedSenderCity.Description : 'м. Львів'}
                                                    </span>
                                                    <span className="text-[9px] text-[#0ea5e9] font-black uppercase tracking-wider bg-[#0ea5e9]/5 px-1 py-0.5 rounded leading-none">
                                                        Відправник
                                                    </span>
                                                </div>
                                                <p className="text-zinc-300 text-xs font-semibold leading-relaxed truncate">
                                                    {selectedSenderWarehouseLabel || 'Оберіть місто та відділення відправника'}
                                                </p>
                                                {senderCounterparties.find(cp => cp.Ref === selectedSenderRef) && (
                                                    <p className="text-emerald-400 text-[10px] font-bold flex items-center gap-1.5 pt-0.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                                        ФОП/Особа: {senderCounterparties.find(cp => cp.Ref === selectedSenderRef)?.Description}
                                                    </p>
                                                )}
                                                {senderPhone && (
                                                    <p className="text-zinc-500 text-[10px] font-mono font-bold">
                                                        Тел: {senderPhone}
                                                    </p>
                                                )}
                                            </div>
                                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-transform group-hover:translate-x-0.5" />
                                        </motion.div>
                                    ) : (
                                        <motion.div 
                                            key="sender-edit-pane"
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.98 }}
                                            className="bg-[#262a30] rounded-2xl p-4 border border-[#2e3138] space-y-4 shadow-xl relative"
                                        >
                                            {/* SENDER COUNTERPARTY SELECTOR */}
                                            {senderCounterparties.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <label className="text-[11px] text-zinc-500 font-bold block">
                                                        Профіль відправника (Контрагент)
                                                    </label>
                                                    <select
                                                        value={selectedSenderRef}
                                                        onChange={(e) => handleSenderChange(e.target.value)}
                                                        className="w-full bg-[#1c1d21] border border-zinc-700 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#0ea5e9] transition-colors"
                                                    >
                                                        {senderCounterparties.map(cp => (
                                                            <option key={cp.Ref} value={cp.Ref}>
                                                                {cp.Description}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <p className="text-[10px] text-zinc-500 font-semibold italic leading-tight">
                                                        * Для послуги "Контроль оплати" обов'язково оберіть профіль вашого ФОП або компанії, з якою підписано договір з NovaPay.
                                                    </p>
                                                </div>
                                            )}

                                            {/* City sender search */}
                                            <div className="space-y-1 relative">
                                                <label className="text-[11px] text-zinc-500 font-bold block">Місто відправлення</label>
                                                <div className="relative">
                                                    <input 
                                                        type="text"
                                                        placeholder="Введіть назву міста (наприклад: Львів)..."
                                                        value={selectedSenderCity ? selectedSenderCity.Description : senderCitySearch}
                                                        onChange={(e) => {
                                                            setSelectedSenderCity(null);
                                                            setSenderCitySearch(e.target.value);
                                                            setSelectedSenderWarehouseRef('');
                                                        }}
                                                        className="w-full bg-[#1c1d21] border border-zinc-700 font-medium text-white text-xs rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-[#0ea5e9] placeholder-zinc-500 transition-colors"
                                                    />
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                                    {searchingSenderCity && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0ea5e9] animate-spin" />}
                                                </div>

                                                {/* Suggestions list */}
                                                {senderCities.length > 0 && !selectedSenderCity && (
                                                    <div className="absolute top-[103%] left-0 w-full bg-[#2a2e38] border border-zinc-700 rounded-xl mt-1 shadow-2xl z-40 max-h-48 overflow-y-auto no-scrollbar">
                                                        {senderCities.map(city => (
                                                            <button
                                                                key={city.Ref}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedSenderCity(city);
                                                                    setSenderCitySearch(city.Description);
                                                                }}
                                                                className="w-full text-left px-3 py-2.5 text-xs text-zinc-100 hover:bg-[#323642] border-b border-zinc-700/30 font-medium flex flex-col transition-colors"
                                                            >
                                                                <span className="font-bold text-white">{city.Description}</span>
                                                                <span className="text-[9px] text-[#0ea5e9] tracking-wider uppercase">{city.AreaDescription} область</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Branch selection */}
                                            {selectedSenderCity && (
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-zinc-500 font-bold block">Відділення відправлення</label>
                                                    {loadingSenderWarehouses ? (
                                                        <div className="py-2.5 px-3 bg-[#1c1d21] text-xs text-zinc-400 rounded-xl flex items-center gap-2">
                                                            <Loader2 className="w-3.5 h-3.5 text-[#0ea5e9] animate-spin" />
                                                            <span>Завантаження відділень...</span>
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={selectedSenderWarehouseRef}
                                                            onChange={(e) => setSelectedSenderWarehouseRef(e.target.value)}
                                                            className="w-full bg-[#1c1d21] border border-zinc-700 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#0ea5e9] transition-colors"
                                                        >
                                                            <option value="" disabled>Оберіть відділення або поштомат відправника</option>
                                                            {senderWarehouses.length === 0 ? (
                                                                <option value="" disabled>Немає відділень</option>
                                                            ) : (
                                                                senderWarehouses.map(w => (
                                                                    <option key={w.Ref} value={w.Ref}>{w.Description}</option>
                                                                ))
                                                            )}
                                                        </select>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex justify-end pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditingSenderAddress(false)}
                                                    className="bg-[#1e293b] hover:bg-slate-800 text-white font-bold text-xs uppercase px-4 py-2 rounded-xl transition-all cursor-pointer"
                                                >
                                                    Зберегти адресу
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* SECTION 2: ОПЛАТА ПОСИЛКИ */}
                            <div id="section-payment-info" className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-zinc-400 font-bold text-sm uppercase tracking-wider">Оплата посилки</h3>
                                    <button 
                                        id="btn-edit-payment"
                                        type="button"
                                        onClick={() => setIsEditingPayment(!isEditingPayment)}
                                        className="bg-[#0ea5e9] text-white p-2.5 rounded-xl transition-all hover:bg-sky-500 shrink-0 shadow-md flex items-center justify-center cursor-pointer"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="bg-[#262a30] rounded-2xl p-4.5 border border-[#2e3138] space-y-4">
                                    {isEditingPayment ? (
                                        <div className="space-y-3.5">
                                            <div className="flex items-center justify-between border-b border-[#2d3139]/50 pb-2 mb-1">
                                                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Редагування оплати</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setIsEditingPayment(false)}
                                                    className="text-xs text-[#0ea5e9] hover:underline"
                                                >
                                                    Зберегти
                                                </button>
                                            </div>

                                            {/* Payer selection */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Платник доставки</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPayerType('Recipient')}
                                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                                            payerType === 'Recipient' 
                                                            ? 'bg-[#0ea5e9] text-white' 
                                                            : 'bg-[#1c1d21] text-zinc-400 border border-zinc-700/60'
                                                        }`}
                                                    >
                                                        Одержувач
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPayerType('Sender')}
                                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                                            payerType === 'Sender' 
                                                            ? 'bg-[#0ea5e9] text-white' 
                                                            : 'bg-[#1c1d21] text-zinc-400 border border-zinc-700/60'
                                                        }`}
                                                    >
                                                        Відправник
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Cost limit */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Оціночна вартість (грн)</label>
                                                <input 
                                                    type="number"
                                                    value={cost}
                                                    onChange={(e) => setCost(e.target.value)}
                                                    className="w-full bg-[#1c1d21] border border-zinc-700/60 font-bold text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#0ea5e9]"
                                                />
                                            </div>

                                            {/* Afterpayment switch */}
                                            <div className="flex items-center justify-between pt-1">
                                                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Післяплата</span>
                                                <button 
                                                    type="button"
                                                    onClick={() => setAfterpayment(!afterpayment)}
                                                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer outline-none ${
                                                        afterpayment ? 'bg-[#0ea5e9]' : 'bg-zinc-700'
                                                    }`}
                                                >
                                                    <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform ${
                                                        afterpayment ? 'translate-x-5' : 'translate-x-0'
                                                    }`} />
                                                </button>
                                            </div>

                                            {/* Afterpayment fields if yes */}
                                            {afterpayment && (
                                                <div className="space-y-3.5 pt-2 border-t border-[#2d3139]/40 mt-1">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Послуга післяплати (накладеного платежу)</label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setAfterpaymentType('Money')}
                                                                className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition-all leading-tight ${
                                                                    afterpaymentType === 'Money' 
                                                                    ? 'bg-[#0ea5e9] text-white' 
                                                                    : 'bg-[#1c1d21] text-zinc-400 border border-zinc-700/60'
                                                                }`}
                                                            >
                                                                Звичайна післяплата
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setAfterpaymentType('PaymentControl'); setAfterpaymentPayer('Recipient'); }}
                                                                className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition-all leading-tight ${
                                                                    afterpaymentType === 'PaymentControl' 
                                                                    ? 'bg-[#0ea5e9] text-white' 
                                                                    : 'bg-[#1c1d21] text-zinc-400 border border-zinc-700/60'
                                                                }`}
                                                            >
                                                                Контроль оплати (Договір)
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Сума післяплати (грн)</label>
                                                        <input 
                                                            type="number"
                                                            value={afterpaymentSum}
                                                            onChange={(e) => setAfterpaymentSum(e.target.value)}
                                                            className="w-full bg-[#1c1d21] border border-zinc-700/60 font-bold text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#0ea5e9]"
                                                        />
                                                    </div>

                                                    {afterpaymentType === 'Money' ? (
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Платник післяплати</label>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAfterpaymentPayer('Recipient')}
                                                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                                                        afterpaymentPayer === 'Recipient' 
                                                                        ? 'bg-[#0ea5e9] text-white' 
                                                                        : 'bg-[#1c1d21] text-zinc-400 border border-zinc-700/60'
                                                                    }`}
                                                                >
                                                                    Одержувач
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAfterpaymentPayer('Sender')}
                                                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                                                        afterpaymentPayer === 'Sender' 
                                                                        ? 'bg-[#0ea5e9] text-white' 
                                                                        : 'bg-[#1c1d21] text-zinc-400 border border-zinc-700/60'
                                                                    }`}
                                                                >
                                                                    Відправник
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-[#1c1d21] p-3 rounded-xl border border-zinc-800 flex items-center justify-between">
                                                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Платник післяплати:</span>
                                                            <span className="text-xs text-white font-bold">Одержувач за договором</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Static visual table format exactly matching screenshot styling */
                                        <div className="space-y-3 font-sans">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-500 font-semibold">Платник доставки:</span>
                                                <span className="text-white font-semibold text-right">{payerType === 'Recipient' ? 'Одержувач' : 'Відправник'}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-500 font-semibold">Оціночна вартість:</span>
                                                <span className="text-white font-semibold text-right">{parseFloat(cost).toFixed(2).replace('.', ',')} грн</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-500 font-semibold">Післяплата:</span>
                                                <span className="text-white font-semibold text-right">
                                                    {afterpayment ? (
                                                        <span className="bg-[#0ea5e9] text-white font-black text-[10px] px-2.5 py-0.5 rounded-lg uppercase tracking-wider shadow-sm">
                                                            Так
                                                        </span>
                                                    ) : 'Ні'}
                                                </span>
                                            </div>
                                            {afterpayment && (
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-zinc-500 font-semibold">Послуга післяплати:</span>
                                                    <span className="text-white font-semibold text-right text-[11px] font-bold">
                                                        {afterpaymentType === 'PaymentControl' ? (
                                                            <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold tracking-wide text-[10px] uppercase">
                                                                Контроль оплати
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-300 font-medium">Звичайна післяплата</span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            {afterpayment && (
                                                <>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-zinc-500 font-semibold">Сума післяплати:</span>
                                                        <span className="text-white font-semibold text-right">{parseFloat(afterpaymentSum).toFixed(2).replace('.', ',')} грн</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-zinc-500 font-semibold">Платник післяплати:</span>
                                                        <span className="text-white font-semibold text-right">{afterpaymentPayer === 'Recipient' ? 'Одержувач' : 'Відправник'}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECTION 3: АДРЕСА ДОСТАВКИ */}
                            <div id="section-address-delivery" className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-zinc-400 font-bold text-sm uppercase tracking-wider">Адреса доставки</h3>
                                    <button 
                                        id="btn-edit-address"
                                        type="button"
                                        onClick={() => setIsEditingAddress(!isEditingAddress)}
                                        className="bg-[#0ea5e9] text-white p-2.5 rounded-xl transition-all hover:bg-sky-500 shrink-0 shadow-md flex items-center justify-center cursor-pointer"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="bg-[#262a30] rounded-2xl p-4.5 border border-[#2e3138] space-y-4">
                                    {isEditingAddress ? (
                                        <div className="space-y-3.5">
                                            <div className="flex items-center justify-between border-b border-[#2d3139]/50 pb-2 mb-1">
                                                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Редагування отримувача</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setIsEditingAddress(false)}
                                                    className="text-xs text-[#0ea5e9] hover:underline"
                                                >
                                                    Зберегти
                                                </button>
                                            </div>

                                            {/* Mode Selection */}
                                            <div className="space-y-1.5">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setRecipientMode('other')}
                                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                                            recipientMode === 'other' 
                                                            ? 'bg-[#0ea5e9] text-white' 
                                                            : 'bg-[#1c1d21] text-zinc-400 border border-zinc-700/60'
                                                        }`}
                                                    >
                                                        Інша особа
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRecipientMode('me')}
                                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                                            recipientMode === 'me' 
                                                            ? 'bg-[#0ea5e9] text-white' 
                                                            : 'bg-[#1c1d21] text-zinc-400 border border-zinc-700/60'
                                                        }`}
                                                    >
                                                        Я (собі)
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Recipient details text inputs */}
                                            {recipientMode === 'other' && (
                                                <div className="space-y-2.5 bg-[#1c1d21] p-3 rounded-xl border border-zinc-700/40">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Мобільний телефон</label>
                                                        <input 
                                                            type="tel"
                                                            placeholder="0951234567"
                                                            maxLength={10}
                                                            value={recPhone}
                                                            onChange={(e) => setRecPhone(e.target.value.replace(/\D/g, ''))}
                                                            className="w-full bg-[#1c1d21] border-b border-zinc-650 font-bold text-xs text-white py-1 outline-none focus:border-[#0ea5e9]"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Прізвище</label>
                                                        <input 
                                                            type="text"
                                                            value={recLastName}
                                                            onChange={(e) => setRecLastName(e.target.value)}
                                                            className="w-full bg-[#1c1d21] border-b border-zinc-650 font-bold text-xs text-white py-1 outline-none focus:border-[#0ea5e9]"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Ім'я</label>
                                                        <input 
                                                            type="text"
                                                            value={recFirstName}
                                                            onChange={(e) => setRecFirstName(e.target.value)}
                                                            className="w-full bg-[#1c1d21] border-b border-zinc-650 font-bold text-xs text-white py-1 outline-none focus:border-[#0ea5e9]"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* City Search */}
                                            <div className="space-y-1 relative">
                                                <label className="text-[10px] text-zinc-500 font-bold uppercase block">Місто отримувача</label>
                                                <input 
                                                    type="text"
                                                    placeholder="Почніть вводити назву міста..."
                                                    value={selectedRecipientCity ? selectedRecipientCity.Description : recipientCitySearch}
                                                    onChange={(e) => {
                                                        setSelectedRecipientCity(null);
                                                        setRecipientCitySearch(e.target.value);
                                                    }}
                                                    className="w-full bg-[#1c1d21] border border-zinc-700/60 font-medium text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#0ea5e9]"
                                                />
                                                {searchingRecipientCity && <Loader2 className="absolute right-3 top-6.5 w-3.5 h-3.5 text-[#0ea5e9] animate-spin" />}
                                                
                                                {recipientCities.length > 0 && !selectedRecipientCity && (
                                                    <div className="absolute top-[103%] left-0 w-full bg-[#2a2e38] border border-zinc-700 rounded-xl mt-1 shadow-2xl z-45 max-h-40 overflow-y-auto no-scrollbar">
                                                        {recipientCities.map(city => (
                                                            <button
                                                                key={city.Ref}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedRecipientCity(city);
                                                                    setRecipientCitySearch(city.Description);
                                                                }}
                                                                className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-[#323642] border-b border-zinc-700/30 flex flex-col font-medium"
                                                            >
                                                                <span className="font-bold text-white">{city.Description}</span>
                                                                <span className="text-[9px] text-[#0ea5e9] uppercase tracking-wider">{city.AreaDescription} область</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Recipient Warehouse choose */}
                                            {selectedRecipientCity && (
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-zinc-500 font-bold uppercase block">Відділення отримання</label>
                                                    {loadingRecipientWarehouses ? (
                                                        <div className="py-2.5 px-3 bg-[#1c1d21] text-xs text-zinc-400 rounded-xl flex items-center gap-2">
                                                            <Loader2 className="w-3.5 h-3.5 text-[#0ea5e9] animate-spin" />
                                                            <span>Пошук точок отримання...</span>
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={selectedRecipientWarehouseRef}
                                                            onChange={(e) => setSelectedRecipientWarehouseRef(e.target.value)}
                                                            className="w-full bg-[#1c1d21] border border-zinc-700/60 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0ea5e9]"
                                                        >
                                                            {recipientWarehouses.length === 0 ? (
                                                                <option value="">Немає відділень для міста</option>
                                                            ) : (
                                                                recipientWarehouses.map(w => (
                                                                    <option key={w.Ref} value={w.Ref}>{w.Description}</option>
                                                                ))
                                                            )}
                                                        </select>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Static View exactly matching screenshot layouts */
                                        <div className="space-y-3 font-sans">
                                            {/* Red diamond icon and header name */}
                                            <div className="flex items-start gap-2.5 border-b border-[#2e3138]/50 pb-3 mb-2">
                                                <NpLogo className="w-5 h-5 shrink-0 mt-0.5" />
                                                <div className="text-white font-semibold text-[13px] leading-tight text-zinc-100">
                                                    {selectedRecipientWarehouseLabel}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-500 font-semibold">Тип особи:</span>
                                                <span className="text-white font-semibold text-right">
                                                    {recipientMode === 'me' ? 'Я (собі)' : 'Приватна особа'}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-500 font-semibold">Місто:</span>
                                                <span className="text-white font-semibold text-right truncate max-w-[210px]">
                                                    {selectedRecipientCity ? selectedRecipientCity.Description : 'м. Деражня'}
                                                </span>
                                            </div>

                                            <div className="flex items-start justify-between text-xs gap-3">
                                                <span className="text-zinc-500 font-semibold shrink-0">Відділення:</span>
                                                <span className="text-white font-semibold text-right leading-relaxed truncate max-w-[210px]">
                                                    {selectedRecipientWarehouseLabel.split(', ')[0]}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECTION 4: ДОДАТКОВІ ПОЛЯ */}
                            <div id="section-additional-fields" className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-zinc-400 font-bold text-sm uppercase tracking-wider">Додаткові поля</h3>
                                    <button 
                                        id="btn-edit-extras"
                                        type="button"
                                        onClick={() => setIsEditingExtras(!isEditingExtras)}
                                        className="bg-[#0ea5e9] text-white p-2.5 rounded-xl transition-all hover:bg-sky-500 shrink-0 shadow-md flex items-center justify-center cursor-pointer"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="bg-[#262a30] rounded-2xl p-4.5 border border-[#2e3138] space-y-4">
                                    {isEditingExtras ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between border-b border-[#2d3139]/50 pb-2 mb-1">
                                                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Редагування додаткових полів</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setIsEditingExtras(false)}
                                                    className="text-xs text-[#0ea5e9] hover:underline"
                                                >
                                                    Зберегти
                                                </button>
                                            </div>

                                            {/* Send date selection */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Дата відправки</label>
                                                <input 
                                                    type="text"
                                                    value={sendDate}
                                                    onChange={(e) => setSendDate(e.target.value)}
                                                    className="w-full bg-[#1c1d21] border border-zinc-700/60 font-medium text-xs text-white rounded-xl px-3 py-2"
                                                />
                                            </div>

                                            {/* Parcel description */}
                                            <div className="space-y-1.5 relative">
                                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Опис відправлення</label>
                                                <input 
                                                    type="text"
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    className="w-full bg-[#1c1d21] border border-zinc-700/60 font-medium text-xs text-white rounded-xl px-3 py-2 focus:outline-none"
                                                />
                                                <div className="flex flex-wrap gap-1 pt-1.5">
                                                    {QUICK_DESCRIPTIONS.slice(0, 5).map(chip => (
                                                        <button
                                                            key={chip}
                                                            type="button"
                                                            onClick={() => setDescription(chip)}
                                                            className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-colors ${
                                                                description === chip 
                                                                ? 'bg-[#0ea5e9] text-white' 
                                                                : 'bg-[#1c1d21] text-zinc-400 border border-zinc-800'
                                                            }`}
                                                        >
                                                            {chip}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Additional Info */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Додаткова інформація</label>
                                                <input 
                                                    type="text"
                                                    value={additionalInfo}
                                                    onChange={(e) => setAdditionalInfo(e.target.value)}
                                                    className="w-full bg-[#1c1d21] border border-zinc-700/60 font-medium text-xs text-white rounded-xl px-3 py-2 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        /* Static view matching screenshot styling */
                                        <div className="space-y-3 font-sans">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-500 font-semibold">Дата відправки:</span>
                                                <span className="text-white font-semibold text-right">{sendDate}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-500 font-semibold">Опис відправлення:</span>
                                                <span className="text-white font-semibold text-right">{description}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-500 font-semibold">Додаткова інформація:</span>
                                                <span className="text-white font-semibold text-right">{additionalInfo}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECTION 5: МІСЦЯ В ПОСИЛЦІ */}
                            <div id="section-places-packages" className="space-y-2.5">
                                <h3 className="text-zinc-400 font-bold text-sm uppercase tracking-wider px-1">Місця в посилці</h3>
                                
                                {/* 5.1 Шаблон відправок selector row */}
                                <div className="space-y-1">
                                    <label className="text-[11px] text-zinc-500 font-bold block">Шаблон відправок</label>
                                    <div 
                                        id="interactive-places-template-picker"
                                        className="bg-[#262a30] hover:bg-zinc-800/80 rounded-2xl p-4 border border-[#2e3138] flex items-center justify-between cursor-pointer transition-colors"
                                        onClick={() => {
                                            const nextIdx = (selectedTemplateIndex + 1) % PRESET_TEMPLATES.length;
                                            handlePresetChange(nextIdx);
                                        }}
                                    >
                                        <span className="text-white text-sm font-semibold">
                                            {PRESET_TEMPLATES[selectedTemplateIndex]?.name || '1 кг'}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                                    </div>
                                </div>

                                {/* Dynamic places lists inside cards */}
                                <div className="space-y-2">
                                    {places.map((place, idx) => (
                                        <div 
                                            key={place.id}
                                            className="bg-[#262a30] rounded-2xl p-4 border border-[#2e3138] flex items-center justify-between transition-colors hover:bg-zinc-800/50"
                                        >
                                            <div className="flex items-center gap-3 truncate max-w-[340px]">
                                                {/* Triple dots on left styling */}
                                                <span className="text-zinc-500 font-bold tracking-widest text-xs shrink-0">•••</span>
                                                <span className="text-white text-[13px] font-semibold font-sans truncate leading-normal">
                                                    {place.weight * 1000} г, {place.length} см, {place.width} см, {place.height} см, {place.isPacked ? 'З пакуванням' : 'Без пакування'}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                {places.length > 1 && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => removeCargoPlace(place.id)}
                                                        className="text-red-400 p-1 hover:text-red-300 transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Custom Inline Add Seat triggers */}
                                <button
                                    id="btn-add-cargo-place"
                                    type="button"
                                    onClick={addCargoPlace}
                                    className="w-full text-center border border-dashed border-[#0ea5e9]/40 hover:border-[#0ea5e9]/70 bg-transparent text-[#0ea5e9] py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer mt-1"
                                >
                                    <Plus className="w-4 h-4 shrink-0" />
                                    <span>Додати місце</span>
                                </button>

                                {/* Price calculator trigger */}
                                <button
                                    id="btn-calculate-shipping-cost"
                                    type="button"
                                    onClick={handleCalculateCostSubmit}
                                    disabled={isCalculating}
                                    className="w-full text-center border border-[#0ea5e9]/40 hover:bg-[#0ea5e9]/5 bg-transparent text-[#0ea5e9] py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
                                >
                                    {isCalculating ? (
                                        <Loader2 className="w-4 h-4 text-[#0ea5e9] animate-spin" />
                                    ) : calculationSuccess ? (
                                        <Check className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                        <Calculator className="w-4 h-4 shrink-0" />
                                    )}
                                    <span>
                                        {isCalculating ? 'Розраховуємо...' : calculationSuccess ? 'Готово!' : 'Розрахувати вартість'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* STICKY SPLIT BOTTOM CTA BUTTONS matching the canceling & creating flow on screenshot */}
                        <div id="ttn-modal-split-ctas" className="pt-5 border-t border-[#2e3138]/60 mt-6 grid grid-cols-2 gap-3.5 shrink-0">
                            <button
                                id="btn-cancel-ttn-creation"
                                type="button"
                                onClick={onClose}
                                className="w-full bg-[#262a30] hover:bg-zinc-800 text-[#0ea5e9] border border-zinc-700/60 transition-colors font-bold py-3.5 px-4 rounded-2xl text-[13px] uppercase tracking-wider text-center cursor-pointer"
                            >
                                Скасувати
                            </button>
                            <button
                                id="btn-submit-ttn-creation"
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-[#0ea5e9] hover:bg-[#0c94d2] disabled:bg-zinc-800 transition-colors font-bold text-white py-3.5 px-4 rounded-2xl text-[13px] uppercase tracking-wider text-center cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-[#0ea5e9]/10"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                                        <span>Створення...</span>
                                    </>
                                ) : (
                                    <span>Створити</span>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
