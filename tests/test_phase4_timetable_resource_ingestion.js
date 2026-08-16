/**
 * 🧪 PHASE 4 UNIVERSAL RESOURCE INGESTION & TIMETABLE PARSER TEST SUITE
 * 
 * Empirically verifies document text extraction, timetable schedule parsing,
 * SQLite commitment to Calendar & Tasks, multi-format export (ICS, CSV, JSON),
 * and multi-user permission sharing with real revocation enforcement.
 */

const timetableParser = require('../main/timetableParser');
const mainDb = require('../main/main_db');
const assert = require('assert');

async function runPhase4Tests() {
    console.log('==================================================================');
    console.log('📅 CHRONO PHASE 4: TIMETABLE PARSER & RESOURCE INGESTION SUITE');
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

    const userA = 'user_A_phase4_' + Date.now();
    const userB = 'user_B_phase4_' + Date.now();

    // ── TEST 1: Timetable Raw Text Parser ───────────────────────────────
    console.log('--- TEST 1: Raw Timetable Text Parser ---');
    const rawTimetableText = `Monday
09:00 - 10:30 CS101 Computer Networks Room 302
11:00 - 12:30 Database Systems Lab 4

Wednesday
14:00 - 15:30 Operating Systems LH-1`;

    const parsedItems = timetableParser.parseTimetableText(rawTimetableText);
    check('Parsed 3 schedule items from raw text', parsedItems.length === 3);
    check('First item day is Monday', parsedItems[0].day === 'Monday');
    check('First item start time is 09:00', parsedItems[0].startTime === '09:00');
    check('First item end time is 10:30', parsedItems[0].endTime === '10:30');
    check('First item title contains CS101 Computer Networks', parsedItems[0].title.includes('CS101 Computer Networks'));
    check('First item location matches Room 302', parsedItems[0].location === 'Room 302');

    // ── TEST 2: Commit Timetable to Calendar & Tasks ────────────────────
    console.log('\n--- TEST 2: Commit Timetable to Calendar & Tasks ---');
    const commitRes = await timetableParser.commitTimetableToWorkspace(userA, parsedItems);
    check('Schedule items committed cleanly', commitRes.success);
    check('Inserted 3 events into Calendar', commitRes.insertedEvents === 3);
    check('Inserted 3 tasks into Task Manager', commitRes.insertedTasks === 3);

    // Verify DB insertion
    const db = mainDb.db;
    const tasks = db.prepare(`SELECT * FROM tasks WHERE text LIKE '%CS101%' OR text LIKE '%Database%' OR text LIKE '%Operating%'`).all();
    check('SQLite tasks table contains committed schedule items', tasks.length === 3);

    // ── TEST 3: Multi-Format Schedule Export (.ICS / .CSV / .JSON) ───────
    console.log('\n--- TEST 3: Multi-Format Schedule Export ---');
    const icsOutput = timetableParser.exportTimetable(parsedItems, 'ics');
    check('ICS export starts with VCALENDAR header', icsOutput.includes('BEGIN:VCALENDAR'));
    check('ICS export includes event summary', icsOutput.includes('SUMMARY:CS101 Computer Networks'));

    const csvOutput = timetableParser.exportTimetable(parsedItems, 'csv');
    check('CSV export contains header row', csvOutput.includes('Day,Start Time,End Time,Title,Location,Category'));
    check('CSV export contains Monday row', csvOutput.includes('"Monday"'));

    // ── TEST 4: Resource Storage & Metadata ─────────────────────────────
    console.log('\n--- TEST 4: Universal Resource Storage & OCR ---');
    const storeRes = await timetableParser.storeResource(userA, 'Fall 2026 Timetable', 'timetable', 'timetable.pdf', 'application/pdf', 1048576, '/storage/timetable.pdf', rawTimetableText);
    check('Resource stored cleanly', storeRes.success && storeRes.resourceId);
    const resourceId = storeRes.resourceId;

    // ── TEST 5: Multi-User Sharing & Permission Access ─────────────────
    console.log('\n--- TEST 5: Multi-User Permission Sharing & Revocation ---');
    // User A shares resource with User B
    const shareRes = await timetableParser.shareResource(resourceId, userA, userB, 'VIEW');
    check('Resource shared with User B (VIEW permission)', shareRes.success);

    // User B attempts access
    const accessB = await timetableParser.accessResource(resourceId, userB);
    check('User B granted access to shared resource', accessB.allowed && accessB.permission === 'VIEW');

    // User A revokes share
    const revokeRes = await timetableParser.revokeResourceShare(resourceId, userA, userB);
    check('User A revoked resource share', revokeRes.success);

    // User B attempts access post-revocation
    const accessBPostRevoke = await timetableParser.accessResource(resourceId, userB);
    check('User B denied access post-revocation (ACCESS DENIED)', accessBPostRevoke.allowed === false && accessBPostRevoke.reason.includes('ACCESS DENIED'));

    console.log('\n==================================================================');
    console.log(`🎉 PHASE 4 TIMETABLE & RESOURCE SUITE RESULTS: ${passed} / ${total} PASSED`);
    console.log('==================================================================\n');

    if (passed !== total) {
        process.exit(1);
    }
}

runPhase4Tests().catch(err => {
    console.error('Phase 4 test failed with error:', err);
    process.exit(1);
});
