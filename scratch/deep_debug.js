/**
 * CHRONO DEEP DEBUG LAUNCHER
 * Launches the real app (main/main.js entry) and injects a live diagnostic
 * overlay into the renderer after load. Writes full report to scratch/debug_report.json
 */
const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Mirror the production app setup ──
app.name = 'Chrono';
if (!app.isPackaged) {
    app.setPath('userData', path.join(app.getPath('appData'), 'Chrono'));
}

// Load the production main.js IPC handlers by requiring it
// We can't directly require main.js (it calls app.whenReady), so we'll load
// the real UI and intercept all renderer messages instead.

const REPORT_PATH = path.join(__dirname, '..', 'scratch', 'debug_report.json');
const report = {
    timestamp: new Date().toISOString(),
    mainProcessErrors: [],
    rendererErrors: [],
    rendererWarnings: [],
    ipcFailures: [],
    networkFailures: [],
    domState: null,
    initFunctions: null,
    localStorageState: null,
    uncaughtRejections: []
};

process.on('uncaughtException', (err) => {
    report.mainProcessErrors.push({ type: 'uncaughtException', message: err.message, stack: err.stack });
    console.error('[MAIN UNCAUGHT]', err.message);
});
process.on('unhandledRejection', (reason) => {
    report.mainProcessErrors.push({ type: 'unhandledRejection', message: String(reason) });
    console.error('[MAIN REJECTION]', reason);
});

// ── Require the real production main.js modules ──
// But we control the window creation so we can inject diagnostics
const cloudDb = require('../main/cloudDb');
const db = require('../main/main_db');
const memory = require('../main/memoryEngine');
const userModel = require('../main/userModel');
const interactionAdaptation = require('../main/interactionAdaptation');

// Load all IPC handlers from production main.js by parsing its handlers list
// (We spawn the real app process instead to get real IPC)

let win;

