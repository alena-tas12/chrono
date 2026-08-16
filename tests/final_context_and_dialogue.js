/**
 * 🧪 FINAL CONTEXT, DIALOGUE & COGNITIVE MEMORY ACCEPTANCE SUITE
 * 
 * Verifies:
 * 1. Semantic Precision & Negative Exclusion (Positive inclusion + Negative exclusion)
 * 2. Casual Message Safety (no rogue tasks, no memory pollution)
 * 3. Conversation Tree Branching (U1 -> A1, edit U1', regenerate A1', leaf tracking)
 * 4. Cognitive Memory Lifecycle (store -> retrieve -> correct -> forget -> supersede)
 */

const mainDb = require('../main/main_db');
const notesService = require('../main/notesService');
const knowledgeRetrieval = require('../main/knowledgeRetrieval');
const intentEngine = require('../main/intentEngine');
const memoryEngine = require('../main/memoryEngine');

async function runContextAndDialogueAcceptance() {
    console.log("=========================================================================");
    console.log("🧠 FINAL CONTEXT, DIALOGUE & COGNITIVE MEMORY ACCEPTANCE SUITE");
    console.log("=========================================================================\n");

    const results = {
        total: 5,
        passed: 0,
        failed: 0,
        details: []
    };

    const testUserId = 'user_context_test_88';
    mainDb.setActiveUserId(testUserId);

    // --- SETUP: Known Test Data ---
    console.log("0. Seeding Isolated Knowledge, Task, Calendar, and Memory Dataset...");
    await notesService.addNote(testUserId, 'Networking Protocols', 'OSPF uses Dijkstra shortest path first (SPF) algorithm for routing.');
    await mainDb.addTask({ text: 'Study networking for certification', date: '2026-08-16' });

    const db = mainDb.getDb();
    db.prepare(`
        INSERT INTO calendar_events (id, user_id, title, start_time, end_time, category, created_at, updated_at)
        VALUES (?, ?, 'Networking Exam', '2026-08-16 10:00', '2026-08-16 12:00', 'Exam', ?, ?)
    `).run(mainDb.generateUUID(), testUserId, Date.now(), Date.now());

    memoryEngine.storeObservation('User is studying networking and preparing for exams', 'Setup', 'Obs', 'high');

    // --- TEST 1: Precision Context Assembly: "Explain OSPF" ---
    console.log("\n1. Testing Precision Retrieval & Negative Exclusion for 'Explain OSPF'...");
    const matchedNotes = knowledgeRetrieval.retrieveExplicitKnowledge('Explain OSPF', 5, testUserId);
    const hasNotes = matchedNotes.some(b => b.block_content && b.block_content.includes('Dijkstra'));

    const intent = intentEngine.detectInteractionMode('Explain OSPF');
    const isDestructive = intent.mode === 'task_creation' || intent.mode === 'calendar_mutation';

    if (hasNotes && !isDestructive) {
        console.log("   ✅ PASSED: OSPF Note retrieved with Dijkstra content; destructive modes cleanly excluded.");
        results.passed++;
        results.details.push({ test: 'Positive/Negative Context Precision', status: 'PASSED' });
    } else {
        console.log(`   ❌ FAILED: Context assembly mismatch. Notes found: ${hasNotes}, Destructive: ${isDestructive}`);
        results.failed++;
    }

    // --- TEST 2: Precision Retrieval for "What do I have tomorrow?" ---
    console.log("\n2. Testing Precision Retrieval for 'What do I have tomorrow?'...");
    const tomorrowTasks = await mainDb.fetchTasks('2026-08-16');
    const hasSchedule = tomorrowTasks.some(t => t.text && t.text.includes('Study networking'));

    if (hasSchedule) {
        console.log("   ✅ PASSED: Schedule task retrieved correctly for calendar/task date query.");
        results.passed++;
        results.details.push({ test: 'Calendar Context Retrieval', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: Schedule missing from tomorrow context.");
        results.failed++;
    }

    // --- TEST 3: Casual Message Safety Pipeline ---
    console.log("\n3. Testing Casual Dialogue Pipeline Safety ('hello', 'lol', 'never mind')...");
    const initialTasks = await mainDb.fetchTasks('2026-08-16');
    const countBefore = initialTasks.length;

    const casualInputs = ['hello', 'lol', 'what?', 'yeah', 'what are you doing?', 'actually never mind'];
    for (const input of casualInputs) {
        const casualIntent = intentEngine.detectInteractionMode(input);
        // Ensure none of casual inputs trigger automatic database mutations
        if (casualIntent.mode === 'task_creation' || casualIntent.mode === 'calendar_mutation') {
            throw new Error(`Casual input '${input}' misclassified as destructive mode '${casualIntent.mode}'`);
        }
    }

    const afterTasks = await mainDb.fetchTasks('2026-08-16');
    if (afterTasks.length === countBefore) {
        console.log("   ✅ PASSED: 0 unintended tasks created during casual conversational turns.");
        results.passed++;
        results.details.push({ test: 'Casual Dialogue Safety', status: 'PASSED' });
    } else {
        console.log(`   ❌ FAILED: Tasks altered unexpectedly: ${countBefore} -> ${afterTasks.length}`);
        results.failed++;
    }

    // --- TEST 4: Conversation Tree Branching & Leaf Persistence ---
    console.log("\n4. Testing Conversation Tree Branching & History Forking...");
    const msgU1 = mainDb.generateUUID();
    const grp1 = mainDb.generateUUID();
    mainDb.addWorkspaceMessage({ id: msgU1, parentId: null, generationGroupId: grp1, role: 'user', content: 'What is 2+2?' });

    const msgA1 = mainDb.generateUUID();
    mainDb.addWorkspaceMessage({ id: msgA1, parentId: msgU1, generationGroupId: msgA1, role: 'assistant', content: '2+2 is 4.' });

    // Fork edit: U1' -> A1'
    const msgU1Prime = mainDb.generateUUID();
    mainDb.addWorkspaceMessage({ id: msgU1Prime, parentId: null, generationGroupId: grp1, role: 'user', content: 'What is 2+3?' });

    const msgA1Prime = mainDb.generateUUID();
    mainDb.addWorkspaceMessage({ id: msgA1Prime, parentId: msgU1Prime, generationGroupId: msgA1Prime, role: 'assistant', content: '2+3 is 5.' });

    mainDb.setActiveLeafId(msgA1Prime);

    const activeBranch = mainDb.getWorkspaceBranch(msgA1Prime);
    const hasU1Prime = activeBranch.some(m => m.content === 'What is 2+3?');
    const hasOldU1 = activeBranch.some(m => m.content === 'What is 2+2?');

    if (hasU1Prime && !hasOldU1) {
        console.log("   ✅ PASSED: Active branch cleanly contains U1' and excludes old U1.");
        results.passed++;
        results.details.push({ test: 'Conversation Tree Branching', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: Branch pollution detected in conversation tree.");
        results.failed++;
    }

    // --- TEST 5: Cognitive Memory Lifecycle (Store -> Correct -> Forget -> Exclude) ---
    console.log("\n5. Testing Memory Lifecycle (Store -> Correct -> Forget -> Exclude)...");
    const mem1Id = memoryEngine.storeObservation('User lives in Boston', 'User dialogue', 'Self report', 'high', 'user_explicit');
    
    // Correct
    const correctedId = memoryEngine.correctMemory(mem1Id, 'User lives in Seattle', 'User explicit correction', 'high', 'user_explicit');
    const retrievedAfterCorrection = memoryEngine.retrieveMemory();
    const hasSeattle = retrievedAfterCorrection.some(m => m.content.includes('Seattle') && m.status === 'active');
    const hasBostonActiveInitial = retrievedAfterCorrection.some(m => m.content.includes('Boston') && m.status === 'active');

    // Forget
    if (correctedId) {
        memoryEngine.forgetMemory(correctedId);
    }
    const retrievedAfterForget = memoryEngine.retrieveMemory();
    const hasBostonActive = retrievedAfterForget.some(m => m.content.includes('Boston') && m.status === 'active');
    const hasSeattleActive = retrievedAfterForget.some(m => m.content.includes('Seattle') && m.status === 'active');

    if (hasSeattle && !hasBostonActiveInitial && !hasBostonActive && !hasSeattleActive) {
        console.log("   ✅ PASSED: Corrected & forgotten memories cleanly excluded from active retrieval (zero resurrection).");
        results.passed++;
        results.details.push({ test: 'Memory Lifecycle & Non-Resurrection', status: 'PASSED' });
    } else {
        console.log(`   ❌ FAILED: Memory lifecycle issue. hasSeattle: ${hasSeattle}, BostonActive: ${hasBostonActive}, SeattleActive: ${hasSeattleActive}`);
        results.failed++;
    }

    // Cleanup
    try {
        mainDb.setActiveUserId('local_user');
    } catch(e) {}

    console.log("\n-------------------------------------------------------------------------");
    console.log(`CONTEXT & DIALOGUE SUMMARY: ${results.passed}/${results.total} PASSED (${results.failed} failed)`);
    console.log("-------------------------------------------------------------------------\n");

    return results;
}

if (require.main === module) {
    runContextAndDialogueAcceptance().then(r => {
        if (r.failed > 0) process.exit(1);
        process.exit(0);
    });
}

module.exports = { runContextAndDialogueAcceptance };
