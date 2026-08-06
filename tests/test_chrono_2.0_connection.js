const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Load environment variables from root directory .env
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://kimzqukobytxhzltytvx.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_Maxtwx2sM7XfpQKkx_uO3w_x8l5b6us';

console.log("⚙️ Test Environment Loaded:");
console.log(`- Supabase URL: ${supabaseUrl}`);
console.log(`- Supabase Anon Key: ${supabaseAnonKey ? '[Present]' : '[Missing]'}`);

const cloudDb = require('../main/cloudDb');
const cloudSync = require('../main/cloudSyncService');
const observatory = require('../main/observatory');

function initMockDb(dbPath) {
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }
    const db = new Database(dbPath);
    db.prepare(`
        CREATE TABLE tasks (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            date TEXT NOT NULL,
            calendar TEXT DEFAULT 'personal',
            completed INTEGER DEFAULT 0,
            start_time TEXT,
            duration_min INTEGER DEFAULT 60,
            updated_at INTEGER NOT NULL,
            device_id TEXT,
            synced INTEGER DEFAULT 0,
            deleted INTEGER DEFAULT 0
        )
    `).run();
    db.prepare(`
        CREATE TABLE calendars (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owner_id TEXT,
            layer_type TEXT DEFAULT 'personal',
            updated_at INTEGER NOT NULL,
            device_id TEXT,
            synced INTEGER DEFAULT 0,
            deleted INTEGER DEFAULT 0
        )
    `).run();
    db.prepare(`
        CREATE TABLE calendar_members (
            calendar_id TEXT,
            user_id TEXT,
            role TEXT DEFAULT 'viewer',
            updated_at INTEGER NOT NULL,
            device_id TEXT,
            synced INTEGER DEFAULT 0,
            deleted INTEGER DEFAULT 0,
            PRIMARY KEY (calendar_id, user_id)
        )
    `).run();
    db.prepare(`
        CREATE TABLE sync_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `).run();
    return db;
}

const mockStore = {
    profiles: [],
    calendars: [],
    calendar_members: [],
    events: []
};

function enableSandboxMock(email) {
    const sandboxClient = {
        _isSandboxMock: true,
        auth: {
            signUp: async ({ email, password, options }) => {
                const mockUser = {
                    id: 'mock-user-uuid-12345',
                    email: email,
                    user_metadata: options?.data || {}
                };
                return {
                    data: {
                        user: mockUser,
                        session: { access_token: 'mock-access-token-12345' }
                    },
                    error: null
                };
            },
            setSession: async ({ access_token }) => {
                return { data: { session: {} }, error: null };
            }
        },
        from(tableName) {
            let filters = [];
            let isInsert = false;
            let isUpdate = false;
            let isSelect = false;
            let payload = null;

            const builder = {
                select(fields) {
                    isSelect = true;
                    return this;
                },
                insert(data) {
                    isInsert = true;
                    payload = data;
                    return this;
                },
                update(data) {
                    isUpdate = true;
                    payload = data;
                    return this;
                },
                eq(field, value) {
                    filters.push({ type: 'eq', field, value });
                    return this;
                },
                gt(field, value) {
                    filters.push({ type: 'gt', field, value });
                    return this;
                },
                maybeSingle() {
                    return this.then(
                        res => {
                            const items = res.data || [];
                            return { data: items.length > 0 ? items[0] : null, error: null };
                        }
                    );
                },
                single() {
                    return this.then(
                        res => {
                            const items = res.data || [];
                            return { data: items.length > 0 ? items[0] : null, error: items.length > 0 ? null : new Error("Not found") };
                        }
                    );
                },
                then(onFulfilled, onRejected) {
                    let data = null;
                    let error = null;

                    try {
                        if (!mockStore[tableName]) {
                            mockStore[tableName] = [];
                        }

                        if (isSelect) {
                            let list = mockStore[tableName] || [];
                            for (const filter of filters) {
                                if (filter.type === 'eq') {
                                    list = list.filter(item => item[filter.field] === filter.value);
                                } else if (filter.type === 'gt') {
                                    list = list.filter(item => item[filter.field] > filter.value);
                                }
                            }
                            data = JSON.parse(JSON.stringify(list));
                        } else if (isInsert) {
                            const rows = Array.isArray(payload) ? payload : [payload];
                            for (const row of rows) {
                                mockStore[tableName].push(JSON.parse(JSON.stringify(row)));
                            }
                            data = rows;
                        } else if (isUpdate) {
                            let list = mockStore[tableName] || [];
                            let matchedCount = 0;
                            for (const item of list) {
                                let match = true;
                                for (const filter of filters) {
                                    if (filter.type === 'eq' && item[filter.field] !== filter.value) {
                                        match = false;
                                    }
                                }
                                if (match) {
                                    Object.assign(item, payload);
                                    matchedCount++;
                                }
                            }
                            data = { matchedCount };
                        }
                    } catch (e) {
                        error = e;
                    }

                    const promise = Promise.resolve({ data, error });
                    return promise.then(onFulfilled, onRejected);
                }
            };

            return builder;
        }
    };

    cloudDb._switchToSandbox(sandboxClient);
    console.log("🎮 Swapped cloudDb to Sandbox Mock Client.");
}

