const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.includes('[YOUR-PASSWORD]')) {
    console.log("⚠️ TEST SKIPPED: Please edit your .env file and replace [YOUR-PASSWORD] with your actual Supabase database password to run this test.");
    process.exit(0);
}

// Import client modules
const cloudDb = require('../main/cloudDb');
const cloudSync = require('../main/cloudSyncService');
const bcrypt = require('bcryptjs');

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
    return db;
}

async function runDirectTests() {
    console.log("🚀 Starting Direct-to-Supabase Offline-First Sync Integration Tests...");

    const dbPathA = path.join(__dirname, 'chrono_direct_A.db');
    const dbPathB = path.join(__dirname, 'chrono_direct_B.db');

    const dbA = initMockDb(dbPathA);
    const dbB = initMockDb(dbPathB);

    const deviceIdA = 'device_vian_direct_laptop';
    const deviceIdB = 'device_princess_direct_phone';

    try {
        // 1. User Registration on Supabase Directly
        console.log("\n1. Registering user on Supabase directly via Prisma...");
        const email = `supabase_direct_${Date.now()}@example.com`;
        const password = 'password123';
        const displayName = 'Supabase Direct User';
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = 'u_' + Math.random().toString(36).substring(2, 11);

        await cloudDb.user.create({
            data: {
                id: userId,
                email,
                password_hash: hashedPassword,
                profile: {
                    create: {
                        display_name: displayName,
                        cognitive_style: 'adaptive'
                    }
                }
            }
        });

        // Create default calendars for test user on Supabase directly
        const defaultLayers = ['Personal', 'Study', 'Routine', 'Focus'];
        const serverTime = Date.now();
        for (const layer of defaultLayers) {
            const calId = 'c_' + Math.random().toString(36).substring(2, 11);
            await cloudDb.calendar.create({
                data: {
                    id: calId,
                    name: layer,
                    owner_id: userId,
                    layer_type: layer.toLowerCase(),
                    updated_at: BigInt(serverTime),
                    device_id: 'server',
                    deleted: 0
                }
            });
            await cloudDb.calendarMember.create({
                data: {
                    calendar_id: calId,
                    user_id: userId,
                    role: 'owner',
                    updated_at: BigInt(serverTime),
                    device_id: 'server',
                    deleted: 0
                }
            });
        }

        console.log(`✅ User ${email} registered and default calendars created successfully on Supabase directly.`);

        // 2. Device A pulls initial default calendars
        console.log("\n2. Device A pulls initial default calendars from Supabase...");
        const initialPull = await cloudSync.pull({ lastSyncTime: 0, deviceId: deviceIdA, userId });
        console.log(`✅ Pulled ${initialPull.calendars.length} default calendars.`);

        // Insert pulled calendars into Device A's SQLite
        for (const cal of initialPull.calendars) {
            dbA.prepare(`
                INSERT INTO calendars (id, name, owner_id, layer_type, updated_at, device_id, synced, deleted)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0)
            `).run(cal.id, cal.name, cal.owner_id, cal.layer_type, cal.updated_at, cal.device_id);
        }

        const studyCal = initialPull.calendars.find(c => c.layer_type === 'study') || initialPull.calendars[0];

        // 3. Device A creates a task locally (Offline)
        console.log("\n3. Device A schedules a task locally (offline)...");
        const taskId = 'e_direct_task_123';
        const taskText = "Study Advanced DSA with Princess directly on Supabase";
        const taskDate = "2026-06-01";
        const timeA = Date.now();

        dbA.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        `).run(taskId, taskText, taskDate, studyCal.id, 0, '09:00', 90, timeA, deviceIdA);

        const localCountA = dbA.prepare("SELECT COUNT(*) as count FROM tasks").get().count;
        console.log(`✅ Task saved to Device A's chrono_direct_A.db. Local task count: ${localCountA}`);

        // 4. Device A goes online and syncs (Push to Supabase)
        console.log("\n4. Device A pushes local unsynced task to Supabase...");
        const unsyncedA = dbA.prepare("SELECT * FROM tasks WHERE synced = 0").all();
        
        await cloudSync.push({
            deviceId: deviceIdA,
            userId,
            events: unsyncedA.map(e => ({ ...e, completed: e.completed === 1, deleted: e.deleted === 1 })),
            calendars: [],
            calendar_members: []
        });

        dbA.prepare("UPDATE tasks SET synced = 1 WHERE id = ?").run(taskId);
        console.log("✅ Device A push complete. Synced flag set to 1 in local database.");

        // 5. Device B goes online and pulls updates (Pull from Supabase)
        console.log("\n5. Device B pulls updates from Supabase...");
        const pullB = await cloudSync.pull({ lastSyncTime: 0, deviceId: deviceIdB, userId });
        console.log(`✅ Device B pulled ${pullB.events.length} events from Supabase.`);

        // Assert B retrieved the task created by A
        const pulledEvent = pullB.events.find(e => e.id === taskId);
        if (!pulledEvent) {
            throw new Error("Device B failed to pull the task created by Device A!");
        }
        console.log(`✅ Pulled task verified: "${pulledEvent.text}"`);

        // Reconcile and save in Device B's SQLite database
        dbB.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
        `).run(pulledEvent.id, pulledEvent.text, pulledEvent.date, pulledEvent.calendar, pulledEvent.completed ? 1 : 0, pulledEvent.start_time, pulledEvent.duration_min, pulledEvent.updated_at, pulledEvent.device_id);

        const localCountB = dbB.prepare("SELECT COUNT(*) as count FROM tasks").get().count;
        console.log(`✅ Task successfully synchronized to Device B's chrono_direct_B.db. Local task count: ${localCountB}`);

        // 6. Test Conflict Resolution: Newest Version Wins
        console.log("\n6. Testing Conflict Resolution (Newest Version Wins)...");
        // Device B updates the task first at T1
        const timeB1 = Date.now() - 5000;
        dbB.prepare(`
            UPDATE tasks SET text = ?, updated_at = ?, device_id = ?, synced = 0 WHERE id = ?
        `).run("Study Advanced DSA - Basic Edition Direct", timeB1, deviceIdB, taskId);

        // Device A updates the task later at T2 (T2 > T1)
        const timeA2 = Date.now();
        dbA.prepare(`
            UPDATE tasks SET text = ?, updated_at = ?, device_id = ?, synced = 0 WHERE id = ?
        `).run("Study Advanced DSA - Ultimate Edition Direct", timeA2, deviceIdA, taskId);

        // Device B pushes first (T1)
        console.log("Device B pushes update (T1)...");
        const unsyncedB = dbB.prepare("SELECT * FROM tasks WHERE synced = 0").all();
        await cloudSync.push({
            deviceId: deviceIdB,
            userId,
            events: unsyncedB.map(e => ({ ...e, completed: e.completed === 1, deleted: e.deleted === 1 }))
        });
        dbB.prepare("UPDATE tasks SET synced = 1 WHERE id = ?").run(taskId);

        // Device A pushes second (T2)
        console.log("Device A pushes update (T2)...");
        const unsyncedA2 = dbA.prepare("SELECT * FROM tasks WHERE synced = 0").all();
        await cloudSync.push({
            deviceId: deviceIdA,
            userId,
            events: unsyncedA2.map(e => ({ ...e, completed: e.completed === 1, deleted: e.deleted === 1 }))
        });
        dbA.prepare("UPDATE tasks SET synced = 1 WHERE id = ?").run(taskId);

        // Device B pulls updates to reconcile
        console.log("Device B pulls T2 update to reconcile...");
        const pullB2 = await cloudSync.pull({ lastSyncTime: 0, deviceId: deviceIdB, userId });
        const reconciledEvent = pullB2.events.find(e => e.id === taskId);
        
        console.log(`Reconciled event text: "${reconciledEvent.text}"`);
        if (reconciledEvent.text !== "Study Advanced DSA - Ultimate Edition Direct") {
            throw new Error("Conflict resolution failed! Newest version did not win.");
        }
        console.log("✅ Conflict Resolution passed: T2 (Ultimate Edition) successfully overwrote T1.");

        // 7. Test Soft Deletion Sync
        console.log("\n7. Testing Soft Deletion Sync...");
        const timeB3 = Math.max(Date.now(), timeA2 + 1000);
        dbB.prepare(`
            UPDATE tasks SET deleted = 1, updated_at = ?, device_id = ?, synced = 0 WHERE id = ?
        `).run(timeB3, deviceIdB, taskId);

        // Push deletion from B
        console.log("Device B pushes deletion...");
        const unsyncedB_Del = dbB.prepare("SELECT * FROM tasks WHERE synced = 0").all();
        await cloudSync.push({
            deviceId: deviceIdB,
            userId,
            events: unsyncedB_Del.map(e => ({ ...e, completed: e.completed === 1, deleted: e.deleted === 1 }))
        });
        dbB.prepare("UPDATE tasks SET synced = 1 WHERE id = ?").run(taskId);

        // Device A pulls deletion
        console.log("Device A pulls deletion...");
        const pullA_Del = await cloudSync.pull({ lastSyncTime: 0, deviceId: deviceIdA, userId });
        const deletedEvent = pullA_Del.events.find(e => e.id === taskId);
        
        console.log(`Deleted event flag from Supabase: ${deletedEvent.deleted}`);
        if (deletedEvent.deleted !== 1) {
            throw new Error("Soft delete was not synced to Supabase/pull!");
        }

        dbA.prepare("UPDATE tasks SET deleted = 1, updated_at = ?, synced = 1 WHERE id = ?").run(deletedEvent.updated_at, taskId);
        
        const activeCountA = dbA.prepare("SELECT COUNT(*) as count FROM tasks WHERE deleted = 0").get().count;
        console.log(`✅ Soft Deletion passed. Device A active tasks count: ${activeCountA}`);

        console.log("\n🌟 ALL DIRECT-TO-SUPABASE SYNC TESTS PASSED! 🌟");

    } catch (e) {
        console.error("❌ Direct Supabase Integration Test failed:", e);
        process.exit(1);
    } finally {
        // Clean up databases
        dbA.close();
        dbB.close();
        if (fs.existsSync(dbPathA)) fs.unlinkSync(dbPathA);
        if (fs.existsSync(dbPathB)) fs.unlinkSync(dbPathB);
        process.exit(0);
    }
}

runDirectTests();