app.whenReady().then(() => {
    const { width: workW, height: workH } = screen.getPrimaryDisplay().workAreaSize;
    win = new BrowserWindow({
        width: Math.min(1536, workW),
        height: Math.min(864, workH),
        minWidth: 960,
        minHeight: 600,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false
        }
    });

    // ── Capture ALL renderer console messages ──
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const entry = { level, message, line, sourceId: sourceId ? path.basename(sourceId) : '' };
        if (level === 3) { // error
            report.rendererErrors.push(entry);
            console.error(`[RENDERER ERR L${level}] ${message} (${entry.sourceId}:${line})`);
        } else if (level === 2) { // warning
            report.rendererWarnings.push(entry);
        } else {
            console.log(`[RENDERER L${level}] ${message}`);
        }
    });

    win.webContents.on('render-process-gone', (event, details) => {
        report.mainProcessErrors.push({ type: 'render-process-gone', details });
        console.error('[RENDERER CRASHED]', details);
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        report.networkFailures.push({ errorCode, errorDescription, validatedURL });
        console.error('[LOAD FAIL]', errorCode, errorDescription, validatedURL);
    });

    win.webContents.on('did-finish-load', async () => {
        console.log('\n=== PAGE LOADED — Running deep diagnostic ===\n');
        
        try {
            // Inject diagnostic probe into the renderer
            const domDiag = await win.webContents.executeJavaScript(`
                (function() {
                    const d = {};
                    
                    // 1. Body state
                    const body = document.body;
                    const bs = window.getComputedStyle(body);
                    d.body = {
                        display: bs.display,
                        bg: bs.backgroundColor,
                        children: body.children.length,
                        htmlLen: body.innerHTML.length
                    };
                    
                    // 2. appShell
                    const shell = document.querySelector('.appShell');
                    if (shell) {
                        const ss = window.getComputedStyle(shell);
                        d.appShell = { display: ss.display, w: ss.width, h: ss.height, vis: ss.visibility };
                    } else { d.appShell = 'MISSING'; }
                    
                    // 3. calendarGrid
                    const grid = document.getElementById('calendarGrid');
                    if (grid) {
                        const gs = window.getComputedStyle(grid);
                        d.calendarGrid = { 
                            display: gs.display, 
                            w: gs.width, 
                            h: gs.height,
                            childCount: grid.children.length,
                            innerHTML: grid.innerHTML.substring(0, 300)
                        };
                    } else { d.calendarGrid = 'MISSING'; }
                    
                    // 4. localStorage
                    d.localStorage = {
                        theme: localStorage.getItem('theme'),
                        accent: localStorage.getItem('accent'),
                        token: localStorage.getItem('token') ? '[EXISTS]' : null,
                        userName: localStorage.getItem('userName'),
                        appName: localStorage.getItem('appName'),
                        onboardingComplete: localStorage.getItem('onboardingComplete')
                    };
                    
                    // 5. Check all critical function availability
                    d.functions = {
                        renderCalendar: typeof renderCalendar,
                        loadTasks: typeof loadTasks,
                        initializeSettings: typeof initializeSettings,
                        addTask: typeof addTask,
                        switchWorkspace: typeof switchWorkspace,
                        sendChat: typeof sendChat
                    };
                    
                    // 6. tasks array state
                    d.tasksArrayLength = typeof tasks !== 'undefined' ? tasks.length : 'UNDEFINED';
                    d.selectedDate = typeof selectedDate !== 'undefined' ? selectedDate : 'UNDEFINED';
                    d.activeView = typeof activeView !== 'undefined' ? activeView : 'UNDEFINED';
                    
                    // 7. All fixed/absolute overlays and their display state
                    d.overlays = Array.from(document.querySelectorAll('[id]')).map(el => {
                        const s = window.getComputedStyle(el);
                        return { id: el.id, display: s.display, pos: s.position, zIndex: s.zIndex };
                    }).filter(o => o.display !== 'none' && o.zIndex !== 'auto' && parseInt(o.zIndex) > 100);
                    
                    // 8. Chat workspace
                    const chatWs = document.querySelector('.chatWorkspace');
                    if (chatWs) {
                        const cs = window.getComputedStyle(chatWs);
                        d.chatWorkspace = { display: cs.display, w: cs.width, h: cs.height };
                    }
                    
                    // 9. Visible text on screen (top-level content)
                    const visibleText = Array.from(document.querySelectorAll('h1,h2,h3,.currentDate,.userGreeting,.chatTitle'))
                        .map(el => ({ tag: el.tagName, id: el.id, text: el.innerText.substring(0, 60) }));
                    d.visibleHeadings = visibleText;
                    
                    // 10. ipcRenderer availability
                    try {
                        const ipc = require('electron').ipcRenderer;
                        d.ipcRendererAvailable = true;
                    } catch(e) {
                        d.ipcRendererAvailable = false;
                        d.ipcRendererError = e.message;
                    }
                    
                    return JSON.stringify(d, null, 2);
                })();
            `);
            
            report.domState = JSON.parse(domDiag);
            console.log('\n=== DOM STATE ===\n', domDiag);
            
        } catch (err) {
            report.mainProcessErrors.push({ type: 'diagnosticExecFailed', message: err.message });
            console.error('[DIAGNOSTIC EXEC FAILED]', err.message);
        }
        
        // Save the report
        fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
        console.log('\n=== REPORT SAVED TO:', REPORT_PATH, '===\n');
        
        // Print summary
        console.log('=== SUMMARY ===');
        console.log('Renderer errors:', report.rendererErrors.length);
        console.log('Main process errors:', report.mainProcessErrors.length);
        console.log('Network failures:', report.networkFailures.length);
        if (report.rendererErrors.length > 0) {
            console.log('\nRENDERER ERRORS:');
            report.rendererErrors.forEach(e => console.log(' -', e.message, `(${e.sourceId}:${e.line})`));
        }
    });

    win.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
    // Keep window open for user inspection
});

app.on('window-all-closed', () => {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    app.quit();
});
