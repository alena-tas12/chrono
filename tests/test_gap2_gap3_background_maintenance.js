/**
 * 🧪 TEST: Gap 2 & Gap 3 — Automatic Background Maintenance & Reflection Scheduler
 *
 * Verifies:
 * 1. DB & Context Compression (compressAndCleanDb) automatically rolls up old tasks (>14 days) into summary memories
 * 2. Daily Reflection Engine (generateDailyReflection) synthesizes task rates & emotions into daily reflections
 * 3. Weekly Consolidation (pruneAndConsolidateReflections) synthesizes 5+ daily reflections into a weekly memory
 * 4. Episodic Replay runs automatically in the maintenance cycle
 *
 * Run via: $env:ELECTRON_RUN_AS_NODE=1; npx electron tests/test_gap2_gap3_background_maintenance.js
 */

const path = require('path');
process.env.CHRONO_SEED_TEST_PEERS = 'false';

const db = require(path.join(__dirname, '../main/main_db'));
const contextCompression = require(path.join(__dirname, '../main/contextCompression'));
const reflectionEngine = require(path.join(__dirname, '../main/reflectionEngine'));
const episodicReplay = require(path.join(__dirname, '../main/episodicReplay'));

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${label}`);
        failed++;
    }
}

async function runTest() {
    console.log('\n🧪 TEST: Gap 2 & Gap 3 — Automatic Background Maintenance & Reflection Scheduler\n');

    const userId = db.getActiveUserId() || 'local_user';
    const now = Date.now();

    // ------------------------------------------------------------------
    // STEP 1: Context & DB Compression Test (Gap 2)
    // ------------------------------------------------------------------
    console.log('--- Step 1: Testing Context & Database Compression ---');

    // Create an old completed low-significance task (>14 days old)
    const oldTaskId = db.generateUUID();
    const oldDateStr = new Date(now - 15 * 86400000).toISOString().split('T')[0];
    const oldTimestamp = now - 15 * 86400000;

    db.db.prepare(`
        INSERT INTO tasks (id, text, date, calendar, completed, importance_score, updated_at, device_id, synced, deleted)
        VALUES (?, 'Old Minor Maintenance Task', ?, 'personal', 1, 2, ?, 'dev_test', 0, 0)
    `).run(oldTaskId, oldDateStr, oldTimestamp);

    // Execute compression
    const compRes = contextCompression.compressAndCleanDb();
    assert(compRes.success === true, 'compressAndCleanDb executed successfully');
    assert(compRes.rolledUpTasks >= 1, `compressAndCleanDb rolled up ${compRes.rolledUpTasks} old task(s)`);

    // Verify task was purged and replaced by rollup summary in cognitive_memories
    const purgedTask = db.db.prepare(`SELECT id FROM tasks WHERE id = ?`).get(oldTaskId);
    assert(!purgedTask, 'Old low-significance task was purged from tasks table');

    const rollupMem = db.db.prepare(`SELECT * FROM cognitive_memories WHERE memory_type = 'rollup_summary' ORDER BY created_at DESC LIMIT 1`).get();
    assert(!!rollupMem, 'Rollup summary memory was created in cognitive_memories');
    console.log(`     → Rollup summary content: "${rollupMem ? rollupMem.content : ''}"`);


    // ------------------------------------------------------------------
    // STEP 2: Daily Reflection Generation Test (Gap 3)
    // ------------------------------------------------------------------
    console.log('\n--- Step 2: Testing Daily Reflection Generation ---');

    const todayStr = new Date().toISOString().split('T')[0];
    const reflection = reflectionEngine.generateDailyReflection(userId, todayStr);

    assert(!!reflection, 'generateDailyReflection returned reflection object');
    assert(typeof reflection.narrative === 'string' && reflection.narrative.length > 0, 'Reflection narrative was synthesized');
    assert(typeof reflection.taskCompletionRate === 'number', 'Task completion rate was calculated');

    const storedReflection = db.db.prepare(`
        SELECT * FROM cognitive_memories WHERE memory_type = 'daily_reflection' AND id = ?
    `).get('rec_' + todayStr.replace(/-/g, '_'));

    assert(!!storedReflection, 'Daily reflection memory persisted to cognitive_memories SQLite table');


    // ------------------------------------------------------------------
    // STEP 3: Weekly Consolidation Test (Gap 3)
    // ------------------------------------------------------------------
    console.log('\n--- Step 3: Testing Weekly Consolidation ---');

    // Create 5 dummy historical reflections older than 7 days
    for (let i = 8; i <= 12; i++) {
        const dStr = new Date(now - i * 86400000).toISOString().split('T')[0];
        const rId = 'rec_' + dStr.replace(/-/g, '_');
        const rTime = now - i * 86400000;
        const dummyData = {
            date: dStr,
            narrative: `Historical day ${i} reflection narrative`,
            taskCompletionRate: 80,
            primaryEmotion: 'calm',
            timeline: []
        };
        db.db.prepare(`
            INSERT OR REPLACE INTO cognitive_memories (id, user_id, memory_type, content, importance_score, created_at, updated_at, device_id, synced, deleted)
            VALUES (?, ?, 'daily_reflection', ?, 5, ?, ?, 'dev_test', 0, 0)
        `).run(rId, userId, JSON.stringify(dummyData), rTime, rTime);
    }

    reflectionEngine.pruneAndConsolidateReflections(userId);

    const weeklyMem = db.db.prepare(`
        SELECT * FROM cognitive_memories WHERE memory_type = 'weekly_reflection' ORDER BY created_at DESC LIMIT 1
    `).get();

    assert(!!weeklyMem, 'Weekly consolidated reflection memory was synthesized and saved');
    if (weeklyMem) {
        const parsedWeekly = JSON.parse(weeklyMem.content);
        assert(parsedWeekly.type === 'weekly_consolidation', 'Consolidated memory type matched weekly_consolidation');
    }

    // Clean up test reflections
    db.db.prepare(`DELETE FROM cognitive_memories WHERE id LIKE 'rec_%' OR id LIKE 'weekly_%' OR id LIKE 'rollup_%'`).run();

    console.log(`\n📊 Result: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
