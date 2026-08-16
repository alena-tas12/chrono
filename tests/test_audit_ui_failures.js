const { SemanticParser } = require('../main/semanticParser');
const { DispatchEngine } = require('../main/dispatchEngine');
const { StateManager } = require('../main/stateManager');
const { ExecutiveLayer } = require('../main/executiveLayer');
const { ReasoningEngine } = require('../main/reasoningEngine');
const assert = require('assert');

async function runAuditUIFailuresTest() {
    console.log("=== Phase 7: Audit & Real-World UI Failure Fix Suite ===");

    const parser = new SemanticParser();
    const stateManager = new StateManager();
    const dispatchEngine = new DispatchEngine({ stateManager });
    const executiveLayer = new ExecutiveLayer();
    const reasoningEngine = new ReasoningEngine();

    // ------------------------------------------------------------------
    // Failure 1: "hello why do i feel sad?" (No Canned Continuity / Therapy)
    // ------------------------------------------------------------------
    const input1 = "hello why do i feel sad?";
    const parsed1 = await parser.parse(input1, []);
    const plan1 = await dispatchEngine.planIntent({ input: input1, session: { history: [] } });
    const res1 = await reasoningEngine.synthesizeResponse(input1, { intents: plan1.intents, retrievedState: {}, executiveDirective: 'Normal Response' });
    
    assert(!res1.includes("Welcome back, friend"), "Must NOT output canned Welcome back narrative");
    assert(!res1.includes("Let's unpack that"), "Must NOT output canned therapy template");
    console.log(`✓ Failure 1 Fixed: "${input1}" -> "${res1.trim()}"`);

    // ------------------------------------------------------------------
    // Failure 2: "I'm so fucking frustrated with this code" (No Therapy Template)
    // ------------------------------------------------------------------
    const input2 = "I'm so fucking frustrated with this code";
    const parsed2 = await parser.parse(input2, []);
    const plan2 = await dispatchEngine.planIntent({ input: input2, session: { history: [] } });
    const res2 = await reasoningEngine.synthesizeResponse(input2, { intents: plan2.intents, retrievedState: {}, executiveDirective: 'Normal Response' });
    
    assert(!res2.includes("Let's unpack that"), "Must NOT output canned therapy template");
    assert(!res2.includes("emotional distress"), "Must NOT output psychiatric diagnosis");
    console.log(`✓ Failure 2 Fixed: "${input2}" -> "${res2.trim()}"`);

    // ------------------------------------------------------------------
    // Failure 3: "delete it" (Enforce ASK, No Event "it" Deletion)
    // ------------------------------------------------------------------
    const input3 = "delete it";
    const plan3 = await dispatchEngine.planIntent({ input: input3, session: { history: [], currentTopic: null } });
    
    assert.strictEqual(plan3.clarification_required, true, "'delete it' with no active target MUST require clarification (ASK)");
    assert.strictEqual(plan3.action.permitted, false, "'delete it' with no active target MUST block action");
    console.log(`✓ Failure 3 Fixed: "${input3}" -> Clarification Required: true | Action Permitted: false`);

    // ------------------------------------------------------------------
    // Failure 4: "Move study to evenings" (Dynamic Simulation Target = "study")
    // ------------------------------------------------------------------
    const input4 = "Move study to evenings";
    const plan4 = await dispatchEngine.planIntent({ input: input4, session: { history: [] } });
    plan4.requiresSimulation = true;
    const exec4 = executiveLayer.executePipeline(plan4, {}, [], []);
    
    assert(exec4.simulationResult, "Simulation result must be generated");
    assert.strictEqual(exec4.simulationResult.hypothesis.target, "study", "Simulation target MUST be dynamic 'study', not hardcoded 'Meeting'");
    console.log(`✓ Failure 4 Fixed: "${input4}" -> Simulation Target correctly extracted as "${exec4.simulationResult.hypothesis.target}"`);

    // ------------------------------------------------------------------
    // Failure 5: "what have i planned for tomorrow" (Schedule Retrieval)
    // ------------------------------------------------------------------
    const input5 = "what have i planned for tomorrow";
    const plan5 = await dispatchEngine.planIntent({ input: input5, session: { history: [] } });
    
    assert(plan5.selectedModules.includes('Calendar') || plan5.selectedModules.includes('Tasks'), "Must select Calendar/Tasks for schedule query");
    assert.strictEqual(plan5.action.permitted, false, "Query MUST NOT permit state-mutating action");
    console.log(`✓ Failure 5 Fixed: "${input5}" -> Modules: [${plan5.selectedModules.join(', ')}] | Action Permitted: false`);

    console.log("\n=========================================");
    console.log("🎉 All 5 Real-World UI Failure Fixes Verified Cleanly!");
    console.log("=========================================");
}

runAuditUIFailuresTest().catch(err => {
    console.error(err);
    process.exit(1);
});
