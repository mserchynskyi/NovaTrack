import { useState, FormEvent, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Ticket, Phone, AlertCircle, Info, Truck, Loader2, Check } from 'lucide-react';
import { ManualTtn } from '../lib/useAccounts';
import { NpAccount, Parcel } from '../types';

interface AddTtnModalProps {
  isOpen: boolean;
  onClose: () => void;
  manualTtns: ManualTtn[];
  onSave: (newTtns: ManualTtn[], addedTtn?: string) => void;
  hasAccounts: boolean;
  onCreateNewTtn?: () => void;
  accounts: NpAccount[];
  parcels: Parcel[];
  loading: boolean;
}

export function AddTtnModal({ isOpen, onClose, manualTtns, onSave, hasAccounts, onCreateNewTtn, accounts, parcels, loading }: AddTtnModalProps) {
    const [ttn, setTtn] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [validationError, setValidationError] = useState('');
    const [syncingTtn, setSyncingTtn] = useState<string | null>(null);
    const [successTtn, setSuccessTtn] = useState<string | null>(null);

    useEffect(() => {
        if (accounts.length > 0 && !selectedAccountId) {
            setSelectedAccountId(accounts[0].id);
        } else if (accounts.length === 0 && selectedAccountId !== 'public') {
            setSelectedAccountId('public');
        }
    }, [accounts, selectedAccountId]);

    useEffect(() => {
        if (!isOpen) {
            setSyncingTtn(null);
            setSuccessTtn(null);
            setValidationError('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (syncingTtn) {
            const isTtnFetched = parcels.some(p => p.ttn === syncingTtn);
            if (isTtnFetched) {
                setSuccessTtn(syncingTtn);
                setSyncingTtn(null);
                setTtn('');
                setPhone('');
                const timer = setTimeout(() => {
                    setSuccessTtn(null);
                    onClose();
                }, 1500);
                return () => clearTimeout(timer);
            }
        }
    }, [parcels, syncingTtn, onClose]);

    useEffect(() => {
        if (syncingTtn && !loading) {
            const timer = setTimeout(() => {
                if (syncingTtn && !parcels.some(p => p.ttn === syncingTtn)) {
                    setSyncingTtn(null);
                }
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [syncingTtn, loading, parcels]);

    if (!isOpen) return null;

    const handleAdd = (e: FormEvent) => {
        e.preventDefault();
        setValidationError('');

        const cleanTtn = ttn.trim();
        const cleanPhone = phone.trim();

        // NP TTN standard validation: 14 digits, starts with 1, 2, or 5
        const ttnRegex = /^[125]\d{13}$/;
        if (!ttnRegex.test(cleanTtn)) {
            setValidationError('Некоректний ТТН. Має складатися з 14 цифр і починатися на 1, 2 або 5.');
            return;
        }

        if (manualTtns.some(item => item.ttn === cleanTtn)) {
            setValidationError('Цей ТТН вже є у списку відстеження.');
            return;
        }

        // Validate phone if supplied (should be standard format or simplified digits)
        let formattedPhone = cleanPhone;
        if (cleanPhone) {
            const digitsOnly = cleanPhone.replace(/\D/g, '');
            if (digitsOnly.length < 10) {
                setValidationError('Номер телефону повинен містити щонайменше 10 цифр.');
                return;
            }
            if (digitsOnly.length === 10) {
                formattedPhone = '38' + digitsOnly;
            } else {
                formattedPhone = digitsOnly;
            }
        }

        const updated = [...manualTtns, { 
            ttn: cleanTtn, 
            phone: formattedPhone || undefined, 
            accountId: selectedAccountId || (accounts[0]?.id || undefined)
        }];
        setSyncingTtn(cleanTtn);
        onSave(updated, cleanTtn);
    };

    const handleDelete = (ttnToDelete: string) => {
        const updated = manualTtns.filter(item => item.ttn !== ttnToDelete);
        onSave(updated);
    };

    return createPortal(
        <div 
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100010] flex items-center justify-center p-0 sm:p-4"
            onClick={onClose}
        >
            <div 
                className="bg-[var(--bg-main)] w-full max-w-lg h-[100dvh] sm:h-auto sm:max-h-[85vh] rounded-none sm:rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-none sm:border border-[var(--border-color)] flex flex-col pt-safe pb-safe sm:pt-0 sm:pb-0"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-main)] shrink-0">
                    <div className="w-7 h-7" />
                    <span className="font-bold text-lg text-[var(--text-main)] tracking-tight text-center">Відстежити</span>
                    <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-full transition-colors shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex flex-col flex-1 overflow-hidden">
                    {!hasAccounts && (
                        <div className="bg-blue-500/10 border border-blue-500/25 text-[var(--text-blue-accent)] p-3.5 rounded-xl text-xs flex gap-2 w-full shrink-0 mb-4">
                            <Info className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">Публічне відстеження</p>
                                <p className="opacity-90 mt-0.5">Ви можете відстежувати будь-які ТТН через публічний API Нової Пошти без додавання особистих кабінетів.</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleAdd} className="space-y-4 shrink-0 mb-5">
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Номер ТТН (14 цифр)</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[var(--text-muted)]">
                                    <Ticket className="w-4 h-4" />
                                </span>
                                <input
                                    type="text" maxLength={14} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" placeholder="59000000000000"
                                    disabled={!!syncingTtn || !!successTtn}
                                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-card-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm focus:outline-none focus:border-red-[#e33745] focus:ring-1 focus:ring-[#e33745] placeholder:text-gray-500 disabled:opacity-50 font-mono tracking-wider"
                                    value={ttn}
                                    onChange={e => setTtn(e.target.value.replace(/\D/g, ''))}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Оберіть кабінет або метод відстеження</label>
                            <select
                                disabled={!!syncingTtn || !!successTtn}
                                className="w-full px-3.5 py-2.5 bg-[var(--bg-card-alt)] text-[var(--text-main)] border border-[var(--border-color)] rounded-xl text-sm focus:outline-none focus:border-red-[#e33745] focus:ring-1 focus:ring-[#e33745] disabled:opacity-50"
                                value={selectedAccountId}
                                onChange={e => setSelectedAccountId(e.target.value)}
                            >
                                <option value="public">🌐 Публічний API (без ключа)</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        🔑 {acc.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                <span>Номер телефону (Отримувача або Відправника)</span>
                                <span className="text-[10px] normal-case lowercase italic text-[var(--text-muted)]">Необов'язково</span>
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[var(--text-muted)]">
                                    <Phone className="w-4 h-4" />
                                </span>
                                <input
                                    type="tel" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" placeholder="0951112233"
                                    disabled={!!syncingTtn || !!successTtn}
                                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-card-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm focus:outline-none focus:border-red-[#e33745] focus:ring-1 focus:ring-[#e33745] placeholder:text-gray-500 disabled:opacity-50 font-mono"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                />
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-1 pl-1">
                                <Info className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                Покращує точність відображення ПІБ відправника/отримувача у Новій Пошті.
                            </span>
                        </div>

                        {validationError && (
                            <div className="text-red-500 text-xs font-semibold pl-1 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{validationError}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!ttn || !!syncingTtn || !!successTtn}
                            className="w-full bg-[#e33745] hover:bg-red-700 disabled:bg-[#e33745]/50 text-[#ffffff] font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-900/10 flex items-center justify-center gap-2"
                        >
                            {successTtn ? (
                                <>
                                    <Check className="w-4 h-4 text-green-300 animate-bounce" />
                                    <span>Знайдено та додано!</span>
                                </>
                            ) : syncingTtn ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    <span>Завантаження даних по ТТН...</span>
                                </>
                            ) : (
                                <span>Почати відстеження</span>
                            )}
                        </button>
                    </form>

                    {/* Manual TTN list */}
                    <div className="flex-1 flex flex-col min-h-0 pt-4 border-t border-[var(--border-color)]">
                        {(() => {
                            const basisTtnsInSystem = new Set<string>();
                            parcels.forEach(p => {
                                const cleanBasisTtn = p.basisTtn ? p.basisTtn.trim() : "";
                                if (cleanBasisTtn) {
                                    basisTtnsInSystem.add(cleanBasisTtn);
                                }
                                if (p.basisChain && Array.isArray(p.basisChain)) {
                                    p.basisChain.forEach(c => {
                                        const cleanChainTtn = c.ttn ? c.ttn.trim() : "";
                                        if (cleanChainTtn) {
                                            basisTtnsInSystem.add(cleanChainTtn);
                                        }
                                    });
                                }
                            });

                            const userAddedTtns = manualTtns.filter(item => {
                                if (item.isAutoAdded) return false;
                                const cleanTtn = item.ttn ? item.ttn.trim() : "";
                                if (basisTtnsInSystem.has(cleanTtn)) return false;
                                return true;
                            });
                            return (
                                <>
                                    <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3 shrink-0">
                                        Зараз відстежуються вручну ({userAddedTtns.length})
                                    </h4>
                                    
                                    {userAddedTtns.length === 0 ? (
                                        <p className="text-xs text-[var(--text-muted)] italic py-2">Немає доданих вручну номерів.</p>
                                    ) : (
                                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar pb-6">
                                            {userAddedTtns.map(item => {
                                                const matchedAcc = item.accountId && item.accountId !== 'public' ? accounts.find(a => a.id === item.accountId) : undefined;
                                                const accountName = matchedAcc ? matchedAcc.name : (item.accountId === 'public' ? "Публічний API" : (accounts[0]?.name || "Публічний API"));
                                                const matchedParcel = parcels.find(p => p.ttn === item.ttn);
                                                const isItemSyncing = syncingTtn === item.ttn || (!matchedParcel && (loading || syncingTtn));

                                                return (
                                                    <div key={item.ttn} className="bg-[var(--bg-card-alt)] border border-[var(--border-color)] rounded-xl p-3 flex items-center justify-between text-[var(--text-main)] transition-all">
                                                        <div className="flex flex-col gap-0.5 flex-1 min-w-0 mr-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-sm font-bold tracking-wider">{item.ttn}</span>
                                                                {isItemSyncing && (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#e33745] shrink-0" />
                                                                )}
                                                            </div>

                                                            {/* Syncing or Parcel Details */}
                                                            {isItemSyncing ? (
                                                                <span className="text-[10px] text-[#e33745] animate-pulse font-medium flex items-center gap-1 mt-0.5">
                                                                    Отримання статусу з Нової Пошти...
                                                                </span>
                                                            ) : matchedParcel ? (
                                                                <div className="flex flex-col mt-0.5">
                                                                    <span className="text-xs font-semibold text-[#e33745]">
                                                                        {matchedParcel.status}
                                                                    </span>
                                                                    {(matchedParcel.cityName || matchedParcel.recipient) && (
                                                                        <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[280px] block mt-0.5">
                                                                            {matchedParcel.cityName ? `${matchedParcel.cityName} · ` : ''}{matchedParcel.recipient || ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-[var(--text-muted)] italic mt-0.5 block">
                                                                    Дані не завантажено
                                                                </span>
                                                            )}

                                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                                {item.phone && (
                                                                    <span className="text-[10px] text-[var(--text-muted)] font-mono">📞 {item.phone}</span>
                                                                )}
                                                                <span className="text-[9px] font-semibold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded uppercase leading-none tracking-wider">
                                                                    👤 {accountName}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDelete(item.ttn)}
                                                            className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0 self-center"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
