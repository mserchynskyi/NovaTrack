import React, { useState } from 'react';
import { CreditCard, Package, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import { useSubscription } from '../lib/useSubscription';
import { useAuth } from '../lib/AuthContext';

export function SubscriptionPaywall() {
  const { user, logout } = useAuth();
  const { getWayForPayParams, activateSubscription } = useSubscription();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
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

    // Show status update help to complete active sync
    setTimeout(() => {
      setIsSubmitting(false);
    }, 2000);
  };

  return (
    <div className="flex bg-[var(--bg-main)] h-full w-full overflow-hidden items-center justify-center p-4 antialiased selection:bg-red-200">
      <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 shadow-xl shadow-black/20 flex flex-col text-center">
        
        {/* Visual Badge Header */}
        <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20 shadow-lg shadow-red-950/25 relative animate-bounce">
          <CreditCard className="w-8 h-8 text-[#e33745]" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] tracking-tight mb-2">
          Пробний період закінчився
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
          Ваш 14-денний тестовий доступ завершено. Для подальшого швидкого відстеження та створення посилок Нової Пошти, будь ласка, активуйте підписку.
        </p>

        {/* Plan Summary Card */}
        <div className="bg-[var(--bg-card-alt)] rounded-2xl border border-[var(--border-color)]/80 p-5 mb-6 text-left space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]/55">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#e33745] tracking-wider">Ваш План</span>
              <div className="font-extrabold text-sm text-[var(--text-main)] mt-0.5">Premium Доступ</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-[var(--text-main)]">100 ₴</div>
              <div className="text-[10px] text-[var(--text-muted)] font-semibold">на місяць</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2.5 text-xs text-[var(--text-main)]">
              <Zap className="w-4 h-4 text-[#e33745] shrink-0 mt-0.5" />
              <span>Автоматичне оновлення статусів посилок без обмежень</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[var(--text-main)]">
              <Package className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Створення ТТН та автоматичний пошук відділень у мапі</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[var(--text-main)]">
              <ShieldCheck className="w-4 h-4 text-[#2a68ff] shrink-0 mt-0.5" />
              <span>Безпечна регулярна оплата через еквайринг <strong>WayForPay</strong></span>
            </div>
          </div>
        </div>

        {/* Buttons and Actions */}
        <div className="space-y-3">
          <button
            onClick={handleSubscribe}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-[#e33745] hover:bg-red-700 text-[#ffffff] py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all transform active:scale-98 shadow-lg shadow-red-950/20 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Генерація лінку...' : 'Оплатити 100 ₴ через WayForPay'}
          </button>

          <button
            onClick={logout}
            className="w-full py-2 bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-semibold cursor-pointer transition-colors pt-3"
          >
            Вийти з акаунту
          </button>
        </div>

        {/* Footer Warning */}
        <div className="flex gap-1.5 items-center justify-center mt-6 text-[10px] text-[var(--text-muted)]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Платіж захищено шифруванням за стандартом PCI DSS.</span>
        </div>

      </div>
    </div>
  );
}
