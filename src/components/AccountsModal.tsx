import { useState, FormEvent, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Plus, Key, LogOut, CheckCircle2, Mail, ChevronRight, ArrowLeft, Sun, Moon, Monitor, CreditCard, Settings, MessageCircle } from 'lucide-react';
import { NpAccount } from '../types';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/useTheme';
import { useSubscription } from '../lib/useSubscription';

interface AccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: NpAccount[];
  onSave: (accounts: NpAccount[]) => void;
  initialTab?: 'profile' | 'api';
}

export function AccountsModal({ isOpen, onClose, accounts, onSave, initialTab = 'profile' }: AccountsModalProps) {
  const { user, loading, loginEmail, registerEmail, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { 
    subscription, 
    loading: subLoading, 
    activateSubscription, 
    cancelSubscription,
    setTrialExpired, 
    resetTrial, 
    daysLeft,
    merchantAccount,
    merchantSecret,
    saveMerchantConfig,
    getWayForPayParams
  } = useSubscription();
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'api'>(initialTab);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleSubscribe = (e: any) => {
    e.preventDefault();
    setIsSubmitting(true);

    const params = getWayForPayParams();
    if (!params) {
      alert('Помилка: Не вдалося згенерувати параметри оплати. Перевірте статус авторизації.');
      setIsSubmitting(false);
      return;
    }

    // Build standard hidden HTML form and submit to WayForPay
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = params.action;
    form.target = '_blank'; // Open in a new tab for seamless flow in iframe

    // Append regular parameters
    Object.entries(params.fields).forEach(([key, val]) => {
      if (Array.isArray(val)) {
        val.forEach((item) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = `${key}[]`;
          input.value = String(item);
          form.appendChild(input);
        });
      } else {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(val);
        form.appendChild(input);
      }
    });

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);

    setTimeout(() => {
      setIsSubmitting(false);
    }, 2000);
  };

  // Sync activeTab when modal opens/changes
  useEffect(() => {
     if (isOpen) {
         setActiveTab(initialTab);
         setShowCancelConfirm(false);
     }
  }, [isOpen, initialTab]);

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
    const cleanedApiKey = apiKey.trim().replace(/[\r\n\s]+/g, '');
    const newAccount: NpAccount = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      apiKey: cleanedApiKey
    };
    onSave([...accounts, newAccount]);
    setName('');
    setApiKey('');
  };

  const handleRemove = (id: string) => {
    onSave(accounts.filter(a => a.id !== id));
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[var(--bg-main)] h-[100dvh] sm:h-[85vh] sm:max-h-[600px] rounded-none sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-none sm:border border-[var(--border-color)] flex flex-col pt-safe sm:pt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-main)] shrink-0">
            {activeTab === 'api' ? (
                <button onClick={() => setActiveTab('profile')} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors shrink-0">
                  <ArrowLeft className="w-5 h-5" />
                </button>
            ) : (
                <div className="w-7 h-7 shrink-0" />
            )}
            
            <h2 className="text-lg font-bold text-[var(--text-main)] tracking-tight text-center">
              {activeTab === 'api' ? 'Профілі (ключі API)' : 'Користувач'}
            </h2>

            <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
        </div>
        
        <div className="p-6 space-y-5 flex-1 overflow-y-auto w-full no-scrollbar relative">
          {activeTab === 'profile' ? (
            <>
              {/* Auth/Profile Box */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl flex flex-col gap-3">
                {!loading && !user ? (
                <>
                  <p className="text-xs text-[var(--text-muted)]">
                    Авторизуйтеся для збереження акаунтів та синхронізації між пристроями:
                  </p>
                  
                  {/* Email sign in trigger */}
                  {!isEmailFormOpen ? (
                    <button
                      onClick={() => {
                        setIsEmailFormOpen(true);
                        setAuthError('');
                      }}
                      className="flex items-center justify-center gap-2 bg-[var(--bg-card-alt)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-main)] text-xs py-2.5 rounded-lg font-medium transition cursor-pointer"
                    >
                      <Mail className="w-4 h-4" /> Вхід через Email / Пароль
                    </button>
                  ) : (
                    <form onSubmit={handleEmailAuth} className="space-y-3 mt-1 text-left">
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Email Адреса
                        </label>
                        <input
                          type="email"
                          placeholder="your@email.com"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Пароль (мін. 6 символів)
                        </label>
                        <input
                          type="password"
                          placeholder="••••••"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          className="flex-1 bg-[#2a68ff] hover:bg-[#1a58ef] text-[var(--text-main)] text-xs py-2 rounded-lg font-bold transition cursor-pointer"
                        >
                          {isRegisterMode ? 'Зареєструватися' : 'Увійти'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEmailFormOpen(false);
                            setAuthError('');
                          }}
                          className="px-3 bg-transparent border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg text-xs hover:bg-[var(--bg-hover)] transition cursor-pointer"
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
                  <div className="flex items-center gap-2 text-xs text-[var(--text-main)] min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-[#25c468] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-[var(--text-muted)]/80 font-bold uppercase tracking-wider">Синхронізація активна</div>
                      <div className="font-semibold truncate max-w-[170px] mt-0.5">{user.email}</div>
                    </div>
                  </div>
                  <button 
                    onClick={logout}
                    className="text-xs flex items-center gap-1.5 text-[#e33745] hover:text-[var(--text-main)] shrink-0"
                  >
                   <LogOut className="w-3.5 h-3.5"/> Вийти
                  </button>
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-[var(--text-muted)]">Завантаження...</div>
              )}
              
                {authSuccess && (
                  <p className="text-[11px] text-[#25c468] font-semibold text-center mt-1">
                    {authSuccess}
                  </p>
                )}
              </div>

              {/* WayForPay Subscription Status Panel */}
              {user && (
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-5 rounded-xl flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-[var(--text-main)] text-sm flex items-center gap-2">
                      <CreditCard className="w-4.5 h-4.5 text-[#e33745]" />
                      <span>Підписка WayForPay</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      subscription?.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' :
                      subscription?.status === 'trial' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/10' :
                      'bg-red-500/10 text-red-500 border border-red-500/10'
                    }`}>
                      {subscription?.status === 'active' ? 'Активна' :
                       subscription?.status === 'trial' ? `Пробна (${daysLeft()} дн.)` :
                       'Закінчилась'}
                    </span>
                  </div>

                  <div className="text-xs text-[var(--text-muted)] space-y-1.5 leading-relaxed text-left">
                    {subscription?.status === 'trial' && (
                      <p>Пробний 14-денний період активний. Дата завершення: <strong className="text-[var(--text-main)]">{new Date(subscription.trialEndDate).toLocaleDateString('uk-UA')}</strong></p>
                    )}
                    {subscription?.status === 'active' && subscription?.activeEndDate && (
                      subscription?.wayforpayCardPan ? (
                        <p>Ваша підписка активна (100 грн/міс). Наступне списання: <strong className="text-[var(--text-main)]">{new Date(subscription.activeEndDate).toLocaleDateString('uk-UA')}</strong></p>
                      ) : (
                        <p>Автопродовження підписки скасовано. Доступ залишається активним до: <strong className="text-[var(--text-main)]">{new Date(subscription.activeEndDate).toLocaleDateString('uk-UA')}</strong></p>
                      )
                    )}
                    {subscription?.status === 'expired' && (
                      <p className="text-[#e33745] font-semibold">Ваш пробний період або термін дії підписки закінчився. Будь ласка, активуйте підписку для подальшої роботи з посилками.</p>
                    )}
                    {subscription?.wayforpayCardPan && (
                      <p className="font-mono text-[11px] bg-[var(--bg-main)] p-1.5 rounded border border-[var(--border-color)]/40 text-center">Прив'язана картка: {subscription.wayforpayCardPan}</p>
                    )}
                  </div>

                  {subscription?.wayforpayCardPan && (
                    <div className="space-y-2">
                      {!showCancelConfirm ? (
                        <button
                          onClick={() => setShowCancelConfirm(true)}
                          className="w-full flex items-center justify-center gap-2 bg-[var(--bg-main)] border border-[var(--border-color)]/60 hover:bg-[var(--bg-hover)] text-[#e33745] hover:text-red-700 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all transform active:scale-98 cursor-pointer shadow-sm"
                        >
                          Скасувати підписку
                        </button>
                      ) : (
                        <div className="bg-[var(--bg-main)]/50 p-3 rounded-lg border border-[#e33745]/30 text-center space-y-2.5">
                          <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                            Ви впевнені, що хочете скасувати підписку? Автоплатежі буде відключено.
                          </p>
                          <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
                            <button
                              onClick={async () => {
                                await cancelSubscription();
                                setShowCancelConfirm(false);
                              }}
                              className="flex-1 bg-[#e33745] hover:bg-red-700 text-[#ffffff] py-2 rounded-md cursor-pointer transition-colors"
                            >
                              Так, скасувати
                            </button>
                            <button
                              onClick={() => setShowCancelConfirm(false)}
                              className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] py-2 rounded-md cursor-pointer transition-colors"
                            >
                              Ні, залишити
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(subscription?.status !== 'active' || !subscription?.wayforpayCardPan) && (
                    <button
                      onClick={handleSubscribe}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 mt-3 bg-[#e33745] hover:bg-red-700 text-[#ffffff] py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all transform active:scale-98 shadow-md shadow-red-950/10 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? 'Генерація лінку...' : 'Оплатити підписку 100 ₴'}
                    </button>
                  )}
                </div>
              )}

              {/* Theme Selector */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl flex flex-col gap-3">
                <div className="font-semibold text-[var(--text-main)] text-sm">Тема оформлення</div>
                <div className="flex bg-[var(--bg-main)] rounded-lg p-1 border border-[var(--border-color)] text-xs font-semibold">
                  <button 
                    onClick={() => setTheme('light')}
                    className={`flex-1 py-2 flex items-center justify-center gap-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-[var(--bg-card)] shadow-sm text-gray-900 border border-[var(--border-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                  >
                    <Sun className="w-3.5 h-3.5" /> Світла
                  </button>
                  <button 
                    onClick={() => setTheme('dark')}
                    className={`flex-1 py-2 flex items-center justify-center gap-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-[var(--bg-card)] shadow-sm text-[#ffffff] border border-[var(--border-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                  >
                    <Moon className="w-3.5 h-3.5" /> Темна
                  </button>
                  <button 
                    onClick={() => setTheme('system')}
                    className={`flex-1 py-2 flex items-center justify-center gap-1.5 rounded-md transition-all ${theme === 'system' ? 'bg-[var(--bg-card)] shadow-sm text-[var(--text-main)] border border-[var(--border-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                  >
                    <Monitor className="w-3.5 h-3.5" /> Системна
                  </button>
                </div>
              </div>

              {/* API Keys Menu Item */}
              <div 
                onClick={() => setActiveTab('api')}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[var(--bg-hover)] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--bg-main)] rounded-lg text-[var(--text-muted)]">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--text-main)] text-sm">Профілі (ключі API)</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">Керування підключеннями НП</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors" />
              </div>

              {/* Telegram Support Menu Item */}
              <a 
                href="https://t.me/multipost_app"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[var(--bg-hover)] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--bg-main)] rounded-lg text-sky-400">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--text-main)] text-sm">Технічна підтримка</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">t.me/multipost_app</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors" />
              </a>
            </>
          ) : (
            <>
              {accounts.length > 0 ? (
                <div className="space-y-3">
                  {accounts.map(acc => (
                    <div key={acc.id} className="flex justify-between items-center p-3.5 bg-[var(--bg-card-alt)] border border-[var(--border-color)] border-[var(--border-color)] rounded-xl">
                      <div>
                        <div className="font-medium text-[var(--text-main)] text-sm tracking-wide">{acc.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5 break-all" title={acc.apiKey}>{acc.apiKey}</div>
                      </div>
                      <button onClick={() => handleRemove(acc.id)} className="p-2 text-[var(--text-muted)] hover:text-[#e33745] hover:bg-[#e33745]/10 rounded-lg transition-colors" title="Видалити">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-[var(--text-muted)] text-sm">
                  Немає доданих акаунтів. Додайте перший API ключ.
                </div>
              )}

              <div className="border-t border-[var(--border-color)] border-[var(--border-color)] pt-5 mt-5 space-y-4">
                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Додати новий акаунт</h3>
                <div>
                  <input 
                    type="text" 
                    placeholder="Назва (напр. ФОП Іванов)" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm focus:outline-none focus:border-[#e33745] focus:ring-1 focus:ring-[#e33745] placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <input 
                    type="text" 
                    placeholder="API Ключ (отримайте в кабінеті НП)" 
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm focus:outline-none focus:border-[#e33745] focus:ring-1 focus:ring-[#e33745] placeholder:text-gray-500 font-mono"
                  />
                </div>
                <button 
                  onClick={handleAdd}
                  disabled={!name || !apiKey}
                  className="w-full flex items-center justify-center gap-2 bg-[#e33745] hover:bg-red-700 text-[#ffffff] px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors shadow-lg shadow-red-900/10"
                >
                  <Plus className="w-4 h-4" /> Зберегти
                </button>
                <div className="mt-3 text-center text-[10px] text-[var(--text-muted)] leading-relaxed">
                  <p>Як знайти токен?</p>
                  <p>Увійдіть у <b>веб-кабінет</b> Нової Пошти, перейдіть у меню <br/> <span className="font-medium">Налаштування → Безпека → API 2.0</span> і створіть новий ключ.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
