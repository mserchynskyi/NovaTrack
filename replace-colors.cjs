const fs = require('fs');
let content = fs.readFileSync('src/components/CreateTtnModal.tsx', 'utf8');

// Colors replacement mapping
const replacements = {
    'bg-[#0ea5e9]': 'bg-[#e33745]',
    'text-[#0ea5e9]': 'text-[#e33745]',
    'border-[#0ea5e9]': 'border-[#e33745]',
    'ring-[#0ea5e9]': 'ring-[#e33745]',
    'shadow-[#0ea5e9]': 'shadow-[#e33745]',
    'bg-[#1c1d21]': 'bg-[#1b2b35]',
    'bg-[#262a30]': 'bg-[#262c33]',
    'border-[#2e3138]': 'border-[#32363b]',
    'bg-[#0c91cc]': 'bg-red-700',
    'bg-[#0c94d2]': 'bg-red-700',
    'hover:bg-sky-500': 'hover:bg-red-600',
    'hover:text-blue-400': 'hover:text-red-400',
};

for (const [search, replace] of Object.entries(replacements)) {
    content = content.replace(new RegExp(search.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), replace);
}

// Further replace any `#0ea5e9` left over
content = content.replace(/#0ea5e9/g, '#e33745');
// `#1c1d21` left over
content = content.replace(/#1c1d21/g, '#1b2b35');
// `#262a30` left over
content = content.replace(/#262a30/g, '#262c33');
// `#2e3138` left over
content = content.replace(/#2e3138/g, '#32363b');
// `#2d3139` left over (another border color?)
content = content.replace(/#2d3139/g, '#32363b');
// `#2a2e38` left over
content = content.replace(/#2a2e38/g, '#262c33');

fs.writeFileSync('src/components/CreateTtnModal.tsx', content);
console.log('Colors replaced successfully');
