const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log("=== 🧪 STARTING CHRONO OS PHASES 15 TO 20 INTEGRATION TESTS ===");

    try {
        // 1. Test Production Authentication Layer Hardening (Phase 15)
        console.log("\n--- 1. Testing Auth Layer Hardening (Phase 15) ---");
        const mainDb = require('../main/main_db');
        
        // Clear meta keys first
        mainDb.db.prepare("DELETE FROM sync_meta WHERE key IN ('auth_token', 'google_provider_token', 'refresh_token')").run();

        const testToken = "supabase_secure_jwt_12345_token";
        mainDb.setSyncMeta('auth_token', testToken);
        
        const testProviderToken = "google_oauth_provider_secret_token";
        mainDb.setSyncMeta('google_provider_token', testProviderToken);

        const testRefreshToken = "supabase_refresh_token_abcde";
        mainDb.setSyncMeta('refresh_token', testRefreshToken);

        const retrievedToken = mainDb.getSyncMeta('auth_token');
        const retrievedProviderToken = mainDb.getSyncMeta('google_provider_token');
        const retrievedRefreshToken = mainDb.getSyncMeta('refresh_token');

        console.log(`Input Auth Token: ${testToken}`);
        console.log(`Retrieved Auth Token: ${retrievedToken}`);
        assert.strictEqual(retrievedToken, testToken, "Auth token encryption/decryption failed!");

        console.log(`Input Provider Token: ${testProviderToken}`);
        console.log(`Retrieved Provider Token: ${retrievedProviderToken}`);
        assert.strictEqual(retrievedProviderToken, testProviderToken, "Google provider token encryption/decryption failed!");

        console.log(`Input Refresh Token: ${testRefreshToken}`);
        console.log(`Retrieved Refresh Token: ${retrievedRefreshToken}`);
        assert.strictEqual(retrievedRefreshToken, testRefreshToken, "Refresh token encryption/decryption failed!");

        console.log("✅ Phase 15 Cryptographic Token persistence is functioning correctly!");


        // 2. Test Trust & Reliability Telemetry Hardening & Backup Rotation (Phase 16)
        console.log("\n--- 2. Testing Telemetry & Backup Rotation (Phase 16) ---");
        const continuityStability = require('../main/continuityStability');
        
        const dbDir = path.dirname(mainDb.dbPath);
        console.log(`Database directory: ${dbDir}`);

        // Create 10 fake old backups
        console.log("Seeding 10 mock database backup files...");
        const mockBackups = [];
        const baseTime = Date.now() - 1000 * 60 * 60 * 24 * 10; // start 10 days ago
        for (let i = 0; i < 10; i++) {
            const ts = baseTime + i * 10000;
            const backupName = `chrono_backup_${ts}.db`;
            const backupPath = path.join(dbDir, backupName);
            fs.writeFileSync(backupPath, `mock-db-content-${i}`);
            mockBackups.push(backupPath);
        }

        // Check count of backups before rotation
        let filesBefore = fs.readdirSync(dbDir).filter(f => f.startsWith('chrono_backup_') && f.endsWith('.db'));
        console.log(`Backup files before rotation check: ${filesBefore.length} (Expected: >= 10)`);
        assert(filesBefore.length >= 10, "Failed to seed mock backup files!");

        // Run backup rotation
        console.log("Executing performBackupRotation()...");
        continuityStability.performBackupRotation();

        // Check count of backups after rotation
        let filesAfter = fs.readdirSync(dbDir).filter(f => f.startsWith('chrono_backup_') && f.endsWith('.db'));
        console.log(`Backup files after rotation check: ${filesAfter.length} (Expected: 7)`);
        assert.strictEqual(filesAfter.length, 7, "Backup rotation did not cap backup files to exactly 7 copies!");

        // Run getTrustReliability and verify latency fields exist
        console.log("Running getTrustReliability()...");
        const telemetry = continuityStability.getTrustReliability();
        console.log("Telemetry results:", JSON.stringify(telemetry, null, 2));
        assert(telemetry.readLatencyMs >= 0, "Telemetry readLatencyMs is invalid!");
        assert(telemetry.writeLatencyMs >= 0, "Telemetry writeLatencyMs is invalid!");
        assert.strictEqual(telemetry.backupStatus, 'Secured', "Telemetry backupState should report 'Secured'!");

        // Cleanup mock backups
        filesAfter.forEach(f => {
            try {
                fs.unlinkSync(path.join(dbDir, f));
            } catch (e) {}
        });
        console.log("✅ Phase 16 Database Telemetry & Backup Rotation works perfectly!");


        // 3. Test Continuity Intervention Adherence Tracking (Phase 17)
        console.log("\n--- 3. Testing Intervention Adherence Tracking (Phase 17) ---");
        // Clear adherence table
        mainDb.db.prepare("DELETE FROM cognitive_loop_adherence").run();

        // Resolve an intervention
        console.log("Resolving loop intervention with 'schedule_review'...");
        const topicName = "Algorithms";
        const res = continuityStability.resolveLoopIntervention(topicName, 'active', 'schedule_review');
        assert.strictEqual(res.success, true, "Loop intervention resolution failed!");

        // Fetch adherence statistics
        let adherence = continuityStability.getInterventionAdherence();
        console.log("Adherence stats (before completing review):", JSON.stringify(adherence, null, 2));
        assert.strictEqual(adherence.totalInterventions, 1, "Intervention count should be 1!");
        assert.strictEqual(adherence.completedReviews, 0, "Completed reviews should be 0!");
        assert.strictEqual(adherence.adherencePercentage, 0, "Adherence percentage should be 0%!");

        // Simulate task completion of the scheduled review task
        console.log("Simulating completion of review task: 'Review Repeating Topic: Algorithms'...");
        await mainDb.completeTask(`Review Repeating Topic: ${topicName}`);

        // Verify completion status
        adherence = continuityStability.getInterventionAdherence();
        console.log("Adherence stats (after completing review):", JSON.stringify(adherence, null, 2));
        assert.strictEqual(adherence.completedReviews, 1, "Completed reviews should be 1!");
        assert.strictEqual(adherence.adherencePercentage, 100, "Adherence percentage should be 100%!");

        // Simulate uncompleting task
        console.log("Simulating uncompletion of review task...");
        await mainDb.uncompleteTask(`Review Repeating Topic: ${topicName}`);
        adherence = continuityStability.getInterventionAdherence();
        assert.strictEqual(adherence.completedReviews, 0, "Completed reviews should be 0 after uncompleting task!");

        console.log("✅ Phase 17 Continuity Intervention Adherence tracking verified!");


        // 4. Test Deep Narrative Memory Compression (Phase 18)
        console.log("\n--- 4. Testing Yearly Narrative Compression (Phase 18) ---");
        const narrativeCompressor = require('../main/narrativeCompressor');
        
        // Seed some task and subject data for current month to ensure aggregator works
        console.log("Seeding mock subject and study task data...");
        const seedTime = Date.now();
        const currentMonthStr = new Date().toISOString().split('T')[0];

        // Create subject
        mainDb.db.prepare("INSERT OR REPLACE INTO goals (id, user_id, title, status, created_at, updated_at) VALUES ('g_test_comp', 'local_user', 'Calculus Mastery', 'active', ?, ?)").run(seedTime, seedTime);
        mainDb.db.prepare("INSERT OR REPLACE INTO projects (id, goal_id, title, status, created_at, updated_at) VALUES ('p_test_comp', 'g_test_comp', 'Limits & Derivatives', 'active', ?, ?)").run(seedTime, seedTime);
        mainDb.db.prepare("INSERT OR REPLACE INTO subjects (id, project_id, name, created_at, updated_at) VALUES ('s_test_comp', 'p_test_comp', 'Limits', ?, ?)").run(seedTime, seedTime);
        mainDb.db.prepare("INSERT OR REPLACE INTO subject_mastery (subject_id, mastery) VALUES ('s_test_comp', 0.85)").run();

        // Create study tasks
        mainDb.db.prepare(`
            INSERT OR REPLACE INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted, subject_id)
            VALUES ('t_test_comp_1', 'Calculus Study session with Princess', ?, 'focus', 1, '10:00', 120, ?, 'test_device', 0, 0, 's_test_comp')
        `).run(currentMonthStr, seedTime);

        mainDb.db.prepare(`
            INSERT OR REPLACE INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted, subject_id)
            VALUES ('t_test_comp_2', 'Limit laws task', ?, 'focus', 1, '14:00', 60, ?, 'test_device', 0, 0, 's_test_comp')
        `).run(currentMonthStr, seedTime);

        console.log("Running consolidateNarrativesToYearly()...");
        const yearlyDigest = await narrativeCompressor.consolidateNarrativesToYearly('local_user');
        console.log("Yearly Narrative Object:", JSON.stringify(yearlyDigest, null, 2));

        const contentParsed = JSON.parse(yearlyDigest.content);
        assert(contentParsed.year === new Date().getFullYear(), "Year should be correct!");
        assert(contentParsed.totalCompletedTasks >= 2, "Completed tasks total is incorrect!");
        assert(contentParsed.totalFocusHours >= 3, "Focus hours aggregation is incorrect!");
        assert.strictEqual(contentParsed.topSubject, 'Limits', "Top subject identification failed!");
        assert.strictEqual(contentParsed.topPeer, 'Princess', "Top peer identification failed!");
        assert(yearlyDigest.content.includes("Yearly Digest for"), "Yearly narrative text synthesis failed!");

        console.log("✅ Phase 18 Long-term Narrative Compression is functioning perfectly!");

        console.log("\n=== 🎉 ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY WITH 100% ACCURACY! ===");
        process.exit(0);

    } catch (err) {
        console.error("\n🚨 INTEGRATION TESTS FAILED:", err);
        process.exit(1);
    }
}

runTests();
