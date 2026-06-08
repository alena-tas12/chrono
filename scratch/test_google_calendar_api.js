const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

console.log("⚙️ Initializing Google Calendar Sync Test environment...");

// Mock main_db database module
const testDbPath = path.join(__dirname, 'chrono_test_gcal.db');
if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
}
const db = new Database(testDbPath);

// Initialize DB schema required for the sync
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
        deleted INTEGER DEFAULT 0,
        goal_id TEXT,
        project_id TEXT,
        subject_id TEXT,
        visibility TEXT DEFAULT 'private',
        shared_with TEXT DEFAULT '[]',
        importance_score INTEGER DEFAULT 5,
        impact_score INTEGER DEFAULT 5
    )
`).run();

db.prepare(`
    CREATE TABLE sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT
    )
`).run();

// Seed the mock google_provider_token
db.prepare("INSERT INTO sync_meta (key, value) VALUES ('google_provider_token', 'mock_google_api_key_112233')").run();
db.prepare("INSERT INTO sync_meta (key, value) VALUES ('device_id', 'test_gcal_device')").run();

// Mock the main_db exports
const mainDb = require('../main/main_db');
const originalDb = mainDb.db;
const originalGetSyncMeta = mainDb.getSyncMeta;
const originalGetDeviceId = mainDb.getDeviceId;

mainDb.db = db;
mainDb.getSyncMeta = (key) => {
    const row = db.prepare("SELECT value FROM sync_meta WHERE key = ?").get(key);
    return row ? row.value : null;
};
mainDb.getDeviceId = () => 'test_gcal_device';

// Mock mock Google Calendar Events API response
const mockGcalEvents = {
    items: [
        {
            id: 'gcal_event_001',
            status: 'confirmed',
            summary: 'Calculus Study Group with Princess',
            updated: '2026-06-01T04:00:00.000Z',
            start: {
                dateTime: '2026-06-02T14:00:00+05:30'
            },
            end: {
                dateTime: '2026-06-02T15:30:00+05:30'
            }
        },
        {
            id: 'gcal_event_002',
            status: 'confirmed',
            summary: 'All Day Embedded Systems Lab',
            updated: '2026-06-01T04:30:00.000Z',
            start: {
                date: '2026-06-03'
            },
            end: {
                date: '2026-06-04'
            }
        },
        {
            id: 'gcal_event_003',
            status: 'cancelled' // Should be ignored
        }
    ]
};

// Mock global fetch
global.fetch = async (url, options) => {
    console.log(`[Mock Fetch] Intercepted Google API call: ${url}`);
    
    // Validate authorization header
    const authHeader = options.headers['Authorization'];
    if (authHeader !== 'Bearer mock_google_api_key_112233') {
        return {
            ok: false,
            status: 401,
            text: async () => 'Unauthorized scope or invalid token'
        };
    }

    return {
        ok: true,
        status: 200,
        json: async () => mockGcalEvents
    };
};

const { syncGoogleCalendar } = require('../main/googleCalendarSync');

async function runTest() {
    console.log("\n🚀 Running Google Calendar Sync Logic Tests...");
    try {
        const res = await syncGoogleCalendar('test_user_id');
        console.log("Result:", res);

        if (!res.success) {
            throw new Error(`Sync returned failure: ${res.error}`);
        }

        // Verify tasks in SQLite
        const tasks = db.prepare("SELECT * FROM tasks").all();
        console.log(`\n📋 Tasks in SQLite database (${tasks.length} found):`);
        tasks.forEach(t => {
            console.log(`- [${t.id}] "${t.text}" on ${t.date} at ${t.start_time} (duration: ${t.duration_min}m)`);
        });

        if (tasks.length !== 2) {
            throw new Error(`Expected exactly 2 synced tasks, found ${tasks.length}`);
        }

        const task1 = tasks.find(t => t.id === 'e_gcal_gcal_event_001');
        if (!task1 || task1.text !== 'Calculus Study Group with Princess' || task1.start_time !== '14:00' || task1.duration_min !== 90) {
            throw new Error("Task 1 mapping variables are incorrect!");
        }

        const task2 = tasks.find(t => t.id === 'e_gcal_gcal_event_002');
        if (!task2 || task2.text !== 'All Day Embedded Systems Lab' || task2.start_time !== null || task2.duration_min !== 1440) {
            throw new Error("Task 2 (all-day event) mapping variables are incorrect!");
        }

        console.log("\n✅ Test 1 Passed: Correctly parsed dates, start times, and durations.");

        // Re-run sync to check duplicate detection (reconciliation)
        console.log("\nTesting reconciliation (re-running sync with no changes)...");
        const res2 = await syncGoogleCalendar('test_user_id');
        console.log("Result:", res2);
        
        if (res2.imported !== 0) {
            throw new Error(`Expected 0 imported on re-run, got ${res2.imported}`);
        }
        console.log("✅ Test 2 Passed: Correctly filtered unchanged duplicates.");

        // Simulate updated event on Google
        console.log("\nSimulating updated event on Google...");
        mockGcalEvents.items[0].summary = 'Calculus Study Group with Princess (Advanced)';
        mockGcalEvents.items[0].updated = new Date().toISOString();

        const res3 = await syncGoogleCalendar('test_user_id');
        console.log("Result:", res3);

        const updatedTask1 = db.prepare("SELECT * FROM tasks WHERE id = ?").get('e_gcal_gcal_event_001');
        console.log("Updated Task Text:", updatedTask1.text);
        if (updatedTask1.text !== 'Calculus Study Group with Princess (Advanced)') {
            throw new Error("Task was not updated to reflect newer remote modified timestamp!");
        }
        console.log("✅ Test 3 Passed: Correctly resolved and updated event when remote changes occurred.");

        console.log("\n🌟 GOOGLE CALENDAR SYNC INTEGRATION TESTS PASSED SUCCESSFULLY! 🌟");
        cleanup();
        process.exit(0);

    } catch (e) {
        console.error("\n❌ Test Failed:", e.message || e);
        cleanup();
        process.exit(1);
    }
}

function cleanup() {
    // Restore originals
    mainDb.db = originalDb;
    mainDb.getSyncMeta = originalGetSyncMeta;
    mainDb.getDeviceId = originalGetDeviceId;

    db.close();
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
}

runTest();
