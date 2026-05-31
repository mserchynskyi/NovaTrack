import { X, MapPin, Calendar, Box, User, UserCheck, Scale, CreditCard, Phone } from 'lucide-react';
import { Parcel } from '../types';

interface ParcelDetailsProps {
    parcel: Parcel;
    onClose: () => void;
}

export function ParcelDetailsModal({ parcel, onClose }: ParcelDetailsProps) {
    if (!parcel) return null;

    const parsePayer = () => {
        if (parcel.rawStatus?.PayerType === 'Sender') return 'Відправник';
        if (parcel.rawStatus?.PayerType === 'Recipient') return 'Одержувач';
        return parcel.rawStatus?.PayerType || 'Не визначено';
    };

    const getBackwardDeliveryInfo = () => {
        const cleanVal = (val: any) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const cleaned = val.replace(',', '.').replace(/[^\d.]/g, '');
                return parseFloat(cleaned) || 0;
            }
            return 0;
        };

        const sum = cleanVal(parcel.rawStatus?.BackwardDeliveryMoney) || 
                    cleanVal(parcel.rawStatus?.BackwardDeliverySum) || 
                    cleanVal(parcel.rawStatus?.RedeliverySum) ||
                    cleanVal(parcel.rawStatus?.AfterpaymentOnGoodsCost) ||
                    cleanVal(parcel.rawDoc?.BackwardDeliverySum) ||
                    0;

        if (sum <= 0) return null;

        const isControl = 
            JSON.stringify(parcel.rawStatus).toLowerCase().includes('контроль') || 
            JSON.stringify(parcel.rawDoc).toLowerCase().includes('контроль') ||
            (parcel.rawStatus?.ServiceType || '').toLowerCase().includes('control') ||
            (parcel.rawDoc?.ServiceType || '').toLowerCase().includes('control');
            
        return {
            amount: sum,
            label: isControl ? 'Контроль оплати' : 'Післяплата',
            isControl
        };
    };

    const backwardInfo = getBackwardDeliveryInfo();

    return (
        <div 
           className="fixed inset-0 bg-black/40 lg:bg-black/60 lg:backdrop-blur-sm z-50 flex items-end landscape:items-center lg:items-center justify-center p-0 lg:p-6"
           onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Mobile View */}
            <div className="lg:hidden bg-[#1b2b35] w-full max-w-[400px] landscape:max-w-[640px] h-[85dvh] landscape:h-[92dvh] sm:h-[600px] rounded-t-[2.5rem] landscape:rounded-[1.5rem] sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300 ring-1 ring-gray-800">
                <div className="flex justify-center pt-3 pb-1 shrink-0 landscape:hidden">
                   <div className="w-12 h-1.5 bg-[#32363b] rounded-full"></div>
                </div>
                <div className="px-6 py-4 landscape:py-3.5 border-b border-[#32363b] flex items-center justify-between shrink-0 bg-[#1b2b35]">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#e33745] p-2 rounded-xl shadow-md shadow-red-900/20">
                            <Box className="w-5 h-5 text-white stroke-[2]" />
                        </div>
                        <div>
                            <div className="font-mono font-bold text-lg text-white tracking-tight">{parcel.ttn}</div>
                            <div className="text-[10px] uppercase text-[#a5acb5] font-bold tracking-wider">{parcel.accountName}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-[#a5acb5] hover:text-white rounded-full transition-colors bg-[#292D32]">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-auto p-6 landscape:p-5 pb-28 landscape:pb-8 flex flex-col landscape:grid landscape:grid-cols-2 gap-6 landscape:gap-5 text-sm bg-[#1b2b35] no-scrollbar">
                    {/* Left Column in Landscape: Status and Route */}
                    <div className="flex flex-col gap-6 landscape:gap-4_5">
                        {/* Status Section */}
                        <div>
                            <div className="bg-[#292D32] p-5 landscape:p-4 rounded-2xl border border-[#32363b] shadow-sm">
                                <div className="font-bold text-lg text-white mb-2 leading-tight">{parcel.status}</div>
                                <div className="flex gap-4 text-xs text-[#a5acb5] pt-3 border-t border-[#32363b]">
                                    <div><span className="font-medium text-gray-400">Створено:</span> <br/>{parcel.dateCreated || '-'}</div>
                                    <div><span className="font-medium text-gray-400">Тип:</span> <br/>{parcel.rawStatus?.ServiceType || parcel.rawDoc?.ServiceType || 'Standard'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Route */}
                        <div className="grid grid-cols-1 gap-3 relative">
                            <div className="absolute left-[31px] top-10 bottom-10 w-[2px] bg-[#32363b] z-0"></div>
                            
                            <div className="bg-[#292D32] border border-[#32363b] rounded-2xl p-4 landscape:p-3 shadow-sm relative z-10">
                                <div className="flex items-center gap-2 mb-2 text-[#a5acb5]">
                                    <div className="bg-[#1b2b35] p-1.5 rounded-lg border border-[#32363b]">
                                        <User className="w-4 h-4 text-blue-400" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Відправник</span>
                                </div>
                                <div className="font-medium text-white mb-1.5 text-[15px] pl-10">{parcel.sender}</div>
                                <div className="text-xs text-[#a5acb5] flex items-start gap-1.5 pl-10">
                                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{parcel.rawStatus?.CitySender || parcel.rawDoc?.CitySenderDescription || 'Місто невідоме'}</span>
                                </div>
                            </div>

                            <div className="bg-[#292D32] border border-[#32363b] rounded-2xl p-4 landscape:p-3 shadow-sm relative z-10">
                                <div className="flex items-center gap-2 mb-2 text-[#a5acb5]">
                                    <div className="bg-[#1b2b35] p-1.5 rounded-lg border border-[#32363b]">
                                        <UserCheck className="w-4 h-4 text-green-400" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Одержувач</span>
                                </div>
                                <div className="font-medium text-white mb-1.5 text-[15px] pl-10">{parcel.recipient}</div>
                                {(() => {
                                    const phoneNum = parcel.rawStatus?.PhoneRecipient || parcel.rawDoc?.PhoneRecipient;
                                    if (!phoneNum) return null;
                                    const displayPhone = phoneNum.startsWith('+') ? phoneNum : `+${phoneNum}`;
                                    return (
                                        <a 
                                            href={`tel:${displayPhone}`}
                                            className="text-[#a5acb5] hover:text-white flex items-center gap-1.5 text-xs pl-10 mb-1.5 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Phone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <span>{displayPhone}</span>
                                        </a>
                                    );
                                })()}
                                <div className="text-xs text-[#a5acb5] flex items-start gap-1.5 pl-10">
                                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{parcel.cityName}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column in Landscape: Meta stats & Description */}
                    <div className="flex flex-col gap-6 landscape:gap-4_5">
                        {/* Meta */}
                        <div className="bg-[#292D32] border border-[#32363b] rounded-2xl shadow-sm divide-y divide-[#32363b]">
                            <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                <div className="text-[#a5acb5] flex items-center gap-2"><Scale className="w-4 h-4"/> Вага</div>
                                <div className="font-medium text-right text-white">{parcel.weight} кг {parcel.rawStatus?.VolumeWeight ? `(${parcel.rawStatus.VolumeWeight} об'єм)` : ''}</div>
                            </div>
                            <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                <div className="text-[#a5acb5] flex items-center gap-2"><CreditCard className="w-4 h-4"/> Оплачує</div>
                                <div className="font-medium text-right text-white">{parsePayer()}</div>
                            </div>
                            <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                <div className="text-[#a5acb5] flex items-center gap-2">Доставка</div>
                                <div className="font-medium text-right font-mono text-[15px] text-white">{parcel.cost} ₴</div>
                            </div>
                            {backwardInfo && (
                                <div className="grid grid-cols-2 p-4 landscape:p-3 text-[13px]">
                                    <div className="text-[#a5acb5] flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-emerald-400"/> {backwardInfo.label}
                                    </div>
                                    <div className="font-bold text-right text-emerald-400 font-mono text-[15px]">
                                        {backwardInfo.amount} ₴
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 p-4 landscape:p-3 bg-[#32363b]/30 rounded-b-2xl text-[13px]">
                                <div className="text-[#a5acb5] font-medium flex items-center gap-2">Орієнтовно</div>
                                <div className="font-bold text-[#e33745] text-right flex items-center justify-end gap-1.5"><Calendar className="w-4 h-4" />{parcel.estimatedDeliveryDate || '-'}</div>
                            </div>
                        </div>

                        {/* Description */}
                        {parcel.rawDoc?.Description && (
                            <div className="bg-[#292D32] border border-[#32363b] rounded-2xl p-4 landscape:p-3 text-[13px] text-[#a5acb5] shadow-sm leading-relaxed mb-6 landscape:mb-0">
                                <span className="font-medium text-white block mb-1">Опис:</span>
                                {parcel.rawDoc.Description}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Desktop View */}
            <div className="hidden lg:flex flex-col bg-white w-full max-w-4xl max-h-[85vh] h-[650px] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
               {/* Desktop header */}
               <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-red-100 p-2.5 rounded-xl shadow-sm">
                           <Box className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <div className="font-mono font-bold text-2xl text-gray-900 tracking-tight">{parcel.ttn}</div>
                            <div className="text-[11px] uppercase text-gray-500 font-bold tracking-wider">{parcel.accountName}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200">
                        <X className="w-6 h-6" />
                    </button>
               </div>
               
               <div className="flex-1 flex min-h-0">
                   {/* Left Col - Route & Main Info */}
                   <div className="flex-1 overflow-y-auto p-8 border-r border-gray-100 bg-white">
                        <div className="inline-flex px-4 py-1.5 bg-gray-100 text-gray-900 rounded-full text-sm font-bold mb-8 shadow-sm">
                            {parcel.status}
                        </div>
                        
                        <div className="relative pl-7 space-y-10 before:absolute before:inset-y-0 before:left-3 before:w-0.5 before:bg-gray-100">
                            
                            {/* Sender */}
                            <div className="relative">
                                <div className="absolute top-1 -left-[30px] w-5 h-5 bg-white border-[3px] border-blue-400 rounded-full shadow-sm"></div>
                                <div className="text-[11px] font-bold uppercase tracking-widest text-blue-500 mb-1.5">Відправник</div>
                                <div className="font-medium text-gray-900 text-xl tracking-tight mb-2">{parcel.sender}</div>
                                <div className="flex items-start gap-2 text-gray-500 text-sm">
                                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>{parcel.rawStatus?.CitySender || parcel.rawDoc?.CitySenderDescription || 'Місто невідоме'}</span>
                                </div>
                            </div>

                            {/* Recipient */}
                            <div className="relative">
                                <div className="absolute top-1 -left-[30px] w-5 h-5 bg-white border-[3px] border-green-400 rounded-full shadow-sm"></div>
                                <div className="text-[11px] font-bold uppercase tracking-widest text-green-500 mb-1.5">Одержувач</div>
                                <div className="font-medium text-gray-900 text-xl tracking-tight mb-2">{parcel.recipient}</div>
                                {(() => {
                                    const phoneNum = parcel.rawStatus?.PhoneRecipient || parcel.rawDoc?.PhoneRecipient;
                                    if (!phoneNum) return null;
                                    const displayPhone = phoneNum.startsWith('+') ? phoneNum : `+${phoneNum}`;
                                    return (
                                        <a 
                                            href={`tel:${displayPhone}`}
                                            className="flex items-center gap-2 text-gray-500 hover:text-blue-600 text-sm mb-1.5 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Phone className="w-4 h-4 shrink-0" />
                                            <span>{displayPhone}</span>
                                        </a>
                                    );
                                })()}
                                <div className="flex items-start gap-2 text-gray-500 text-sm">
                                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>{parcel.cityName}</span>
                                </div>
                            </div>
                        </div>

                        {parcel.rawDoc?.Description && (
                            <div className="mt-10 pt-8 border-t border-gray-100">
                                <div className="font-medium text-gray-900 block mb-3 text-sm">Опис відправлення:</div>
                                <div className="text-[15px] text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed">
                                    {parcel.rawDoc.Description}
                                </div>
                            </div>
                        )}
                   </div>
                   
                   {/* Right Col - Details */}
                   <div className="w-[320px] shrink-0 bg-[#FAFAFA] p-8 overflow-y-auto hidden lg:block">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-8">Деталі</h3>
                        
                        <div className="space-y-8">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                                    <Calendar className="w-4 h-4 text-orange-500" />Орієнтовна дата
                                </div>
                                <div className="font-semibold text-gray-900 text-[15px] pl-6">
                                    {parcel.estimatedDeliveryDate || '-'}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                                    <Scale className="w-4 h-4 text-blue-500" />Вага
                                </div>
                                <div className="font-semibold text-gray-900 text-[15px] pl-6">
                                    {parcel.weight} кг {parcel.rawStatus?.VolumeWeight ? `(${parcel.rawStatus.VolumeWeight} об'єм)` : ''}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                                    <CreditCard className="w-4 h-4 text-purple-500" />Тип оплати
                                </div>
                                <div className="font-semibold text-gray-900 text-[15px] pl-6">
                                    {parsePayer()}
                                </div>
                            </div>

                            {backwardInfo && (
                                <div className="flex flex-col gap-1.5 align-right">
                                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                                        <CreditCard className="w-4 h-4 text-emerald-500" />{backwardInfo.label}
                                    </div>
                                    <div className="font-semibold text-emerald-600 text-[15px] pl-6 font-mono">
                                        {backwardInfo.amount} ₴
                                    </div>
                                </div>
                            )}

                            <div className="pt-8 border-t border-gray-200 mt-8">
                                <div className="text-gray-500 text-sm mb-2 text-right font-medium">Вартість доставки</div>
                                <div className="font-mono text-[32px] tracking-tighter font-bold text-gray-900 text-right">
                                    {parcel.cost} ₴
                                </div>
                            </div>
                        </div>
                   </div>
               </div>
            </div>
        </div>
    );
}
