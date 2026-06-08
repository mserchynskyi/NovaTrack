const fs = require('fs');
let content = fs.readFileSync('src/components/CreateTtnModal.tsx', 'utf8');

content = content.replace(/2d313a/g, '32363b');

fs.writeFileSync('src/components/CreateTtnModal.tsx', content);
