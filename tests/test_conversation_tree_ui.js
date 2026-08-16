const mainDb = require('../main/main_db');
const assert = require('assert');

async function runConversationTreeTest() {
    console.log("=== Conversation Tree & Branching Controls Test Suite ===");

    // 1. Setup fresh tree
    mainDb.db.prepare("DELETE FROM workspace_conversation WHERE content LIKE '%test_tree%'").run();

    // Node 1: User message U1
    const u1 = mainDb.addWorkspaceMessage({ role: 'user', content: 'test_tree Explain OSPF', parent_id: null });
    assert(u1 && u1.id, "U1 must be created");

    // Node 2: Assistant response A1
    const a1 = mainDb.addWorkspaceMessage({ role: 'assistant', content: 'test_tree OSPF is a link-state routing protocol.', parent_id: u1.id });
    assert(a1 && a1.id, "A1 must be created");

    // Node 3: User message U2
    const u2 = mainDb.addWorkspaceMessage({ role: 'user', content: 'test_tree How does SPF work?', parent_id: a1.id });
    assert(u2 && u2.id, "U2 must be created");

    // Assert initial branch path
    let branch1 = mainDb.getWorkspaceBranch(u2.id);
    assert.strictEqual(branch1.length, 3, "Branch 1 must contain U1, A1, U2");
    console.log("   ✓ Initial branch (U1 -> A1 -> U2) reconstructed correctly");

    // Node 4: Edit U1 -> Creates U1' branching off U1's parent (null)
    const u1_prime = mainDb.addWorkspaceMessage({ role: 'user', content: 'test_tree Explain RIP', parent_id: null });
    assert(u1_prime && u1_prime.id, "U1' must be created");

    // Node 5: Assistant response A1' branching off U1'
    const a1_prime = mainDb.addWorkspaceMessage({ role: 'assistant', content: 'test_tree RIP is a distance-vector protocol.', parent_id: u1_prime.id });

    // Assert new branch path
    let branch2 = mainDb.getWorkspaceBranch(a1_prime.id);
    assert.strictEqual(branch2.length, 2, "Branch 2 must contain U1', A1'");
    assert.strictEqual(branch2[0].content, 'test_tree Explain RIP');
    assert.strictEqual(branch2[1].content, 'test_tree RIP is a distance-vector protocol.');
    console.log("   ✓ Message editing branch (U1' -> A1') reconstructed cleanly without leaking U1/A1 context");

    // Node 6: Regenerate A1' -> Creates A1'' branching off U1'
    const a1_double = mainDb.addWorkspaceMessage({ role: 'assistant', content: 'test_tree RIP uses hop count as metric.', parent_id: u1_prime.id });
    let branch3 = mainDb.getWorkspaceBranch(a1_double.id);
    assert.strictEqual(branch3.length, 2, "Branch 3 must contain U1', A1''");
    assert.strictEqual(branch3[1].content, 'test_tree RIP uses hop count as metric.');
    console.log("   ✓ Message regeneration branch (U1' -> A1'') reconstructed cleanly");

    console.log("\n=========================================");
    console.log("🎉 Conversation Tree UI Controls Suite: ALL PASSED");
    console.log("=========================================");
}

runConversationTreeTest().catch(err => {
    console.error(err);
    process.exit(1);
});
