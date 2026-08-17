const fs = require('fs');
const path = require('path');

console.log("==================================================================");
console.log("🔍 CHRONO EXHAUSTIVE BLINDSPOT & INTEGRITY SCANNER");
console.log("==================================================================\n");

const uiHtmlPath = path.join(__dirname, '../ui/index.html');
const uiJsPath = path.join(__dirname, '../ui/app.js');
const mainJsPath = path.join(__dirname, '../main/main.js');
const mainDbPath = path.join(__dirname, '../main/main_db.js');

const htmlContent = fs.readFileSync(uiHtmlPath, 'utf8');
const jsContent = fs.readFileSync(uiJsPath, 'utf8');
const mainContent = fs.readFileSync(mainJsPath, 'utf8');
const mainDbContent = fs.readFileSync(mainDbPath, 'utf8');

// 1. Audit all onclick attributes in index.html
console.log("1. AUDITING HTML ONCLICK HANDLERS...");
const onclickMatches = [...htmlContent.matchAll(/onclick="([a-zA-Z0-9_$]+)\s*\(/g)];
const onclickFuncs = [...new Set(onclickMatches.map(m => m[1]))];

const missingOnclickFuncs = [];
for (const fn of onclickFuncs) {
    const definedInJs = jsContent.includes(`function ${fn}`) || 
                        jsContent.includes(`window.${fn}`) || 
                        jsContent.includes(`const ${fn} =`) ||
                        jsContent.includes(`let ${fn} =`) ||
                        jsContent.includes(`var ${fn} =`);
    if (!definedInJs) {
        missingOnclickFuncs.push(fn);
    }
}

if (missingOnclickFuncs.length === 0) {
    console.log(`✅ All ${onclickFuncs.length} HTML onclick functions are declared in app.js!`);
} else {
    console.log(`⚠️ MISSING ONCLICK FUNCTIONS (${missingOnclickFuncs.length}):`, missingOnclickFuncs);
}

// 2. Audit all ipcRenderer.invoke / ipc.invoke in app.js
console.log("\n2. AUDITING IPC CHANNELS (UI -> MAIN)...");
const ipcInvokeMatches = [
    ...jsContent.matchAll(/ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g),
    ...jsContent.matchAll(/ipc\.invoke\(\s*['"]([^'"]+)['"]/g)
];
const ipcChannels = [...new Set(ipcInvokeMatches.map(m => m[1]))];

// Collect all main process files to search for handlers
const mainFiles = fs.readdirSync(path.join(__dirname, '../main')).filter(f => f.endsWith('.js'));
let allMainCode = '';
for (const f of mainFiles) {
    allMainCode += fs.readFileSync(path.join(__dirname, '../main', f), 'utf8') + '\n';
}

const missingIpcHandlers = [];
for (const ch of ipcChannels) {
    const isHandled = allMainCode.includes(`'${ch}'`) || allMainCode.includes(`"${ch}"`);
    if (!isHandled) {
        missingIpcHandlers.push(ch);
    }
}

if (missingIpcHandlers.length === 0) {
    console.log(`✅ All ${ipcChannels.length} frontend IPC channels are handled by main modules!`);
} else {
    console.log(`⚠️ UNHANDLED IPC CHANNELS (${missingIpcHandlers.length}):`, missingIpcHandlers);
}

// 3. Audit getElementById calls in app.js
console.log("\n3. AUDITING DOM ELEMENT IDS (app.js -> index.html)...");
const getElemMatches = [...jsContent.matchAll(/document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)];
const referencedIds = [...new Set(getElemMatches.map(m => m[1]))];

const missingIds = [];
for (const id of referencedIds) {
    const existsInHtml = htmlContent.includes(`id="${id}"`) || htmlContent.includes(`id='${id}'`);
    if (!existsInHtml) {
        missingIds.push(id);
    }
}

console.log(`Checked ${referencedIds.length} getElementById references.`);
if (missingIds.length > 0) {
    console.log(`ℹ️ Optional/Dynamic/Missing DOM IDs in HTML (${missingIds.length}):`, missingIds);
} else {
    console.log(`✅ All referenced DOM IDs exist directly in index.html!`);
}

// 4. Audit API Key / Secret Leakage in code files
console.log("\n4. AUDITING CREDENTIALS & SENSITIVE KEYS HYGIENE...");
const forbiddenKeyPatterns = [
    /AIzaSy[A-Za-z0-9_-]{33}/g,
    /gsk_[a-zA-Z0-9]{40,}/g,
    /sk-or-v1-[a-f0-9]{64}/g
];
let keyLeaks = 0;
const scanDirs = ['../main', '../ui', '../site'];
for (const dir of scanDirs) {
    const files = fs.readdirSync(path.join(__dirname, dir)).filter(f => f.endsWith('.js') || f.endsWith('.html'));
    for (const f of files) {
        const c = fs.readFileSync(path.join(__dirname, dir, f), 'utf8');
        for (const re of forbiddenKeyPatterns) {
            const matches = c.match(re);
            if (matches) {
                console.log(`⚠️ EXPOSED REAL API KEY in ${dir}/${f}: ${matches[0].substring(0, 10)}...`);
                keyLeaks++;
            }
        }
    }
}
if (keyLeaks === 0) {
    console.log("✅ Zero hardcoded production API keys found in codebase or site files!");
}

console.log("\n==================================================================");
console.log("🏁 BLINDSPOT SCAN COMPLETE");
console.log("==================================================================");
