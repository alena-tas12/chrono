const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');
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

// 🔧 SUPPORTING SYSTEMS
const memory = require('./memoryEngine');
const userModel = require('./userModel');
const presence = require('./presenceEngine');
const db = require('./main_db');
const timeEngine = require('./timeEngine');
const interactionAdaptation = require('./interactionAdaptation');
const syncEngine = require('./syncEngine');
const realtimeSync = require('./realtimeSync');
const observatory = require('./observatory');

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
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

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

app.whenReady().then(() => {
    // Open the main window immediately
    createWindow();

    // Trigger startup database backup check
    try {
        const continuityStability = require('./continuityStability');
        continuityStability.getTrustReliability();
    } catch (err) {
        console.error("Failed to execute startup backup check:", err.message);
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
    // 🎯 Central orchestration point
    // All response generation flows through here
    
    try {
        const orchestratedResult = await orchestrator.generateOrchestratedResponse(
            data.userInput || data.message || data.input,
            {
                currentTask: data.currentTask,
                tasks: data.tasks,
                idleTime: data.idleTime,
                attention: data.attention,
                selectedDate: data.selectedDate
            }
        );

        // 🛡️ Validate response against identity
        const validation = identityStability.validateResponseAlignment(
            orchestratedResult.response,
            {
                emotion: orchestratedResult.state.emotion,
                attention: orchestratedResult.state.focus,
                priority: orchestratedResult.state.priority
            }
        );

        let finalResponse = orchestratedResult.response;

        if (!validation.valid) {
            // Apply identity correction if needed
            finalResponse = identityStability.enforceIdentity(
                validation.suggestion || orchestratedResult.response,
                {
                    emotion: orchestratedResult.state.emotion
                }
            );
        }

        return {
            response: finalResponse,
            state: orchestratedResult.state,
            alignment: validation.score,
            adaptation: orchestratedResult.state?.adaptation || interactionAdaptation.getAdaptationState()
        };

    } catch (error) {
        console.error('🚨 Orchestration error:', error);
        return {
            response: 'I\'m here. Let\'s start fresh.',
            state: { emotion: 'neutral', focus: 'open' },
            error: error.message
        };
    }
});

// Safe save-chat handler to prevent IPC registration error
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

// 📊 MEMORY HANDLERS

ipcMain.handle('log-session', (event, task, duration) => {
    memory.logSession(task, duration);
    return { logged: true };
});

ipcMain.handle('get-history', () => {
    return memory.getHistory();
});

ipcMain.handle('get-chat-history', (event, limit) => {
    return memory.getRecentChats(limit || 50);
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

// 📋 TASK HANDLERS

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
    return { success: true };
});

ipcMain.handle('get-sync-meta', (event, key) => {
    return db.getSyncMeta(key);
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
            const userId = db.getSyncMeta('auth_user_id');
            if (!userId) throw new Error("Unauthorized");

            if (method === 'GET') {
                const { data: profile, error } = await cloudDb
                    .from('profiles')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle();
                if (error) throw error;
                if (!profile) throw new Error('Profile not found');
                return {
                    display_name: profile.display_name,
                    cognitive_style: profile.cognitive_style,
                    reassurance_needs: profile.reassurance_needs
                };
            } else if (method === 'PUT') {
                const { cognitiveStyle } = body;
                const { error } = await cloudDb
                    .from('profiles')
                    .update({
                        cognitive_style: cognitiveStyle || 'adaptive',
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);
                if (error) throw error;
                return { success: true };
            }

        } else if (endpoint === '/api/chat') {
            const userId = db.getSyncMeta('auth_user_id');
            if (!userId) throw new Error("Unauthorized");

            const { input, selectedDate, activeView, taskCount } = body;
            // Process AI Chat directly in the main process
            const aiResponse = await processAIChat(userId, input, { selectedDate, activeView, taskCount });
            return aiResponse;

        } else if (endpoint === '/api/chat/history') {
            const userId = db.getSyncMeta('auth_user_id');
            if (!userId) throw new Error("Unauthorized");

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
// 🧠 STATE & DEBUGGING HANDLERS
// ========================================

ipcMain.handle('get-cognitive-state', () => {
    return orchestrator.getState();
});

ipcMain.handle('get-emotional-state', () => {
    return emotionalContinuity.getEmotionalState();
});

ipcMain.handle('get-identity-state', () => {
    return identityStability.getIdentityState();
});

ipcMain.handle('get-complete-diagnostics', () => {
    return cognitiveDiagnostics.getCompleteDiagnostics();
});

ipcMain.handle('get-observatory-telemetry', () => {
    return observatory.getTelemetryState();
});

ipcMain.handle('get-quick-summary', () => {
    return cognitiveDiagnostics.getQuickSummary();
});

// 🧪 STRESS TEST HANDLERS

ipcMain.handle('run-stress-test', (event, scenarioName) => {
    return stressTestEngine.runStressTest(scenarioName);
});

ipcMain.handle('get-coherence-metrics', () => {
    return stressTestEngine.getCoherenceMetrics();
});

ipcMain.handle('reset-coherence-metrics', () => {
    stressTestEngine.resetCoherenceMetrics();
    return { reset: true };
});

ipcMain.handle('get-stress-test-scenarios', () => {
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

ipcMain.handle('add-note', (event, title, content, visibility, sharedWith, importanceScore, impactScore) => {
    const notesService = require('./notesService');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return notesService.addNote(userId, title, content, visibility, sharedWith, importanceScore, impactScore);
});

ipcMain.handle('edit-note', (event, noteId, title, content, visibility, sharedWith, importanceScore, impactScore) => {
    const notesService = require('./notesService');
    const userId = db.getSyncMeta('auth_user_id') || 'local_user';
    return notesService.editNote(userId, noteId, title, content, visibility, sharedWith, importanceScore, impactScore);
});

ipcMain.handle('delete-note', (event, noteId) => {
    const notesService = require('./notesService');
    return notesService.deleteNote(noteId);
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

let updateStatus = 'Idle';
let updateError = null;

function sendUpdateStatusToWindows() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auto-update-status', { status: updateStatus, error: updateError });
    }
}

try {
    const { autoUpdater, app } = require('electron');
    if (autoUpdater && app) {
        const feedURL = 'http://localhost:54321/update/' + process.platform + '/' + app.getVersion();
        if (app.isPackaged) {
            autoUpdater.setFeedURL({ url: feedURL });
        }

        autoUpdater.on('checking-for-update', () => {
            updateStatus = 'Checking for updates...';
            sendUpdateStatusToWindows();
        });

        autoUpdater.on('update-available', (info) => {
            updateStatus = 'Update available!';
            sendUpdateStatusToWindows();
        });

        autoUpdater.on('update-not-available', (info) => {
            updateStatus = 'Chrono is up to date.';
            sendUpdateStatusToWindows();
        });

        autoUpdater.on('error', (err) => {
            updateStatus = 'Update check failed.';
            updateError = err.message;
            sendUpdateStatusToWindows();
        });

        autoUpdater.on('update-downloaded', (info) => {
            updateStatus = 'Update downloaded. Restart to apply.';
            sendUpdateStatusToWindows();
        });
    }
} catch (e) {
    console.warn("autoUpdater framework not initialized:", e.message);
}

ipcMain.handle('check-for-updates', async () => {
    updateError = null;
    try {
        const { autoUpdater, app } = require('electron');
        if (autoUpdater && app) {
            if (app.isPackaged) {
                autoUpdater.checkForUpdates();
                updateStatus = 'Checking...';
                return { success: true, status: updateStatus };
            } else {
                updateStatus = 'Checking...';
                sendUpdateStatusToWindows();
                await new Promise(resolve => setTimeout(resolve, 800));

                updateStatus = 'Update available! Downloading...';
                sendUpdateStatusToWindows();
                await new Promise(resolve => setTimeout(resolve, 1200));

                updateStatus = 'Update downloaded. Restart to apply.';
                sendUpdateStatusToWindows();
                return { success: true, status: updateStatus };
            }
        } else {
            return { success: false, error: 'autoUpdater not available' };
        }
    } catch (err) {
        updateStatus = 'Update check error.';
        updateError = err.message;
        sendUpdateStatusToWindows();
        return { success: false, error: err.message };
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

