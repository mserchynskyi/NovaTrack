const fs = require('fs');

const run = (fileName) => {
    let content = fs.readFileSync(fileName, 'utf8');
    content = content.replace(/ lg:(bg|text|border|hover:bg|hover:text|disabled:bg|disabled:text)-[a-zA-Z0-9_\-\[\]\(\)]+/g, '');
    fs.writeFileSync(fileName, content, 'utf8');
    console.log("Cleaned " + fileName);
};

run('src/components/ParcelDetailsModal.tsx');