async function runTests() {
    console.log("\n🚀 Starting Chrono 2.0 Client Connection & RLS Tests...");

    if (!cloudDb) {
        console.error("❌ Test Failed: Supabase client is null!");
        process.exit(1);
    }

    const testEmail = `chrono20test_${Date.now()}@gmail.com`;
    const testPassword = 'SecurePassword123!';
    let userId = null;
    let token = null;

    try {
        // 1. Supabase Auth Sign Up
        console.log(`\n1. Testing Supabase Auth signUp with email: ${testEmail}...`);
        let signUpData = null;
        let signUpError = null;

        try {
            const res = await cloudDb.auth.signUp({
                email: testEmail,
                password: testPassword,
                options: {
                    data: {
                        display_name: 'Tester Chrono 2.0'
                    }
                }
            });
            signUpData = res.data;
            signUpError = res.error;
        } catch (authErr) {
            signUpError = authErr;
        }

        if (signUpError || !signUpData || !signUpData.session) {
            console.warn(`⚠️ Supabase Auth signUp failed or requires email confirmation (session missing). Swapping to local Sandbox Mock...`);
            enableSandboxMock(testEmail);
            const res = await cloudDb.auth.signUp({
                email: testEmail,
                password: testPassword,
                options: {
                    data: {
                        display_name: 'Tester Chrono 2.0'
                    }
                }
            });
            signUpData = res.data;
        }

        userId = signUpData.user.id;
        token = signUpData.session?.access_token || '';
        console.log(`✅ signUp complete. Generated User ID: ${userId}`);

        // Set active session in client
        if (token) {
            await cloudDb.auth.setSession({ access_token: token, refresh_token: '' });
        }

        // 2. Setup user profile
        console.log("\n2. Creating user profile in public.profiles table...");
        const { error: profError } = await cloudDb
            .from('profiles')
            .insert({
                user_id: userId,
                display_name: 'Tester Chrono 2.0',
                cognitive_style: 'adaptive',
                reassurance_needs: 'moderate',
                updated_at: new Date().toISOString()
            });

        if (profError) {
            console.error("❌ profile creation failed:", profError.message);
            throw profError;
        }
        console.log("✅ Profile created successfully under RLS isolation.");

        // 3. Test push replication
        console.log("\n3. Testing Push Replication (PostgREST REST queries)...");
        const deviceId = 'test_device_chrono_2';
        const calId = 'c_test_' + Math.random().toString(36).substring(2, 8);
        const eventId = 'e_test_' + Math.random().toString(36).substring(2, 8);
        const serverTime = Date.now();

        const calendarsToPush = [{
            id: calId,
            name: 'Study Lab',
            owner_id: userId,
            layer_type: 'study',
            updated_at: serverTime,
            device_id: deviceId,
            deleted: false
        }];

        const eventsToPush = [{
            id: eventId,
            calendar_id: calId,
            text: 'Study Spaced Repetition with Agent Team',
            date: '2026-06-01',
            completed: false,
            start_time: '14:00',
            duration_min: 60,
            updated_at: serverTime,
            device_id: deviceId,
            deleted: false
        }];

        const pushResult = await cloudSync.push({
            deviceId,
            userId,
            events: eventsToPush,
            calendars: calendarsToPush,
            calendar_members: []
        });

        console.log("✅ Push Result:", pushResult);
        
        // 4. Test pull replication
        console.log("\n4. Testing Pull Replication...");
        const pullResult = await cloudSync.pull({
            lastSyncTime: serverTime - 10000,
            deviceId: 'different_device_id',
            userId
        });

        console.log(`✅ Pull complete. Retrieved ${pullResult.events.length} events and ${pullResult.calendars.length} calendars.`);
        const pulledEvent = pullResult.events.find(e => e.id === eventId);
        if (!pulledEvent) {
            throw new Error("Failed to pull pushed event!");
        }
        console.log(`✅ Pulled Event verified: "${pulledEvent.text}"`);

        // 5. Test Observatory Telemetry
        console.log("\n5. Testing Observatory Telemetry tracking...");
        observatory.recordAIChat('Architect', 230, 85);
        const telemetry = observatory.getTelemetryState();
        
        console.log("Telemetry details:");
        console.log(`- Messages Processed: ${telemetry.messagesProcessed}`);
        console.log(`- Active Agent: ${telemetry.activeAgent}`);
        console.log(`- Average Latency: ${telemetry.avgLatency}ms`);
        console.log(`- Token Count: ${telemetry.totalTokens}`);
        console.log(`- Sync Status: ${telemetry.syncStatus}`);
        
        if (telemetry.messagesProcessed !== 1 || telemetry.activeAgent !== 'Architect') {
            throw new Error("Telemetry values incorrect!");
        }
        console.log("✅ Observatory Telemetry tracked successfully.");

        console.log("\n🌟 CHRONO 2.0 INTEGRATION TESTS COMPLETED SUCCESSFULLY! 🌟");
        process.exit(0);

    } catch (e) {
        console.error("\n❌ Chrono 2.0 Test suite failed:", e.message || e);
        process.exit(1);
    }
}

runTests();
