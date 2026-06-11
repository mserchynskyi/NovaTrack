const fs = require('fs');
const path = require('path');

const walk = (dir) => {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let orig = content;

            // Replacing hardcoded #32363b with semantic variables
            content = content.replace(/bg-\[#32363b\](?![\/\w])/g, 'bg-[var(--bg-hover)]');
            content = content.replace(/divide-\[#32363b\]/g, 'divide-[var(--border-color)]');
            content = content.replace(/border-\[#3e424c\]/g, 'border-[var(--border-color)]');
            content = content.replace(/border-\[#4a4f56\]/g, 'border-[var(--progress-track)]');
            content = content.replace(/hover:bg-\[#43484e\]/g, 'hover:bg-[var(--progress-track)]');
            content = content.replace(/hover:bg-zinc-700/g, 'hover:bg-[var(--bg-active-alpha)]');

            if (orig !== content) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed semantic colors in ' + fullPath);
            }
        }
    }
}

walk('src/components');
