const fs = require('fs');
let c = fs.readFileSync('src/components/CreateTtnModal.tsx', 'utf8');

const colors = ['red', 'yellow', 'blue', 'green', 'emerald'];
colors.forEach(col => {
    c = c.replace(new RegExp(`text-${col}-400`, 'g'), `text-${col}-500`);
    c = c.replace(new RegExp(`text-${col}-300`, 'g'), `text-${col}-500`);
});

fs.writeFileSync('src/components/CreateTtnModal.tsx', c);
console.log('Fixed -400 to -500 in CreateTtnModal');
