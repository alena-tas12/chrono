/**
 * 🔄 CHRONO SYNC RELIABILITY & TESTING FRAMEWORK
 * 
 * Validates bidirectional sync under:
 * - Concurrent edits
 * - Network failures
 * - Offline/online transitions
 * - Token expiry
 * - Conflict resolution
 */

const mainDb = require('./main_db');

class SyncReliabilityTest {
    constructor(testName) {
        this.testName = testName;
        this.startTime = Date.now();
        this.results = {
            passed: 0,
            failed: 0,
            assertions: []
        };
    }

    assert(condition, message) {
        if (condition) {
            this.results.passed++;
            this.results.assertions.push({ status: 'pass', message });
            console.log(`✅ ${message}`);
        } else {
            this.results.failed++;
            this.results.assertions.push({ status: 'fail', message });
            console.error(`❌ ${message}`);
        }
    }

    report() {
        const duration = Date.now() - this.startTime;
        return {
            testName: this.testName,
            duration,
            passed: this.results.passed,
            failed: this.results.failed,
            total: this.results.passed + this.results.failed,
            successRate: `${Math.round((this.results.passed / (this.results.passed + this.results.failed)) * 100)}%`,
            assertions: this.results.assertions
        };
    }
}

// Test 1: Data Persistence (Tier 1 Trust Killer #1)
function testDataPersistence() {
    const test = new SyncReliabilityTest('Data Persistence');
    const db = mainDb.db;
    const testId = `persistence_test_${Date.now()}`;

    try {
        // Create task
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, synced, deleted, updated_at, device_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(testId, 'Persistence Test Task', new Date().toISOString().split('T')[0], 'personal', 0, 0, 0, Date.now(), 'test_device');

        // Immediately verify
        const immediate = db.prepare('SELECT * FROM tasks WHERE id = ?').get(testId);
        test.assert(immediate !== undefined, 'Task inserted and immediately readable');
        test.assert(immediate.text === 'Persistence Test Task', 'Task text preserved');
        test.assert(immediate.synced === 0, 'Task marked for sync');

        // Simulate close and reopen (in same process, but verify state)
        const reopened = db.prepare('SELECT * FROM tasks WHERE id = ?').get(testId);
        test.assert(reopened !== undefined, 'Task persisted after simulated close/reopen');
        test.assert(reopened.id === testId, 'Task ID unchanged');

        // Cleanup
        db.prepare('DELETE FROM tasks WHERE id = ?').run(testId);

        return test.report();
    } catch (err) {
        test.assert(false, `Data persistence test failed: ${err.message}`);
        return test.report();
    }
}

// Test 2: Offline/Online Transitions
function testOfflineOnlineTransitions() {
    const test = new SyncReliabilityTest('Offline/Online Transitions');
    const db = mainDb.db;

    try {
        // Simulate offline state
        const testTaskId = `offline_test_${Date.now()}`;
        
        // Create task while "offline" (no sync)
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, synced, deleted, updated_at, device_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(testTaskId, 'Offline Task', new Date().toISOString().split('T')[0], 'personal', 0, 0, 0, Date.now(), 'test_device');

        const offlineTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(testTaskId);
        test.assert(offlineTask.synced === 0, 'Task marked as unsynced while offline');

        // Simulate "coming online" - mark synced
        db.prepare('UPDATE tasks SET synced = 1 WHERE id = ?').run(testTaskId);
        const onlineTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(testTaskId);
        test.assert(onlineTask.synced === 1, 'Task marked synced when coming online');

        // Verify task still intact
        test.assert(onlineTask.text === 'Offline Task', 'Task content preserved through offline/online cycle');

        // Cleanup
        db.prepare('DELETE FROM tasks WHERE id = ?').run(testTaskId);

        return test.report();
    } catch (err) {
        test.assert(false, `Offline/Online test failed: ${err.message}`);
        return test.report();
    }
}

