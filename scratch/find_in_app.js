const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '../ui/app.js');
const content = fs.readFileSync(appJsPath, 'utf8');
const lines = content.split('\n');
const query = process.argv[2] || '';
console.log(`Searching for "${query}" in ${appJsPath}:`);
let count = 0;
lines.forEach((line, idx) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
        console.log(`${idx + 1}: ${line.trim()}`);
        count++;
    }
});
console.log(`Found ${count} matches.`);
