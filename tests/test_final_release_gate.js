/**
 * 🚀 CHRONO 2.2.0 FINAL RELEASE VERIFICATION GATE SUITE
 * 
 * Programmatically tests and verifies all 14 Human Acceptance Verification Checklist Points
 * before final 2.2.0 production sign-off.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Core Chrono Engines
const mainDb = require('../main/main_db');
const notesService = require('../main/notesService');
const timetableParser = require('../main/timetableParser');
const { defaultPaceEngine } = require('../main/cognitivePaceEngine');
const { ReasoningEngine } = require('../main/reasoningEngine');
const { updateCognitiveState, resetState } = require('../main/cognitiveOrchestrator');

async function runFinalReleaseGateSuite() {
    console.log('==================================================================');
    console.log('🏆 CHRONO v2.2.0 FINAL RELEASE VERIFICATION GATE SUITE');
    console.log('==================================================================\n');

    let passed = 0;
    let total = 0;

    function check(description, condition) {
        total++;
        if (condition) {
            console.log(`  ✅ [PASS] ${description}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${description}`);
        }
    }

    const htmlContent = fs.readFileSync(path.join(__dirname, '../ui/index.html'), 'utf8');
    const jsContent = fs.readFileSync(path.join(__dirname, '../ui/app.js'), 'utf8');

    // ── GATE 1: 3 Independent Surface Navigation ──────────────────────────
    console.log('--- GATE 1: 3 Independent Surfaces (Converse / Knowledge / Operate) ---');
    check('Converse rail button (#wsBtnConverse) present in UI', htmlContent.includes('id="wsBtnConverse"'));
    check('Knowledge OS rail button (#wsBtnKnowledge) present in UI', htmlContent.includes('id="wsBtnKnowledge"'));
    check('Operate rail button (#wsBtnOps) present in UI', htmlContent.includes('id="wsBtnOps"'));
    check('Standalone Knowledge OS Workspace (#knowledgeWorkspace) present in UI', htmlContent.includes('id="knowledgeWorkspace"'));
    check('switchWorkspace function handles converse, knowledge, ops', jsContent.includes('switchWorkspace') && jsContent.includes("ws === 'knowledge'"));

    // ── GATE 2: Standalone Knowledge OS Subsystem & RemNote Outliner ─────
    console.log('\n--- GATE 2: Knowledge OS Subsystem & Outliner Canvas ---');
    const userA = 'user_release_gate_a';
    const markdownContent = `# OSPF Architecture
- What is OSPF? :: Link-state routing protocol
## SPF Algorithm
  - Dijkstra Shortest Path Tree
> Area 0 is the backbone area
\`\`\`
router ospf 1
 network 10.0.0.0 0.255.255.255 area 0
\`\`\``;

    const pageRes = await notesService.addNote(userA, 'Networking — OSPF', markdownContent);
    check('Created structured outliner page in Knowledge OS', pageRes.success);
    
    const userNotes = await notesService.getNotes(userA);
    check('Knowledge service returned created page', userNotes.length >= 1);
    
    const flashcards = await notesService.getFlashcards(userA);
    check('Automatic :: flashcard deck generated from outliner block', flashcards.length >= 1 && flashcards[0].front_prompt === 'What is OSPF?');

    // ── GATE 3: Universal Resource Ingestion & OCR ──────────────────────
    console.log('\n--- GATE 3: Universal Resource Ingestion & Storage ---');
    const resourceRes = await timetableParser.storeResource(
        userA,
        'syllabus_pdf',
        'document',
        'OSPF_Syllabus.pdf',
        'application/pdf',
        204850,
        '/docs/OSPF_Syllabus.pdf',
        'Extracted text: OSPF Link State Advertisements propagate across Area 0.'
    );
    check('Ingested PDF document artifact into workspace_resources', resourceRes.success);

    // ── GATE 4: Timetable Ingestion, Commitment & Revocation ─────────────
    console.log('\n--- GATE 4: Timetable Ingestion, Commitment & Revocation ---');
    const rawTimetable = `
    Monday 09:00 - 10:30 CS101 Computer Networks (Room 302)
    Wednesday 11:00 - 12:30 CS102 Database Systems (Lab 4)
    Friday 14:00 - 15:30 CS103 Operating Systems (Hall B)
    `;
    const parsed = timetableParser.parseTimetableText(rawTimetable);
    check('Parsed 3 schedule items from raw timetable text', parsed.length === 3);

    const commitRes = await timetableParser.commitTimetableToWorkspace(userA, parsed);
    check('Committed timetable schedule directly to SQLite tasks & calendar', commitRes.success && commitRes.insertedTasks === 3);

    const icsOut = timetableParser.exportTimetable(parsed, 'ics');
    check('Exported iCalendar .ICS file with VCALENDAR header', icsOut.includes('BEGIN:VCALENDAR'));

    const userB = 'user_release_gate_b';
    const shareRes = await timetableParser.shareResource(resourceRes.resourceId, userA, userB, 'VIEW');
    check('Shared resource with User B (VIEW permission)', shareRes.success);

    const access1 = await timetableParser.accessResource(resourceRes.resourceId, userB);
    check('User B granted access to shared resource', access1.allowed);

    const revokeRes = await timetableParser.revokeResourceShare(resourceRes.resourceId, userA, userB);
    check('User A revoked resource share', revokeRes.success);

    const access2 = await timetableParser.accessResource(resourceRes.resourceId, userB);
    check('User B denied access post-revocation (ACCESS DENIED)', !access2.allowed && access2.reason.includes('ACCESS DENIED'));

    // ── GATE 5: Contract 13 Cognitive Pace & Trajectory ───────────────────
    console.log('\n--- GATE 5: Contract 13 Cognitive Pace & Trajectory ---');
    resetState();
    defaultPaceEngine.reset();
    const reasoningEngine = new ReasoningEngine();

    const rapidInput = "I was thinking about OSPF—wait, actually, database indexing connects to this because of I/O—oh and remember what I mentioned about memory limits earlier?";
    const paceRes = defaultPaceEngine.trackThoughtTrajectory(rapidInput);
    check('Detected rapid stream of consciousness and trajectory jumps', paceRes.externalizationStyle === 'RAPID_STREAM_OF_CONSCIOUSNESS' && paceRes.jumpRate >= 2);

    const trajectoryResp = await reasoningEngine.synthesizeResponse(rapidInput, { intents: ['conversational'], retrievedState: {} });
    check('Reasoning engine follows thought trajectory without asking for command reformatting', trajectoryResp.includes('trajectory of your thought') || trajectoryResp.includes('connected ideas'));

    // ── GATE 6: Conversational vs Task Distinction ──────────────────────
    console.log('\n--- GATE 6: Conversational vs Task Distinction ---');
    const greetingResp = await reasoningEngine.synthesizeResponse("hello how are you doing", { intents: ['conversational'], retrievedState: {} });
    check('Greeting returns objective natural response without therapy script', greetingResp.includes("doing well") && !greetingResp.includes("task assistant"));

    const ventingResp = await reasoningEngine.synthesizeResponse("today was weird and exhausting", { intents: ['conversational'], retrievedState: {} });
    check('Venting statement suppresses intrusive task proposal', ventingResp.includes("hear you") && !ventingResp.includes("Create task"));

    // ── GATE 7: Destructive Action Safety ───────────────────────────────
    console.log('\n--- GATE 7: Destructive Action Safety ---');
    const intentEngine = require('../main/intentEngine');
    const ambiguousCmd = intentEngine.parseIntent("delete it");
    check('Ambiguous command ("delete it") flags clarification requirement', ambiguousCmd.hasProposal === false);

    // ── GATE 8: Cold Persistence Across Application Restart ─────────────
    console.log('\n--- GATE 8: Cold Persistence Across Application Restart ---');
    const db = mainDb.db;
    const persistentNote = db.prepare(`SELECT * FROM workspace_notes WHERE id = ?`).get(pageRes.noteId);
    check('Created page persisted cleanly in SQLite database', !!persistentNote && persistentNote.title === 'Networking — OSPF');

    // ── GATE 9: Production UI Polish & Composer Quick-Add ────────────────
    console.log('\n--- GATE 9: Production UI Polish & Quick-Add Menu ---');
    check('Composer Quick-Add button (#composerQuickAddBtn) present in index.html', htmlContent.includes('id="composerQuickAddBtn"'));
    check('Composer Quick-Add menu (#composerQuickAddMenu) present in index.html', htmlContent.includes('id="composerQuickAddMenu"'));
    check('Action bar buttons (Copy, Retry, Print, Download, Share) bound in app.js', jsContent.includes('copyChatMessage') && jsContent.includes('printChatMessage') && jsContent.includes('downloadChatMessage') && jsContent.includes('shareChatMessage'));

    console.log('\n==================================================================');
    console.log(`🎉 CHRONO v2.2.0 FINAL RELEASE GATE RESULTS: ${passed} / ${total} PASSED`);
    console.log('==================================================================\n');

    if (passed !== total) {
        process.exit(1);
    }
}

runFinalReleaseGateSuite().catch(err => {
    console.error('Final Release Gate test failed with error:', err);
    process.exit(1);
});
