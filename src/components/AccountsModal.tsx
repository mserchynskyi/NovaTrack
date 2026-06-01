import { useState } from 'react';
import { X, Trash2, Plus, Key, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { NpAccount } from '../types';
import { useAuth } from '../lib/AuthContext';

interface AccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: NpAccount[];
  onSave: (accounts: NpAccount[]) => void;
}

export function AccountsModal({ isOpen, onClose, accounts, onSave }: AccountsModalProps) {
  const { user, loading, login, logout } = useAuth();
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!name || !apiKey) return;
    const newAccount: NpAccount = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      apiKey
    };
    onSave([...accounts, newAccount]);
    setName('');
    setApiKey('');
  };

  const handleRemove = (id: string) => {
    onSave(accounts.filter(a => a.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-black/40 lg:bg-black/60 lg:backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1b2b35] lg:bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#32363b] lg:border-none">
        <div className="px-6 py-4 border-b border-[#32363b] lg:border-gray-100 flex justify-between items-center bg-[#1b2b35] lg:bg-gray-50">
          <h2 className="text-lg font-semibold text-white lg:text-gray-800 flex items-center gap-2">
            <Key className="w-5 h-5 text-[#a5acb5] lg:text-gray-500" />
            API Ключі
          </h2>
          <button onClick={onClose} className="text-[#a5acb5] hover:text-white lg:text-gray-400 lg:hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto w-full">
          {/* Auth Section */}
          <div className="bg-[#262c33] lg:bg-blue-50 border border-[#32363b] lg:border-blue-100 p-4 rounded-xl flex flex-col gap-3">
            {!loading && !user ? (
              <>
                <p className="text-xs text-[#a5acb5] lg:text-blue-800">
                  Авторизуйтеся для синхронізації акаунтів між пристроями:
                </p>
                <button 
                  onClick={login}
                  className="flex items-center justify-center gap-2 bg-[#2a68ff] text-white text-xs py-2.5 rounded-lg font-medium hover:bg-[#1a58ef] transition"
                >
                  <LogIn className="w-4 h-4" /> Авторизація через Google
                </button>
              </>
            ) : !loading && user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-white lg:text-blue-900">
                  <CheckCircle2 className="w-4 h-4 text-[#25c468] lg:text-green-500" />
                  Увійшли як: <span className="font-semibold truncate max-w-[140px]">{user.email}</span>
                </div>
                <button 
                  onClick={logout}
                  className="text-xs flex items-center gap-1.5 text-[#e33745] hover:text-white lg:text-gray-500 lg:hover:text-gray-700"
                >
                 <LogOut className="w-3.5 h-3.5"/> Вийти
                </button>
              </div>
            ) : null}
          </div>

          {accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map(acc => (
                <div key={acc.id} className="flex justify-between items-center p-3.5 bg-[#262c33] lg:bg-gray-50 border border-[#32363b] lg:border-gray-100 rounded-xl">
                  <div>
                    <div className="font-medium text-white lg:text-gray-800 text-sm tracking-wide">{acc.name}</div>
                    <div className="text-[11px] text-[#a5acb5] lg:text-gray-500 font-mono mt-0.5" title={acc.apiKey}>{acc.apiKey.substring(0, 8)}••••••••</div>
                  </div>
                  <button onClick={() => handleRemove(acc.id)} className="p-2 text-[#a5acb5] hover:text-[#e33745] lg:text-red-500 lg:hover:bg-red-50 hover:bg-[#e33745]/10 rounded-lg transition-colors" title="Видалити">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-[#a5acb5] lg:text-gray-500 text-sm">
              Немає доданих акаунтів. Додайте перший API ключ.
            </div>
          )}

          <div className="border-t border-[#32363b] lg:border-gray-100 pt-5 mt-5 space-y-4">
            <h3 className="text-xs font-bold text-[#a5acb5] lg:text-gray-700 uppercase tracking-widest">Додати новий акаунт</h3>
            <div>
              <input 
                type="text" 
                placeholder="Назва (напр. ФОП Іванов)" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#262c33] lg:bg-white border border-[#32363b] lg:border-gray-300 rounded-xl text-white lg:text-gray-900 text-sm focus:outline-none focus:border-[#e33745] lg:focus:border-red-500 focus:ring-1 focus:ring-[#e33745] lg:focus:ring-red-500 placeholder:text-gray-500 lg:placeholder:text-gray-400"
              />
            </div>
            <div>
              <input 
                type="text" 
                placeholder="API Ключ (отримайте в кабінеті НП)" 
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#262c33] lg:bg-white border border-[#32363b] lg:border-gray-300 rounded-xl text-white lg:text-gray-900 text-sm focus:outline-none focus:border-[#e33745] lg:focus:border-red-500 focus:ring-1 focus:ring-[#e33745] lg:focus:ring-red-500 placeholder:text-gray-500 lg:placeholder:text-gray-400 font-mono"
              />
            </div>
            <button 
              onClick={handleAdd}
              disabled={!name || !apiKey}
              className="w-full flex items-center justify-center gap-2 bg-[#e33745] hover:bg-red-700 text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors shadow-lg shadow-red-900/10"
            >
              <Plus className="w-4 h-4" /> Зберегти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
