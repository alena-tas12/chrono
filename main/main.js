const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');

// Set application name and align userData path in development mode to load the production DB
app.name = 'Chrono';
app.disableHardwareAcceleration();
if (!app.isPackaged) {
    app.setPath('userData', path.join(app.getPath('appData'), 'Chrono'));
}
const cloudDb = require('./cloudDb');
const googleAuth = require('./googleAuth');
const bcrypt = require('bcryptjs');
// Load the local AI gateway with resilient fallbacks so the packaged app
// doesn't crash if the file was unpacked or omitted during packaging.
let processAIChat;
try {
    // Normal development path (relative to main directory)
    processAIChat = require(path.join(__dirname, '..', 'server', 'ai_gateway')).processAIChat;
} catch (err1) {
    try {
        // When packaged with ASAR, some files may be placed in app.asar.unpacked
        const unpacked = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'server', 'ai_gateway');
        processAIChat = require(unpacked).processAIChat;
    } catch (err2) {
        try {
            // As a last resort try loading from resourcesPath/server (non-asar packaging)
            const alt = path.join(process.resourcesPath || '', 'server', 'ai_gateway');
            processAIChat = require(alt).processAIChat;
        } catch (err3) {
            console.error('Failed to load ai_gateway module:', err1, err2, err3);
            // Fallback stub to avoid crashing the whole app; returns a neutral message.
            processAIChat = async () => ({ response: "AI gateway unavailable (packaged app)." });
        }
    }
}

// 🧠 UNIFIED ORCHESTRATION LAYER
const orchestrator = require('./cognitiveOrchestrator');
const emotionalContinuity = require('./emotionalContinuity');
const identityStability = require('./identityStability');
const cognitiveDiagnostics = require('./cognitiveDiagnostics');
const stressTestEngine = require('./stressTestEngine');
const safetyFramework = require('./safetyFramework');
const performanceOptimizer = require('./performanceOptimizer');
const architecturePolicy = require('./architecturePolicy');
const modelProvider = require('./modelProvider');

// 🔧 SUPPORTING SYSTEMS
const memory = require('./memoryEngine');
const userModel = require('./userModel');
const presence = require('./presenceEngine');
const db = require('./main_db');
const timeEngine = require('./timeEngine');
const interactionAdaptation = require('./interactionAdaptation');

const syncEngine = require('./syncEngine');
const realtimeSync = require('./realtimeSync');
const episodicReplay = require('./episodicReplay');


// 🛡️ TRUST KILLER PREVENTION FRAMEWORK (Original Chrono Inner Circle)
const dataIntegrity = require('./dataIntegrity');
const cloudSyncService = require('./cloudSyncService');
const serverDb = require('./cloudDb');
const observatory = require('./observatory');
const syncReliability = require('./syncReliabilityTest');
const { DispatchEngine } = require('./dispatchEngine');
const { StateManager } = require('./stateManager');
const { ModuleRegistry } = require('./moduleRegistry');
const { ExecutiveLayer } = require('./executiveLayer');
const { ReasoningEngine } = require('./reasoningEngine');
const { MemoryModule } = require('./memoryModule');

// Instantiate the new Cognitive OS components
const globalStateManager = new StateManager();
const globalModuleRegistry = new ModuleRegistry();
const globalDispatchEngine = new DispatchEngine({ stateManager: globalStateManager, registry: globalModuleRegistry });
const globalExecutiveLayer = new ExecutiveLayer();
const globalReasoningEngine = new ReasoningEngine();
const globalMemoryModule = new MemoryModule();

let win;
let menuBarVisible = false;
let customizeWin;

function buildAppMenu() {
    const template = [
        {
            label: 'File',
            submenu: [{ role: 'quit' }]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                {
                    label: 'Show / Hide Menu Bar',
                    click: () => setMenuBarVisible(!menuBarVisible)
                },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [{ role: 'minimize' }, { role: 'close' }]
        }
    ];
    return Menu.buildFromTemplate(template);
}

function setMenuBarVisible(visible) {
    menuBarVisible = visible;
    if (!win) return;
    if (visible) {
        Menu.setApplicationMenu(buildAppMenu());
        win.setAutoHideMenuBar(false);
        win.setMenuBarVisibility(true);
    } else {
        Menu.setApplicationMenu(null);
        win.setAutoHideMenuBar(true);
        win.setMenuBarVisibility(false);
    }
}

function createWindow() {
    const { width: workW, height: workH } = screen.getPrimaryDisplay().workAreaSize;

    win = new BrowserWindow({
        width: Math.min(1536, workW),
        height: Math.min(864, workH),
        minWidth: 960,
        minHeight: 600,
        backgroundColor: '#0f172a',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false
        }
    });

    win.webContents.on('console-message', (event, ...args) => {
        let level = 0, message = '', line = 0, sourceId = '';
        if (args[0] && typeof args[0] === 'object') {
            level = args[0].level;
            message = args[0].message;
            line = args[0].lineNumber;
            sourceId = args[0].sourceId;
        } else {
            [level, message, line, sourceId] = args;
        }
        console.log(`[RENDERER CONSOLE (${level})] ${message} (${sourceId}:${line})`);
    });
    win.webContents.on('render-process-gone', (event, details) => {
        console.error(`❌ RENDERER CRASHED:`, details);
    });
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error(`❌ FAILED TO LOAD URL: ${validatedURL} - ${errorDescription} (${errorCode})`);
    });
    // DevTools can be opened via View > Toggle DevTools in the menu (Ctrl+Shift+I)

    setMenuBarVisible(false);
    win.loadFile(path.join(__dirname, '../ui/index.html'));

    if (workW >= 1400 && workH >= 800) {
        win.maximize();
    }

    // Reset onboarding if --reset-onboarding flag is passed
    if (process.argv.includes('--reset-onboarding')) {
        db.setSyncMeta('auth_token', '');
        db.setSyncMeta('auth_user_id', '');
        db.setSyncMeta('google_provider_token', '');
        win.webContents.on('did-finish-load', () => {
            win.webContents.executeJavaScript(`
                localStorage.removeItem('onboardingComplete');
                localStorage.removeItem('token');
                localStorage.removeItem('userName');
                localStorage.removeItem('userEmail');
                const overlay = document.getElementById('onboardingOverlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                }
                const obUserNameInput = document.getElementById('obUserNameInput');
                if (obUserNameInput) obUserNameInput.value = 'Planner';
                const obUserEmailInput = document.getElementById('obUserEmailInput');
                if (obUserEmailInput) obUserEmailInput.value = '';
                const obAppNameInput = document.getElementById('obAppNameInput');
                if (obAppNameInput) obAppNameInput.value = 'Chrono';
                console.log("Onboarding reset successfully via CLI flag.");
            `);
        });
    }
}

// ========================================
// ⏱️ TIMER HANDLERS
// ========================================

ipcMain.handle('start-timer', () => {
    timeEngine.startTimer();
});

ipcMain.handle('stop-timer', () => {
    return timeEngine.stopTimer();
});

ipcMain.handle('toggle-menu-bar', () => {
    setMenuBarVisible(!menuBarVisible);
    return { visible: menuBarVisible };
});

ipcMain.handle('get-menu-bar-visible', () => ({ visible: menuBarVisible }));

// ========================================
// 🛡️ TRUST KILLER PREVENTION HANDLERS
// ========================================

// Health checks
ipcMain.handle('run-health-checks', async () => {
    try {
        const { HealthCheckEngine } = require('./healthCheck');
        const engine = new HealthCheckEngine();
        return await engine.runAll();
    } catch (err) {
        return { success: false, message: 'Health check failed: ' + err.message };
    }
});

// Data integrity verification
ipcMain.handle('verify-data-integrity', async () => {
    try {
        return await dataIntegrity.verifyDataIntegrity();
    } catch (err) {
        return { success: false, message: 'Data integrity verification failed: ' + err.message };
    }
});

