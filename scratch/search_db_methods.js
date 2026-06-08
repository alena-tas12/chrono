const fs = require('fs');
const code = fs.readFileSync('c:/chrono app/main/main_db.js', 'utf8');
const lines = code.split('\n');
lines.forEach((line, index) => {
    if (line.includes('module.exports') || line.includes('exports.') || line.includes('function ') || line.includes('addTask')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
process.exit(0);
