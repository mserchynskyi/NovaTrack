import React from 'react';
import { FileText, ArrowLeft } from 'lucide-react';

export function PrivacyPolicyPage() {
    return (
        <div className="flex flex-col h-full bg-[var(--bg-main)] text-[var(--text-main)] font-sans overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 flex items-center gap-4 border-b border-[var(--border-color)]/40 bg-[var(--bg-card)] shrink-0 sticky top-0 z-20 shadow-sm">
                <a 
                    href="/"
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-card-alt)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors border border-[var(--border-color)]"
                >
                    <ArrowLeft className="w-4 h-4" />
                </a>
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full border border-gray-500/20 bg-[var(--bg-card-alt)]">
                        <FileText className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">Політика конфіденційності</span>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 max-w-2xl mx-auto w-full p-6 text-sm flex flex-col gap-5 overflow-y-auto no-scrollbar">
                <p className="text-[var(--text-muted)] leading-relaxed">Ця Політика конфіденційності визначає порядок збору, використання та захисту вашої особистої інформації та даних під час використання додатку «МультиПошта».</p>

                <div className="space-y-2">
                    <h3 className="text-base font-semibold">1. Які дані ми збираємо</h3>
                    <ul className="list-disc pl-5 space-y-1 text-[var(--text-muted)] leading-relaxed">
                        <li><strong>Ключі API Нової Пошти:</strong> Збираються виключно для забезпечення взаємодії з серверами Нової Пошти (отримання статусів, створення накладних).</li>
                        <li><strong>Номери експрес-накладних (ТТН):</strong> Зберігаються для забезпечення швидкого доступу та історії відстежень.</li>
                        <li><strong>Контактна інформація:</strong> Може включати номер телефону отримувача, адреси доставки, ПІБ та інші дані, що містяться у ТТН.</li>
                        <li><strong>Дані облікового запису:</strong> Електронна адреса, що використовується для ідентифікації користувача в додатку через систему Firebase.</li>
                    </ul>
                </div>

                <div className="space-y-2">
                    <h3 className="text-base font-semibold">2. Використання даних</h3>
                    <p className="text-[var(--text-muted)] leading-relaxed">Ми використовуємо зібрані дані виключно для:</p>
                    <ul className="list-disc pl-5 space-y-1 text-[var(--text-muted)] leading-relaxed">
                        <li>Взаємодії з офіційним API Нової Пошти від вашого імені.</li>
                        <li>Відображення інформації про статус та деталі ваших відправлень.</li>
                        <li>Забезпечення синхронізації ваших даних між різними пристроями під одним обліковим записом.</li>
                    </ul>
                    <p className="text-[var(--text-muted)] lg:font-medium leading-relaxed">Ваші ключі API та деталі посилок ніколи не передаються третім компаніям, за винятком безпосередніх запитів до серверів ТОВ «Нова Пошта».</p>
                </div>

                <div className="space-y-2">
                    <h3 className="text-base font-semibold">3. Зберігання та захист</h3>
                    <p className="text-[var(--text-muted)] leading-relaxed">Дані зберігаються у безпечному хмарному сховищі Google Firebase, яке відповідає найвищим стандартам безпеки. Кожен користувач має доступ виключно до власних інкапсульованих даних. Ваші паролі ніколи не зберігаються у відкритому вигляді.</p>
                </div>

                <div className="space-y-2">
                    <h3 className="text-base font-semibold">4. Контроль даних користувачем</h3>
                    <p className="text-[var(--text-muted)] leading-relaxed">Ви маєте повне право в будь-який момент:</p>
                    <ul className="list-disc pl-5 space-y-1 text-[var(--text-muted)] leading-relaxed">
                        <li>Видалити свої ключі API Нової Пошти з нашого додатку.</li>
                        <li>Очистити історію відстежень ТТН.</li>
                        <li>Повністю видалити свій обліковий запис у системі разом із усіма пов'язаними даними.</li>
                    </ul>
                </div>

                <div className="space-y-2">
                    <h3 className="text-base font-semibold">5. Зміни до політики</h3>
                    <p className="text-[var(--text-muted)] leading-relaxed">Ми залишаємо за собою право вносити зміни до цієї Політики конфіденційності. У разі суттєвих змін ми обов'язково повідомимо вас про це в інтерфейсі додатку.</p>
                </div>

                <div className="space-y-2 pb-10">
                    <h3 className="text-base font-semibold">6. Контакти</h3>
                    <p className="text-[var(--text-muted)] leading-relaxed">
                        ФОП Серчинський Тарас Володимирович<br/>
                        ЄДРПОУ: 2367114254
                    </p>
                </div>
            </div>
        </div>
    );
}
