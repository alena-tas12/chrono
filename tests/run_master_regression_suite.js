const { execSync } = require('child_process');

console.log("==================================================================");
console.log("🚀 RUNNING MASTER ARCHITECTURAL REGRESSION SUITE (Phases 1 - 7)");
console.log("==================================================================\n");

const testFiles = [
    'tests/test_dont_help.js',
    'tests/test_memory_lifecycle.js',
    'tests/test_context_conflicts.js',
    'tests/test_phase5_behavioral.js',
    'tests/test_phase6_longitudinal_variability.js',
    'tests/test_context_disambiguation.js',
    'tests/test_full_pipeline_multi_turn.js',
    'tests/test_boundary_cases.js',
    'tests/test_persistence_restart.js',
    'tests/test_conversation_tree_ui.js',
    'tests/test_multi_user_collaboration.js',
    'tests/test_notes_feature.js',
    'tests/test_installed_app_smoke.js',
    'tests/test_3_identities_emergent_personalization.js',
    'tests/test_contract14_human_agency.js',
    'tests/test_chrono_spaces_and_communication_os.js',
    'tests/final_full_system_acceptance.js'
];

let passedSuiteCount = 0;
let totalSuites = testFiles.length;

for (const testFile of testFiles) {
    console.log(`\n▶ Running ${testFile}...`);
    try {
        const output = execSync(`npx electron ${testFile}`, { 
            encoding: 'utf-8', 
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } 
        });
        console.log(output);
        console.log(`✅ ${testFile} PASSED`);
        passedSuiteCount++;
    } catch (err) {
        console.error(`❌ ${testFile} FAILED`);
        console.error(err.stdout || err.message);
        process.exit(1);
    }
}

console.log("\n==================================================================");
console.log(`🎉 MASTER REGRESSION SUITE COMPLETE: ${passedSuiteCount}/${totalSuites} TEST SUITES PASSED CLEANLY`);
console.log("Zero architectural regressions detected across all cognitive layers!");
console.log("==================================================================");
