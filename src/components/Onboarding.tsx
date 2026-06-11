import { KeyRound } from 'lucide-react';

export function Onboarding({ onAddAccount }: { onAddAccount: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center h-full p-4">
      <div className="bg-[var(--bg-card-alt)] p-8 lg:p-10 rounded-2xl lg:rounded border border-[var(--border-color)] shadow-xl lg:shadow-sm max-w-lg w-full text-center my-8">
          <div className="w-16 h-16 bg-[#e33745]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#e33745]/20">
              <KeyRound className="w-8 h-8 text-[#e33745]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2 tracking-tight">
              МультиПошта
          </h1>
          <p className="text-[var(--text-muted)] mb-8 text-sm max-w-sm mx-auto">
              Додайте API ключі з кабінету Нової Пошти, щоб відслідковувати всі ваші відправлення та отримання на одному екрані.
          </p>
          
          <button 
              onClick={onAddAccount}
              className="bg-[#e33745] hover:bg-red-700 text-[#ffffff] px-6 py-3 lg:py-2.5 rounded-lg text-sm font-bold tracking-wide shadow-sm shadow-red-900/30 lg:shadow-sm transition-colors uppercase w-full sm:w-auto"
          >
              Додати перший ключ
          </button>
      </div>
    </div>
  );
}
