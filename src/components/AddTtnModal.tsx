import { useState, FormEvent } from 'react';
import { X, Plus, Trash2, Ticket, Phone, AlertCircle, Info } from 'lucide-react';
import { ManualTtn } from '../lib/useAccounts';

interface AddTtnModalProps {
  isOpen: boolean;
  onClose: () => void;
  manualTtns: ManualTtn[];
  onSave: (newTtns: ManualTtn[]) => void;
  hasAccounts: boolean;
}

export function AddTtnModal({ isOpen, onClose, manualTtns, onSave, hasAccounts }: AddTtnModalProps) {
    const [ttn, setTtn] = useState('');
    const [phone, setPhone] = useState('');
    const [validationError, setValidationError] = useState('');

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

        const updated = [...manualTtns, { ttn: cleanTtn, phone: formattedPhone || undefined }];
        onSave(updated);
        setTtn('');
        setPhone('');
    };

    const handleDelete = (ttnToDelete: string) => {
        const updated = manualTtns.filter(item => item.ttn !== ttnToDelete);
        onSave(updated);
    };

    return (
        <div className="fixed inset-0 bg-black/40 lg:bg-black/60 lg:backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1b2b35] lg:bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[#32363b] lg:border-none">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[#32363b] lg:border-gray-100 flex items-center justify-between bg-[#1b2b35] lg:bg-gray-50">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-[#e33745] p-2 rounded-xl text-white">
                            <Plus className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-lg text-white lg:text-gray-900">Додати ТТН вручну</span>
                    </div>
                    <button onClick={onClose} className="p-1 text-[#a5acb5] hover:text-white lg:hover:text-gray-900 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {!hasAccounts && (
                        <div className="bg-amber-500/10 border border-amber-500/25 text-amber-500 lg:bg-amber-50 lg:border-amber-200 lg:text-amber-805 p-3.5 rounded-xl text-xs flex gap-2 w-full">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">Акаунт не знайдено</p>
                                <p className="opacity-90 mt-0.5">Щоб відстежувати сторонні ТТН, спершу додайте хоча б один свій акаунт Нової Пошти у профілі.</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-300 lg:text-gray-600 uppercase tracking-wider mb-1.5">Номер ТТН (14 цифр)</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                                    <Ticket className="w-4 h-4" />
                                </span>
                                <input
                                    type="text"
                                    maxLength={14}
                                    placeholder="59000000000000"
                                    disabled={!hasAccounts}
                                    className="w-full pl-10 pr-4 py-2.5 bg-[#262c33] lg:bg-gray-50 border border-[#32363b] lg:border-gray-200 rounded-xl text-white lg:text-gray-900 text-sm focus:outline-none focus:border-red-[#e33745] focus:ring-1 focus:ring-[#e33745] placeholder:text-gray-500 lg:placeholder:text-gray-400 disabled:opacity-50 font-mono tracking-wider"
                                    value={ttn}
                                    onChange={e => setTtn(e.target.value.replace(/\D/g, ''))}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-300 lg:text-gray-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                <span>Номер телефону (Отримувача або Відправника)</span>
                                <span className="text-[10px] text-gray-400 lowercase italic normal-case">Необов'язково</span>
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                                    <Phone className="w-4 h-4" />
                                </span>
                                <input
                                    type="tel"
                                    placeholder="0951112233"
                                    disabled={!hasAccounts}
                                    className="w-full pl-10 pr-4 py-2.5 bg-[#262c33] lg:bg-gray-50 border border-[#32363b] lg:border-gray-200 rounded-xl text-white lg:text-gray-900 text-sm focus:outline-none focus:border-red-[#e33745] focus:ring-1 focus:ring-[#e33745] placeholder:text-gray-500 lg:placeholder:text-gray-400 disabled:opacity-50 font-mono"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                />
                            </div>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-1 pl-1">
                                <Info className="w-3.5 h-3.5 text-gray-400" />
                                Покращує точність відображення ПІБ відправника/отримувача у Новій Пошті.
                            </span>
                        </div>

                        {validationError && (
                            <div className="text-red-500 lg:text-red-600 text-xs font-semibold pl-1 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{validationError}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!hasAccounts || !ttn}
                            className="w-full bg-[#e33745] hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg shadow-red-900/10 disabled:opacity-50"
                        >
                            Почати відстеження
                        </button>
                    </form>

                    {/* Manual TTN list */}
                    <div className="pt-4 border-t border-[#32363b] lg:border-gray-100">
                        <h4 className="text-xs font-bold text-gray-300 lg:text-gray-600 uppercase tracking-widest mb-3">
                            Зараз відстежуються вручну ({manualTtns.length})
                        </h4>
                        
                        {manualTtns.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-2">Немає доданих вручну номерів.</p>
                        ) : (
                            <div className="max-h-40 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                                {manualTtns.map(item => (
                                    <div key={item.ttn} className="bg-[#262c33] lg:bg-gray-50 border border-[#32363b] lg:border-gray-150 rounded-xl p-3 flex items-center justify-between text-white lg:text-gray-900">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-sm font-bold tracking-wider">{item.ttn}</span>
                                            {item.phone && (
                                                <span className="text-[10px] text-gray-400 font-mono mt-0.5">📞 {item.phone}</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDelete(item.ttn)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
