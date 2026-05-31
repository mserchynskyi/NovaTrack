import { useState, useMemo } from 'react';
import { Parcel } from '../types';
import { Package, Truck, CheckCircle2, AlertCircle, RefreshCw, Box, MapPin, Calendar, Wallet, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { motion } from 'motion/react';
import { ParcelDetailsModal } from './ParcelDetailsModal';

interface DashboardProps {
  parcels: Parcel[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  lastRefresh: Date | null;
}

export function Dashboard({ parcels, loading, error, onRefresh, lastRefresh }: DashboardProps) {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('Date (Newest)');
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  
  const getStatusColorTheme = (statusCode: string) => {
    const code = Number(statusCode);
    if (code === 1) return "bg-gray-50 text-gray-700";
    if ([2, 3, 102, 103, 108].includes(code)) return "bg-red-50 text-red-700";
    if ([9, 10, 11, 14].includes(code)) return "bg-green-50 text-green-700";
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

     // Apply Filter
     if (filterStatus !== 'All') {
         result = result.filter(p => {
             const code = Number(p.statusCode);
             if (filterStatus === 'Pending') return code === 1;
             if (filterStatus === 'Delivered') return [9, 10, 11, 14].includes(code);
             if (filterStatus === 'Issues') return [2, 3, 102, 103, 108].includes(code);
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
             if (filterStatus === 'In Transit') return ![1, 2, 3, 7, 8, 9, 10, 11, 14, 102, 103, 108].includes(code);
             return true;
         });
     }

     // Apply Sort
     result = [...result].sort((a, b) => {
          if (sortBy === 'Date (Newest)') return parseDateString(b.dateCreated) - parseDateString(a.dateCreated);
          if (sortBy === 'Date (Oldest)') return parseDateString(a.dateCreated) - parseDateString(b.dateCreated);
          if (sortBy === 'Tracking (Asc)') return a.ttn.localeCompare(b.ttn);
          if (sortBy === 'Tracking (Desc)') return b.ttn.localeCompare(a.ttn);
          return 0;
     });

     return result;
  }, [parcels, filterStatus, sortBy]);


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
      <div className="flex flex-col landscape:flex-row lg:flex-row justify-between items-stretch landscape:items-center lg:items-center gap-3 shrink-0 bg-transparent lg:bg-white p-4 pb-2 lg:p-3 lg:pb-3 rounded-none lg:rounded border-none lg:border lg:border-gray-200 shadow-none lg:shadow-sm">
        <div className="flex items-center gap-3 flex-nowrap w-full lg:w-auto">
           <h2 className="text-[14px] font-bold text-gray-900 uppercase tracking-tight hidden lg:block">Active Tracking</h2>
           <div className="flex items-center gap-2 text-xs flex-1 lg:flex-none">
              <SlidersHorizontal className="w-4 h-4 text-gray-400 hidden lg:block" />
              <select 
                  className="w-full bg-[#262c33] lg:bg-gray-50 border border-[#30373e] lg:border-gray-200 rounded-lg lg:rounded px-3 py-2.5 lg:py-1.5 focus:outline-none focus:border-red-500 lg:focus:border-red-400 text-gray-200 lg:text-gray-700 font-medium"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
              >
                  <option value="All">Всі статуси</option>
                  <option value="Pending">Очікують</option>
                  <option value="In Transit">В дорозі</option>
                  <option value="At Branch">У відділенні</option>
                  <option value="Stored 5+ Days">Зберігається 5+ днів</option>
                  <option value="Delivered">Отримані</option>
                  <option value="Issues">Проблемні</option>
              </select>
           </div>
           
           <div className="flex items-center gap-2 text-xs flex-1 lg:flex-none">
              <ArrowUpDown className="w-4 h-4 text-gray-400 hidden lg:block" />
              <select 
                  className="w-full bg-[#262c33] lg:bg-gray-50 border border-[#30373e] lg:border-gray-200 rounded-lg lg:rounded px-3 py-2.5 lg:py-1.5 focus:outline-none focus:border-red-500 lg:focus:border-red-400 text-gray-200 lg:text-gray-700 font-medium"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
              >
                  <option value="Date (Newest)">Новіші</option>
                  <option value="Date (Oldest)">Старіші</option>
                  <option value="Tracking (Asc)">ТТН (зрост)</option>
                  <option value="Tracking (Desc)">ТТН (спад)</option>
              </select>
           </div>
        </div>

        <div className="flex items-center gap-2 w-full landscape:w-auto lg:w-auto shrink-0 justify-end">
          <button 
            onClick={onRefresh} 
            disabled={loading}
            className="flex items-center justify-center gap-1.5 bg-[#e33745]/10 lg:bg-gray-50 border border-[#e33745]/30 lg:border-gray-200 px-4 lg:px-3 py-2.5 lg:py-1.5 rounded-lg lg:rounded text-xs font-medium hover:bg-[#e33745]/20 lg:hover:bg-gray-100 disabled:opacity-50 transition-colors text-[#e33745] lg:text-gray-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Оновлення...' : 'Оновити'}</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 flex flex-col min-h-0 bg-transparent lg:bg-white lg:border lg:border-gray-200 lg:rounded lg:shadow-sm lg:overflow-hidden">
        {filteredAndSortedParcels.length === 0 && !loading && !error && (
          <div className="text-center py-12 lg:bg-white rounded lg:border lg:border-gray-200">
            <Package className="w-10 h-10 text-gray-500 lg:text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 lg:text-gray-500 text-xs">No parcels found matching criteria</p>
          </div>
        )}
        
        {loading && parcels.length === 0 && (
           <div className="text-center py-12 lg:bg-white rounded lg:border lg:border-gray-200">
               <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
               <p className="text-gray-500 text-xs">Fetching records...</p>
           </div>
        )}

        {filteredAndSortedParcels.length > 0 && (
          <div className="overflow-y-auto overflow-x-hidden lg:overflow-auto flex-1 pb-20 lg:pb-0 no-scrollbar">
            {/* Desktop View */}
            <div className="hidden lg:block min-w-[800px]">
              {/* Header Row (fake table) */}
              <div className="bg-gray-50 sticky top-0 border-b border-gray-200 z-10 flex text-[10px] uppercase text-gray-400 font-bold tracking-wider">
                <div className="px-4 py-3 w-40 shrink-0">Tracking ID</div>
                <div className="px-4 py-3 w-40 shrink-0">Account</div>
                <div className="px-4 py-3 w-32 shrink-0">Status</div>
                <div className="px-4 py-3 flex-1 min-w-[200px]">Recipient / Route</div>
                <div className="px-4 py-3 w-28 shrink-0">Cost</div>
                <div className="px-4 py-3 w-28 shrink-0 text-right">Estimated</div>
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
                      className="flex hover:bg-gray-50 group cursor-pointer text-xs transition-colors items-center"
                  >
                      {/* Tracking */}
                      <div className="px-4 py-2.5 w-40 shrink-0 font-mono text-red-600 font-medium group-hover:underline">
                        {parcel.ttn}
                      </div>

                      {/* Account */}
                      <div className="px-4 py-2.5 w-40 shrink-0 flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded bg-gray-200 text-[8px] flex items-center justify-center text-gray-600 font-bold shrink-0">
                          {parcel.accountName.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate flex-1" title={parcel.accountName}>{parcel.accountName}</span>
                      </div>

                      {/* Status */}
                      <div className="px-4 py-2.5 w-32 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase inline-block truncate max-w-[120px] ${getStatusColorTheme(parcel.statusCode)}`} title={parcel.status}>
                            {parcel.status}
                        </span>
                      </div>

                      {/* Route/Details */}
                      <div className="px-4 py-2.5 flex-1 min-w-[200px] flex flex-col gap-0.5 justify-center">
                        <div className="font-medium text-gray-900 truncate" title={parcel.recipient}>
                          {parcel.recipient}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate" title={`${parcel.sender} → ${parcel.cityName}`}>
                          {parcel.cityName}
                        </div>
                      </div>

                      {/* Cost */}
                      <div className="px-4 py-2.5 w-28 shrink-0 text-gray-600">
                        {parcel.cost} ₴
                      </div>

                      {/* Date */}
                      <div className="px-4 py-2.5 w-28 shrink-0 text-right text-gray-400">
                        {parcel.actualDeliveryDate || parcel.estimatedDeliveryDate || '-'}
                      </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden divide-y divide-[#32363b] bg-[#292D32] overflow-hidden pb-6">
              {filteredAndSortedParcels.map((parcel, idx) => {
                 const initials = getInitials(parcel.recipient);
                 const ttnSuffix = "'" + parcel.ttn.slice(-4);
                 
                 const code = Number(parcel.statusCode);
                 let progress = 50;
                 let progressColor = "bg-[#25c468]";
                 if (code === 1) progress = 10;
                 else if ([7, 8, 9, 10, 11, 14].includes(code)) progress = 100;

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
                        className="px-4 py-4 flex gap-4 cursor-pointer active:bg-[#32373e] transition-colors"
                    >
                        <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                            <div className="w-12 h-12 rounded-full bg-[#96bdd1] text-[#1b2b35] flex items-center justify-center text-[17px] font-medium tracking-wide">
                                {initials}
                            </div>
                            <div className="text-[12px] text-[#a5acb5] font-mono tracking-wider">{ttnSuffix}</div>
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="text-[15px] font-semibold text-gray-100 leading-snug drop-shadow-sm mb-1 pr-2 tracking-tight">
                                {parcel.status}
                            </div>
                            <div className="text-[#a5acb5] text-[14px] truncate tracking-tight">
                                до {parcel.recipient}
                            </div>
                            <div className="text-[#a5acb5] text-[14px] truncate mb-3 tracking-tight">
                                {parcel.sender}
                            </div>
                            
                            {/* Progress Bar Container */}
                            <div className="pr-4 mt-1">
                                <div className="relative w-full h-[3px] bg-[#43484e] rounded-full mb-3 flex items-center">
                                    <div 
                                        className={`h-[3px] rounded-full ${progressColor} relative`} 
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${progressColor} shadow-[0_0_0_2px_#292D32] translate-x-1/2`}></div>
                                    </div>
                                </div>
                                
                                {/* Bottom texts */}
                                <div className="mt-2.5 flex justify-between items-center text-[12px] text-[#868d96] font-medium tracking-wide">
                                    <div className="truncate pr-2">
                                        Відправка · {dateCreated}
                                    </div>
                                    <div className="truncate text-right">
                                        {parcel.cityName} · {dateEst}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                 );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedParcel && (
          <ParcelDetailsModal parcel={selectedParcel} onClose={() => setSelectedParcel(null)} />
      )}
    </div>
  );
}

