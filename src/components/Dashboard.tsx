import { useState, useMemo, useEffect, useRef } from 'react';
import { Parcel, NpAccount } from '../types';
import { Package, Truck, CheckCircle2, AlertCircle, RefreshCw, Box, MapPin, Calendar, Wallet, SlidersHorizontal, ArrowUpDown, Search, X, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { ParcelDetailsModal } from './ParcelDetailsModal';

interface DashboardProps {
  parcels: Parcel[];
  loading: boolean;
  error: string | null;
  onRefresh: (force?: boolean) => void;
  lastRefresh: Date | null;
  onDeleteManualTtn: (ttn: string) => void;
  onUpdateManualTtn?: (ttn: string, phone?: string, accountId?: string) => void;
  autoSelectTtn?: string | null;
  onAutoSelectClear?: () => void;
  onAddManualTtn?: (ttn: string) => void;
  accounts: NpAccount[];
  onCreateTtn?: () => void;
}

export function Dashboard({ parcels, loading, error, onRefresh, lastRefresh, onDeleteManualTtn, onUpdateManualTtn, autoSelectTtn, onAutoSelectClear, onAddManualTtn, accounts, onCreateTtn }: DashboardProps) {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterDate, setFilterDate] = useState<string>('AllTime');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [sortBy, setSortBy] = useState<string>('DateCreated (Newest)');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const prevLoading = useRef(loading);

  useEffect(() => {
    if (autoSelectTtn) {
        const found = parcels.find(p => p.ttn === autoSelectTtn);
        if (found) {
            setSelectedParcel(found);
            if (onAutoSelectClear) onAutoSelectClear();
        } else if (prevLoading.current && !loading) {
            if (onAutoSelectClear) onAutoSelectClear();
        }
    }
    prevLoading.current = loading;
  }, [autoSelectTtn, parcels, loading, onAutoSelectClear]);
  
  const getStatusColorTheme = (statusCode: string) => {
    const code = Number(statusCode);
    if (code === 1) return "bg-[var(--bg-card)] text-[var(--text-main)]";
    if ([2, 3, 102, 103].includes(code)) return "bg-red-50 text-red-700";
    if ([9, 10, 11, 14, 106, 108].includes(code)) return "bg-green-50 text-green-700";
    if ([7, 8].includes(code)) return "bg-orange-50 text-orange-700";
    return "bg-blue-50 text-blue-700";
  };

  const getInitials = (name: string) => {
      if (!name) return '';
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
          return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return (name[0] || '').toUpperCase();
  };

  const getAvatarColors = (name: string) => {
      if (!name) return 'bg-[#96bdd1] text-[var(--text-main)]';
      const firstLetter = name.trim().charAt(0).toUpperCase();
      const code = firstLetter.charCodeAt(0) || 0;
      const colors = [
          'bg-[#ffadad] text-[#8a1c1c]',
          'bg-[#ffd6a5] text-[#8a4e1c]',
          'bg-[#fdffb6] text-[#8a8a1c]',
          'bg-[#caffbf] text-[#1c8a1c]',
          'bg-[#9bf6ff] text-[#1c648a]',
          'bg-[#a0c4ff] text-[#1c308a]',
          'bg-[#bdb2ff] text-[#3e1c8a]',
          'bg-[#ffc6ff] text-[#8a1c8a]',
          'bg-[#ffb5a7] text-[#8a1c1c]',
          'bg-[#fec89a] text-[#8a4a1c]',
          'bg-[#fbe7c6] text-[#806c1c]',
          'bg-[#b4f8c8] text-[#1c7e2c]',
          'bg-[#a0e7e5] text-[#1c6865]',
          'bg-[#b5ead7] text-[#1c633a]',
      ];
      return colors[code % colors.length];
  };

  const formatDateDayMonth = (dateStr: string) => {
      if (!dateStr) return '';
      const datePart = dateStr.split(' ')[0] || dateStr;
      const parts = datePart.split(/[-.]/);
      if (parts.length === 3) {
         if (parts[0].length === 4) {
             // YYYY-MM-DD
             return `${parts[2]}.${parts[1]}`;
         } else if (parts[2].length === 4) {
             // DD.MM.YYYY or DD-MM-YYYY
             return `${parts[0]}.${parts[1]}`;
         }
         return `${parts[0]}.${parts[1]}`;
      }
      return dateStr;
  };

  const filteredAndSortedParcels = useMemo(() => {
     let result = parcels;

     const parseDateString = (d: string) => {
         if (!d) return 0;
         const datePart = d.split(' ')[0] || d;
         if (datePart.includes('.')) {
             const parts = datePart.split('.');
             if (parts.length === 3) {
                 return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
             }
         }
         const ts = new Date(d.replace(' ', 'T')).getTime();
         return isNaN(ts) ? 0 : ts;
     };

     // Apply Search Filter (real-time filtering by TTN, Recipient phone/last name, or Destination city)
     if (searchQuery.trim()) {
         const query = searchQuery.trim().toLowerCase();
         // Extract only digits for phone matching
         const phoneQuery = query.replace(/\D/g, '');
         const ttnQuery = query.replace(/\s+/g, '');

         result = result.filter(p => {
             const ttnMatch = p.ttn ? p.ttn.toLowerCase().replace(/\s+/g, '').includes(ttnQuery) : false;
             const recipientMatch = p.recipient ? p.recipient.toLowerCase().includes(query) : false;
             const senderMatch = p.sender ? p.sender.toLowerCase().includes(query) : false;
             const cityMatch = p.cityName ? p.cityName.toLowerCase().includes(query) : false;
             
             let phoneMatch = false;
             // Only try matching digits if there are at least 3 digits in the query (avoids false positives on addresses with numbers)
             if (phoneQuery.length >= 3) {
                 const phone1 = p.rawStatus?.PhoneRecipient ? String(p.rawStatus.PhoneRecipient).replace(/\D/g, '') : '';
                 const phone2 = p.rawDoc?.PhoneRecipient ? String(p.rawDoc.PhoneRecipient).replace(/\D/g, '') : '';
                 const senderPhone = p.rawStatus?.PhoneSender ? String(p.rawStatus.PhoneSender).replace(/\D/g, '') : '';
                 
                 phoneMatch = (phone1 && phone1.includes(phoneQuery)) || 
                              (phone2 && phone2.includes(phoneQuery)) || 
                              (senderPhone && senderPhone.includes(phoneQuery));
             } else {
                 // Fallback to basic string includes if no digit extraction makes sense
                 const phone1 = p.rawStatus?.PhoneRecipient ? String(p.rawStatus.PhoneRecipient).toLowerCase() : '';
                 const phone2 = p.rawDoc?.PhoneRecipient ? String(p.rawDoc.PhoneRecipient).toLowerCase() : '';
                 const senderPhone = p.rawStatus?.PhoneSender ? String(p.rawStatus.PhoneSender).toLowerCase() : '';
                 phoneMatch = phone1.includes(query) || phone2.includes(query) || senderPhone.includes(query);
             }
             
             return ttnMatch || recipientMatch || senderMatch || cityMatch || phoneMatch;
         });
     }

     // Apply Filter
     if (filterStatus !== 'All') {
         result = result.filter(p => {
             const code = Number(p.statusCode);
             if (filterStatus === 'Created') return [1, 3, 0].includes(code) || !p.statusCode || isNaN(code);
             if (filterStatus === 'Pending') return code === 1;
             if (filterStatus === 'Delivered') return [9, 10, 11, 14, 106, 108].includes(code);
             if (filterStatus === 'Issues') return [2, 3, 102, 103].includes(code);
             if (filterStatus === 'At Branch') return [7, 8].includes(code);
             if (filterStatus === 'Stored 5+ Days') {
                 if (![7, 8].includes(code)) return false;
                 
                 // ActualDeliveryDate is when it arrived at branch
                 const branchDate = parseDateString(p.actualDeliveryDate) || parseDateString(p.estimatedDeliveryDate);
                 if (branchDate === 0) return false;
                 
                 const msInDay = 1000 * 60 * 60 * 24;
                 const daysDiff = (Date.now() - branchDate) / msInDay;
                 return daysDiff >= 5;
             }
             if (filterStatus === 'In Transit') return ![1, 2, 3, 7, 8, 9, 10, 11, 14, 102, 103, 106, 108].includes(code);
             return true;
         });
     }

     // Apply Date Filter
     if (filterDate !== 'AllTime') {
         result = result.filter(p => {
             const ts = parseDateString(p.dateCreated);
             if (ts === 0) return false;
             
             const now = new Date();
             const msInDay = 1000 * 60 * 60 * 24;
             
             if (filterDate === 'Today') {
                 return (now.getTime() - ts) < msInDay;
             } else if (filterDate === 'Yesterday') {
                 const diff = now.getTime() - ts;
                 return diff >= msInDay && diff < msInDay * 2;
             } else if (filterDate === 'Last7Days') {
                 return (now.getTime() - ts) < msInDay * 7;
             } else if (filterDate === 'ThisMonth') {
                 const date = new Date(ts);
                 return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
             }
             return true;
         });
     }

     // Apply Sort
     result = [...result].sort((a, b) => {
          if (sortBy === 'DateCreated (Newest)') return parseDateString(b.dateCreated) - parseDateString(a.dateCreated);
          if (sortBy === 'DateCreated (Oldest)') return parseDateString(a.dateCreated) - parseDateString(b.dateCreated);
          if (sortBy === 'DeliveryDate (Newest)') {
              const dateB = parseDateString(b.actualDeliveryDate) || parseDateString(b.estimatedDeliveryDate);
              const dateA = parseDateString(a.actualDeliveryDate) || parseDateString(a.estimatedDeliveryDate);
              return dateB - dateA;
          }
          if (sortBy === 'DeliveryDate (Oldest)') {
              const dateB = parseDateString(b.actualDeliveryDate) || parseDateString(b.estimatedDeliveryDate);
              const dateA = parseDateString(a.actualDeliveryDate) || parseDateString(a.estimatedDeliveryDate);
              return dateA - dateB;
          }
          if (sortBy === 'City (A-Z)') return a.cityName.localeCompare(b.cityName);
          if (sortBy === 'City (Z-A)') return b.cityName.localeCompare(a.cityName);
          if (sortBy === 'Cost (Highest)') return parseFloat(b.announcedPrice || "0") - parseFloat(a.announcedPrice || "0");
          if (sortBy === 'Cost (Lowest)') return parseFloat(a.announcedPrice || "0") - parseFloat(b.announcedPrice || "0");
          return 0;
     });

     return result;
  }, [parcels, filterStatus, sortBy, searchQuery]);


  return (
    <div className="flex flex-col gap-0 lg:gap-6 h-full">
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded text-xs border border-red-200 flex flex-col gap-1 shrink-0">
            <div className="flex items-center gap-2 font-bold uppercase">
                <AlertCircle className="w-4 h-4" />
                <span>Error Loading Data</span>
            </div>
            <p className="opacity-90">{error}</p>
        </div>
      )}

      {/* Controls & Filters */}
      <div className="sticky top-0 z-30 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 shrink-0 bg-[var(--bg-nav)] p-4 pb-3 lg:p-3 rounded-none lg:rounded border-b border-[#25323d]/60 lg:border  shadow-md lg:shadow-sm">
        
        {/* Left Side: Search + Filters group */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
           {/* Real-time Search Box */}
           <div className="relative w-full sm:w-72 md:w-80 lg:w-96 shrink-0">
             <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
               <Search className="h-4 w-4 text-[var(--text-muted)]" />
             </span>
             <input
               type="text"
               autoComplete="off"
               autoCorrect="off"
               autoCapitalize="off"
               spellCheck="false"
               placeholder="Пошук за ТТН, телефоном, прізвищем, містом..."
               className="w-full pl-9 pr-8 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg py-2.5 lg:py-1.5 focus:outline-none focus:border-red-500 text-[var(--text-main)] font-medium text-xs placeholder:text-[var(--text-muted)]"
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
             />
             {searchQuery && (
               <button
                 type="button"
                 onClick={() => setSearchQuery('')}
                 className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"
               >
                 <X className="h-4 w-4" />
               </button>
             )}
           </div>

           {/* Select Dropdowns */}
           <div className="flex items-center gap-3 flex-nowrap w-full sm:w-auto text-xs">
              
              <div className="relative" ref={filterMenuRef}>
                 <div 
                   onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                   className="relative flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg h-[42px] lg:h-[30px] w-[42px] lg:w-[36px] shrink-0 hover:bg-[var(--bg-hover)] transition-colors group cursor-pointer" 
                   title="Фільтри"
                 >
                    <SlidersHorizontal className="w-4 h-4 text-[var(--text-main)] group-hover:text-red-500 transition-colors" />
                    {(filterStatus !== 'All' || filterDate !== 'AllTime') && (
                        <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full shadow-sm shadow-red-900/50"></div>
                    )}
                 </div>
                 
                 {isFilterMenuOpen && (
                   <div className="absolute top-full left-0 mt-2 w-56 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 p-3 flex flex-col gap-3 origin-top-left animate-in fade-in zoom-in-95 duration-100">
                     <div className="flex flex-col gap-1.5">
                       <label className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider px-1">За статусом</label>
                       <select 
                           className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-2.5 py-2 focus:outline-none focus:border-red-500 text-[var(--text-main)] text-sm"
                           value={filterStatus}
                           onChange={e => setFilterStatus(e.target.value)}
                       >
                           <option value="All">Всі статуси</option>
                           <option value="Created">Створені</option>
                           <option value="Pending">Очікують</option>
                           <option value="In Transit">В дорозі</option>
                           <option value="At Branch">У відділенні</option>
                           <option value="Stored 5+ Days">Зберігається 5+ днів</option>
                           <option value="Delivered">Отримані</option>
                           <option value="Issues">Проблемні</option>
                       </select>
                     </div>
                     <div className="flex flex-col gap-1.5">
                       <label className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider px-1">За датою відправки</label>
                       <select 
                           className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-2.5 py-2 focus:outline-none focus:border-red-500 text-[var(--text-main)] text-sm"
                           value={filterDate}
                           onChange={e => setFilterDate(e.target.value)}
                       >
                           <option value="AllTime">За весь час</option>
                           <option value="Today">Сьогодні</option>
                           <option value="Yesterday">Вчора</option>
                           <option value="Last7Days">За тиждень</option>
                           <option value="ThisMonth">Цього місяця</option>
                       </select>
                     </div>
                   </div>
                 )}
              </div>
              
              <div className="flex items-center gap-2 text-xs flex-1 sm:flex-none">
                 <ArrowUpDown className="w-4 h-4 text-[var(--text-muted)] hidden lg:block" />
                 <select 
                     className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 lg:py-1.5 focus:outline-none focus:border-red-500 text-[var(--text-main)] font-medium text-xs"
                     value={sortBy}
                     onChange={e => setSortBy(e.target.value)}
                 >
                     <option value="DateCreated (Newest)">Дата відпр. (новіші)</option>
                     <option value="DateCreated (Oldest)">Дата відпр. (старіші)</option>
                     <option value="DeliveryDate (Newest)">Дата дост. (новіші)</option>
                     <option value="DeliveryDate (Oldest)">Дата дост. (старіші)</option>
                     <option value="City (A-Z)">Місто (А-Я)</option>
                     <option value="City (Z-A)">Місто (Я-А)</option>
                     <option value="Cost (Highest)">Вартість (найвища)</option>
                     <option value="Cost (Lowest)">Вартість (найнижча)</option>
                 </select>
              </div>
           </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 w-full landscape:w-auto lg:w-auto shrink-0 justify-end">
          <button 
            onClick={() => onRefresh(true)} 
            disabled={loading}
            className="flex items-center justify-center gap-1.5 bg-[#e33745]/10  border border-[#e33745]/30  px-4 lg:px-3 py-2.5 lg:py-1.5 rounded-lg lg:rounded text-xs font-medium hover:bg-[#e33745]/20  disabled:opacity-50 transition-colors text-[#e33745] "
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Оновлення...' : 'Оновити'}</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 flex flex-col min-h-0 bg-transparent  lg:border  lg:rounded lg:shadow-sm lg:overflow-hidden">
        {filteredAndSortedParcels.length === 0 && !loading && !error && (
          <div className="text-center py-12  rounded lg:border ">
            <Package className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-[var(--text-muted)]  text-xs">Не знайдено посилок, що відповідають критеріям</p>
          </div>
        )}
        
        {loading && parcels.length === 0 && (
           <div className="flex flex-col items-center justify-center py-24  lg:shadow-sm rounded-2xl lg:border border-[var(--border-color)]">
               <div className="w-16 h-16 bg-[#e33745]/5 rounded-2xl flex items-center justify-center mb-5 border border-[#e33745]/10 relative">
                   <Package className="w-8 h-8 text-[#e33745] animate-pulse" />
                   <div className="absolute inset-0 rounded-2xl border-2 border-[#e33745]/20 animate-ping opacity-20" />
               </div>
               <div className="flex flex-col items-center gap-2">
                   <p className="text-[var(--text-main)] font-medium text-sm">Завантаження даних</p>
                   <div className="flex gap-1.5">
                       <div className="w-1.5 h-1.5 rounded-full bg-[#e33745]/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                       <div className="w-1.5 h-1.5 rounded-full bg-[#e33745]/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                       <div className="w-1.5 h-1.5 rounded-full bg-[#e33745]/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                   </div>
               </div>
           </div>
        )}

        {filteredAndSortedParcels.length > 0 && (
          <div className="overflow-y-auto overflow-x-hidden lg:overflow-auto flex-1 pb-20 lg:pb-0 no-scrollbar">
            {/* Desktop View */}
            <div className="hidden lg:block min-w-[800px]">
              {/* Header Row (fake table) */}
              <div className="bg-[var(--bg-card)] sticky top-0 border-b border-[var(--border-color)] z-10 flex text-[10px] uppercase text-[var(--text-muted)] font-bold tracking-wider">
                <div className="px-4 py-3 w-40 shrink-0">ТТН</div>
                <div className="px-4 py-3 w-40 shrink-0">Профіль</div>
                <div className="px-4 py-3 w-56 shrink-0">Статус</div>
                <div className="px-4 py-3 flex-1 min-w-[200px]">Одержувач / Маршрут</div>
                <div className="px-4 py-3 w-28 shrink-0">Вартість</div>
                <div className="px-4 py-3 w-28 shrink-0 text-right">Очікується</div>
              </div>
              
              {/* Rows */}
              <div className="divide-y divide-gray-100">
                {filteredAndSortedParcels.map((parcel, idx) => (
                  <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.2), duration: 0.15 }}
                      key={parcel.ttn} 
                      onClick={() => setSelectedParcel(parcel)}
                      className="flex hover:bg-[var(--bg-card)] group cursor-pointer text-xs transition-colors items-center"
                  >
                      {/* Tracking */}
                      <div className="px-4 py-2.5 w-40 shrink-0 font-mono text-red-600 font-medium group-hover:underline">
                        {parcel.ttn}
                      </div>

                      {/* Account */}
                      <div className="px-4 py-2.5 w-40 shrink-0 flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded bg-[var(--bg-active-alpha)] text-[8px] flex items-center justify-center text-[var(--text-muted)] font-bold shrink-0">
                          {parcel.accountName.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate flex-1" title={parcel.accountName}>{parcel.accountName}</span>
                      </div>

                      {/* Status */}
                      <div className="px-4 py-2.5 w-56 shrink-0 flex items-center">
                        <span className={`px-2 py-1.5 rounded-md text-[10px] font-bold uppercase leading-snug break-words ${getStatusColorTheme(parcel.statusCode)}`} title={parcel.status}>
                            {parcel.status}
                        </span>
                      </div>

                      {/* Route/Details */}
                      <div className="px-4 py-2.5 flex-1 min-w-[200px] flex flex-col gap-0.5 justify-center">
                        <div className="font-medium text-[var(--text-main)] truncate" title={parcel.recipient}>
                          {parcel.recipient}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-2 flex-wrap" title={`${parcel.sender} → ${parcel.cityName}`}>
                          <span>{parcel.cityName}</span>
                          {parcel.basisTtn && (() => {
                            const hasRedirect = parcel.basisChain?.some((b: any) => b.rawStatus?.OwnerDocumentType === 'Redirecting');
                            const hasReturn = parcel.basisChain?.some((b: any) => b.rawStatus?.OwnerDocumentType === 'CargoReturn');
                            const parts = [];
                            if (hasRedirect) parts.push('Переадресація');
                            if (hasReturn || (!hasRedirect && !hasReturn)) parts.push('Повернення');
                            const badgeText = parts.join(' / ');
                            return (
                              <span className="px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200 text-[9px] font-bold tracking-wider uppercase inline-flex items-center gap-1 shrink-0">
                                {badgeText}
                              </span>
                            );
                          })()}
                        </div>
                        {parcel.basisChain && parcel.basisChain.length > 0 && parcel.basisChain.map((basis: any) => {
                          const isRedirect = basis.rawStatus?.OwnerDocumentType === 'Redirecting';
                          const isReturn = basis.rawStatus?.OwnerDocumentType === 'CargoReturn';
                          const title = isRedirect ? 'Переадресація' : (isReturn ? 'Повернення' : 'Переадресація / Повернення');
                          return (
                            <div key={basis.ttn} className="text-[11px] text-yellow-600 font-semibold mt-1 flex items-center gap-1">
                              <span>
                                  {title} (ТТН <span 
                                      className="underline decoration-dashed cursor-pointer hover:text-yellow-700 transition" 
                                      onClick={(e) => { e.stopPropagation(); onAddManualTtn?.(basis.ttn); }}
                                  >{basis.ttn}</span>):
                              </span>
                              <span className="font-bold">{basis.status || "Оформлюється"}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Cost */}
                      <div className="px-4 py-2.5 w-28 shrink-0 text-[var(--text-muted)]">
                        {parcel.cost} ₴
                      </div>

                      {/* Date */}
                      <div className="px-4 py-2.5 w-28 shrink-0 text-right text-[var(--text-muted)]">
                        {parcel.actualDeliveryDate || parcel.estimatedDeliveryDate || '-'}
                      </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden divide-y divide-[var(--border-color)] bg-[var(--bg-card-alt)] overflow-hidden pb-6">
              {filteredAndSortedParcels.map((parcel, idx) => {
                 const initials = getInitials(parcel.recipient);
                 const ttnSuffix = "'" + parcel.ttn.slice(-4);
                 
                 const code = Number(parcel.statusCode);
                 let progress = 50;
                 let progressColor = "bg-blue-500";
                 let showProgressBar = true;
                 
                 if (code === 1) {
                     progress = 10;
                     progressColor = "bg-[var(--text-muted)]";
                 } else if ([7, 8].includes(code)) {
                     progress = 100;
                     progressColor = "bg-orange-500";
                 } else if ([9, 10, 11, 14, 106, 108].includes(code)) {
                     showProgressBar = false;
                 } else if ([2, 3, 102, 103].includes(code)) {
                     progress = 100;
                     progressColor = "bg-red-500";
                 }

                 // Parse the locations slightly. Assuming "Відправка" -> "CityName" based on usual data.
                 // We don't have true sender city in standard parcel interface without extra fetch, 
                 // so we'll just format it cleanly 
                 const dateCreated = formatDateDayMonth(parcel.dateCreated);
                 const dateEst = formatDateDayMonth(parcel.actualDeliveryDate || parcel.estimatedDeliveryDate);

                 return (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.2 }}
                        key={parcel.ttn} 
                        onClick={() => setSelectedParcel(parcel)} 
                        className="px-4 py-4 flex gap-4 cursor-pointer active:bg-[var(--bg-active-alpha)] transition-colors"
                    >
                        <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                            <div className={`w-12 h-12 rounded-full ${getAvatarColors(parcel.recipient)} flex items-center justify-center text-[17px] font-medium tracking-wide`}>
                                {initials}
                            </div>
                            <div className="text-[12px] text-[var(--text-muted)] font-mono tracking-wider">{ttnSuffix}</div>
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="text-[15px] font-semibold text-[var(--text-main)] leading-snug mb-1 pr-2 tracking-tight flex flex-wrap items-center gap-2">
                                <span>{parcel.status}</span>
                                {parcel.basisTtn && (() => {
                                    const hasRedirect = parcel.basisChain?.some((b: any) => b.rawStatus?.OwnerDocumentType === 'Redirecting');
                                    const hasReturn = parcel.basisChain?.some((b: any) => b.rawStatus?.OwnerDocumentType === 'CargoReturn');
                                    const parts = [];
                                    if (hasRedirect) parts.push('Переадресація');
                                    if (hasReturn || (!hasRedirect && !hasReturn)) parts.push('Повернення');
                                    const badgeText = parts.join(' / ');
                                    return (
                                        <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-[var(--text-yellow-accent)] text-[10px] font-bold tracking-wider uppercase inline-flex items-center gap-1 shrink-0">
                                            {badgeText}
                                        </span>
                                    );
                                })()}
                            </div>
                            <div className="text-[var(--text-muted)] text-[14px] truncate tracking-tight">
                                до {parcel.recipient}
                            </div>
                            <div className="flex items-center gap-2 mb-3 mt-0.5">
                                <div className="text-[var(--text-muted)] text-[14px] truncate tracking-tight">
                                    {parcel.sender}
                                </div>
                                <div className="px-1.5 py-0.5 rounded border border-dashed border-blue-500/50 bg-blue-500/5 text-[var(--text-blue-accent)] text-[10px] font-medium tracking-wide shrink-0" title={`Додано з акаунту: ${parcel.accountName}`}>
                                    {parcel.accountName}
                                </div>
                            </div>

                            {parcel.basisChain && parcel.basisChain.length > 0 && parcel.basisChain.map((basis: any) => {
                                const isRedirect = basis.rawStatus?.OwnerDocumentType === 'Redirecting';
                                const isReturn = basis.rawStatus?.OwnerDocumentType === 'CargoReturn';
                                const title = isRedirect ? 'Переадресація' : (isReturn ? 'Повернення' : 'Переадресація / Повернення');
                                return (
                                    <div key={basis.ttn} className="mb-3 mr-4 bg-[#febb14]/10 border border-[#febb14]/20 rounded-xl px-3 py-2 text-[var(--text-yellow-accent)] flex flex-col gap-0.5">
                                        <div className="font-semibold flex items-center gap-1.5 text-xs">
                                            {title} (ТТН <span 
                                                className="underline decoration-dashed cursor-pointer hover:opacity-80 transition" 
                                                onClick={(e) => { e.stopPropagation(); onAddManualTtn?.(basis.ttn); }}
                                            >{basis.ttn}</span>)
                                        </div>
                                        <div className="text-[11px] opacity-90 font-medium">
                                            Статус: <span className="font-bold">{basis.status || 'У процесі оформлення'}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {showProgressBar && (
                                <div className="pr-4 mt-1">
                                    <div className="relative w-full h-[3px] bg-[var(--progress-track)] rounded-full mb-3 flex items-center">
                                        <div 
                                            className={`h-[3px] rounded-full ${progressColor} relative`} 
                                            style={{ width: `${progress}%` }}
                                        >
                                            <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${progressColor} shadow-[0_0_0_2px_var(--bg-card-alt)] translate-x-1/2`}></div>
                                        </div>
                                    </div>
                                    
                                    {/* Bottom texts */}
                                    <div className="mt-2.5 flex justify-between items-center text-[12px] text-[var(--text-muted)] font-medium tracking-wide">
                                        <div className="truncate pr-2">
                                            {parcel.rawStatus?.CitySender || 'Відправка'} · {dateCreated}
                                        </div>
                                        <div className="truncate text-right">
                                            {parcel.cityName} · {dateEst}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                 );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedParcel && (
          <ParcelDetailsModal 
              parcel={selectedParcel} 
              accounts={accounts}
              onRefresh={onRefresh}
              onClose={() => setSelectedParcel(null)} 
              onDeleteManualTtn={selectedParcel.isManual ? () => {
                   onDeleteManualTtn(selectedParcel.ttn);
                   setSelectedParcel(null);
              } : undefined}
              onUpdateManualTtn={selectedParcel.isManual ? (phone?: string, accountId?: string) => {
                   if (onUpdateManualTtn) onUpdateManualTtn(selectedParcel.ttn, phone, accountId);
              } : undefined}
          />
      )}

      {autoSelectTtn && loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
              <div className="bg-[var(--bg-card-alt)] p-8 rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col items-center gap-5">
                  <RefreshCw className="w-10 h-10 text-[#e33745] animate-spin" />
                  <div className="text-[var(--text-main)] font-medium text-[15px] tracking-wide">Отримання даних...</div>
              </div>
          </div>
      )}
    </div>
  );
}

