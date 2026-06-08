const fs = require('fs');
const path = require('path');

const filePathArg = process.argv[2];
const query = process.argv[3] || '';

if (!filePathArg) {
    console.error('Usage: node find_in_file.js <filepath> <query>');
    process.exit(1);
}

const filePath = path.isAbsolute(filePathArg) ? filePathArg : path.resolve(__dirname, '..', filePathArg);

try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log(`Searching for "${query}" in ${filePath}:`);
    let count = 0;
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
            console.log(`${idx + 1}: ${line.trim()}`);
            count++;
        }
    });
    console.log(`Found ${count} matches.`);
} catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
    process.exit(1);
}