// Create backup
ipcMain.handle('create-backup', async (event, options = {}) => {
    try {
        const { BackupManager } = require('./backupManager');
        const backupMgr = new BackupManager();
        const result = await backupMgr.createLocalBackup(options.label || 'manual');
        return result;
    } catch (err) {
        return { success: false, message: 'Backup creation failed: ' + err.message };
    }
});

// List backups
ipcMain.handle('list-backups', async () => {
    try {
        const { BackupManager } = require('./backupManager');
        const backupMgr = new BackupManager();
        return await backupMgr.listBackups();
    } catch (err) {
        return { success: false, message: 'List backups failed: ' + err.message };
    }
});

// Restore from backup
ipcMain.handle('restore-backup', async (event, backupFile) => {
    try {
        const { BackupManager } = require('./backupManager');
        const backupMgr = new BackupManager();
        const result = await backupMgr.restoreFromBackup(backupFile);
        return result;
    } catch (err) {
        return { success: false, message: 'Restore failed: ' + err.message };
    }
});

// Run backup verification drill
ipcMain.handle('run-backup-drill', async () => {
    try {
        const { BackupManager } = require('./backupManager');
        const backupMgr = new BackupManager();
        const result = await backupMgr.runBackupDrill();
        return result;
    } catch (err) {
        return { success: false, message: 'Backup drill failed: ' + err.message };
    }
});

// Run sync reliability tests
ipcMain.handle('run-sync-tests', async () => {
    try {
        const { runAllSyncTests } = require('./syncReliabilityTest');
        const results = await runAllSyncTests();
        return results;
    } catch (err) {
        return { success: false, message: 'Sync tests failed: ' + err.message };
    }
});

// Detect silent failures
ipcMain.handle('detect-silent-failures', async () => {
    try {
        const failures = await dataIntegrity.detectSilentFailures();
        return { success: true, silentFailures: failures };
    } catch (err) {
        return { success: false, message: 'Silent failure detection failed: ' + err.message };
    }
});

function startBackgroundMaintenance() {
    const runTasks = () => {
        try {
            const contextCompression = require('./contextCompression');
            const episodicReplay = require('./episodicReplay');
            const reflectionEngine = require('./reflectionEngine');
            const userId = db.getActiveUserId() || 'local_user';

            // 1. Context & Database Compression (Task rollup & delete purge)
            contextCompression.compressAndCleanDb();

            // 2. Episodic Replay (Completed task outcome log)
            episodicReplay.replayCompletedEpisodes(userId, 14);

            // 3. Daily Reflection & Weekly Consolidation
            reflectionEngine.generateDailyReflection(userId);
            reflectionEngine.pruneAndConsolidateReflections(userId);

            console.log('[CHRONO] Background maintenance cycle completed successfully.');
        } catch (e) {
            console.error('[CHRONO] Background maintenance error:', e.message);
        }
    };

    // Run initial cycle 5s after startup (non-blocking)
    setTimeout(runTasks, 5000);

    // Schedule subsequent cycles every 6 hours
    setInterval(runTasks, 6 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
    // Open the main window immediately
    createWindow();

    // Start background maintenance scheduler (Compression + Episodic Replay + Reflections)
    startBackgroundMaintenance();

    // Trigger startup database backup check
    try {
        const continuityStability = require('./continuityStability');
        continuityStability.getTrustReliability();
    } catch (err) {
        console.error("Failed to execute startup backup check:", err.message);
    }

    // 🛡️ INITIALIZE TRUST KILLER PREVENTION FRAMEWORK
    try {
        console.log('[CHRONO] Initializing Original Chrono Trust Killer Prevention Framework...');
        
        // Initialize health checks (validates system state)
        const { HealthCheckEngine } = require('./healthCheck');
        const healthCheckEngine = new HealthCheckEngine();
        healthCheckEngine.runAll();
        console.log('[CHRONO] Health checks completed.');
        
        // Initialize data integrity monitoring
        dataIntegrity.initializeOperationLogging();
        console.log('[CHRONO] Data integrity monitoring initialized.');
        
        // Register trust killer handlers (IPC for visible results)
        const trustKillerHandlers = require('./trustKillerHandlers');
        trustKillerHandlers.registerTrustKillerHandlers();
        console.log('[CHRONO] Trust killer handlers registered.');
        
        // Schedule automatic backup verification drill
        const { BackupManager } = require('./backupManager');
        const backupMgr = new BackupManager();
        backupMgr.scheduleBackupDrill();
        console.log('[CHRONO] Backup drill scheduler started.');
        
    } catch (err) {
        console.error('[CHRONO] Trust killer framework initialization failed:', err.message);
        console.error('[CHRONO] Continuing with core systems (framework disabled)');
    }

    // Automatically restore active session if auth token exists locally and cloud is enabled
    const token = db.getSyncMeta('auth_token');
    const refreshToken = db.getSyncMeta('refresh_token');
    const userId = db.getSyncMeta('auth_user_id');
    const useCloud = db.getSyncMeta('use_cloud') !== 'false';
    if (cloudDb && useCloud) {
        // Set up onAuthStateChange listener to keep local database updated
        cloudDb.auth.onAuthStateChange((event, session) => {
            if (session) {
                db.setSyncMeta('auth_token', session.access_token || '');
                if (session.refresh_token) {
                    db.setSyncMeta('refresh_token', session.refresh_token);
                }
                if (session.user) {
                    db.setSyncMeta('auth_user_id', session.user.id || '');
                }
            } else if (event === 'SIGNED_OUT') {
                db.setSyncMeta('auth_token', '');
                db.setSyncMeta('refresh_token', '');
                db.setSyncMeta('auth_user_id', '');
            }
        });

        if (token || refreshToken) {
            (async () => {
                try {
                    const { data, error } = await cloudDb.auth.setSession({
                        access_token: token || '',
                        refresh_token: refreshToken || ''
                    });
                    if (error) {
                        console.warn("Restoring session using stored access token failed, attempting refresh session...", error.message);
                        if (refreshToken) {
                            const { data: refreshData, error: refreshError } = await cloudDb.auth.refreshSession({ refresh_token: refreshToken });
                            if (refreshError) throw refreshError;
                            if (refreshData && refreshData.session) {
                                const newAccessToken = refreshData.session.access_token;
                                const newRefreshToken = refreshData.session.refresh_token;
                                db.setSyncMeta('auth_token', newAccessToken);
                                db.setSyncMeta('refresh_token', newRefreshToken);
                                realtimeSync.initializeRealtimeSync(newAccessToken, userId);
                                console.log("Session refreshed successfully on startup.");
                            }
                        }
                    } else if (data && data.session) {
                        if (data.session.access_token) {
                            db.setSyncMeta('auth_token', data.session.access_token);
                        }
                        if (data.session.refresh_token) {
                            db.setSyncMeta('refresh_token', data.session.refresh_token);
                        }
                        realtimeSync.initializeRealtimeSync(data.session.access_token, userId);
                    }
                } catch (err) {
                    console.error("Failed to restore or refresh session on startup:", err.message);
                }
            })();
        }
    }

    syncEngine.startSyncLoop();
});

// ========================================
// 🔥 ORCHESTRATED AI RESPONSE HANDLER
// ========================================


