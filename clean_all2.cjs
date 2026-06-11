const fs = require('fs');
const path = require('path');

const cleanDirectory = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            cleanDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const originalContent = content;
            
            content = content.replace(/ lg:(placeholder|focus|focus-within|active|ring|border|bg|text)-[a-zA-Z0-9_\-\[\]\(\)]+/g, '');
            content = content.replace(/ lg:focus:(border|ring)-[a-zA-Z0-9_\-\[\]\(\)]+/g, '');
            content = content.replace(/ lg:placeholder:(text|color)-[a-zA-Z0-9_\-\[\]\(\)]+/g, '');
            content = content.replace(/ lg:hover:(border|ring)-[a-zA-Z0-9_\-\[\]\(\)]+/g, '');
            
            if (originalContent !== content) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log("Cleaned extra " + fullPath);
            }
        }
    }
}

cleanDirectory('src/components');
