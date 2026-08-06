/**
 * Renderer Diagnostic Script
 * Run with: node scratch/diagnose_renderer.js
 * This launches electron with executeJavaScript to dump the DOM state
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.name = 'Chrono';
if (!app.isPackaged) {
    app.setPath('userData', path.join(app.getPath('appData'), 'Chrono'));
}

let win;

app.whenReady().then(() => {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false
        }
    });

    // Capture ALL console messages
    const logs = [];
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const entry = `[L${level}] ${message} (${sourceId}:${line})`;
        logs.push(entry);
        console.log(entry);
    });

    win.webContents.on('render-process-gone', (event, details) => {
        const msg = `RENDERER CRASHED: ${JSON.stringify(details)}`;
        logs.push(msg);
        console.error(msg);
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        const msg = `FAILED TO LOAD: ${validatedURL} - ${errorDescription} (${errorCode})`;
        logs.push(msg);
        console.error(msg);
    });

    win.webContents.on('did-finish-load', async () => {
        console.log('=== PAGE LOADED, DIAGNOSING RENDERER ===');
        try {
            const result = await win.webContents.executeJavaScript(`
                (function() {
                    const report = {};
                    
                    // Check body
                    const body = document.body;
                    const bodyStyle = window.getComputedStyle(body);
                    report.bodyDisplay = bodyStyle.display;
                    report.bodyVisibility = bodyStyle.visibility;
                    report.bodyOpacity = bodyStyle.opacity;
                    report.bodyBg = bodyStyle.backgroundColor;
                    report.bodyChildren = body.children.length;
                    report.bodyInnerHTMLLength = body.innerHTML.length;
                    
                    // Check appShell
                    const appShell = document.querySelector('.appShell');
                    if (appShell) {
                        const shellStyle = window.getComputedStyle(appShell);
                        report.appShellDisplay = shellStyle.display;
                        report.appShellVisibility = shellStyle.visibility;
                        report.appShellOpacity = shellStyle.opacity;
                        report.appShellWidth = shellStyle.width;
                        report.appShellHeight = shellStyle.height;
                    } else {
                        report.appShellFound = false;
                    }
                    
                    // Check for any element with display:none on root children
                    const rootChildren = Array.from(body.children);
                    report.rootChildrenInfo = rootChildren.map(el => {
                        const s = window.getComputedStyle(el);
                        return {
                            tag: el.tagName,
                            id: el.id,
                            className: el.className.substring(0, 50),
                            display: s.display,
                            visibility: s.visibility,
                            zIndex: s.zIndex
                        };
                    });
                    
                    // Check for overlays or fixed position elements
                    const allFixed = Array.from(document.querySelectorAll('*')).filter(el => {
                        return window.getComputedStyle(el).position === 'fixed';
                    }).map(el => ({
                        tag: el.tagName,
                        id: el.id,
                        zIndex: window.getComputedStyle(el).zIndex,
                        display: window.getComputedStyle(el).display,
                        width: window.getComputedStyle(el).width,
                        height: window.getComputedStyle(el).height
                    }));
                    report.fixedElements = allFixed;
                    
                    // Errors captured by window.onerror
                    report.firstScriptTag = document.querySelector('script') ? 'found' : 'none';
                    
                    return JSON.stringify(report, null, 2);
                })();
            `);
            
            const outputPath = path.join(__dirname, '..', 'scratch', 'renderer_diagnosis.json');
            fs.writeFileSync(outputPath, result);
            console.log('=== DIAGNOSIS SAVED TO:', outputPath);
            console.log(result);
        } catch (err) {
            console.error('Failed to execute diagnostic JS:', err);
        }
        
        // Also save all logs
        const logPath = path.join(__dirname, '..', 'scratch', 'renderer_logs.txt');
        fs.writeFileSync(logPath, logs.join('\n'));
        
        // Wait 3s then quit
        setTimeout(() => app.quit(), 3000);
    });

    win.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
    win.webContents.openDevTools({ mode: 'detach' });
});

app.on('window-all-closed', () => {
    app.quit();
});