ipcMain.handle('ai-response', async (event, data) => {
    try {
        const userInput = data.userInput || data.message || data.input;
        const parentId = data.parent_id || db.getActiveLeafId() || null;
        
        // Save User Message
        const userMsg = db.addWorkspaceMessage({
            role: 'user',
            content: userInput,
            parent_id: parentId
        });

        // Get full branch history
        const branch = db.getWorkspaceBranch(userMsg.id);
        const sessionHistory = branch.map(m => ({ role: m.role, content: m.content }));
        
        // 1. Plan Intent
        const intentPlan = await globalDispatchEngine.planIntent({ 
            input: userInput, 
            session: { currentTopic: null, history: sessionHistory } 
        });

        // 2. Retrieve State Iteratively using Structured Contracts
        const retrievedState = await globalDispatchEngine.retrieve(intentPlan);
        
        // 3. Contradiction & Opportunity Detection
        const contradictions = globalDispatchEngine.detectContradictions({
            userInput: userInput,
            ...retrievedState
        });
        const opportunities = globalDispatchEngine.detectOpportunities(retrievedState);

        // 4. Executive Execution Pipeline (Observe -> Reason -> Simulate -> Recommend -> Act)
        const pipelineResult = globalExecutiveLayer.executePipeline(intentPlan, retrievedState, contradictions, opportunities, sessionHistory);

        // 4b. Generate Hypotheses / Observations for World Model
        try {
            orchestrator.generateHypotheses(db.getActiveUserId(), userInput, retrievedState);
        } catch (hypErr) {
            console.error('Failed to generate hypotheses:', hypErr.message);
        }

        // 5. LLM Synthesis (Reasoning Engine)
        const synthRes = await globalReasoningEngine.synthesizeResponse(userInput, pipelineResult);
        const finalResponseText = typeof synthRes === 'string' ? synthRes : (synthRes.text || '');
        const providerUsed = typeof synthRes === 'object' ? (synthRes.providerUsed || 'Google Gemini') : 'Google Gemini';
        const modelUsed = typeof synthRes === 'object' ? (synthRes.modelUsed || 'gemini-3.5-flash') : 'gemini-3.5-flash';
        
        // 6. Memory Write Path (Post-Processing)
        const memoryWriteResult = globalMemoryModule.processInteraction(userInput, finalResponseText);

        // Save AI Message
        const aiMsg = db.addWorkspaceMessage({
            role: 'assistant',
            content: finalResponseText,
            parent_id: userMsg.id
        });
        
        db.setActiveLeafId(aiMsg.id);

        return {
            response: finalResponseText,
            providerUsed,
            modelUsed,
            state: { emotion: 'analytical', focus: 1.0, priority: 1 },
            log: 'Success',
            nodeId: aiMsg.id
        };
    } catch (err) {
        return {
            response: `Error in Dispatch Engine: ${err.message}`,
            providerUsed: 'NONE',
            modelUsed: 'error',
            state: { emotion: 'error', focus: 0, priority: 0 },
            log: err.message
        };
    }
});

ipcMain.handle('get-startup-greeting', async () => {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';
    
    let name = 'Alen';
    let eventCount = 0;
    try {
        const userId = db.getSyncMeta('auth_user_id') || 'local_user';
        const profile = db.getProfile ? db.getProfile(userId) : null;
        if (profile && profile.display_name) name = profile.display_name;
        
        const today = new Date();
        const dateStr = today.getDate().toString().padStart(2, '0') + '-' + (today.getMonth()+1).toString().padStart(2, '0') + '-' + today.getFullYear();
        const events = db.getEventsByDate(dateStr);
        if (events) eventCount = events.length;
    } catch (e) {
        console.error(e);
    }
    
    let calendarContext = '';
    if (eventCount === 0) {
        calendarContext = 'Your schedule is currently clear for today.';
    } else {
        calendarContext = `I am tracking ${eventCount} active block${eventCount > 1 ? 's' : ''} in your timeline today.`;
    }

    return `${greeting}, ${name}. All core systems are initialized and I am online. ${calendarContext} How should we begin?`;
});

ipcMain.handle('save-chat', (event, message, response) => {
    return { saved: true };
});

// complete-task handler to mark tasks as completed in SQLite
ipcMain.handle('complete-task', async (event, taskText) => {
    await Promise.resolve(db.completeTask(taskText));
    syncEngine.triggerSync();
    return { completed: true };
});

ipcMain.handle('uncomplete-task', async (event, idOrText) => {
    await Promise.resolve(db.uncompleteTask(idOrText));
    syncEngine.triggerSync();
    return { completed: false };
});

ipcMain.handle('delete-task', async (event, idOrText) => {
    await Promise.resolve(db.deleteTask(idOrText));
    syncEngine.triggerSync();
    return { deleted: true };
});

ipcMain.handle('edit-task-text', async (event, idOrText, newText) => {
    await Promise.resolve(db.editTaskText(idOrText, newText));
    syncEngine.triggerSync();
    return { success: true };
});

// 📊 MEMORY HANDLERS

ipcMain.handle('log-session', (event, task, duration) => {
    memory.logSession(task, duration);
    return { logged: true };
});

ipcMain.handle('get-history', () => {
    return memory.getHistory();
});

ipcMain.handle('get-chat-history', (event, limit) => {
    const activeLeafId = db.getActiveLeafId();
    if (!activeLeafId) return [];
    return db.getWorkspaceBranch(activeLeafId);
});

ipcMain.handle('new-chat', () => {
    db.setActiveLeafId(null);
    return { success: true };
});