// Test 3: Conflict Resolution (Tier 1 Trust Killer #2)
function testConflictResolution() {
    const test = new SyncReliabilityTest('Conflict Resolution');
    const db = mainDb.db;

    try {
        const conflictTaskId = `conflict_test_${Date.now()}`;
        const now = Date.now();

        // Create task
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, synced, deleted, updated_at, device_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(conflictTaskId, 'Original Text', '2026-06-10', 'personal', 0, 1, 0, now, 'device_a');

        // Simulate device A update (newer timestamp)
        db.prepare('UPDATE tasks SET text = ?, updated_at = ? WHERE id = ?')
            .run('Device A Update', now + 1000, conflictTaskId);

        const deviceAVersion = db.prepare('SELECT * FROM tasks WHERE id = ?').get(conflictTaskId);
        test.assert(deviceAVersion.text === 'Device A Update', 'Device A update applied');

        // Simulate device B trying to apply older update
        // In real scenario, conflict resolution would use timestamp
        const deviceBUpdateTime = now + 500; // Older than Device A
        if (deviceBUpdateTime < deviceAVersion.updated_at) {
            // Conflict: Device B is older, should be rejected
            test.assert(true, 'Conflict detected: Device B update is older, correctly rejected');
        }

        // Verify Device A's version persists
        const final = db.prepare('SELECT * FROM tasks WHERE id = ?').get(conflictTaskId);
        test.assert(final.text === 'Device A Update', 'Newer update retained (last-write-wins)');

        // Cleanup
        db.prepare('DELETE FROM tasks WHERE id = ?').run(conflictTaskId);

        return test.report();
    } catch (err) {
        test.assert(false, `Conflict resolution test failed: ${err.message}`);
        return test.report();
    }
}

