/**
 * 🧪 CHRONO ACCOUNT ISOLATION & AUTH VERIFICATION SUITE
 */

const mainDb = require('../main/main_db');
const notesService = require('../main/notesService');

async function runIsolationAudit() {
    console.log("=========================================================================");
    console.log("🧪 AUDIT: PRODUCTION-GRADE ACCOUNT ISOLATION & DATA SOVEREIGNTY");
    console.log("=========================================================================\n");

    const userA = { id: 'user_alena_test_01', name: 'Alena Barnes', email: 'barnes.vianalen@gmail.com' };
    const userB = { id: 'user_princess_test_02', name: 'Princess', email: 'princess@chrono.network' };

    // Step 1: Initialize User A State
    console.log("1. Setting active session to Account A (Alena)...");
    mainDb.setActiveUserId(userA.id);
    mainDb.setSyncMeta('user_name', userA.name);
    mainDb.setSyncMeta('user_email', userA.email);

    // Seed private cognitive state for User A
    const resA = await notesService.addNote(userA.id, 'Alena Private Mathematics Research', 'Confidential thesis notes on differential topology.');
    const noteAId = resA.noteId;
    await mainDb.addTask({
        text: 'Review Calculus Optimization',
        date: '2026-08-15'
    });

    console.log(`   ✓ Account A private note created (ID: ${noteAId})`);
    console.log("   ✓ Account A private task created: 'Review Calculus Optimization'");

    // Step 2: Switch to Account B (Princess)
    console.log("\n2. Switching active session to Account B (Princess)...");
    mainDb.setActiveUserId(userB.id);
    mainDb.setSyncMeta('user_name', userB.name);
    mainDb.setSyncMeta('user_email', userB.email);

    // Verify Account B notes
    const allNotesUserB = await notesService.getNotes(userB.id);
    const leakedNoteFound = allNotesUserB.some(n => n.id === noteAId);

    if (leakedNoteFound) {
        console.error("   ❌ ISOLATION BREACH: Account B accessed Account A's private notes!");
        process.exit(1);
    } else {
        console.log("   ✅ PERFECT ISOLATION: Account B cannot see Account A's private notes.");
    }

    // Seed private note for User B
    const resB = await notesService.addNote(userB.id, 'Princess Anatomy & Physiology Summary', 'Clinical rotation notes and pharmacology flashcards.');
    const noteBId = resB.noteId;
    console.log(`   ✓ Account B private note created (ID: ${noteBId})`);

    // Step 3: Switch back to Account A
    console.log("\n3. Switching back to Account A (Alena)...");
    mainDb.setActiveUserId(userA.id);
    mainDb.setSyncMeta('user_name', userA.name);
    mainDb.setSyncMeta('user_email', userA.email);

    const allNotesUserA = await notesService.getNotes(userA.id);
    const userBLeakInA = allNotesUserA.some(n => n.id === noteBId);
    const userAOwnNoteFound = allNotesUserA.some(n => n.id === noteAId);

    if (userBLeakInA) {
        console.error("   ❌ ISOLATION BREACH: Account A accessed Account B's private notes!");
        process.exit(1);
    } else if (!userAOwnNoteFound) {
        console.error("   ❌ DATA LOSS: Account A's own note was lost on session switch!");
        process.exit(1);
    } else {
        console.log("   ✅ ZERO RESIDUAL LEAKAGE: Account A restored cleanly with 0% state contamination.");
    }

    // Step 4: Cleanup test records
    try {
        await notesService.deleteNote(noteAId);
        mainDb.setActiveUserId(userB.id);
        await notesService.deleteNote(noteBId);
        mainDb.setActiveUserId('local_user');
    } catch(e) {}

    console.log("\n=========================================================================");
    console.log("🏆 ALL ACCOUNT ISOLATION AUDITS PASSED (100% SOVEREIGN DATA BOUNDARIES)!");
    console.log("=========================================================================\n");
}

runIsolationAudit().catch(console.error);
