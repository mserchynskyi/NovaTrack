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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Key className="w-5 h-5 text-gray-500" />
            API Ключі
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Auth Section */}
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex flex-col gap-2">
            {!loading && !user ? (
              <>
                <p className="text-xs text-blue-800">
                  Авторизуйтеся для синхронізації акаунтів між пристроями:
                </p>
                <button 
                  onClick={login}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white text-xs py-2 rounded font-medium hover:bg-blue-700 transition"
                >
                  <LogIn className="w-3.5 h-3.5" /> Авторизація через Google
                </button>
              </>
            ) : !loading && user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-blue-900">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Увійшли як: <span className="font-semibold truncate max-w-[140px]">{user.email}</span>
                </div>
                <button 
                  onClick={logout}
                  className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-700"
                >
                 <LogOut className="w-3 h-3"/> Вийти
                </button>
              </div>
            ) : null}
          </div>

          {accounts.length > 0 ? (
            <div className="space-y-2">
              {accounts.map(acc => (
                <div key={acc.id} className="flex justify-between items-center p-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-800">{acc.name}</div>
                    <div className="text-xs text-gray-500 font-mono" title={acc.apiKey}>{acc.apiKey.substring(0, 8)}••••••••</div>
                  </div>
                  <button onClick={() => handleRemove(acc.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Видалити">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 text-sm">
              Немає доданих акаунтів. Додайте перший API ключ.
            </div>
          )}

          <div className="border-t border-gray-100 pt-4 mt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Додати новий акаунт</h3>
            <div>
              <input 
                type="text" 
                placeholder="Назва (напр. ФОП Іванов)" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <input 
                type="text" 
                placeholder="API Ключ (отримайте в кабінеті НП)" 
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
              />
            </div>
            <button 
              onClick={handleAdd}
              disabled={!name || !apiKey}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" /> Зберегти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
