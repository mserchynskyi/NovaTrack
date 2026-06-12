import { useState, useEffect } from 'react';
import { X, CreditCard } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useSubscription } from '../lib/useSubscription';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const { user } = useAuth();
  const { 
    subscription, 
    cancelSubscription,
    daysLeft,
    getWayForPayParams
  } = useSubscription();

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

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = params.action;
    form.target = '_blank';

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

  useEffect(() => {
     if (isOpen) {
         setShowCancelConfirm(false);
     }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[var(--bg-main)] h-[100dvh] sm:h-auto sm:max-h-[85vh] rounded-none sm:rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border-none sm:border border-[var(--border-color)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-main)] shrink-0">
            <div className="w-5 h-5 shrink-0" />
            
            <h2 className="text-lg font-bold text-[var(--text-main)] tracking-tight text-center">
              Підписка
            </h2>

            <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors shrink-0 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
        </div>
        
        <div className="p-6 space-y-5 flex-1 overflow-y-auto w-full no-scrollbar relative">
          {user ? (
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
                  className="w-full flex items-center justify-center gap-2 mt-2 bg-[#e33745] hover:bg-red-700 text-[#ffffff] py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all transform active:scale-98 shadow-md shadow-red-950/10 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Генерація лінку...' : 'Оплатити підписку 100 ₴'}
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-[var(--text-muted)] text-sm">
              Авторизуйтесь для перегляду підписки.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
