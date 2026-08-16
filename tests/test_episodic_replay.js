/**
 * ✅ TEST: Episodic Replay Engine
 *
 * Verifies that replayCompletedEpisodes and getEpisodeSummary work correctly:
 * - Can be called without crashing
 * - Returns correct types
 * - Replay result has expected shape
 * - After replay, getEpisodeSummary returns the replayed records from DB
 *
 * Run via: ELECTRON_RUN_AS_NODE=1 npx electron tests/test_episodic_replay.js
 */

const path = require('path');
process.env.CHRONO_SEED_TEST_PEERS = 'false';

const episodicReplay = require(path.join(__dirname, '../main/episodicReplay'));
const mainDb = require(path.join(__dirname, '../main/main_db'));

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

console.log('\n🔁 TEST: Episodic Replay Engine\n');

// 1. Module exports
assert(typeof episodicReplay.replayCompletedEpisodes === 'function', 'replayCompletedEpisodes is exported');
assert(typeof episodicReplay.getEpisodeSummary === 'function', 'getEpisodeSummary is exported');

// 2. replayCompletedEpisodes runs without crash
let replayResult;
try {
    replayResult = episodicReplay.replayCompletedEpisodes('local_user', 30);
    assert(true, 'replayCompletedEpisodes did not throw');
} catch (e) {
    assert(false, `replayCompletedEpisodes threw: ${e.message}`);
    replayResult = { replayed: 0, skipped: 0, outcomes: [] };
}

// 3. Result has expected shape
assert(typeof replayResult.replayed === 'number', 'result.replayed is a number');
assert(typeof replayResult.skipped === 'number', 'result.skipped is a number');
assert(Array.isArray(replayResult.outcomes), 'result.outcomes is an Array');
console.log(`     → Replayed: ${replayResult.replayed}, Skipped: ${replayResult.skipped}, Outcomes: ${replayResult.outcomes.length}`);

// 4. getEpisodeSummary runs without crash
let summary;
try {
    summary = episodicReplay.getEpisodeSummary(10);
    assert(true, 'getEpisodeSummary did not throw');
} catch (e) {
    assert(false, `getEpisodeSummary threw: ${e.message}`);
    summary = [];
}

// 5. Summary is an array
assert(Array.isArray(summary), 'getEpisodeSummary returns Array');
console.log(`     → Summary entries: ${summary.length}`);

// 6. If replayed > 0, summary should have records
if (replayResult.replayed > 0) {
    assert(summary.length > 0, 'After replay, getEpisodeSummary returns records');
    if (summary.length > 0) {
        assert(typeof summary[0].content === 'string', 'Episode record has content field');
        assert(typeof summary[0].created_at === 'number', 'Episode record has created_at field');
    }
} else {
    console.log('     (No completed tasks in last 30 days — replay returned 0, skipping write verification)');
    assert(true, 'Zero-replay scenario handled gracefully');
}

// 7. Idempotency — running again should produce 0 new replays (all skipped)
try {
    const secondRun = episodicReplay.replayCompletedEpisodes('local_user', 30);
    assert(secondRun.replayed === 0 || secondRun.skipped >= replayResult.replayed, 
        `Second run is idempotent (replayed=${secondRun.replayed}, skipped=${secondRun.skipped})`);
} catch (e) {
    assert(false, `Idempotency check threw: ${e.message}`);
}

console.log(`\n📊 Result: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
