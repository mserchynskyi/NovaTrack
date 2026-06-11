const fs = require('fs');
let c = fs.readFileSync('src/components/ParcelDetailsModal.tsx', 'utf8');

const colors = ['red', 'yellow', 'blue', 'green'];
colors.forEach(col => {
    c = c.replace(new RegExp(`text-${col}-400`, 'g'), `text-${col}-500`);
});

fs.writeFileSync('src/components/ParcelDetailsModal.tsx', c);
console.log('Fixed -400 to -500');
