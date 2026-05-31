import { ReactNode } from 'react';
import { Home, MapPin, User, Package as Box, LogOut } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface LayoutProps {
  children: ReactNode;
  onManageAccounts: () => void;
}

export function Layout({ children, onManageAccounts }: LayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="flex bg-[#1b2b35] lg:bg-[#F3F4F6] min-h-[100dvh] font-sans selection:bg-red-200">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[#1b2b35] text-white flex-col h-screen sticky top-0 shadow-lg shrink-0">
         <div className="p-6 flex items-center gap-3">
             <div className="bg-[#e33745] p-2 rounded-xl shadow-md shadow-red-900/20">
                 <Box className="w-5 h-5 text-white stroke-[2]" />
             </div>
             <span className="font-bold text-lg tracking-tight">Nova Track</span>
         </div>
         
         <nav className="flex-1 px-4 space-y-1.5 mt-2">
             <div className="flex items-center gap-3 px-3 py-2.5 bg-white/10 rounded-lg text-white cursor-pointer font-medium text-sm">
                <Home className="w-4 h-4" />
                Головна
             </div>
             <div onClick={onManageAccounts} className="flex items-center gap-3 px-3 py-2.5 text-[#a5acb5] hover:bg-white/5 hover:text-white rounded-lg cursor-pointer font-medium text-sm transition-colors">
                <User className="w-4 h-4" />
                Профіль та Акаунти
             </div>
         </nav>

         {user && (
            <div className="p-4 mt-auto">
                <div className="flex items-center gap-3 px-3 py-2.5 text-[#a5acb5] hover:bg-white/5 hover:text-white rounded-lg cursor-pointer font-medium text-sm transition-colors" onClick={logout}>
                   <LogOut className="w-4 h-4" />
                   <span className="truncate flex-1">Вийти ({user.email?.split('@')[0]})</span>
                </div>
            </div>
         )}
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col w-full h-[100dvh] lg:h-auto overflow-hidden lg:overflow-visible">
          {/* Main Content Area */}
          <main className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto no-scrollbar relative w-full h-full pb-[72px] landscape:pb-[56px] lg:pb-0">
            <div className="p-0 lg:p-8 flex-1 flex flex-col max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
          
          {/* Mobile Bottom Nav */}
          <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-[#1b2b35] border-t border-[#32363b] pb-safe pt-2.5 landscape:pt-1 px-6 flex justify-around items-center text-[11px] landscape:text-[10px] text-[#a5acb5] font-medium z-50 h-[72px] landscape:h-[56px]">
            <div className="flex flex-col items-center gap-1.5 landscape:gap-0.5 w-20 cursor-pointer text-[#e33745]">
              <Home className="w-6 h-6 landscape:w-5 landscape:h-5 stroke-[1.5]" />
              <span>Головна</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 landscape:gap-0.5 w-20 cursor-pointer hover:text-gray-300 transition-colors" onClick={onManageAccounts}>
              <User className="w-6 h-6 landscape:w-5 landscape:h-5 stroke-[1.5]" />
              <span>Профіль</span>
            </div>
          </nav>
      </div>
    </div>
  );
}
