import { useState, FormEvent } from 'react';
import { X, Trash2, Plus, Key, LogIn, LogOut, CheckCircle2, Mail } from 'lucide-react';
import { NpAccount } from '../types';
import { useAuth } from '../lib/AuthContext';

interface AccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: NpAccount[];
  onSave: (accounts: NpAccount[]) => void;
}

export function AccountsModal({ isOpen, onClose, accounts, onSave }: AccountsModalProps) {
  const { user, loading, login, loginEmail, registerEmail, logout } = useAuth();
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isEmailFormOpen, setIsEmailFormOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  if (!isOpen) return null;

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    if (!authEmail || !authPassword) {
      setAuthError('Будь ласка, заповніть усі поля');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('Пароль має містити не менше 6 символів');
      return;
    }
    try {
      if (isRegisterMode) {
        await registerEmail(authEmail, authPassword);
        setAuthSuccess('Реєстрація успішна! Ви увійшли.');
      } else {
        await loginEmail(authEmail, authPassword);
        setAuthSuccess('Вхід успішний!');
      }
      setAuthEmail('');
      setAuthPassword('');
      setIsEmailFormOpen(false);
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'Помилка авторизації';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'Цей Email вже використовується іншим акаунтом';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Неправильний пароль або Email';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'Користувача з таким Email не знайдено';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Неправильний формат Email-адреси';
      }
      setAuthError(msg);
    }
  };

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
                
                {/* Google Sign-in */}
                <button 
                  onClick={login}
                  className="flex items-center justify-center gap-2 bg-[#2a68ff] text-white text-xs py-2.5 rounded-lg font-medium hover:bg-[#1a58ef] transition cursor-pointer"
                >
                  <LogIn className="w-4 h-4" /> Авторизація через Google
                </button>

                {/* Divider */}
                <div className="flex items-center justify-between gap-2 my-1">
                  <span className="h-[1px] bg-[#32363b] lg:bg-gray-200 flex-1"></span>
                  <span className="text-[10px] text-[#a5acb5] lg:text-gray-400 font-bold uppercase tracking-wider">або</span>
                  <span className="h-[1px] bg-[#32363b] lg:bg-gray-200 flex-1"></span>
                </div>

                {/* Email sign in trigger */}
                {!isEmailFormOpen ? (
                  <button
                    onClick={() => {
                      setIsEmailFormOpen(true);
                      setAuthError('');
                    }}
                    className="flex items-center justify-center gap-2 bg-[#292d32] hover:bg-[#32363b] text-[#a5acb5] lg:bg-white lg:border lg:border-gray-300 lg:text-gray-700 lg:hover:bg-gray-50 text-xs py-2.5 rounded-lg font-medium transition cursor-pointer"
                  >
                    <Mail className="w-4 h-4" /> Вхід через Email / Пароль
                  </button>
                ) : (
                  <form onSubmit={handleEmailAuth} className="space-y-3 mt-1 text-left">
                    <div>
                      <label className="block text-[10px] font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider mb-1">
                        Email Адреса
                      </label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1b2b35] lg:bg-white border border-[#32363b] lg:border-gray-200 rounded-lg text-white lg:text-gray-900 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a5acb5] lg:text-gray-500 uppercase tracking-wider mb-1">
                        Пароль (мін. 6 символів)
                      </label>
                      <input
                        type="password"
                        placeholder="••••••"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1b2b35] lg:bg-white border border-[#32363b] lg:border-gray-200 rounded-lg text-white lg:text-gray-900 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {authError && (
                      <p className="text-[11px] text-red-500 font-medium">
                        {authError}
                      </p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        className="flex-1 bg-[#2a68ff] hover:bg-[#1a58ef] text-white text-xs py-2 rounded-lg font-bold transition cursor-pointer"
                      >
                        {isRegisterMode ? 'Зареєструватися' : 'Увійти'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEmailFormOpen(false);
                          setAuthError('');
                        }}
                        className="px-3 bg-transparent border border-[#32363b] lg:border-gray-300 text-[#a5acb5] lg:text-gray-600 rounded-lg text-xs hover:bg-[#131b20] lg:hover:bg-gray-100 transition cursor-pointer"
                      >
                        Скасувати
                      </button>
                    </div>

                    <div className="text-center pt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegisterMode(!isRegisterMode);
                          setAuthError('');
                        }}
                        className="text-[11px] text-[#2a68ff] hover:underline font-medium cursor-pointer"
                      >
                        {isRegisterMode
                          ? 'Вже маєте акаунт? Увійдіть'
                          : 'Немає акаунту? Створіть новий'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : !loading && user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-white lg:text-blue-900 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-[#25c468] lg:text-green-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#a5acb5] lg:text-blue-700/80 font-bold uppercase tracking-wider">Синхронізація активна</div>
                    <div className="font-semibold truncate max-w-[170px] mt-0.5">{user.email}</div>
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="text-xs flex items-center gap-1.5 text-[#e33745] hover:text-white lg:text-gray-500 lg:hover:text-gray-700 shrink-0"
                >
                 <LogOut className="w-3.5 h-3.5"/> Вийти
                </button>
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-[#a5acb5] lg:text-gray-500">Завантаження...</div>
            )}
            
            {authSuccess && (
              <p className="text-[11px] text-[#25c468] font-semibold text-center mt-1">
                {authSuccess}
              </p>
            )}
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