ipcMain.handle('backup-chat-history', async () => {
    try {
        const allMessages = db.getAllWorkspaceMessages();
        const activeLeafId = db.getActiveLeafId();
        const payload = {
            version: '2.2.0',
            timestamp: Date.now(),
            date: new Date().toISOString(),
            activeLeafId,
            messages: allMessages
        };

        // Also save local file snapshot in app directory if possible
        try {
            const backupDir = path.join(app.getPath('userData'), 'chat_backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
            const backupPath = path.join(backupDir, `chat_backup_${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2), 'utf8');
        } catch(e) {
            console.warn("Local chat backup snapshot warning:", e.message);
        }

        return { success: true, count: allMessages.length, payload };
    } catch(e) {
        console.error("backup-chat-history error:", e.message);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('restore-chat-history', async (event, backupData) => {
    try {
        let messages = [];
        let activeLeafId = null;

        if (backupData && Array.isArray(backupData.messages)) {
            messages = backupData.messages;
            activeLeafId = backupData.activeLeafId || null;
        } else if (Array.isArray(backupData)) {
            messages = backupData;
        } else {
            // Try loading latest snapshot from chat_backups directory
            const backupDir = path.join(app.getPath('userData'), 'chat_backups');
            if (fs.existsSync(backupDir)) {
                const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
                if (files.length > 0) {
                    const content = JSON.parse(fs.readFileSync(path.join(backupDir, files[0]), 'utf8'));
                    messages = content.messages || [];
                    activeLeafId = content.activeLeafId || null;
                }
            }
        }

        if (!messages || messages.length === 0) {
            return { success: false, error: "No messages found in backup payload" };
        }

        const res = db.restoreWorkspaceConversation(messages, activeLeafId);
        return res;
    } catch(e) {
        console.error("restore-chat-history error:", e.message);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('reset-chat-history', async () => {
    try {
        return db.resetWorkspaceConversation();
    } catch(e) {
        console.error("reset-chat-history error:", e.message);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('switch-chat-leaf', (event, leafId) => {
    db.setActiveLeafId(leafId);
    return db.getWorkspaceBranch(leafId);
});

ipcMain.handle('get-chat-leaves', () => {
    return db.getWorkspaceConversationLeaves();
});

ipcMain.handle('get-message-siblings', (event, parentId) => {
    return db.getWorkspaceMessageSiblings(parentId);
});

ipcMain.handle('delete-chat-message', (event, id) => {
    db.deleteWorkspaceMessage(id);
    return { deleted: true };
});

ipcMain.handle('get-average-focus', () => {
    return memory.getAverageFocusTime();
});

ipcMain.handle('get-most-frequent-task', () => {
    return memory.getMostFrequentTask();
});

// 📚 HIERARCHICAL MEMORY HANDLERS

ipcMain.handle('get-hierarchical-memories', (event, limit) => {
    return memory.getHierarchicalMemories(limit || 10);
});

ipcMain.handle('get-emotional-memories', (event, limit) => {
    return memory.getEmotionalMemories(limit || 5);
});

ipcMain.handle('get-core-identity', () => {
    return memory.getCoreIdentity();
});

// 🔁 EPISODIC REPLAY

ipcMain.handle('get-episodic-replay', async (event, daysBack) => {
    try {
        const userId = db.getActiveUserId() || 'local_user';
        episodicReplay.replayCompletedEpisodes(userId, daysBack || 7);
        return episodicReplay.getEpisodeSummary(20);
    } catch (e) {
        console.error('get-episodic-replay failed:', e.message);
        return [];
    }
});

// 🤝 SHARED MEMORIES

ipcMain.handle('add-shared-memory', async (event, data) => {
    try {
        const userId = db.getActiveUserId() || 'local_user';
        const id = db.addSharedMemory(userId, data.peerId, data.title, data.summary, data.importance || 5);
        return { success: !!id, id };
    } catch (e) {
        console.error('add-shared-memory failed:', e.message);
        return { success: false, error: e.message };
    }
});

// 🌐 WORLD MODEL — HYPOTHESES

ipcMain.handle('get-hypotheses', async () => {
    try {
        const userId = db.getActiveUserId() || 'local_user';
        return db.db.prepare(`
            SELECT * FROM chat_hypotheses
            WHERE user_id = ? AND status = 'active'
            ORDER BY created_at DESC LIMIT 20
        `).all(userId);
    } catch (e) {
        console.error('get-hypotheses failed:', e.message);
        return [];
    }
});

ipcMain.handle('resolve-hypothesis', async (event, data) => {
    try {
        const now = Date.now();
        db.db.prepare(`
            UPDATE chat_hypotheses
            SET status = ?, updated_at = ?
            WHERE id = ?
        `).run(data.resolution || 'resolved', now, data.id);
        return { success: true };
    } catch (e) {
        console.error('resolve-hypothesis failed:', e.message);
        return { success: false, error: e.message };
    }
});



ipcMain.handle('get-tasks', async (event, date) => {
    return await Promise.resolve(db.fetchTasks(date));
});

ipcMain.handle('get-tasks-range', async (event, startDate, endDate) => {
    return await Promise.resolve(db.fetchTasksInRange(startDate, endDate));
});

ipcMain.handle('add-task', async (event, task) => {
    try {
        await Promise.resolve(db.addTask(task));
        syncEngine.triggerSync();
        return { added: true };
    } catch (err) {
        console.error('Failed to add task:', err);
        throw err;
    }
});

ipcMain.handle('google-login', async () => {
    if (!cloudDb) {
        throw new Error("Supabase cloud database is not configured. Please check your .env file.");
    }
    try {
        const { accessToken, refreshToken, providerToken } = await googleAuth.startGoogleAuth(cloudDb);
        
        // Set the active session in Supabase
        const { data: sessionData, error: sessionError } = await cloudDb.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });
        if (sessionError) throw sessionError;

        // Fetch user information
        const { data: { user }, error: userError } = await cloudDb.auth.getUser();
        if (userError) throw userError;

        const userId = user.id;
        const email = user.email;

        // Fetch display name from user metadata or profile table
        const { data: profile, error: profError } = await cloudDb
            .from('profiles')
            .select('display_name')
            .eq('user_id', userId)
            .maybeSingle();

        let displayName = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];
        if (profile && profile.display_name) {
            displayName = profile.display_name;
        } else {
            // Profile doesn't exist yet, let's create a default profile on Supabase public.profiles table
            const { error: insertError } = await cloudDb
                .from('profiles')
                .insert({
                    user_id: userId,
                    display_name: displayName,
                    cognitive_style: 'adaptive',
                    reassurance_needs: 'moderate',
                    updated_at: new Date().toISOString()
                });
            if (insertError) {
                console.error("Profile insertion error on Google Login:", insertError.message);
            }
        }

        // Set auth token inside SQLite sync engine metadata
        db.setSyncMeta('auth_token', accessToken);
        db.setSyncMeta('refresh_token', refreshToken || '');
        db.setSyncMeta('auth_user_id', userId);
        db.setSyncMeta('user_name', displayName);
        db.setSyncMeta('user_email', email);
        if (providerToken) {
            db.setSyncMeta('google_provider_token', providerToken);
        }
        
        // Start realtime sync subscription
        realtimeSync.initializeRealtimeSync(accessToken, userId);
        
        // Trigger sync loop cycle
        const useCloud = db.getSyncMeta('use_cloud') !== 'false';
        if (useCloud) {
            syncEngine.triggerSync();
        }

        // Trigger Google Calendar sync immediately in background
        if (providerToken) {
            const googleCalendarSync = require('./googleCalendarSync');
            googleCalendarSync.syncGoogleCalendar(userId).catch(e => {
                console.error("Failed to run initial Google Calendar sync:", e.message);
            });
        }

        return { success: true, token: accessToken, userId, displayName, email };
    } catch (err) {
        console.error("🚨 Google Login IPC error:", err);
        throw new Error(err.message || err);
    }
});

ipcMain.handle('sync-google-calendar', async () => {
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    const googleCalendarSync = require('./googleCalendarSync');
    return await googleCalendarSync.syncGoogleCalendar(userId);
});

ipcMain.handle('set-auth-token', (event, token, userId) => {
    db.setSyncMeta('auth_token', token || '');
    if (userId) {
        db.setSyncMeta('auth_user_id', userId);
    } else if (!token) {
        db.setSyncMeta('auth_user_id', '');
    }
    const useCloud = db.getSyncMeta('use_cloud') !== 'false';
    if (token && cloudDb && useCloud) {
        cloudDb.auth.setSession({
            access_token: token,
            refresh_token: db.getSyncMeta('refresh_token') || ''
        });
        // Start realtime sync subscription
        realtimeSync.initializeRealtimeSync(token, userId);
    }
    if (token && useCloud) {
        syncEngine.triggerSync();
    }
    return { success: true };
});

ipcMain.handle('set-sync-meta', (event, key, value) => {
    db.setSyncMeta(key, value);
    if (key === 'openai_api_key') {
        globalReasoningEngine.setApiKey(value);
    }
    return { success: true };
});

ipcMain.handle('set-openai-key', (event, apiKey) => {
    return globalReasoningEngine.setApiKey(apiKey);
});

ipcMain.handle('get-sync-meta', (event, key) => {
    return db.getSyncMeta(key);
});

ipcMain.handle('audit-providers', async () => {
    const apiAuditEngine = require('./apiAuditEngine');
    return await apiAuditEngine.auditAllProviders();
});

ipcMain.handle('test-provider', async (event, { provider, keyOverride }) => {
    const apiAuditEngine = require('./apiAuditEngine');
    return await apiAuditEngine.testProviderConnection(provider, keyOverride);
});

ipcMain.handle('get-provider-keys-status', async () => {
    const creds = modelProvider.getProviderCredentials();
    return {
        gemini: { configured: !!creds.gemini.key, model: creds.gemini.model },
        openai: { configured: !!creds.openai.key, model: creds.openai.model },
        qwen: { configured: !!creds.qwen.key, model: creds.qwen.model },
        ollama: { configured: true, endpoint: creds.ollama.endpoint, model: creds.ollama.model }
    };
});

ipcMain.handle('save-provider-keys', async (event, keys) => {
    if (keys.geminiKey !== undefined) db.setSyncMeta('gemini_api_key', keys.geminiKey);
    if (keys.groqKey !== undefined) db.setSyncMeta('groq_api_key', keys.groqKey);
    if (keys.openrouterKey !== undefined) db.setSyncMeta('openrouter_api_key', keys.openrouterKey);
    if (keys.openaiKey !== undefined) db.setSyncMeta('openai_api_key', keys.openaiKey);
    if (keys.qwenKey !== undefined) db.setSyncMeta('qwen_api_key', keys.qwenKey);
    if (keys.ollamaEndpoint !== undefined) db.setSyncMeta('ollama_endpoint', keys.ollamaEndpoint);
    return { success: true };
});

ipcMain.handle('get-active-provider-status', async () => {
    return modelProvider.getActiveProviderStatus();
});

ipcMain.handle('set-preferred-provider', async (event, providerKey) => {
    return modelProvider.setPreferredProvider(providerKey);
});

ipcMain.handle('groq-transcribe-audio', async (event, { audioBuffer, filename }) => {
    const groqService = require('./groqService');
    try {
        const text = await groqService.transcribeAudio(Buffer.from(audioBuffer), filename);
        return { success: true, text };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('set-use-cloud', (event, useCloud) => {
    db.setSyncMeta('use_cloud', useCloud ? 'true' : 'false');
    // If enabling and we have session, setup realtime sync and trigger a sync cycle
    const token = db.getSyncMeta('auth_token');
    const userId = db.getSyncMeta('auth_user_id');
    if (useCloud && token && cloudDb) {
        cloudDb.auth.setSession({
            access_token: token,
            refresh_token: db.getSyncMeta('refresh_token') || ''
        });
        realtimeSync.initializeRealtimeSync(token, userId);
        syncEngine.triggerSync();
    } else if (!useCloud) {
        // Stop sync loop if needed, or simply let the checks skip it
        realtimeSync.closeRealtimeSync(); // We'll make sure this method is safe in realtimeSync.js
    }
    return { success: true };
});

ipcMain.handle('connect-peer', (event, name, role, email, peerUserId) => {
    const continuityThreads = require('./continuityThreads');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityThreads.addThread(userId, name, role, email, peerUserId);
});

ipcMain.handle('cloud-api-call', async (event, { endpoint, method, body }) => {
    if (!cloudDb) {
        throw new Error("Supabase cloud database is not configured. Please check your .env file.");
    }

    try {
        if (endpoint === '/api/auth/register') {
            const { email, password, displayName } = body;
            const { data, error } = await cloudDb.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: displayName
                    }
                }
            });
            if (error) throw error;
            
            const userId = data.user.id;
            
            // Create user profile on Supabase public.profiles table
            const { error: profError } = await cloudDb
                .from('profiles')
                .insert({
                    user_id: userId,
                    display_name: displayName,
                    cognitive_style: 'adaptive',
                    reassurance_needs: 'moderate',
                    updated_at: new Date().toISOString()
                });
            if (profError) console.error("Profile creation error:", profError.message);

            // Create default calendars
            const defaultLayers = ['Personal', 'Study', 'Routine', 'Focus'];
            const serverTime = Date.now();
            for (const layer of defaultLayers) {
                const calId = 'c_' + Math.random().toString(36).substring(2, 11);
                await cloudDb
                    .from('calendars')
                    .insert({
                        id: calId,
                        name: layer,
                        owner_id: userId,
                        layer_type: layer.toLowerCase(),
                        updated_at: serverTime,
                        device_id: 'server',
                        deleted: 0
                    });
                await cloudDb
                    .from('calendar_members')
                    .insert({
                        calendar_id: calId,
                        user_id: userId,
                        role: 'owner',
                        updated_at: serverTime,
                        device_id: 'server',
                        deleted: 0
                    });
            }

            const token = data.session?.access_token || 'mock_token';
            // Start realtime sync subscription
            realtimeSync.initializeRealtimeSync(token, userId);
            return { success: true, token, userId, displayName };

        } else if (endpoint === '/api/auth/login') {
            const { email, password } = body;
            const { data, error } = await cloudDb.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;

            const userId = data.user.id;
            const token = data.session.access_token;
            
            // Fetch profile
            const { data: profile, error: profError } = await cloudDb
                .from('profiles')
                .select('display_name')
                .eq('user_id', userId)
                .maybeSingle();

            const displayName = profile?.display_name || 'User';
            // Start realtime sync subscription
            realtimeSync.initializeRealtimeSync(token, userId);
            return { success: true, token, userId, displayName };

        } else if (endpoint === '/api/profiles/me') {
            const userId = db.getSyncMeta('auth_user_id') || 'local_user';

            if (method === 'GET') {
                if (cloudDb && db.getSyncMeta('auth_user_id')) {
                    const { data: profile, error } = await cloudDb
                        .from('profiles')
                        .select('*')
                        .eq('user_id', userId)
                        .maybeSingle();
                    if (!error && profile) {
                        return {
                            display_name: profile.display_name,
                            cognitive_style: profile.cognitive_style,
                            reassurance_needs: profile.reassurance_needs
                        };
                    }
                }
                const localProfile = db.getUserProfile();
                return {
                    display_name: localProfile.name || 'User',
                    cognitive_style: localProfile.style || 'adaptive',
                    reassurance_needs: 'moderate'
                };
            } else if (method === 'PUT') {
                const { cognitiveStyle } = body;
                if (cloudDb && db.getSyncMeta('auth_user_id')) {
                    await cloudDb
                        .from('profiles')
                        .update({
                            cognitive_style: cognitiveStyle || 'adaptive',
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId);
                }
                return { success: true };
            }

        } else if (endpoint === '/api/chat') {
            const userId = db.getSyncMeta('auth_user_id') || 'local_user';
            const { input, selectedDate, activeView, taskCount } = body;
            // Process AI Chat directly in the main process
            const aiResponse = await processAIChat(userId, input, { selectedDate, activeView, taskCount });
            return aiResponse;

        } else if (endpoint === '/api/chat/history') {
            const userId = db.getSyncMeta('auth_user_id') || 'local_user';

            const { data: history, error } = await cloudDb
                .from('chat_history')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true })
                .limit(50);
            if (error) throw error;
            return (history || []).map(r => ({
                userInput: r.user_input,
                aiResponse: r.ai_response
            }));
        }

        throw new Error(`Unsupported direct-to-cloud endpoint: ${endpoint}`);
    } catch (err) {
        console.error(`Direct-to-cloud IPC error on ${endpoint}:`, err);
        throw new Error(err.message);
    }
});

ipcMain.handle('get-sync-status', () => {
    return {
        lastSyncTime: db.getSyncMeta('last_sync_time'),
        deviceId: db.getDeviceId(),
        serverUrl: syncEngine.getServerUrl()
    };
});

ipcMain.handle('trigger-sync', () => {
    syncEngine.triggerSync();
    return { success: true };
});

ipcMain.handle('get-cognitive-profile', () => interactionAdaptation.getAdaptationState());

ipcMain.handle('set-cognitive-profile', (event, profileId) => {
    return interactionAdaptation.setActiveProfile(profileId);
});

ipcMain.handle('get-contextual-presence', (event, metadata) => ({
    line: interactionAdaptation.getContextualPresenceLine(metadata || {}),
    adaptation: interactionAdaptation.getAdaptationState()
}));

// ========================================
// 🔔 PROACTIVITY & DOMAIN CONTROL HANDLERS
// ========================================

ipcMain.handle('get-proactivity-settings', () => userModel.getProactivitySettings());
ipcMain.handle('set-proactivity-mode', (event, mode) => userModel.setProactivityMode(mode));
ipcMain.handle('set-domain-proactivity', (event, domain, level) => userModel.setDomainProactivity(domain, level));
ipcMain.handle('complete-proactivity-onboarding', (event, mode, domainPolicies) => userModel.completeProactivityOnboarding(mode, domainPolicies));
ipcMain.handle('evaluate-proactive-thought', (event, thoughtContext) => userModel.evaluateProactiveThought(thoughtContext));

// ========================================
// 🧠 STATE & DEBUGGING HANDLERS
// ========================================

ipcMain.handle('get-cognitive-state', () => {
    return orchestrator.getState();
});

ipcMain.handle('get-emotional-state', () => {
    return emotionalContinuity.getEmotionalState();
});

ipcMain.handle('detect-emotion-labels', (event, text) => {
    const emotionVocabulary = require('./emotionVocabulary');
    return emotionVocabulary.detect(text || '');
});

ipcMain.handle('get-emotion-vocabulary', () => {
    const emotionVocabulary = require('./emotionVocabulary');
    return emotionVocabulary.getVocabulary();
});

ipcMain.handle('get-identity-state', () => {
    return identityStability.getIdentityState();
});

ipcMain.handle('get-complete-diagnostics', () => {
    const blocked = architecturePolicy.requireFounderLayer('complete diagnostics');
    if (blocked) return blocked;
    return cognitiveDiagnostics.getCompleteDiagnostics();
});

ipcMain.handle('get-observatory-telemetry', () => {
    const blocked = architecturePolicy.requireFounderLayer('observatory telemetry');
    if (blocked) return blocked;
    return observatory.getTelemetryState();
});

ipcMain.handle('get-quick-summary', () => {
    const blocked = architecturePolicy.requireFounderLayer('quick diagnostics summary');
    if (blocked) return blocked;
    return cognitiveDiagnostics.getQuickSummary();
});

// 🧪 STRESS TEST HANDLERS

ipcMain.handle('run-stress-test', (event, scenarioName) => {
    const blocked = architecturePolicy.requireFounderLayer('local stress test');
    if (blocked) return blocked;
    return stressTestEngine.runStressTest(scenarioName);
});

ipcMain.handle('get-coherence-metrics', () => {
    const blocked = architecturePolicy.requireFounderLayer('coherence metrics');
    if (blocked) return blocked;
    return stressTestEngine.getCoherenceMetrics();
});

ipcMain.handle('reset-coherence-metrics', () => {
    const blocked = architecturePolicy.requireFounderLayer('reset coherence metrics');
    if (blocked) return blocked;
    stressTestEngine.resetCoherenceMetrics();
    return { reset: true };
});

ipcMain.handle('get-stress-test-scenarios', () => {
    const blocked = architecturePolicy.requireFounderLayer('stress test scenarios');
    if (blocked) return blocked;
    return Object.keys(stressTestEngine.stressTestScenarios).map(key => ({
        name: key,
        ...stressTestEngine.stressTestScenarios[key]
    }));
});

// 🛡️ SAFETY FRAMEWORK HANDLERS

ipcMain.handle('get-safety-state', () => {
    return safetyFramework.getSafetyState();
});

ipcMain.handle('reset-safety-state', () => {
    safetyFramework.resetSafetyState();
    return { reset: true };
});

ipcMain.handle('trigger-emergency', (event, trigger) => {
    const blocked = architecturePolicy.requireFounderLayer('local safety emergency trigger');
    if (blocked) return blocked;
    safetyFramework.triggerEmergency(trigger);
    return { triggered: true };
});

// ⚡ PERFORMANCE OPTIMIZER HANDLERS

ipcMain.handle('get-performance-metrics', () => {
    return performanceOptimizer.getPerformanceMetrics();
});

ipcMain.handle('set-prioritization-layer', (event, layer) => {
    return performanceOptimizer.setPrioritizationLayer(layer);
});

ipcMain.handle('optimize-for-load', () => {
    return performanceOptimizer.optimizeForLoad();
});

ipcMain.handle('clear-cache', () => {
    performanceOptimizer.clearCache();
    return { cleared: true };
});

ipcMain.handle('get-cache-stats', () => {
    return performanceOptimizer.getCacheStats();
});

// 👁️ PRESENCE REALISM HANDLERS

ipcMain.handle('get-presence-state', () => {
    return presence.getPresenceState();
});

ipcMain.handle('set-pacing', (event, pacing) => {
    return presence.setPacing(pacing);
});

ipcMain.handle('calculate-response-delay', (event, context) => {
    return presence.calculateResponseDelay(context);
});

ipcMain.handle('trigger-natural-pause', () => {
    return presence.startNaturalPause();
});

ipcMain.handle('trigger-re-engagement', () => {
    presence.triggerReEngagement();
    return { triggered: true };
});

// ========================================
// 🧠 COGNITIVE ACTION LAYER HANDLERS
// ========================================

ipcMain.handle('get-daily-reflections', (event) => {
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    const reflectionEngine = require('./reflectionEngine');
    return reflectionEngine.getDailyReflections(userId);
});

ipcMain.handle('get-slipped-tasks', (event, dateKey) => {
    const executiveFunction = require('./executiveFunction');
    return executiveFunction.getSlippedTasks(dateKey);
});

ipcMain.handle('apply-intent-proposals', (event, actions) => {
    return orchestrator.applyIntentProposals(actions);
});

ipcMain.handle('undo-cognitive-action', (event, actionId) => {
    return orchestrator.undoCognitiveAction(actionId);
});

ipcMain.handle('save-reflection-journal', (event, dateKey, journalText) => {
    const rawDb = db.db;
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    const now = Date.now();
    const id = 'rec_' + dateKey.replace(/-/g, '_');

    const row = rawDb.prepare("SELECT content FROM cognitive_memories WHERE id = ?").get(id);
    let reflectionData = {};
    if (row) {
        reflectionData = JSON.parse(row.content);
    } else {
        reflectionData = {
            date: dateKey,
            narrative: "Reflective entry.",
            taskCompletionRate: 0,
            primaryEmotion: 'calm',
            timeline: []
        };
    }

    reflectionData.journalEntry = journalText;

    rawDb.prepare(`
        INSERT OR REPLACE INTO cognitive_memories (id, user_id, memory_type, content, importance_score, created_at, updated_at, device_id, synced, deleted)
        VALUES (?, ?, 'daily_reflection', ?, 5, ?, ?, ?, ?, 0, 0)
    `).run(id, userId, JSON.stringify(reflectionData), now, now, db.getDeviceId());

    return { success: true, content: reflectionData };
});

ipcMain.handle('edit-reflection', (event, dateKey, newNarrative) => {
    const reflectionEngine = require('./reflectionEngine');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return reflectionEngine.editReflection(userId, dateKey, newNarrative);
});

ipcMain.handle('delete-reflection', (event, dateKey) => {
    const reflectionEngine = require('./reflectionEngine');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return reflectionEngine.deleteReflection(userId, dateKey);
});

// ========================================
// 🧠 ADAPTIVE COGNITIVE OS PHASE 5A HANDLERS
// ========================================

ipcMain.handle('get-adaptive-cognitive-profile', (event) => {
    const cognitiveProfile = require('./cognitiveProfile');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return cognitiveProfile.getCognitiveProfile(userId);
});

ipcMain.handle('recalculate-cognitive-profile', (event) => {
    const cognitiveProfile = require('./cognitiveProfile');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return cognitiveProfile.calculateCognitiveProfile(userId);
});

ipcMain.handle('get-goals', (event) => {
    const goalIntelligence = require('./goalIntelligence');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return goalIntelligence.getGoals(userId);
});

ipcMain.handle('add-goal', (event, title, description, targetDate) => {
    const goalIntelligence = require('./goalIntelligence');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return goalIntelligence.addGoal(userId, title, description, targetDate);
});

ipcMain.handle('delete-goal', (event, goalId) => {
    const goalIntelligence = require('./goalIntelligence');
    return goalIntelligence.deleteGoal(goalId);
});

ipcMain.handle('add-project', (event, goalId, title, description) => {
    const goalIntelligence = require('./goalIntelligence');
    return goalIntelligence.addProject(goalId, title, description);
});

ipcMain.handle('add-subject', (event, projectId, name) => {
    const goalIntelligence = require('./goalIntelligence');
    return goalIntelligence.addSubject(projectId, name);
});

ipcMain.handle('update-subject-mastery', (event, subjectId, mastery, quizScore) => {
    const goalIntelligence = require('./goalIntelligence');
    return goalIntelligence.updateSubjectMastery(subjectId, mastery, quizScore);
});

// ========================================
// 🧠 CHRONO OS PHASE 5B - 9 HANDLERS
// ========================================

// 📝 Notes Handlers
ipcMain.handle('get-notes', (event) => {
    const notesService = require('./notesService');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return notesService.getNotes(userId);
});

ipcMain.handle('add-note', (event, title, content, parentNoteId = null, icon = '📝', coverUrl = null, isPinned = 0) => {
    const notesService = require('./notesService');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return notesService.addNote(userId, title, content, parentNoteId, icon, coverUrl, isPinned);
});

ipcMain.handle('edit-note', (event, noteId, title, content, parentNoteId = null, icon = '📝', coverUrl = null, isPinned = 0) => {
    const notesService = require('./notesService');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return notesService.editNote(userId, noteId, title, content, parentNoteId, icon, coverUrl, isPinned);
});

ipcMain.handle('delete-note', (event, noteId) => {
    const notesService = require('./notesService');
    return notesService.deleteNote(noteId);
});

ipcMain.handle('get-revisions', (event, noteId) => {
    const notesService = require('./notesService');
    return notesService.getNoteRevisions(noteId);
});

ipcMain.handle('restore-revision', (event, noteId, revisionId) => {
    const notesService = require('./notesService');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return notesService.restoreNoteRevision(userId, noteId, revisionId);
});

ipcMain.handle('get-flashcards', (event) => {
    const notesService = require('./notesService');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return notesService.getFlashcards(userId);
});

ipcMain.handle('review-flashcard', (event, flashcardId, score) => {
    const notesService = require('./notesService');
    return notesService.reviewFlashcard(flashcardId, score);
});

// 📅 Timetable & Universal Resource Ingestion Handlers
ipcMain.handle('parse-timetable-text', (event, rawText) => {
    const timetableParser = require('./timetableParser');
    return timetableParser.parseTimetableText(rawText);
});

ipcMain.handle('commit-timetable-schedule', (event, scheduleItems) => {
    const timetableParser = require('./timetableParser');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return timetableParser.commitTimetableToWorkspace(userId, scheduleItems);
});

ipcMain.handle('export-timetable', (event, scheduleItems, format) => {
    const timetableParser = require('./timetableParser');
    return timetableParser.exportTimetable(scheduleItems, format);
});

ipcMain.handle('store-resource', (event, title, category, originalName, mimeType, fileSize, storagePath, ocrText) => {
    const timetableParser = require('./timetableParser');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return timetableParser.storeResource(userId, title, category, originalName, mimeType, fileSize, storagePath, ocrText);
});

ipcMain.handle('share-resource', (event, resourceId, targetUserId, permissionLevel) => {
    const timetableParser = require('./timetableParser');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return timetableParser.shareResource(resourceId, userId, targetUserId, permissionLevel);
});

ipcMain.handle('revoke-resource-share', (event, resourceId, targetUserId) => {
    const timetableParser = require('./timetableParser');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return timetableParser.revokeResourceShare(resourceId, userId, targetUserId);
});

ipcMain.handle('access-resource', (event, resourceId) => {
    const timetableParser = require('./timetableParser');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return timetableParser.accessResource(resourceId, userId);
});

// 👥 Relationships & Continuity Threads Handlers
ipcMain.handle('get-relationships', (event) => {
    const continuityThreads = require('./continuityThreads');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    const threads = continuityThreads.getThreads(userId);
    return threads.map(t => ({
        ...t,
        continuityTrend: t.metrics.trend,
        continuityScore: t.metrics.continuityScore
    }));
});

ipcMain.handle('get-relationship-details', (event, peerId) => {
    const continuityThreads = require('./continuityThreads');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    const details = continuityThreads.getThreadDetails(userId, peerId);
    if (details && details.peer && details.metrics) {
        details.peer.continuityTrend = details.metrics.trend;
        details.peer.continuityScore = details.metrics.continuityScore;
        details.peer.reciprocity = details.metrics.reciprocity || 'Balanced';
        details.peer.frequency = details.metrics.frequency || 0;
        details.peer.sharedGoalsCount = details.metrics.sharedGoalsCount || 0;
    }
    return details;
});

ipcMain.handle('add-shared-activity', (event, peerId, type, targetId) => {
    const continuityThreads = require('./continuityThreads');
    return continuityThreads.addSharedActivity(peerId, type, targetId);
});

ipcMain.handle('schedule-joint-session', (event, peerId, title, date, startTime, durationMin) => {
    const continuityThreads = require('./continuityThreads');
    return continuityThreads.scheduleJointSession(peerId, title, date, startTime, durationMin);
});

// 🏆 Shared Milestones Handlers
ipcMain.handle('get-shared-milestones', (event, peerId) => {
    const continuityThreads = require('./continuityThreads');
    return continuityThreads.getSharedMilestones(peerId);
});

ipcMain.handle('add-shared-milestone', (event, milestoneData) => {
    const continuityThreads = require('./continuityThreads');
    return continuityThreads.addSharedMilestone(milestoneData);
});

ipcMain.handle('complete-shared-milestone', (event, milestoneId) => {
    const continuityThreads = require('./continuityThreads');
    return continuityThreads.completeMilestone(milestoneId);
});

ipcMain.handle('delete-shared-milestone', (event, milestoneId) => {
    const continuityThreads = require('./continuityThreads');
    return continuityThreads.deleteMilestone(milestoneId);
});

ipcMain.handle('log-peer-interaction', (event, peerId, type) => {
    const continuityThreads = require('./continuityThreads');
    return continuityThreads.logInteraction(peerId, type);
});

// 💾 Memory OS Handlers
ipcMain.handle('get-memory-cards', (event) => {
    const memoryOS = require('./memoryOS');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return memoryOS.getMemoryCards(userId);
});

ipcMain.handle('search-memories', (event, query) => {
    const memoryOS = require('./memoryOS');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return memoryOS.searchMemories(userId, query);
});

ipcMain.handle('get-linked-memories', (event, text) => {
    const memoryOS = require('./memoryOS');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return memoryOS.getLinkedMemories(userId, text);
});

ipcMain.handle('get-life-continuity', (event) => {
    const memoryOS = require('./memoryOS');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return memoryOS.getLifeContinuity(userId);
});

// 🤖 JARVIS Handlers
ipcMain.handle('get-jarvis-suggestions', (event) => {
    const jarvisLayer = require('./jarvisLayer');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return jarvisLayer.getProactiveSuggestions(userId);
});

// 🌀 Human Continuity & Cognitive Stability Handlers
ipcMain.handle('get-cognitive-fronts', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getCognitiveFronts(userId);
});

ipcMain.handle('get-expansion-metrics', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getExpansionMetrics(userId);
});

ipcMain.handle('get-weekly-audit', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getWeeklyAudit(userId);
});

ipcMain.handle('evaluate-draft-communication', (event, text) => {
    const continuityStability = require('./continuityStability');
    return continuityStability.evaluateDraftCommunication(text);
});

ipcMain.handle('get-loop-detections', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getLoopDetections(userId);
});

ipcMain.handle('get-memory-compression-themes', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getMemoryCompressionThemes(userId);
});

ipcMain.handle('get-values-alignment', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getValuesAlignment(userId);
});

ipcMain.handle('get-continuity-state', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getContinuityState(userId);
});

ipcMain.handle('resolve-loop-intervention', (event, topic, status, action) => {
    const continuityStability = require('./continuityStability');
    return continuityStability.resolveLoopIntervention(topic, status, action);
});

ipcMain.handle('get-configurable-fronts', (event) => {
    const continuityStability = require('./continuityStability');
    return continuityStability.getConfigurableFronts();
});

ipcMain.handle('update-front-category', (event, id, active) => {
    const continuityStability = require('./continuityStability');
    return continuityStability.updateFrontCategory(id, active);
});

ipcMain.handle('get-memory-preservation-scores', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getMemoryPreservationScores(userId);
});

ipcMain.handle('update-memory-preservation', (event, id, type, state) => {
    const continuityStability = require('./continuityStability');
    return continuityStability.updateMemoryPreservation(id, type, state);
});

ipcMain.handle('get-personal-os', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getPersonalOS(userId);
});

ipcMain.handle('get-trust-reliability', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getTrustReliability(userId);
});

ipcMain.handle('get-intervention-adherence', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getInterventionAdherence(userId);
});

ipcMain.handle('get-continuity-index', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getContinuityIndex(userId);
});

ipcMain.handle('get-monthly-narrative', (event) => {
    const continuityStability = require('./continuityStability');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityStability.getMonthlyNarrative(userId);
});

ipcMain.handle('consolidate-yearly-narrative', async (event) => {
    const narrativeCompressor = require('./narrativeCompressor');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return await narrativeCompressor.consolidateNarrativesToYearly(userId);
});

ipcMain.handle('get-context-resurrection', async (event, userId) => {
    const contextResurrection = require('./contextResurrection');
    return await contextResurrection.getContextResurrection(userId);
});

ipcMain.handle('compress-database', async (event) => {
    const contextCompression = require('./contextCompression');
    return contextCompression.compressAndCleanDb();
});

ipcMain.handle('translate-expression-bandwidth', async (event, text, targetMode) => {
    const interactionAdaptation = require('./interactionAdaptation');
    return interactionAdaptation.translateExpressionBandwidth(text, targetMode);
});

// ========================================
// 🚀 AUTO-UPDATE FRAMEWORK CONFIGURATION
// ========================================

let updateStatus = 'Manual updates only';
let updateError = null;

function sendUpdateStatusToWindows() {
    if (win && !win.isDestroyed()) {
        win.webContents.send('auto-update-status', { status: updateStatus, error: updateError });
    }
}

ipcMain.handle('check-for-updates', async () => {
    updateError = null;
    updateStatus = 'Auto-update is disabled until a signed production feed is configured.';
    sendUpdateStatusToWindows();
    return { success: false, status: updateStatus };
});

// =========================================================================
// 🚀 CHRONO SPACES & COMMUNICATION OS (v2.3.0) IPC HANDLERS
// =========================================================================
const chronoSpaces = require('./chronoSpaces');
const communicationOS = require('./communicationOS');

ipcMain.handle('get-spaces', async () => {
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return chronoSpaces.getSpaces(userId);
});

ipcMain.handle('create-space', async (event, { name, description, icon } = {}) => {
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return chronoSpaces.createSpace(userId, name, description, icon);
});

ipcMain.handle('create-chrono-space', async (event, { name, description, icon } = {}) => {
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return chronoSpaces.createSpace(userId, name, description, icon);
});

ipcMain.handle('get-space-details', async (event, spaceId) => {
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return chronoSpaces.getSpaceDetails(spaceId, userId);
});

ipcMain.handle('add-space-member', async (event, { spaceId, targetUserId, displayName, role }) => {
    const requesterId = db.getSyncMeta('auth_user_id') || 'local_user';
    return chronoSpaces.addMember(spaceId, requesterId, targetUserId, displayName, role);
});

ipcMain.handle('link-space-resource', async (event, { spaceId, resourceType, resourceId, title, permissionLevel }) => {
    const requesterId = db.getSyncMeta('auth_user_id') || 'local_user';
    return chronoSpaces.linkResource(spaceId, requesterId, resourceType, resourceId, title, permissionLevel);
});

ipcMain.handle('create-event-proposal', async (event, { spaceId, eventData }) => {
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    const profile = db.getUserProfile();
    const proposerName = profile.name || 'Alen';
    return chronoSpaces.createEventProposal(spaceId, userId, proposerName, eventData);
});

ipcMain.handle('review-space-proposal', async (event, { proposalId, action, feedback }) => {
    const reviewerId = db.getSyncMeta('auth_user_id') || 'local_user';
    return chronoSpaces.reviewProposal(proposalId, reviewerId, action, feedback);
});

ipcMain.handle('send-direct-message', async (event, { recipientId, content, mediaUrl }) => {
    const senderId = db.getSyncMeta('auth_user_id') || 'local_user';
    return communicationOS.sendDirectMessage(senderId, recipientId, content, mediaUrl);
});

ipcMain.handle('get-direct-messages', async (event, peerId) => {
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return communicationOS.getDirectMessages(userId, peerId);
});

ipcMain.handle('webrtc-initiate-call', async (event, { receiverId, callType, sdpOffer }) => {
    const callerId = db.getSyncMeta('auth_user_id') || 'local_user';
    const profile = db.getUserProfile();
    const callerName = profile.name || 'Alen';
    return communicationOS.initiateCall(callerId, callerName, receiverId, callType, sdpOffer);
});

ipcMain.handle('webrtc-answer-call', async (event, { callSessionId, sdpAnswer }) => {
    const receiverId = db.getSyncMeta('auth_user_id') || 'local_user';
    return communicationOS.answerCall(callSessionId, receiverId, sdpAnswer);
});

ipcMain.handle('webrtc-end-call', async (event, { callSessionId, reason }) => {
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return communicationOS.endCall(callSessionId, userId, reason);
});

ipcMain.handle('handle-external-webhook-message', async (event, { platform, senderIdentifier, senderName, rawContent }) => {
    return communicationOS.handleExternalWebhookMessage(platform, senderIdentifier, senderName, rawContent);
});

// 👥 People & Contacts Management Handlers
ipcMain.handle('get-people', (event) => {
    const continuityThreads = require('./continuityThreads');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityThreads.getThreads(userId);
});

ipcMain.handle('add-person', (event, { name, role, email, peerUserId, phone, avatarUrl, country }) => {
    const continuityThreads = require('./continuityThreads');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityThreads.addThread(userId, name, role, email, peerUserId, phone, avatarUrl, country);
});

ipcMain.handle('edit-person', (event, { personId, name, role, email, phone, avatarUrl, country }) => {
    const continuityThreads = require('./continuityThreads');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityThreads.editThread(userId, personId, name, role, email, phone, avatarUrl, country);
});

ipcMain.handle('remove-person', (event, personId) => {
    const continuityThreads = require('./continuityThreads');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return continuityThreads.removeThread(userId, personId);
});

// 📝 Notes Trash, Duplicate & Pinning Handlers
ipcMain.handle('get-trash-notes', (event) => {
    const notesService = require('./notesService');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return notesService.getTrashNotes(userId);
});

ipcMain.handle('restore-note', (event, noteId) => {
    const notesService = require('./notesService');
    return notesService.restoreNote(noteId);
});

ipcMain.handle('permanent-delete-note', (event, noteId) => {
    const notesService = require('./notesService');
    return notesService.permanentDeleteNote(noteId);
});

ipcMain.handle('duplicate-note', (event, noteId) => {
    const notesService = require('./notesService');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return notesService.duplicateNote(userId, noteId);
});

ipcMain.handle('pin-note', (event, noteId, isPinned) => {
    const notesService = require('./notesService');
    return notesService.pinNote(noteId, isPinned);
});

// 📱 Phone Identity & Profile Handlers
ipcMain.handle('save-profile-phone', (event, phone, country = null) => {
    db.setSyncMeta('user_phone', phone);
    if (country) db.setSyncMeta('user_country', country);
    return { success: true, phone, country };
});

ipcMain.handle('get-profile-phone', (event) => {
    const phone = db.getSyncMeta('user_phone') || '';
    const country = db.getSyncMeta('user_country') || '';
    return { phone, country };
});

// 📞 Call History Handlers
ipcMain.handle('get-call-history', (event) => {
    const activeDb = (typeof db.getDb === 'function' ? db.getDb() : db.db || db);
    try {
        return activeDb.prepare(`SELECT * FROM chrono_call_history ORDER BY created_at DESC LIMIT 50`).all();
    } catch (e) {
        return [];
    }
});

ipcMain.handle('clear-call-history', (event) => {
    const activeDb = (typeof db.getDb === 'function' ? db.getDb() : db.db || db);
    try {
        activeDb.prepare(`DELETE FROM chrono_call_history`).run();
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('open-external-url', async (event, url) => {
    try {
        const { shell } = require('electron');
        if (url && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('facetime:') || url.startsWith('tel:') || url.startsWith('whatsapp:') || url.startsWith('mailto:'))) {
            await shell.openExternal(url);
            return { success: true };
        }
        return { success: false, error: "Invalid URL scheme" };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// ========================================

// 🔄 WINDOW LIFECYCLE
// ========================================

app.on('window-all-closed', () => {
    try {
        db.setSyncMeta('last_active_time', Date.now().toString());
    } catch (e) {
        console.error("Failed to save last_active_time on window-all-closed:", e);
    }
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    try {
        db.setSyncMeta('last_active_time', Date.now().toString());
    } catch (e) {
        console.error("Failed to save last_active_time on will-quit:", e);
    }
});

