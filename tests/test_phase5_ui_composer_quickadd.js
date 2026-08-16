/**
 * 🧪 PHASE 5 PRODUCTION UI POLISH & COMPOSER QUICK-ADD MENU TEST SUITE
 * 
 * Verifies UI completeness of Chat composer quick-add button (+), floating menu choices,
 * and response card action bar buttons (Copy, Retry, Print, Download, Share).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runPhase5UITests() {
    console.log('==================================================================');
    console.log('✨ CHRONO PHASE 5: PRODUCTION UI POLISH & COMPOSER QUICK-ADD SUITE');
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

    const htmlPath = path.join(__dirname, '../ui/index.html');
    const jsPath = path.join(__dirname, '../ui/app.js');

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    // ── TEST 1: Composer Quick-Add Button & Menu ─────────────────────────
    console.log('--- TEST 1: Composer Quick-Add Button & Menu Structure ---');
    check('Quick-Add button (#composerQuickAddBtn) present in HTML', htmlContent.includes('id="composerQuickAddBtn"'));
    check('Quick-Add menu (#composerQuickAddMenu) present in HTML', htmlContent.includes('id="composerQuickAddMenu"'));
    check('Hidden file input (#composerFileInput) present in HTML', htmlContent.includes('id="composerFileInput"'));

    // ── TEST 2: Composer Quick-Add Options ──────────────────────────────
    console.log('\n--- TEST 2: Quick-Add Menu Action Items ---');
    check('Upload File option present', htmlContent.includes('triggerFileUpload()'));
    check('Photo Scan option present', htmlContent.includes('triggerPhotoScan()'));
    check('Create Note option present', htmlContent.includes('triggerCreateNote()'));
    check('Import Timetable option present', htmlContent.includes('triggerImportTimetable()'));
    check('Quick Add Task option present', htmlContent.includes('triggerQuickAddTask()'));
    check('Quick Add Event option present', htmlContent.includes('triggerQuickAddEvent()'));

    // ── TEST 3: Response Card Action Bar ────────────────────────────────
    console.log('\n--- TEST 3: Response Card Action Bar Buttons ---');
    check('Copy button (copyChatMessage) bound in app.js', jsContent.includes('copyChatMessage'));
    check('Retry / Regenerate button bound in app.js', jsContent.includes('regenerateChatMessage'));
    check('Print button (printChatMessage) bound in app.js', jsContent.includes('printChatMessage'));
    check('Download button (downloadChatMessage) bound in app.js', jsContent.includes('downloadChatMessage'));
    check('Share button (shareChatMessage) bound in app.js', jsContent.includes('shareChatMessage'));

    // ── TEST 4: Timetable Preview Modal Overlay ─────────────────────────
    console.log('\n--- TEST 4: Timetable Preview Modal Overlay ---');
    check('Timetable preview overlay (#timetablePreviewOverlay) present in HTML', htmlContent.includes('id="timetablePreviewOverlay"'));
    check('Raw timetable textarea (#rawTimetableInput) present in HTML', htmlContent.includes('id="rawTimetableInput"'));
    check('Commit timetable schedule button present', htmlContent.includes('commitTimetableSchedule()'));

    console.log('\n==================================================================');
    console.log(`🎉 PHASE 5 PRODUCTION UI SUITE RESULTS: ${passed} / ${total} PASSED`);
    console.log('==================================================================\n');

    if (passed !== total) {
        process.exit(1);
    }
}

try {
    runPhase5UITests();
} catch (e) {
    console.error('Phase 5 UI test failed with error:', e);
    process.exit(1);
}
