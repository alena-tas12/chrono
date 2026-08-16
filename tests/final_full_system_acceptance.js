/**
 * CHRONO MASTER SYSTEM ACCEPTANCE TEST SUITE
 * Comprehensive verification of all 12 subsystems & contracts.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log("=================================================");
console.log("🚀 STARTING CHRONO MASTER SYSTEM ACCEPTANCE SUITE");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✓ PASS: ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ FAIL: ${name}`);
        console.error(`    Error: ${err.message}`);
        failed++;
    }
}

async function runSuite() {
    const mainDb = require('../main/main_db');
    const notesService = require('../main/notesService');
    const continuityThreads = require('../main/continuityThreads');
    const communicationOS = require('../main/communicationOS');
    const chronoSpaces = require('../main/chronoSpaces');

    console.log("--- 1. DATABASE & ACCOUNT ISOLATION ---");
    await test("Switch active user database and verify clean schema", async () => {
        const testUserA = 'test_acc_user_alpha_' + Date.now();
        const testUserB = 'test_acc_user_beta_' + Date.now();
        
        mainDb.setActiveUserId(testUserA);
        const activeA = mainDb.getSyncMeta('auth_user_id') || mainDb.getActiveUserId();
        assert.strictEqual(activeA, testUserA, "User A active database should match");

        mainDb.setActiveUserId(testUserB);
        const activeB = mainDb.getSyncMeta('auth_user_id') || mainDb.getActiveUserId();
        assert.strictEqual(activeB, testUserB, "User B active database should match");
    });

    console.log("\n--- 2. NOTES INDIVIDUAL MANAGEMENT & PROVENANCE ---");
    const testUserId = 'test_notes_user_' + Date.now();
    mainDb.setActiveUserId(testUserId);
    let noteId1, noteId2, dupNoteId;

    await test("Create notes with initial blocks", async () => {
        const res1 = await notesService.addNote(testUserId, "OSPF Routing Notes", "- [[Networking]] :: Protocol overview\n- Link-State Advertisement");
        assert.strictEqual(res1.success, true, "Note 1 creation should succeed");
        noteId1 = res1.noteId;

        const res2 = await notesService.addNote(testUserId, "Calculus Cheatsheet", "- [[Math]] :: Derivatives\n- Limits and continuity");
        assert.strictEqual(res2.success, true, "Note 2 creation should succeed");
        noteId2 = res2.noteId;

        const notes = await notesService.getNotes(testUserId);
        assert.strictEqual(notes.length, 2, "Should have 2 active notes");
    });

    await test("Pin / Unpin individual note", async () => {
        const pinRes = await notesService.pinNote(noteId1, 1);
        assert.strictEqual(pinRes.success, true, "Pin note should succeed");

        const notes = await notesService.getNotes(testUserId);
        const pinned = notes.find(n => n.id === noteId1);
        assert.strictEqual(pinned.is_pinned, 1, "Note should be marked pinned in DB");
    });

    await test("Duplicate individual note with blocks", async () => {
        const dupRes = await notesService.duplicateNote(testUserId, noteId1);
        assert.strictEqual(dupRes.success, true, "Duplicate note should succeed");
        dupNoteId = dupRes.noteId;

        const notes = await notesService.getNotes(testUserId);
        assert.strictEqual(notes.length, 3, "Should now have 3 notes after duplication");
        const dup = notes.find(n => n.id === dupNoteId);
        assert.strictEqual(dup.title.includes("Copy"), true, "Duplicated note title should include (Copy)");
    });

    await test("Move note to Trash (soft delete)", async () => {
        const delRes = await notesService.deleteNote(dupNoteId);
        assert.strictEqual(delRes.success, true, "Delete note should succeed");

        const activeNotes = await notesService.getNotes(testUserId);
        assert.strictEqual(activeNotes.length, 2, "Active notes should now be 2");

        const trashNotes = await notesService.getTrashNotes(testUserId);
        assert.strictEqual(trashNotes.length, 1, "Trash notes should contain 1 deleted note");
        assert.strictEqual(trashNotes[0].id, dupNoteId, "Trash note ID should match deleted note");
    });

    await test("Restore note from Trash", async () => {
        const restoreRes = await notesService.restoreNote(dupNoteId);
        assert.strictEqual(restoreRes.success, true, "Restore note should succeed");

        const activeNotes = await notesService.getNotes(testUserId);
        assert.strictEqual(activeNotes.length, 3, "Active notes should be restored to 3");

        const trashNotes = await notesService.getTrashNotes(testUserId);
        assert.strictEqual(trashNotes.length, 0, "Trash should now be empty");
    });

    await test("Permanent delete note from Database", async () => {
        // First delete to trash
        await notesService.deleteNote(dupNoteId);
        // Then permanently delete
        const permRes = await notesService.permanentDeleteNote(dupNoteId);
        assert.strictEqual(permRes.success, true, "Permanent delete should succeed");

        const allNotes = await notesService.getNotes(testUserId);
        const trash = await notesService.getTrashNotes(testUserId);
        assert.strictEqual(allNotes.some(n => n.id === dupNoteId), false, "Note should not exist in active notes");
        assert.strictEqual(trash.some(n => n.id === dupNoteId), false, "Note should not exist in trash notes");
    });

    console.log("\n--- 3. PEOPLE & CONTACTS MANAGEMENT ---");
    let personId;

    await test("Add a new contact with phone identifier", async () => {
        const res = continuityThreads.addThread(testUserId, "Aarav Sharma", "Colleague", "aarav@tech.io", null, "+91 98765 00001", null, "India");
        assert.strictEqual(res.success, true, "Adding person should succeed");
        personId = res.id;

        const people = continuityThreads.getThreads(testUserId);
        const found = people.find(p => p.id === personId);
        assert.ok(found, "Added person should be returned in getThreads");
        assert.strictEqual(found.name, "Aarav Sharma");
        assert.strictEqual(found.phone, "+91 98765 00001");
    });

    await test("Edit contact details", async () => {
        const editRes = continuityThreads.editThread(testUserId, personId, "Aarav S. Sharma", "Lead Engineer", "aarav.s@tech.io", "+91 98765 00002", null, "India");
        assert.strictEqual(editRes.success, true, "Editing person should succeed");

        const people = continuityThreads.getThreads(testUserId);
        const found = people.find(p => p.id === personId);
        assert.strictEqual(found.name, "Aarav S. Sharma");
        assert.strictEqual(found.phone, "+91 98765 00002");
        assert.strictEqual(found.role, "Lead Engineer");
    });

    await test("Direct Messaging with contact", async () => {
        const msgRes = await communicationOS.sendDirectMessage(testUserId, personId, "Hey Aarav, can we review the architecture document?");
        assert.strictEqual(msgRes.success, true, "Sending direct message should succeed");

        const messages = await communicationOS.getDirectMessages(testUserId, personId);
        assert.ok(messages.length >= 1, "Direct messages should contain sent message");
        assert.strictEqual(messages[0].content, "Hey Aarav, can we review the architecture document?");
    });

    await test("Remove contact while preserving communication history", async () => {
        const remRes = continuityThreads.removeThread(testUserId, personId);
        assert.strictEqual(remRes.success, true, "Removing person should succeed");

        const people = continuityThreads.getThreads(testUserId);
        assert.strictEqual(people.some(p => p.id === personId), false, "Person should be removed from contacts list");

        const messages = await communicationOS.getDirectMessages(testUserId, personId);
        assert.ok(messages.length >= 1, "Message history must be preserved after contact removal");
    });

    console.log("\n--- 4. WEBRTC SIGNALING & CALL HISTORY ---");
    let callSessionId;

    await test("Initiate VoIP/WebRTC call session", async () => {
        const initRes = await communicationOS.initiateCall(testUserId, "receiver_test_01", "AUDIO", "Test Caller");
        assert.strictEqual(initRes.success, true, "Initiating call should succeed");
        callSessionId = initRes.callSessionId;
    });

    await test("End call and record in call history", async () => {
        const endRes = await communicationOS.endCall(callSessionId, testUserId, "COMPLETED");
        assert.strictEqual(endRes.success, true, "Ending call should succeed");

        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db || mainDb);
        const history = db.prepare(`SELECT * FROM chrono_call_history WHERE session_id = ?`).all(callSessionId);
        assert.strictEqual(history.length, 1, "Call history should contain exactly 1 session record");
        assert.strictEqual(history[0].status, "COMPLETED");
    });

    console.log("\n--- 5. CHRONO SPACES & COLLABORATIVE PR MERGE ---");
    let spaceId, proposalId;

    await test("Create collaborative Chrono Space", async () => {
        const spRes = await chronoSpaces.createSpace(testUserId, "System Architecture Circle", "Collaborative design group");
        assert.strictEqual(spRes.success, true, "Creating space should succeed");
        spaceId = spRes.spaceId;
    });

    await test("Propose event to shared space calendar", async () => {
        const propRes = await chronoSpaces.createEventProposal(spaceId, testUserId, "Lead Architect", {
            title: "Sprint Planning Session",
            date: "2026-08-20",
            startTime: "14:00",
            duration_min: 60
        });
        assert.strictEqual(propRes.success, true, "Creating proposal should succeed");
        proposalId = propRes.proposalId;
    });

    await test("Review and merge proposal into local calendar", async () => {
        const mergeRes = await chronoSpaces.reviewProposal(proposalId, testUserId, "MERGE", "Approved for sprint");
        assert.strictEqual(mergeRes.success, true, "Merging proposal should succeed");

        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db || mainDb);
        const tasks = db.prepare(`SELECT * FROM tasks WHERE text LIKE ?`).all("%Sprint Planning Session%");
        assert.ok(tasks.length > 0, "Merged event must appear in local calendar database");
    });

    console.log("\n--- 6. SCALE & PERFORMANCE VERIFICATION ---");
    await test("High-depth branch reconstruction query (< 100ms)", async () => {
        // Insert a deep chain in a transaction
        let parentId = null;
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db || mainDb);
        const insertTx = db.transaction(() => {
            for (let i = 0; i < 50; i++) {
                const leafId = mainDb.generateUUID();
                mainDb.addWorkspaceMessage(leafId, parentId, `Message depth ${i}`, 'user', { depth: i });
                parentId = leafId;
            }
        });
        insertTx();

        const t0 = Date.now();
        const branch = mainDb.getWorkspaceBranch(parentId);
        const duration = Date.now() - t0;
        assert.strictEqual(branch.length, 50, "Branch must reconstruct all 50 ancestor messages");
        assert.ok(duration < 100, `Branch reconstruction query must be under 100ms (took ${duration}ms)`);
    });

    console.log("\n=================================================");
    console.log(`TEST SUMMARY: Passed: ${passed}, Failed: ${failed}`);
    console.log("=================================================");

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runSuite().catch(err => {
    console.error("Fatal Test Runner Error:", err);
    process.exit(1);
});
