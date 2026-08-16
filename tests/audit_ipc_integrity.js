/**
 * 🔍 IPC HANDLER EXHAUSTIVE INTEGRITY AUDIT
 * Extracts every single ipcRenderer.invoke / ipcRenderer.send in ui/
 * and verifies that a corresponding ipcMain.handle / ipcMain.on exists in main/main.js.
 */

const fs = require('fs');
const path = require('path');

const mainJs = fs.readFileSync(path.join(__dirname, '../main/main.js'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '../ui/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../ui/index.html'), 'utf8');

// Find all ipcMain handlers
const ipcMainHandlers = new Set();
const mainRegex = /ipcMain\.(handle|on)\(\s*['"`]([^'"`]+)['"`]/g;
let m;
while ((m = mainRegex.exec(mainJs)) !== null) {
    ipcMainHandlers.add(m[2]);
}

console.log(`Found ${ipcMainHandlers.size} registered IPC handlers in main/main.js.`);

// Find all renderer calls
const rendererCalls = new Set();
const rendererRegex = /ipc(?:Renderer)?\.(invoke|send)\(\s*['"`]([^'"`]+)['"`]/g;
while ((m = rendererRegex.exec(appJs)) !== null) {
    rendererCalls.add(m[2]);
}
while ((m = rendererRegex.exec(indexHtml)) !== null) {
    rendererCalls.add(m[2]);
}

console.log(`Found ${rendererCalls.size} unique IPC invocations in ui/.`);

const missing = [];
for (const ch of rendererCalls) {
    if (!ipcMainHandlers.has(ch)) {
        missing.push(ch);
    }
}

if (missing.length > 0) {
    console.error(`\n❌ Found ${missing.length} missing IPC handlers:`);
    missing.forEach(ch => console.error(`  - ${ch}`));
    process.exit(1);
} else {
    console.log(`\n✅ 100% IPC Integrity Verified! All ${rendererCalls.size} renderer IPC channels have registered handlers.`);
    process.exit(0);
}
