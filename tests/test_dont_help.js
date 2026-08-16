const { SemanticParser } = require('../main/semanticParser');
const { DispatchEngine } = require('../main/dispatchEngine');
const { StateManager } = require('../main/stateManager');
const assert = require('assert');

async function runTests() {
    console.log("=== Running Phase 4: 'Don't Help' Constraint Tests ===");
    const parser = new SemanticParser();
    const stateManager = new StateManager();
    const dispatchEngine = new DispatchEngine({ stateManager });

    console.log("[Test 1] Casual Reaction (lol)");
    const plan1 = await dispatchEngine.planIntent({ input: "lol", session: { history: [] } });
    
    assert(!plan1.selectedModules.includes("Tasks"), "Tasks should not be retrieved for casual reaction");
    assert(!plan1.selectedModules.includes("Calendar"), "Calendar should not be retrieved for casual reaction");
    assert(!plan1.selectedModules.includes("Memory"), "Memory should not be retrieved for casual reaction");
    console.log("  ✓ Casual reaction correctly bypassed intrusive retrieval");

    console.log("[Test 2] Social Inquiry (how are you?)");
    const plan2 = await dispatchEngine.planIntent({ input: "how are you?", session: { history: [] } });
    
    assert(!plan2.selectedModules.includes("Tasks"), "Tasks should not be retrieved for social inquiry");
    assert(!plan2.selectedModules.includes("Calendar"), "Calendar should not be retrieved for social inquiry");
    console.log("  ✓ Social inquiry correctly bypassed intrusive retrieval");

    console.log("=== All 'Don't Help' Tests Passed! ===");
}

runTests().catch(console.error);
