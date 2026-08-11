/**
 * 🧪 CHRONO COGNITIVE OS - ARCHITECTURE TEST SUITE
 * 
 * Validates the core Dispatch and State Manager pipelines.
 * Ensures the system routes intelligently without hallucinating.
 */

const assert = require('assert');

// Mocked dependencies (will be imported from actual modules when built)
const { DispatchEngine } = require('../main/dispatchEngine');
const { StateManager } = require('../main/stateManager');
const { ModuleRegistry } = require('../main/moduleRegistry');

async function runTests() {
    console.log("==========================================");
    console.log("🧠 RUNNING CHRONO ARCHITECTURE TEST SUITE");
    console.log("==========================================\n");

    const stateManager = new StateManager();
    const registry = new ModuleRegistry();
    const dispatch = new DispatchEngine({ stateManager, registry });

    let testsPassed = 0;
    let testsFailed = 0;

    function report(name, passed, error = null) {
        if (passed) {
            console.log(`✅ [PASS] ${name}`);
            testsPassed++;
        } else {
            console.error(`❌ [FAIL] ${name}`);
            if (error) console.error(`   Error: ${error}`);
            testsFailed++;
        }
    }

    // =======================================================
    // TEST 1: Temporal Scoping ("What's tomorrow?")
    // =======================================================
    try {
        const result = await dispatch.planIntent({ input: "What's tomorrow?", session: {} });
        
        // Expected: Calendar queried. Files not queried. Memory graph not queried.
        assert(result.selectedModules.includes('Calendar'), "Calendar must be queried");
        assert(!result.selectedModules.includes('Files'), "Files must NOT be queried");
        assert(!result.selectedModules.includes('MemoryGraph'), "Memory Graph must NOT be queried");
        
        report("Test 1: Temporal Scoping", true);
    } catch (e) {
        report("Test 1: Temporal Scoping", false, e.message);
    }

    // =======================================================
    // TEST 2: Session Continuity ("Continue")
    // =======================================================
    try {
        const session = { currentTopic: 'scheduler_architecture' };
        const result = await dispatch.planIntent({ input: "Continue.", session });
        
        assert(result.activeContext === 'scheduler_architecture', "Session state must override generic inputs");
        assert(result.selectedModules.includes('Projects'), "Projects must be queried based on session context");
        
        report("Test 2: Session Continuity", true);
    } catch (e) {
        report("Test 2: Session Continuity", false, e.message);
    }

    // =======================================================
    // TEST 3: Cross-Domain Health Query ("Why am I tired?")
    // =======================================================
    try {
        const result = await dispatch.planIntent({ input: "Why am I tired?", session: {} });
        
        assert(result.selectedModules.includes('Sleep'), "Sleep must be queried");
        assert(result.selectedModules.includes('Calendar'), "Calendar must be queried");
        assert(result.selectedModules.includes('Health'), "Health must be queried");
        assert(!result.selectedModules.includes('Email'), "Email must NOT be queried");
        
        report("Test 3: Cross-Domain Health Query", true);
    } catch (e) {
        report("Test 3: Cross-Domain Health Query", false, e.message);
    }

    // =======================================================
    // TEST 4: Contradiction Detection
    // =======================================================
    try {
        const mockRetrieval = {
            calendar: [{ event: "Meeting", time: "14:00", confidence: 1.0 }],
            userInput: "I am free all afternoon."
        };
        
        const contradictions = dispatch.detectContradictions(mockRetrieval);
        assert(contradictions.length > 0, "Conflict must be surfaced");
        assert(contradictions[0].type === 'TemporalConflict', "Conflict should be temporal");
        
        report("Test 4: Contradiction Detection", true);
    } catch (e) {
        report("Test 4: Contradiction Detection", false, e.message);
    }

    // =======================================================
    // TEST 5: Epistemic Humility (No Hallucination)
    // =======================================================
    try {
        const mockRetrieval = { memory: [] }; // No data found
        const response = dispatch.formulateResponse(mockRetrieval);
        
        assert(response.includes("I don't have enough information"), "System must admit lack of knowledge");
        
        report("Test 5: Epistemic Humility (No Hallucination)", true);
    } catch (e) {
        report("Test 5: Epistemic Humility (No Hallucination)", false, e.message);
    }

    console.log("\n==========================================");
    console.log(`Results: ${testsPassed} passed, ${testsFailed} failed.`);
    console.log("==========================================");

    process.exit(testsFailed > 0 ? 1 : 0);
}

runTests();
