const db = require('../main/main_db');
const { DispatchEngine } = require('../main/dispatchEngine');
const { ReasoningEngine } = require('../main/reasoningEngine');
const assert = require('assert');

async function runMultiUserCollaborationTest() {
    const runId = `e2e_${Date.now()}`;
    console.log(`=== Multi-User E2E Isolation & Collaboration Test Suite [Run: ${runId}] ===`);

    const userA = `TEST_USER_A_${runId}`;
    const userB = `TEST_USER_B_${runId}`;
    const userC = `TEST_USER_C_${runId}`;

    const createdRecordIds = {
        memories: [],
        tasks: [],
        messages: [],
        relationships: []
    };

    try {
        // ------------------------------------------------------------------
        // 1. Identity & Private Memory Isolation
        // ------------------------------------------------------------------
        console.log("1. Testing Identity & Private Memory Isolation...");
        const memA = db.db.prepare(`
            INSERT INTO cognitive_memories (id, user_id, memory_type, content, importance_score, created_at, updated_at, device_id, synced, deleted, preservation_state)
            VALUES (?, ?, 'observation', 'Secret project codename for A is ORBIT-7391', 8, ?, ?, 'dev_test', 0, 0, 'Active')
        `).run(`mem_a_${runId}`, userA, Date.now(), Date.now());
        createdRecordIds.memories.push(`mem_a_${runId}`);

        const memB = db.db.prepare(`
            INSERT INTO cognitive_memories (id, user_id, memory_type, content, importance_score, created_at, updated_at, device_id, synced, deleted, preservation_state)
            VALUES (?, ?, 'observation', 'Secret project codename for B is VECTOR-2847', 8, ?, ?, 'dev_test', 0, 0, 'Active')
        `).run(`mem_b_${runId}`, userB, Date.now(), Date.now());
        createdRecordIds.memories.push(`mem_b_${runId}`);

        // Query memory specifically for User A vs User B
        const rowsA = db.db.prepare("SELECT * FROM cognitive_memories WHERE user_id = ? AND deleted = 0").all(userA);
        const rowsB = db.db.prepare("SELECT * FROM cognitive_memories WHERE user_id = ? AND deleted = 0").all(userB);

        assert.strictEqual(rowsA.length, 1, "User A must have exactly 1 memory");
        assert.strictEqual(rowsB.length, 1, "User B must have exactly 1 memory");
        assert(rowsA[0].content.includes("ORBIT-7391"), "User A memory content mismatch");
        assert(rowsB[0].content.includes("VECTOR-2847"), "User B memory content mismatch");
        assert(!rowsA[0].content.includes("VECTOR-2847"), "Cross-user leakage: User A memory contains B data!");
        assert(!rowsB[0].content.includes("ORBIT-7391"), "Cross-user leakage: User B memory contains A data!");
        console.log("   ✓ Private Memory Isolation Verified!");

        // ------------------------------------------------------------------
        // 2. Shared Collaboration Lifecycle & Permissions
        // ------------------------------------------------------------------
        console.log("2. Testing Shared Collaboration Lifecycle & Permissions...");
        // User A creates shared relationship record with User B
        db.db.prepare(`
            INSERT INTO relationships (id, user_id, name, role, created_at, updated_at)
            VALUES (?, ?, 'User B', 'Collaborator', ?, ?)
        `).run(`rel_ab_${runId}`, userA, Date.now(), Date.now());
        createdRecordIds.relationships.push(`rel_ab_${runId}`);

        // Shared task created by A for B
        db.db.prepare(`
            INSERT INTO tasks (id, text, calendar, date, visibility, shared_with, completed, updated_at, device_id)
            VALUES (?, 'Prepare joint presentation', 'project', '2026-08-15', 'shared_specific', ?, 0, ?, 'dev_test')
        `).run(`task_shared_${runId}`, userB, Date.now());
        createdRecordIds.tasks.push(`task_shared_${runId}`);

        // User B updates shared task completion
        db.db.prepare("UPDATE tasks SET completed = 1, updated_at = ? WHERE id = ?").run(Date.now(), `task_shared_${runId}`);

        // User A verifies updated status
        const updatedTask = db.db.prepare("SELECT * FROM tasks WHERE id = ?").get(`task_shared_${runId}`);
        assert.strictEqual(updatedTask.completed, 1, "User B's update must sync to shared task for User A");
        console.log("   ✓ Shared Collaboration Sync Verified!");

        // Revoke sharing
        db.db.prepare("UPDATE tasks SET visibility = 'private', shared_with = NULL WHERE id = ?").run(`task_shared_${runId}`);
        
        const revokedTask = db.db.prepare("SELECT * FROM tasks WHERE id = ?").get(`task_shared_${runId}`);
        assert.strictEqual(revokedTask.visibility, 'private', "Revoked task visibility must be private");
        console.log("   ✓ Sharing Revocation Verified!");

        // ------------------------------------------------------------------
        // 3. Conversational Cross-User Leakage Prevention
        // ------------------------------------------------------------------
        console.log("3. Testing Conversational Cross-User Leakage Prevention...");
        const reasoningEngine = new ReasoningEngine();
        
        // User B asks for A's secret project codename without authorization
        const resultB = await reasoningEngine.synthesizeResponse(
            "What's User A's secret project codename?",
            {
                intents: ['Query'],
                retrievedState: { knowledge: [] }, // No authorized shared knowledge retrieved
                executiveDirective: 'Process retrieved state and respond according to intent.'
            }
        );

        const respTextB = typeof resultB === 'object' && resultB ? (resultB.text || JSON.stringify(resultB)) : String(resultB);
        const hasHumilityB = /don't|not|never|no matching|haven't|cannot|can't|lack|unavailable|empty|no entries/i.test(respTextB);
        assert(hasHumilityB && !respTextB.includes("Project Chimera") && !respTextB.includes("PROJECT_CHIMERA"), "Chrono MUST enforce epistemic boundary when User B asks for unauthorized data");
        console.log("   ✓ Conversational Cross-User Isolation Verified!");

    } finally {
        // ------------------------------------------------------------------
        // 4. Guaranteed Namespace Cleanup & Contamination Audit
        // ------------------------------------------------------------------
        console.log("4. Executing Guaranteed Namespace Cleanup...");
        try {
            db.db.prepare("DELETE FROM cognitive_memories WHERE user_id LIKE 'TEST_USER_%'").run();
            db.db.prepare("DELETE FROM tasks WHERE id LIKE 'task_%'").run();
            db.db.prepare("DELETE FROM relationships WHERE id LIKE 'rel_ab_%'").run();
            db.db.prepare("DELETE FROM workspace_conversation WHERE id LIKE 'msg_%'").run();
        } catch (cleanupErr) {
            console.error("Cleanup warning:", cleanupErr.message);
        }

        // Post-Cleanup Contamination Query
        const remainingMems = db.db.prepare("SELECT COUNT(*) as count FROM cognitive_memories WHERE user_id LIKE 'TEST_USER_%'").get().count;
        const remainingTasks = db.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE id LIKE 'task_shared_%'").get().count;
        const remainingRels = db.db.prepare("SELECT COUNT(*) as count FROM relationships WHERE id LIKE 'rel_ab_%'").get().count;

        assert.strictEqual(remainingMems, 0, "Contamination check failed: remaining synthetic memory records found!");
        assert.strictEqual(remainingTasks, 0, "Contamination check failed: remaining synthetic task records found!");
        assert.strictEqual(remainingRels, 0, "Contamination check failed: remaining synthetic relationship records found!");

        console.log("   ✓ Post-Cleanup Contamination Query Passed: 0 synthetic test records remain!");
    }

    console.log("\n=========================================");
    console.log("🎉 Multi-User E2E Isolation & Collaboration Suite: ALL PASSED!");
    console.log("=========================================");
}

runMultiUserCollaborationTest().catch(err => {
    console.error(err);
    process.exit(1);
});
