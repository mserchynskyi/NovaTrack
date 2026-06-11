const fs = require('fs');
let c = fs.readFileSync('src/components/ParcelDetailsModal.tsx', 'utf8');

c = c.replace(/text-emerald-100/g, 'text-emerald-600');
c = c.replace(/bg-emerald-500\/25/g, 'bg-emerald-500/10');
c = c.replace(/border-emerald-500\/40/g, 'border-emerald-500/20');
c = c.replace(/text-emerald-400/g, 'text-emerald-500');

fs.writeFileSync('src/components/ParcelDetailsModal.tsx', c);
console.log('Fixed');
