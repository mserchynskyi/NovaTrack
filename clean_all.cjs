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
            
            // Remove lingering lg: classes referring to gray, amber, emerald, red colors with light numbers (50, 100, 200, 700, 800)
            // But we should be careful not to remove safe classes like layout lg:flex etc.
            content = content.replace(/ lg:(bg|text|border|hover:bg|hover:text|disabled:bg|disabled:text)-[a-zA-Z0-9_\-\[\]\(\)]+/g, '');
            
            if (originalContent !== content) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log("Cleaned " + fullPath);
            }
        }
    }
}

cleanDirectory('src/components');
