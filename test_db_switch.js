const path = require('path');
const fs = require('fs');

(async () => {
    try {
        // Ensure test user data path is used when Electron is not present
        const testData = path.join(__dirname, 'chrono_app_test_data');
        process.env.CHRONO_USER_DATA = testData;
        if (!fs.existsSync(testData)) fs.mkdirSync(testData, { recursive: true });

        const dbMod = require('./main/main_db');
        console.log('Initial activeUserId:', dbMod.getActiveUserId());
        const db = dbMod.db;
        // run a harmless query
        const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1").get();
        console.log('sqlite_master sample table:', row && row.name);

        const newUser = 'test_user_123@example.com';
        console.log('Switching to', newUser);
        dbMod.setSyncMeta('auth_user_id', newUser);
        console.log('After switch activeUserId:', dbMod.getActiveUserId());

        const userDbPath = dbMod.getUserDbPath(newUser);
        console.log('Expected user DB path:', userDbPath);
        console.log('User DB exists:', fs.existsSync(userDbPath));

        // Write a marker into the user DB and read it back
        const markerId = 't_marker_' + Math.random().toString(36).slice(2,8);
        db.prepare("INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(markerId, 'ok');
        const got = db.prepare("SELECT value FROM sync_meta WHERE key = ?").get(markerId);
        console.log('Marker roundtrip:', got && got.value);

        // Switch back to local_user
        dbMod.setSyncMeta('auth_user_id', 'local_user');
        console.log('Restored activeUserId:', dbMod.getActiveUserId());

        console.log('Test completed successfully.');
    } catch (err) {
        console.error('Test failed:', err && err.message);
        console.error(err && err.stack);
        process.exit(2);
    }
})();
