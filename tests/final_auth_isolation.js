/**
 * 🧪 FINAL AUTHENTICATION & MULTI-USER ISOLATION ACCEPTANCE SUITE
 * 
 * Verifies sovereign data boundaries across ALL 10 persistent user-owned domains:
 * 1. User Profile & Session Isolation
 * 2. Notes & Outliners
 * 3. Tasks & Focus items
 * 4. Calendar Events
 * 5. Cognitive Memories & Reflections
 * 6. Conversations & Chat Trees
 * 7. People & Peer Relationships
 * 8. Projects & Research
 * 9. UI Theme & Settings
 * 10. Zero Residual Leakage on Restore
 */

const mainDb = require('../main/main_db');
const notesService = require('../main/notesService');
const relationshipOS = require('../main/relationshipOS');

async function runAuthIsolationAcceptance() {
    console.log("=========================================================================");
    console.log("👥 FINAL AUTH & MULTI-USER ISOLATION ACCEPTANCE SUITE");
    console.log("=========================================================================\n");

    const results = {
        total: 10,
        passed: 0,
        failed: 0,
        details: []
    };

    const userA = { id: 'user_isolation_alena_101', name: 'Alena B', email: 'alena.test@chrono.network' };
    const userB = { id: 'user_isolation_princess_202', name: 'Princess', email: 'princess.test@chrono.network' };

    // --- DOMAIN 1: User Profile & Session Metadata ---
    console.log("1. Testing User Profile & Session Isolation...");
    mainDb.setActiveUserId(userA.id);
    mainDb.setSyncMeta('user_name', userA.name);
    mainDb.setSyncMeta('user_email', userA.email);

    mainDb.setActiveUserId(userB.id);
    mainDb.setSyncMeta('user_name', userB.name);
    mainDb.setSyncMeta('user_email', userB.email);

    mainDb.setActiveUserId(userA.id);
    const restoredName = mainDb.getSyncMeta('user_name');
    if (restoredName === userA.name) {
        console.log(`   ✅ PASSED: User A session metadata restored cleanly ('${restoredName}')`);
        results.passed++;
        results.details.push({ domain: 'Profile & Session', status: 'PASSED' });
    } else {
        console.log(`   ❌ FAILED: Session leaked: '${restoredName}'`);
        results.failed++;
    }

    // --- DOMAIN 2: Notes Hierarchy ---
    console.log("\n2. Testing Notes & Outliner Hierarchy Isolation...");
    mainDb.setActiveUserId(userA.id);
    const noteA = await notesService.addNote(userA.id, 'User A Mathematics Dissertation', 'Sovereign research content');

    mainDb.setActiveUserId(userB.id);
    const notesB = await notesService.getNotes(userB.id);
    const hasLeakNote = notesB.some(n => n.id === noteA.noteId);

    if (!hasLeakNote) {
        console.log("   ✅ PASSED: User B has 0 access to User A notes.");
        results.passed++;
        results.details.push({ domain: 'Notes & Outliners', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: User B can view User A notes!");
        results.failed++;
    }

    // --- DOMAIN 3: Tasks & Focus Items ---
    console.log("\n3. Testing Tasks & Focus Item Isolation...");
    mainDb.setActiveUserId(userA.id);
    await mainDb.addTask({ text: 'User A Private Math Task', date: '2026-08-15' });

    mainDb.setActiveUserId(userB.id);
    const tasksB = await mainDb.fetchTasks('2026-08-15');
    const hasLeakTask = tasksB.some(t => t.text === 'User A Private Math Task');

    if (!hasLeakTask) {
        console.log("   ✅ PASSED: User B has 0 access to User A tasks.");
        results.passed++;
        results.details.push({ domain: 'Tasks & Focus', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: User B can view User A tasks!");
        results.failed++;
    }

    // --- DOMAIN 4: Calendar Events ---
    console.log("\n4. Testing Calendar Events Isolation...");
    mainDb.setActiveUserId(userA.id);
    const dbA = mainDb.getDb();
    const eventIdA = mainDb.generateUUID();
    dbA.prepare(`
        INSERT INTO calendar_events (id, user_id, title, start_time, end_time, category, is_private, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(eventIdA, userA.id, 'Alena Private Calendar Event', '2026-08-15 10:00', '2026-08-15 11:00', 'Personal', Date.now(), Date.now());

    mainDb.setActiveUserId(userB.id);
    const dbB = mainDb.getDb();
    const eventB = dbB.prepare(`SELECT * FROM calendar_events WHERE id = ?`).get(eventIdA);

    if (!eventB) {
        console.log("   ✅ PASSED: User B has 0 access to User A calendar events.");
        results.passed++;
        results.details.push({ domain: 'Calendar Events', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: User B can view User A calendar event!");
        results.failed++;
    }

    // --- DOMAIN 5: Cognitive Memories & Reflections ---
    console.log("\n5. Testing Cognitive Memories & Reflections Isolation...");
    mainDb.setActiveUserId(userA.id);
    const dbMemA = mainDb.getDb();
    const memIdA = mainDb.generateUUID();
    dbMemA.prepare(`
        INSERT INTO cognitive_memories (id, user_id, memory_type, content, importance_score, created_at, updated_at)
        VALUES (?, ?, 'reflection', 'Alena private cognitive reflection', 5, ?, ?)
    `).run(memIdA, userA.id, Date.now(), Date.now());

    mainDb.setActiveUserId(userB.id);
    const dbMemB = mainDb.getDb();
    const memB = dbMemB.prepare(`SELECT * FROM cognitive_memories WHERE id = ?`).get(memIdA);

    if (!memB) {
        console.log("   ✅ PASSED: User B has 0 access to User A cognitive reflections.");
        results.passed++;
        results.details.push({ domain: 'Cognitive Memories', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: User B accessed User A cognitive reflections!");
        results.failed++;
    }

    // --- DOMAIN 6: Conversations & Message Trees ---
    console.log("\n6. Testing Conversation Tree & Branch Isolation...");
    mainDb.setActiveUserId(userA.id);
    const msgIdA = mainDb.generateUUID();
    mainDb.addWorkspaceMessage({
        id: msgIdA,
        parentId: null,
        generationGroupId: msgIdA,
        role: 'user',
        content: 'Confidential research query from Alena'
    });

    mainDb.setActiveUserId(userB.id);
    const msgB = mainDb.getWorkspaceMessage(msgIdA);

    if (!msgB) {
        console.log("   ✅ PASSED: User B has 0 access to User A conversation history.");
        results.passed++;
        results.details.push({ domain: 'Conversations & Branches', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: User B accessed User A conversation branch!");
        results.failed++;
    }

    // --- DOMAIN 7: People & Peer Relationships ---
    console.log("\n7. Testing People & Contacts Isolation...");
    mainDb.setActiveUserId(userA.id);
    relationshipOS.addRelationship(userA.id, 'Dr. Smith', 'Mentor', 'smith@university.edu');

    mainDb.setActiveUserId(userB.id);
    const peopleB = relationshipOS.getRelationships(userB.id);
    const hasLeakContact = peopleB.some(p => p.peer_email === 'smith@university.edu');

    if (!hasLeakContact) {
        console.log("   ✅ PASSED: User B has 0 access to User A contacts/peers.");
        results.passed++;
        results.details.push({ domain: 'Contacts & People', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: User B accessed User A contact records!");
        results.failed++;
    }

    // --- DOMAIN 8: Projects Domain ---
    console.log("\n8. Testing Projects Domain Isolation...");
    mainDb.setActiveUserId(userA.id);
    const dbA2 = mainDb.getDb();
    const projIdA = mainDb.generateUUID();

    dbA2.prepare(`
        INSERT INTO projects (id, title, description, status, created_at, updated_at)
        VALUES (?, 'Chrono OS Core Kernel', 'Core cognitive architecture', 'active', ?, ?)
    `).run(projIdA, Date.now(), Date.now());

    mainDb.setActiveUserId(userB.id);
    const dbB2 = mainDb.getDb();
    const projB = dbB2.prepare(`SELECT * FROM projects WHERE id = ?`).get(projIdA);

    if (!projB) {
        console.log("   ✅ PASSED: User B has 0 access to User A projects.");
        results.passed++;
        results.details.push({ domain: 'Projects', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: User B accessed User A projects!");
        results.failed++;
    }

    // --- DOMAIN 9: Settings & Preferences ---
    console.log("\n9. Testing UI Theme & Settings Isolation...");
    mainDb.setActiveUserId(userA.id);
    mainDb.setSyncMeta('app_theme', 'royal-violet');

    mainDb.setActiveUserId(userB.id);
    mainDb.setSyncMeta('app_theme', 'slate-dark');

    mainDb.setActiveUserId(userA.id);
    const themeA = mainDb.getSyncMeta('app_theme');

    if (themeA === 'royal-violet') {
        console.log(`   ✅ PASSED: User A theme preference restored independently ('${themeA}').`);
        results.passed++;
        results.details.push({ domain: 'Settings & Preferences', status: 'PASSED' });
    } else {
        console.log(`   ❌ FAILED: Preference collided: '${themeA}'`);
        results.failed++;
    }

    // --- DOMAIN 10: Complete Zero-Residual Switchback ---
    console.log("\n10. Testing Complete Switch-Back Cleanliness (Zero Residual State)...");
    mainDb.setActiveUserId(userA.id);
    const finalNotesA = await notesService.getNotes(userA.id);
    const hasOriginalNote = finalNotesA.some(n => n.id === noteA.noteId);

    if (hasOriginalNote) {
        console.log("   ✅ PASSED: User A restored full sovereign dataset with 0% data loss.");
        results.passed++;
        results.details.push({ domain: 'Full Sovereignty Restoration', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: User A note lost during session transitions!");
        results.failed++;
    }

    // Clean up
    try {
        mainDb.setActiveUserId('local_user');
    } catch(e) {}

    console.log("\n-------------------------------------------------------------------------");
    console.log(`AUTH ISOLATION SUMMARY: ${results.passed}/${results.total} PASSED (${results.failed} failed)`);
    console.log("-------------------------------------------------------------------------\n");

    return results;
}

if (require.main === module) {
    runAuthIsolationAcceptance().then(r => {
        if (r.failed > 0) process.exit(1);
        process.exit(0);
    });
}

module.exports = { runAuthIsolationAcceptance };