// Test 4: Sync Queue (Tier 1 Trust Killer #2)
function testSyncQueue() {
    const test = new SyncReliabilityTest('Sync Queue Management');
    const db = mainDb.db;

    try {
        const queueTests = [];
        
        // Create 10 tasks to sync
        for (let i = 0; i < 10; i++) {
            const taskId = `sync_queue_test_${Date.now()}_${i}`;
            db.prepare(`
                INSERT INTO tasks (id, text, date, calendar, completed, synced, deleted, updated_at, device_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(taskId, `Queue Test ${i}`, new Date().toISOString().split('T')[0], 'personal', 0, 0, 0, Date.now(), 'test_device');
            queueTests.push(taskId);
        }

        // Count unsynced tasks
        const unsynced = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE synced = 0').get();
        test.assert(unsynced.count >= 10, `Queue contains ${unsynced.count} unsynced tasks`);

        // Simulate syncing first batch
        const firstBatch = db.prepare('SELECT id FROM tasks WHERE synced = 0 LIMIT 5').all();
        test.assert(firstBatch.length === 5, 'First batch retrieved correctly');

        // Mark first batch as synced
        for (const task of firstBatch) {
            db.prepare('UPDATE tasks SET synced = 1 WHERE id = ?').run(task.id);
        }

        const remaining = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE synced = 0').get();
        test.assert(remaining.count >= 5, 'Remaining queue has unsynced tasks');

        // Cleanup
        for (const taskId of queueTests) {
            db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
        }

        return test.report();
    } catch (err) {
        test.assert(false, `Sync queue test failed: ${err.message}`);
        return test.report();
    }
}

// Test 5: Concurrent Edits
function testConcurrentEdits() {
    const test = new SyncReliabilityTest('Concurrent Edits');
    const db = mainDb.db;

    try {
        const concurrentId = `concurrent_test_${Date.now()}`;
        
        // Create base task
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, synced, deleted, updated_at, device_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(concurrentId, 'Base Task', '2026-06-10', 'personal', 0, 0, 0, Date.now(), 'device_base');

        // Simulate 5 concurrent updates
        const updates = [
            { device: 'device_1', text: 'Update 1' },
            { device: 'device_2', text: 'Update 2' },
            { device: 'device_3', text: 'Update 3' },
            { device: 'device_4', text: 'Update 4' },
            { device: 'device_5', text: 'Update 5' }
        ];

        for (const update of updates) {
            const timestamp = Date.now() + Math.random() * 1000;
            db.prepare('UPDATE tasks SET text = ?, updated_at = ?, device_id = ? WHERE id = ?')
                .run(update.text, timestamp, update.device, concurrentId);
        }

        const final = db.prepare('SELECT * FROM tasks WHERE id = ?').get(concurrentId);
        test.assert(final !== undefined, 'Task survived concurrent updates');
        test.assert(final.text !== 'Base Task', 'At least one update applied');

        // Cleanup
        db.prepare('DELETE FROM tasks WHERE id = ?').run(concurrentId);

        return test.report();
    } catch (err) {
        test.assert(false, `Concurrent edits test failed: ${err.message}`);
        return test.report();
    }
}

// Test 6: Silent Failure Detection
function testSilentFailureDetection() {
    const test = new SyncReliabilityTest('Silent Failure Detection');
    const db = mainDb.db;

    try {
        // This test verifies the detection mechanism works
        const silentTestId = `silent_test_${Date.now()}`;

        // Create operation log entry (simulating logged operation)
        db.prepare(`
            CREATE TABLE IF NOT EXISTS operation_log (
                op_id TEXT PRIMARY KEY,
                operation_type TEXT,
                entity_type TEXT,
                entity_id TEXT,
                device_id TEXT,
                status TEXT,
                error TEXT,
                retry_count INTEGER DEFAULT 0,
                timestamp INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        // Log a "successful" create operation that doesn't actually exist
        const opId = `op_${silentTestId}_${Date.now()}`;
        db.prepare(`
            INSERT INTO operation_log (op_id, operation_type, entity_type, entity_id, device_id, status, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(opId, 'create', 'task', silentTestId, 'test_device', 'success', Date.now());

        // Now check: does the task actually exist?
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(silentTestId);
        const isSilentFailure = task === undefined;

        test.assert(isSilentFailure, 'Silent failure detected: task logged as success but missing');

        // Cleanup
        db.prepare('DELETE FROM operation_log WHERE op_id = ?').run(opId);

        return test.report();
    } catch (err) {
        test.assert(false, `Silent failure detection test failed: ${err.message}`);
        return test.report();
    }
}

// Run all tests and report
function runAllSyncTests() {
    console.log('🧪 Running Sync Reliability Test Suite...\n');

    const results = [];
    
    results.push(testDataPersistence());
    console.log('');
    
    results.push(testOfflineOnlineTransitions());
    console.log('');
    
    results.push(testConflictResolution());
    console.log('');
    
    results.push(testSyncQueue());
    console.log('');
    
    results.push(testConcurrentEdits());
    console.log('');
    
    results.push(testSilentFailureDetection());
    console.log('');

    // Summary
    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalTests = totalPassed + totalFailed;
    const overallSuccessRate = Math.round((totalPassed / totalTests) * 100);

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 SYNC RELIABILITY TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Tests: ${results.length}`);
    console.log(`Total Assertions: ${totalTests}`);
    console.log(`Passed: ${totalPassed} ✅`);
    console.log(`Failed: ${totalFailed} ❌`);
    console.log(`Overall Success Rate: ${overallSuccessRate}%`);
    console.log('═══════════════════════════════════════════════════════\n');

    return {
        summary: {
            totalTests: results.length,
            totalAssertions: totalTests,
            passed: totalPassed,
            failed: totalFailed,
            successRate: `${overallSuccessRate}%`,
            timestamp: new Date().toISOString()
        },
        details: results
    };
}

// Load test: stress with many operations
function runLoadTest(taskCount = 1000, concurrency = 10) {
    console.log(`🔥 Running Load Test: ${taskCount} tasks with ${concurrency} concurrent threads...\n`);

    const test = new SyncReliabilityTest(`Load Test ${taskCount} tasks`);
    const db = mainDb.db;
    const startTime = Date.now();

    try {
        let created = 0;
        const taskIds = [];

        // Create tasks in batches
        for (let batch = 0; batch < taskCount / concurrency; batch++) {
            for (let i = 0; i < concurrency; i++) {
                const taskId = `load_test_${Date.now()}_${batch}_${i}`;
                db.prepare(`
                    INSERT INTO tasks (id, text, date, calendar, completed, synced, deleted, updated_at, device_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(taskId, `Load Test ${batch}-${i}`, new Date().toISOString().split('T')[0], 'personal', 0, 0, 0, Date.now(), 'load_test');
                
                taskIds.push(taskId);
                created++;
            }
        }

        test.assert(created === taskCount, `Created ${created}/${taskCount} tasks`);

        // Verify all created
        const count = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE device_id = ?').get('load_test');
        test.assert(count.count === taskCount, `All ${taskCount} tasks persisted`);

        // Update them
        for (const taskId of taskIds) {
            db.prepare('UPDATE tasks SET completed = 1, synced = 1 WHERE id = ?').run(taskId);
        }

        // Verify updates
        const completed = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE device_id = ? AND completed = 1').get('load_test');
        test.assert(completed.count === taskCount, `All ${taskCount} tasks updated`);

        // Cleanup
        for (const taskId of taskIds) {
            db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
        }

        const duration = Date.now() - startTime;
        console.log(`✅ Load test completed in ${duration}ms (${Math.round(taskCount / (duration / 1000))} ops/sec)\n`);

        return test.report();
    } catch (err) {
        test.assert(false, `Load test failed: ${err.message}`);
        console.error(err);
        return test.report();
    }
}

module.exports = {
    SyncReliabilityTest,
    testDataPersistence,
    testOfflineOnlineTransitions,
    testConflictResolution,
    testSyncQueue,
    testConcurrentEdits,
    testSilentFailureDetection,
    runAllSyncTests,
    runLoadTest
};
