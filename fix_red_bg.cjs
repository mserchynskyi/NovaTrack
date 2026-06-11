const fs = require('fs');
let c = fs.readFileSync('src/components/ParcelDetailsModal.tsx', 'utf8');

c = c.replace(/bg-red-[89]00\/[0-9]+/g, 'bg-red-500/20');
c = c.replace(/bg-red-950\/[0-9]+/g, 'bg-red-500/20');
c = c.replace(/border-red-900\/[0-9]+/g, 'border-red-500/30');

fs.writeFileSync('src/components/ParcelDetailsModal.tsx', c);
console.log('Fixed red dark backgrounds');
