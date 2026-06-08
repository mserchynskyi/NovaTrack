const fs = require('fs');
let content = fs.readFileSync('src/components/CreateTtnModal.tsx', 'utf8');

const replacements = {
    'border-zinc-700/60': 'border-[#32363b]',
    'border-zinc-700/40': 'border-[#32363b]',
    'border-zinc-800': 'border-[#32363b]',
    'border-zinc-700': 'border-[#32363b]',
    'border-zinc-650': 'border-[#32363b]',
    'border-[#32363b]/60': 'border-[#32363b]',
    'bg-[#262c33] hover:bg-zinc-800 text-[#e33745]': 'bg-transparent text-[#a5acb5] hover:bg-[#1b2b35]',
    'bg-zinc-800/80': 'bg-[#1b2b35]',
    'bg-zinc-800/50': 'bg-[#1b2b35]',
    'bg-zinc-800': 'bg-[#262c33]',
    'text-zinc-500': 'text-[#a5acb5]',
    'text-zinc-400': 'text-[#a5acb5]',
    'text-zinc-300': 'text-[#a5acb5]',
    'text-zinc-200': 'text-white',
    // The previous cancel button had `text-[#e33745]`. Let's just fix it generally.
};

for (const [search, replace] of Object.entries(replacements)) {
    content = content.replace(new RegExp(search.replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\//g, '\\/'), 'g'), replace);
}

fs.writeFileSync('src/components/CreateTtnModal.tsx', content);
console.log('Colors 2 replaced successfully');
