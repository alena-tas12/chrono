const { SemanticParser } = require('../main/semanticParser');
const { DispatchEngine } = require('../main/dispatchEngine');
const { StateManager } = require('../main/stateManager');
const memoryEngine = require('../main/memoryEngine');
const mainDb = require('../main/main_db');
const assert = require('assert');

async function runTests() {
    console.log("=== Phase 5: Master Behavioral Suite ===");
    
    const parser = new SemanticParser();
    const stateManager = new StateManager();
    const dispatchEngine = new DispatchEngine({ stateManager });

    let falsePositives = 0;

    async function evaluateBehavior(input, history, expected) {
        const parsed = await parser.parse(input, history);
        const plan = await dispatchEngine.planIntent({ input, session: { history } });
        
        const audit = {
            Input: input,
            Intent: parsed.function.value,
            Intervention_Permitted: plan.intervention.permitted,
            Retrievals_Permitted: plan.context_retrieval.permitted,
            Actions_Permitted: plan.action.permitted,
            Clarification_Required: plan.clarification_required,
            Modules_Retrieved: plan.selectedModules,
            Result: "PENDING"
        };
        
        try {
            if (expected.intervention !== undefined) assert.strictEqual(plan.intervention.permitted, expected.intervention, "Intervention mismatch");
            if (expected.actions !== undefined) assert.strictEqual(plan.action.permitted, expected.actions, "Action mismatch");
            if (expected.clarify !== undefined) assert.strictEqual(plan.clarification_required, expected.clarify, "Clarification mismatch");
            if (expected.modules) {
                for (const mod of expected.modules) {
                    assert(plan.selectedModules.includes(mod), `Missing module: ${mod}`);
                }
            }
            if (expected.no_modules) {
                for (const mod of expected.no_modules) {
                    assert(!plan.selectedModules.includes(mod), `Unexpected module: ${mod}`);
                }
            }
            
            audit.Result = "PASS";
        } catch (e) {
            audit.Result = "FAIL - " + e.message;
            if (expected.intervention === false && plan.intervention.permitted === true) {
                falsePositives++;
            }
        }
        
        console.log(`\n[Audit] ${input}`);
        console.log(JSON.stringify(audit, null, 2));
    }

    console.log("\n--- Layer 1: Zero-Intervention & False Positives ---");
    await evaluateBehavior("I'm exhausted", [], { intervention: false, actions: false, no_modules: ['Tasks', 'Calendar', 'Projects'] });
    await evaluateBehavior("My assignment is killing me", [], { intervention: false, actions: false, no_modules: ['Tasks'] });
    await evaluateBehavior("hmm", [], { intervention: false, actions: false, no_modules: ['KnowledgeBase', 'Memory'] });
    
    console.log("\n--- Layer 2: Ambiguity & Insufficient Confidence ---");
    await evaluateBehavior("Put that on my calendar", [], { clarify: true, actions: false, intervention: false, no_modules: ['Calendar'] });
    
    console.log("\n--- Layer 3: Action Boundaries ---");
    await evaluateBehavior("I should submit this tomorrow", [], { intervention: true, actions: false, no_modules: ['Tasks'] });
    await evaluateBehavior("Remind me tomorrow at 9", [], { intervention: true, actions: true, modules: ['Tasks', 'Calendar'] });

    console.log("\n--- Layer 4: Multi-Turn Mode Shifting ---");
    let history = [];
    history.push({ role: 'user', content: 'I have an assignment due Friday.' });
    await evaluateBehavior("Actually, professor said Monday.", history, { intervention: true, actions: false }); // Correction
    
    history.push({ role: 'user', content: 'Actually, professor said Monday.' });
    await evaluateBehavior("I'm just venting, don't help.", history, { intervention: false, actions: false, no_modules: ['Tasks'] });
    
    history.push({ role: 'user', content: "I'm just venting, don't help." });
    await evaluateBehavior("It's stressing me out.", history, { intervention: false, actions: false });
    
    history.push({ role: 'user', content: "It's stressing me out." });
    await evaluateBehavior("Okay, remind me Sunday at 6.", history, { intervention: true, actions: true, modules: ['Tasks', 'Calendar'] });

    console.log("\n--- Layer 5: Natural Memory Lifecycle ---");
    mainDb.db.prepare("DELETE FROM cognitive_memories WHERE evidence LIKE '%test_p5%'").run();
    
    const m1 = memoryEngine.storeObservation("Deadline is Friday", "User", "test_p5");
    const m2 = memoryEngine.correctMemory(m1, "Deadline is Monday", "test_p5");
    const m3 = memoryEngine.correctMemory(m2, "Deadline is Friday", "test_p5");
    
    const doc1 = mainDb.db.prepare("SELECT * FROM cognitive_memories WHERE id = ?").get(m1);
    const doc2 = mainDb.db.prepare("SELECT * FROM cognitive_memories WHERE id = ?").get(m2);
    const doc3 = mainDb.db.prepare("SELECT * FROM cognitive_memories WHERE id = ?").get(m3);
    
    assert(doc1.status === 'corrected', "M1 should be corrected");
    assert(doc2.status === 'corrected', "M2 should be corrected");
    assert(doc3.status === 'active', "M3 should be active");
    console.log(`\n[Audit] Memory Lifecycle`);
    console.log(`M1 Status: ${doc1.status} | M2 Status: ${doc2.status} | M3 Status: ${doc3.status}\nResult: PASS`);

    console.log("\n=========================================");
    console.log(`False-Positive Interventions: ${falsePositives}`);
    console.log("=========================================");
    
    if (falsePositives > 0) {
        throw new Error("CRITICAL FAILURE: False Positive Interventions > 0");
    }
}

runTests().catch(console.error);
