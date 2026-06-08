import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { Home, MapPin, User, Package as Box, LogOut, Plus, FileText, X, Search, Globe, Copy, Check, Barcode, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { searchCities, getWarehouses } from '../lib/np-api';

interface LayoutProps {
  children: ReactNode;
  onManageAccounts: () => void;
  onAddTtn: () => void;
  onCreateTtn?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export function Layout({ children, onManageAccounts, onAddTtn, onCreateTtn, onRefresh, loading }: LayoutProps) {
  const { user, logout } = useAuth();

  // Scroll and Pull to refresh state
  const mainRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [isPullingReady, setIsPullingReady] = useState(false);

  const isAtTop = (element: HTMLElement | null): boolean => {
    if (!element) return true;
    if (element.scrollTop > 1) return false;
    if (element.parentElement && element !== mainRef.current) {
      return isAtTop(element.parentElement);
    }
    return true;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!onRefresh || loading) return;
    const target = e.target as HTMLElement;
    if (isAtTop(target)) {
      setTouchStartY(e.touches[0].pageY);
      setIsPullingReady(true);
    } else {
      setIsPullingReady(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingReady || !onRefresh || loading) return;
    const currentY = e.touches[0].pageY;
    const diff = currentY - touchStartY;
    if (diff > 0) {
      // Pulling down
      const distance = Math.min(80, diff * 0.4);
      setPullDistance(distance);
      // Suppress default pull actions on mobile
      if (diff > 10 && e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 50 && onRefresh && !loading) {
      onRefresh();
    }
    setPullDistance(0);
    setIsPullingReady(false);
  };

  // Map Locator features state
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [mapCityQuery, setMapCityQuery] = useState('Київ');
  const [mapCities, setMapCities] = useState<any[]>([]);
  const [selectedMapCity, setSelectedMapCity] = useState<any | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [searchWarehouseQuery, setSearchWarehouseQuery] = useState('');
  const [citySearching, setCitySearching] = useState(false);

  // Retrieve API Key for NP searches
  const getApiKey = () => {
    try {
      const saved = localStorage.getItem('np_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].apiKey;
        }
      }
    } catch (e) {}
    return '';
  };

  // Pre-fetch cities when the map query changes
  useEffect(() => {
    if (!isMapOpen) return;
    const apiKey = getApiKey();
    if (!apiKey) return;

    const delayDebounce = setTimeout(async () => {
      if (!mapCityQuery.trim()) {
        setMapCities([]);
        return;
      }
      setCitySearching(true);
      try {
        const res = await searchCities(apiKey, mapCityQuery);
        setMapCities(res || []);
      } catch (err) {
        console.error(err);
      } finally {
        setCitySearching(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [mapCityQuery, isMapOpen]);

  // Load Kyiv by default when the map opens
  useEffect(() => {
    if (!isMapOpen) return;
    const apiKey = getApiKey();
    if (!apiKey) return;

    const loadKyiv = async () => {
      setLoadingWarehouses(true);
      try {
        const cities = await searchCities(apiKey, 'Київ');
        if (cities && cities.length > 0) {
          const kyiv = cities[0];
          setSelectedMapCity(kyiv);
          setMapCityQuery(kyiv.Description);
          const wRes = await getWarehouses(apiKey, kyiv.Ref);
          setWarehouses(wRes || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingWarehouses(false);
      }
    };

    loadKyiv();
  }, [isMapOpen]);

  const handleSelectCity = async (city: any) => {
    setSelectedMapCity(city);
    setMapCityQuery(city.Description);
    setMapCities([]);
    setSearchWarehouseQuery('');
    
    const apiKey = getApiKey();
    if (!apiKey) return;

    setLoadingWarehouses(true);
    try {
      const wRes = await getWarehouses(apiKey, city.Ref);
      setWarehouses(wRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getEmailInitials = (email?: string | null) => {
    if (!email) return '👤';
    const namePart = email.split('@')[0];
    if (!namePart) return '👤';
    
    // Try to find uppercase letters
    const caps = namePart.replace(/[^A-Z]/g, '');
    if (caps.length >= 2) {
      return caps.slice(0, 2);
    }
    
    // Otherwise split by dot, underscore, dash
    const parts = namePart.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    
    return namePart.slice(0, 2).toUpperCase();
  };

  const filteredWarehouses = warehouses.filter((w) => {
    if (!searchWarehouseQuery) return true;
    const query = searchWarehouseQuery.toLowerCase();
    return (
      w.Description.toLowerCase().includes(query) ||
      (w.Number && String(w.Number).includes(query))
    );
  });

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
                Головна (Посилки)
             </div>
             {onCreateTtn && (
                <div onClick={onCreateTtn} className="flex items-center gap-3 px-3 py-2.5 text-[#a5acb5] hover:bg-white/5 hover:text-white rounded-lg cursor-pointer font-medium text-sm transition-colors">
                   <FileText className="w-4 h-4 text-emerald-400" />
                   Створити посилку
                </div>
             )}
             <div onClick={onAddTtn} className="flex items-center gap-3 px-3 py-2.5 text-[#a5acb5] hover:bg-white/5 hover:text-white rounded-lg cursor-pointer font-medium text-sm transition-colors">
                <Plus className="w-4 h-4" />
                Додати ТТН вручну
             </div>
             <div onClick={() => setIsMapOpen(true)} className="flex items-center gap-3 px-3 py-2.5 text-[#a5acb5] hover:bg-white/5 hover:text-white rounded-lg cursor-pointer font-medium text-sm transition-colors">
                <MapPin className="w-4 h-4" />
                Мапа відділень
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
          <main 
            ref={mainRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto no-scrollbar relative w-full h-full pb-[84px] lg:pb-0"
          >
            {/* Pull-to-refresh & Loading indicator */}
            {(pullDistance > 0 || loading) && (
              <div 
                style={{ 
                  height: loading ? '54px' : `${pullDistance}px`, 
                  opacity: loading ? 1 : Math.min(1, pullDistance / 40) 
                }}
                className="flex items-center justify-center w-full transition-all duration-150 overflow-hidden shrink-0 bg-transparent mt-2 self-center z-40"
              >
                <div className="flex items-center gap-2 bg-[#20313c]/90 border border-[#1b2b35] rounded-full px-4 py-2 text-xs font-bold shadow-lg shadow-black/25">
                  <RefreshCw className={`w-4 h-4 text-[#e33745] ${loading ? 'animate-spin' : pullDistance > 55 ? 'rotate-180 transition-all duration-200' : ''}`} />
                  <span className="text-gray-200 font-semibold">
                    {loading ? 'Оновлення...' : pullDistance > 55 ? 'Відпустіть для оновлення' : 'Потягніть для оновлення'}
                  </span>
                </div>
              </div>
            )}
            
            <div className="p-0 lg:p-8 flex-1 flex flex-col max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
          
          {/* Mobile Bottom Nav - Styled exactly like the uploaded screenshot */}
          <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-[#111d24] border-t border-[#1b2b35]/40 pt-2 px-2 flex justify-around items-end text-[11px] text-[#7d8c97] font-semibold z-50 h-[76px] shadow-[0_-8px_24px_rgba(0,0,0,0.3)] select-none">
            
            {/* 1. Посилки */}
            <div className="flex flex-col items-center justify-center w-16 h-[54px] cursor-pointer text-white pb-1">
              <Box className="w-6 h-6 stroke-[1.8]" />
              <span className="text-[10px] mt-1 font-semibold tracking-wide">Посилки</span>
            </div>

            {/* 2. Відстежити ТТН */}
            <div 
              className="flex flex-col items-center justify-center w-20 h-[54px] cursor-pointer hover:text-white text-[#7d8c97] transition-all pb-1"
              onClick={onAddTtn}
            >
              <div className="relative">
                <Barcode className="w-6 h-6 stroke-[1.8]" />
              </div>
              <span className="text-[9.5px] mt-1 font-semibold tracking-wide text-center leading-tight whitespace-nowrap">Відстежити ТТН</span>
            </div>

            {/* 3. "Відправити" (Red Central Plus button) */}
            <div 
              className="flex flex-col items-center justify-center w-[72px] h-[64px] cursor-pointer pb-1"
              onClick={onCreateTtn}
            >
              <div className="w-10 h-10 rounded-full bg-[#e33745] hover:bg-[#c92f3a] text-white flex items-center justify-center shadow-lg shadow-red-950/40 border border-red-700/30 transition-all transform active:scale-95">
                <Plus className="w-5.5 h-5.5 stroke-[2.5]" />
              </div>
              <span className="text-[10px] mt-1 font-bold tracking-wide text-[#e33745]">Відправити</span>
            </div>

            {/* 4. Мапа */}
            <div 
              className="flex flex-col items-center justify-center w-16 h-[54px] cursor-pointer hover:text-white text-[#7d8c97] transition-all pb-1"
              onClick={() => setIsMapOpen(true)}
            >
              <MapPin className="w-6 h-6 stroke-[1.8]" />
              <span className="text-[10px] mt-1 font-semibold tracking-wide">Мапа</span>
            </div>

            {/* 5. Профіль */}
            <div 
              className="flex flex-col items-center justify-center w-16 h-[54px] cursor-pointer hover:text-white text-[#7d8c97] transition-all pb-1"
              onClick={onManageAccounts}
            >
              <div className="w-6 h-6 rounded-full bg-[#3d4b53]/80 flex items-center justify-center text-[9px] font-bold text-white tracking-tighter uppercase border border-gray-650 shrink-0">
                {getEmailInitials(user?.email)}
              </div>
              <span className="text-[10px] mt-1 font-semibold tracking-wide">Профіль</span>
            </div>

            {/* Sublte iOS home indicator simulated bar at the bottom center to match the visual in the screenshot */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-750/30 rounded-full sm:hidden"></div>
          </nav>
      </div>

      {/* Map modal for branch locator */}
      {isMapOpen && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-0 sm:p-4"
          onClick={() => setIsMapOpen(false)}
        >
          <div 
            className="bg-[#111d24] text-white w-full max-w-[480px] h-[100dvh] sm:h-[650px] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Handle for mobile swipe indicator look */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-12 h-1.5 bg-gray-800 rounded-full"></div>
            </div>

            {/* Header */}
            <div className="p-6 pb-4 flex items-center justify-between border-b border-gray-900/30 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Пошук відділень</h3>
                <p className="text-xs text-gray-400 mt-1">Знайдіть найближче відділення Нової Пошти</p>
              </div>
              <button 
                onClick={() => setIsMapOpen(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-all shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input for City */}
            <div className="p-5 pb-3 border-b border-gray-900/30 bg-[#16252f]/30 shrink-0 relative">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Введіть ваше місто (наприклад: Львів, Одеса...)"
                  value={mapCityQuery}
                  onChange={(e) => {
                    setMapCityQuery(e.target.value);
                    setSelectedMapCity(null);
                  }}
                  className="w-full bg-[#1b2b35] border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e33745] transition-all font-medium"
                />
                {citySearching && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {/* City Suggestions dropdown list */}
              {mapCities.length > 0 && !selectedMapCity && (
                <div className="absolute z-[110] left-5 right-5 mt-1 bg-[#1b2b35] border border-gray-800 rounded-xl max-h-[180px] overflow-y-auto shadow-2xl py-1 divide-y divide-gray-800/60 no-scrollbar">
                  {mapCities.map((city) => (
                    <button
                      key={city.Ref}
                      onClick={() => handleSelectCity(city)}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#20313c]/60 text-sm font-semibold text-gray-200 transition-colors flex items-center justify-between"
                    >
                      <span>{city.Description}</span>
                      <span className="text-[10px] text-gray-500 font-normal">{city.AreaDescription || 'Область'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Warehouse Filter */}
            {selectedMapCity && (
              <div className="px-5 py-2 border-b border-gray-900/30 bg-[#13212b]/60 shrink-0 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Фільтр за номером або назвою відділення..."
                  value={searchWarehouseQuery}
                  onChange={(e) => setSearchWarehouseQuery(e.target.value)}
                  className="bg-transparent border-none text-xs text-gray-300 placeholder-gray-550 focus:ring-0 p-0 w-full focus:outline-none font-medium"
                />
                {searchWarehouseQuery && (
                  <button onClick={() => setSearchWarehouseQuery('')} className="text-gray-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Warehouses list content */}
            <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-gray-800/40 no-scrollbar relative min-h-0">
              {loadingWarehouses ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                  <div className="w-10 h-10 border-2 border-[#e33745]/30 border-t-[#e33745] rounded-full animate-spin"></div>
                  <span className="text-xs font-semibold">Завантаження списку відділень...</span>
                </div>
              ) : selectedMapCity ? (
                filteredWarehouses.length > 0 ? (
                  filteredWarehouses.map((w, idx) => (
                    <div key={w.Ref || idx} className="py-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-semibold text-xs sm:text-sm text-gray-150 flex items-start gap-1.5 leading-tight">
                          <span className="px-1.5 py-0.5 bg-gray-800 text-[#e33745] text-[9px] font-bold rounded shrink-0 border border-gray-700/80 mt-0.5">
                            №{w.Number || (idx + 1)}
                          </span>
                          <span>{w.Description}</span>
                        </div>
                      </div>
                      
                      <div className="text-[11px] text-gray-400 font-light flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span>{selectedMapCity.Description}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <button
                            onClick={() => handleCopy(w.Description, idx)}
                            className="p-1 px-2 rounded bg-gray-800/60 hover:bg-gray-800 hover:text-white transition-all text-[10px] font-semibold flex items-center gap-1 border border-gray-700/60"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400 font-bold">Скопійовано</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Скопіювати</span>
                              </>
                            )}
                          </button>
                          
                          <a
                            href={`https://maps.google.com/?q=Нова+Пошта+${encodeURIComponent(selectedMapCity.Description + ' ' + w.Description)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 px-2 rounded bg-[#e33745]/10 text-[#e33745] hover:bg-[#e33745] hover:text-white transition-all text-[10px] font-semibold flex items-center gap-1 border border-[#e33745]/20"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Гугл карта</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 text-gray-400 italic text-xs font-semibold">
                    {searchWarehouseQuery ? 'Нічого не знайдено за вашим фільтром' : 'У цьому місті немає відділень'}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-20 text-gray-400 px-6 gap-3">
                  <Globe className="w-12 h-12 text-gray-700 stroke-[1]" />
                  <p className="text-xs font-semibold leading-relaxed">
                    Будь ласка, вкажіть ваше місто в полі пошуку вище для автоматичного завантаження відділень через API Нової Пошти.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Footer Action */}
            <div className="p-5 border-t border-gray-900/35 shrink-0 bg-[#0d171d]/20">
              <button
                type="button"
                onClick={() => setIsMapOpen(false)}
                className="w-full bg-[#e33745] hover:bg-[#c92f3a] text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-colors shadow-lg cursor-pointer text-center"
              >
                Зрозуміло
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
