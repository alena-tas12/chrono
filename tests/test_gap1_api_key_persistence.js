/**
 * 🧪 TEST: Gap 1 — Settings API Key Persistence & Live Loading
 *
 * Verifies:
 * 1. setApiKey persists 'openai_api_key' to SQLite sync_meta table
 * 2. ReasoningEngine.getEffectiveApiKey loads the key from SQLite on demand
 * 3. Clearing or setting key updates ReasoningEngine dynamically without app restart
 *
 * Run via: $env:ELECTRON_RUN_AS_NODE=1; npx electron tests/test_gap1_api_key_persistence.js
 */

const path = require('path');
process.env.CHRONO_SEED_TEST_PEERS = 'false';

const db = require(path.join(__dirname, '../main/main_db'));
const { ReasoningEngine } = require(path.join(__dirname, '../main/reasoningEngine'));

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
    console.log('\n🧪 TEST: Gap 1 — Settings API Key Persistence & Live Loading\n');

    const reasoning = new ReasoningEngine();

    // 1. Initial key state (from process.env or null)
    const initialKey = reasoning.getEffectiveApiKey();
    console.log(`     → Initial Effective API Key: ${initialKey ? 'Set (env/db)' : 'None (Stub Mode)'}`);

    // 2. Set new test key via setApiKey
    const testKey = 'sk-test-synthetic-key-12345';
    reasoning.setApiKey(testKey);

    assert(reasoning.getEffectiveApiKey() === testKey, 'setApiKey updated ReasoningEngine effective API key in-memory');

    // 3. Verify SQLite persistence via main_db
    const storedInDb = db.getSyncMeta('openai_api_key');
    assert(storedInDb === testKey, 'API key persisted cleanly to SQLite sync_meta table');

    // 4. Instantiate a new ReasoningEngine instance (simulating app process restart)
    const freshReasoning = new ReasoningEngine();
    assert(freshReasoning.getEffectiveApiKey() === testKey, 'Fresh ReasoningEngine instance loads persisted API key from SQLite');

    // 5. Clean up test key
    reasoning.setApiKey('');
    assert(db.getSyncMeta('openai_api_key') === '', 'Cleaned up test API key from SQLite');

    console.log(`\n📊 Result: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
