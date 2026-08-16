/**
 * ✅ TEST: Memory Engine Methods
 *
 * Verifies that all 5 previously-missing memoryEngine methods now exist,
 * return correct types, and don't throw TypeErrors.
 *
 * Run via: ELECTRON_RUN_AS_NODE=1 npx electron tests/test_memory_engine_methods.js
 */

const path = require('path');
process.env.CHRONO_SEED_TEST_PEERS = 'false';

const memoryEngine = require(path.join(__dirname, '../main/memoryEngine'));

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

console.log('\n🧠 TEST: Memory Engine Methods\n');

// 1. getHierarchicalMemories
try {
    const result = memoryEngine.getHierarchicalMemories(5);
    assert(typeof memoryEngine.getHierarchicalMemories === 'function', 'getHierarchicalMemories is a function');
    assert(Array.isArray(result), 'getHierarchicalMemories returns Array');
    console.log(`     → returned ${result.length} records`);
} catch (e) {
    assert(false, `getHierarchicalMemories — no TypeError (got: ${e.message})`);
}

// 2. getEmotionalMemories
try {
    const result = memoryEngine.getEmotionalMemories(3);
    assert(typeof memoryEngine.getEmotionalMemories === 'function', 'getEmotionalMemories is a function');
    assert(Array.isArray(result), 'getEmotionalMemories returns Array');
    console.log(`     → returned ${result.length} records`);
} catch (e) {
    assert(false, `getEmotionalMemories — no TypeError (got: ${e.message})`);
}

// 3. getCoreIdentity
try {
    const result = memoryEngine.getCoreIdentity();
    assert(typeof memoryEngine.getCoreIdentity === 'function', 'getCoreIdentity is a function');
    assert(Array.isArray(result), 'getCoreIdentity returns Array');
    console.log(`     → returned ${result.length} records`);
} catch (e) {
    assert(false, `getCoreIdentity — no TypeError (got: ${e.message})`);
}

// 4. getMostFrequentTask
try {
    const result = memoryEngine.getMostFrequentTask();
    assert(typeof memoryEngine.getMostFrequentTask === 'function', 'getMostFrequentTask is a function');
    assert(result === null || typeof result === 'object', 'getMostFrequentTask returns null or object');
    console.log(`     → returned: ${JSON.stringify(result)}`);
} catch (e) {
    assert(false, `getMostFrequentTask — no TypeError (got: ${e.message})`);
}

// 5. getAverageFocusTime
try {
    const result = memoryEngine.getAverageFocusTime();
    assert(typeof memoryEngine.getAverageFocusTime === 'function', 'getAverageFocusTime is a function');
    assert(typeof result === 'number', 'getAverageFocusTime returns number');
    console.log(`     → returned: ${result}s average`);
} catch (e) {
    assert(false, `getAverageFocusTime — no TypeError (got: ${e.message})`);
}

// 6. All 5 are exported
const exported = Object.keys(module.exports || {});
const expectedNew = ['getHierarchicalMemories', 'getEmotionalMemories', 'getCoreIdentity', 'getMostFrequentTask', 'getAverageFocusTime'];
for (const name of expectedNew) {
    assert(typeof memoryEngine[name] === 'function', `${name} is exported from memoryEngine`);
}

console.log(`\n📊 Result: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
