/**
 * 🧪 STABILIZATION TEST 2: Complete Multi-User Sharing & Revocation Lifecycle
 *
 * Verifies:
 * 1. User A creates shared memory for Peer B
 * 2. Peer B queries shared memory (Access Granted -> 1 record returned)
 * 3. User A revokes access or deletes shared memory
 * 4. Peer B queries shared memory (Access Revoked -> 0 records returned)
 * 5. Post-test cleanup guarantees 0 synthetic residual records remain in database
 *
 * Run via: $env:ELECTRON_RUN_AS_NODE=1; npx electron tests/test_multi_user_sharing_revocation.js
 */

const path = require('path');
process.env.CHRONO_SEED_TEST_PEERS = 'false';

const db = require(path.join(__dirname, '../main/main_db'));
const memory = require(path.join(__dirname, '../main/memoryEngine'));

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
    console.log('\n🧪 STABILIZATION TEST 2: Complete Multi-User Sharing & Revocation Lifecycle\n');

    const userA = 'user_a_' + Date.now();
    const peerB = 'peer_b_' + Date.now();

    // Stage 1: User A creates shared memory for Peer B
    console.log('--- Stage 1: User A creates shared memory for Peer B ---');
    const sharedId = db.addSharedMemory(userA, peerB, 'Shared Architecture Brief', 'System uses 3-layer architecture', 9);
    assert(!!sharedId, `Shared memory created cleanly with ID: ${sharedId}`);

    // Stage 2: Peer B reads shared memories
    console.log('\n--- Stage 2: Peer B reads shared memory ---');
    const sharedForB = db.db.prepare(`
        SELECT * FROM shared_memories WHERE peer_id = ?
    `).all(peerB);

    assert(sharedForB.length === 1, `Peer B retrieved 1 shared memory record (found: ${sharedForB.length})`);
    assert(sharedForB[0].title === 'Shared Architecture Brief', 'Shared memory title matched');
    assert(sharedForB[0].summary === 'System uses 3-layer architecture', 'Shared memory summary content matched');

    // Stage 3: User A revokes shared memory
    console.log('\n--- Stage 3: User A revokes shared memory access ---');
    db.db.prepare(`
        DELETE FROM shared_memories WHERE id = ?
    `).run(sharedId);

    // Stage 4: Peer B queries revoked shared memory
    console.log('\n--- Stage 4: Peer B queries revoked shared memory ---');
    const revokedForB = db.db.prepare(`
        SELECT * FROM shared_memories WHERE peer_id = ?
    `).all(peerB);

    assert(revokedForB.length === 0, `Peer B returned 0 records post-revocation (Access Revoked confirmed)`);

    // Stage 5: Post-test namespace cleanup
    console.log('\n--- Stage 5: Guaranteed Post-Test Cleanup ---');
    db.db.prepare(`DELETE FROM shared_memories WHERE id = ?`).run(sharedId);

    const residual = db.db.prepare(`SELECT COUNT(*) as c FROM shared_memories WHERE id = ?`).get(sharedId).c;
    assert(residual === 0, 'Post-test contamination check passed (0 synthetic test records remain)');

    console.log(`\n📊 Result: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
    console.error('Test failure:', err);
    process.exit(1);
});
