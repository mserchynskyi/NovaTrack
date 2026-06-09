import { useState, FormEvent } from 'react';
import { Mail, Lock, LogIn, UserPlus, Package as Box, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export function AuthScreen() {
    const { loginEmail, registerEmail } = useAuth();
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [authError, setAuthError] = useState('');

    const handleAuth = async (e: FormEvent) => {
        e.preventDefault();
        setAuthError('');

        if (!authEmail || !authPassword) {
            setAuthError('Будь ласка, заповніть усі обов’язкові поля');
            return;
        }

        if (authPassword.length < 6) {
            setAuthError('Пароль має містити щонайменше 6 символів');
            return;
        }

        if (isRegisterMode && authPassword !== confirmPassword) {
            setAuthError('Паролі не співпадають');
            return;
        }

        setIsLoading(true);
        try {
            if (isRegisterMode) {
                await registerEmail(authEmail.trim(), authPassword);
            } else {
                await loginEmail(authEmail.trim(), authPassword);
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            let msg = err.message || 'Помилка авторизації';
            if (err.code === 'auth/email-already-in-use') {
                msg = 'Цей Email вже використовується іншим користувачем';
            } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                msg = 'Неправильний пароль або Email';
            } else if (err.code === 'auth/user-not-found') {
                msg = 'Користувача з таким Email не знайдено';
            } else if (err.code === 'auth/invalid-email') {
                msg = 'Неправильний формат Email-адреси';
            } else if (err.code === 'auth/network-request-failed') {
                msg = 'Помилка мережі. Перевірте з’єднання з інтернетом';
            } else if (err.code === 'auth/too-many-requests') {
                msg = 'Занадто багато спроб. Спробуйте пізніше або скиньте пароль';
            }
            setAuthError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex bg-[var(--bg-main)] min-h-[100dvh] items-center justify-center p-4 antialiased">
            <div className="w-full max-w-md bg-[var(--bg-card-alt)]/80 backdrop-blur-md rounded-3xl border border-[var(--border-color)] p-8 shadow-2xl relative overflow-hidden transition-all duration-300">
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 w-full h-[4px] bg-[#e33745]" />

                {/* Brand Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[#e33745]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#e33745]/20 shadow-inner">
                        <Box className="w-8 h-8 text-[#e33745]" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
                        МультиПошта
                    </h1>
                    <p className="text-[var(--text-muted)] text-sm mt-1.5 font-medium">
                        {isRegisterMode 
                            ? 'Створіть акаунт, щоб синхронізувати посилки' 
                            : 'Увійдіть для доступу та синхронізації ТТН'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleAuth} className="space-y-4">
                    {authError && (
                        <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-red-400 text-xs font-semibold leading-relaxed">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{authError}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Email Input */}
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                                Email Адреса
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                                    <Mail className="w-4.5 h-4.5 stroke-[1.8]" />
                                </div>
                                <input
                                    type="email"
                                    placeholder="name@company.com"
                                    value={authEmail}
                                    onChange={(e) => setAuthEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] focus:border-[#e33745] focus:ring-2 focus:ring-[#e33745]/30 rounded-xl text-[var(--text-main)] text-sm placeholder:text-gray-500 focus:outline-none transition-all"
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                                Пароль
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                                    <Lock className="w-4.5 h-4.5 stroke-[1.8]" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder={isRegisterMode ? "Створіть надійний пароль" : "Введіть ваш пароль"}
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    className="w-full pl-11 pr-11 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] focus:border-[#e33745] focus:ring-2 focus:ring-[#e33745]/30 rounded-xl text-[var(--text-main)] text-sm placeholder:text-gray-500 focus:outline-none transition-all"
                                    required
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password Input (only in registration) */}
                        {isRegisterMode && (
                            <div className="animate-fade-in">
                                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                                    Підтвердьте пароль
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                                        <Lock className="w-4.5 h-4.5 stroke-[1.8]" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Введіть пароль ще раз"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] focus:border-[#e33745] focus:ring-2 focus:ring-[#e33745]/30 rounded-xl text-[var(--text-main)] text-sm placeholder:text-gray-500 focus:outline-none transition-all"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2.5 bg-[#e33745] hover:bg-red-700 disabled:bg-red-900/40 text-[#ffffff] py-3.5 px-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all shadow-lg shadow-red-900/30 disabled:shadow-none hover:shadow-red-600/20 active:scale-[0.98] mt-6 select-none cursor-pointer"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : isRegisterMode ? (
                            <>
                                <UserPlus className="w-4.5 h-4.5 stroke-[2.2]" />
                                Зареєструватися
                            </>
                        ) : (
                            <>
                                <LogIn className="w-4.5 h-4.5 stroke-[2.2]" />
                                Увійти в акаунт
                            </>
                        )}
                    </button>
                </form>

                {/* Switch Mode Toggle */}
                <div className="text-center mt-6 pt-5 border-t border-[var(--border-color)]/70">
                    <button
                        type="button"
                        onClick={() => {
                            setIsRegisterMode(!isRegisterMode);
                            setAuthError('');
                            setAuthPassword('');
                            setConfirmPassword('');
                        }}
                        className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-semibold select-none cursor-pointer transition-colors"
                        disabled={isLoading}
                    >
                        {isRegisterMode 
                            ? 'Вже зареєстровані? Увійти до системи' 
                            : 'Немає акаунту? Бажаєте зареєструватися?'}
                    </button>
                </div>
            </div>
        </div>
    );
}
