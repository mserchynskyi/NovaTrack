const fs = require('fs');
const path = require('path');
const file = 'src/components/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/lg:bg-gray-50/g, '');
content = content.replace(/lg:border-gray-200/g, '');
content = content.replace(/lg:text-gray-700/g, '');
content = content.replace(/lg:bg-white/g, '');
content = content.replace(/lg:hover:bg-gray-100/g, '');
content = content.replace(/lg:text-gray-500/g, '');
content = content.replace(/lg:placeholder:text-\[var\(--text-muted\)\]/g, '');

content = content.replace(/bg-gray-50/g, 'bg-[var(--bg-card)]');
content = content.replace(/bg-gray-100/g, 'bg-[var(--bg-hover)]');
content = content.replace(/bg-gray-200/g, 'bg-[var(--bg-active-alpha)]');
content = content.replace(/border-gray-100/g, 'border-[var(--border-color)]');
content = content.replace(/border-gray-200/g, 'border-[var(--border-color)]');
content = content.replace(/text-gray-500/g, 'text-[var(--text-muted)]');
content = content.replace(/text-gray-600/g, 'text-[var(--text-muted)]');
content = content.replace(/text-gray-700/g, 'text-[var(--text-main)]');
content = content.replace(/text-gray-800/g, 'text-[var(--text-main)]');
content = content.replace(/text-gray-900/g, 'text-[var(--text-main)]');

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
