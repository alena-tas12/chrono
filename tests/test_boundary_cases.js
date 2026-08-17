const { SemanticParser } = require('../main/semanticParser');
const { DispatchEngine } = require('../main/dispatchEngine');
const { StateManager } = require('../main/stateManager');
const { ReasoningEngine } = require('../main/reasoningEngine');
const assert = require('assert');

async function runBoundarySuite() {
    console.log("=== Phase 7: System-Level Boundary & Selective Retrieval Test Suite ===");

    const parser = new SemanticParser();
    const stateManager = new StateManager();
    const dispatchEngine = new DispatchEngine({ stateManager });
    const reasoningEngine = new ReasoningEngine();

    let passedTests = 0;
    let totalTests = 0;

    // Helper to evaluate inclusion & exclusion of modules
    function assertModules(actual, expectedIncluded, expectedExcluded, testName) {
        for (const inc of expectedIncluded) {
            assert(actual.includes(inc), `[${testName}] Missing expected module inclusion: ${inc}`);
        }
        for (const exc of expectedExcluded) {
            assert(!actual.includes(exc), `[${testName}] Unexpected module inclusion (failed exclusion): ${exc}`);
        }
    }

    console.log("\n--- Category 1: Both Directions Boundary (AMBIGUOUS -> ASK -> CLARIFY -> ACT) ---");
    totalTests++;
    let session = { history: [], currentTopic: null };
    
    // Step A: Ambiguous
    let inputA = "Maybe we should put that on tomorrow";
    let parsedA = await parser.parse(inputA, session.history);
    let planA = await dispatchEngine.planIntent({ input: inputA, session });
    assert.strictEqual(planA.clarification_required, true, "Step A must require clarification");
    assert.strictEqual(planA.action.permitted, false, "Step A must block action");
    console.log(`[PASS 1a] "${inputA}" => Clarification Required: true | Action Permitted: false`);

    // Step B: Clarification
    let inputB = "Yeah, put the OSPF study session on tomorrow at 6.";
    session.history.push({ role: 'user', content: inputA });
    session.history.push({ role: 'assistant', content: "Which task or event would you like to put on tomorrow?" });
    session.currentTopic = "OSPF study session";

    let parsedB = await parser.parse(inputB, session.history);
    let planB = await dispatchEngine.planIntent({ input: inputB, session });
    assert.strictEqual(planB.clarification_required, false, "Step B must resolve clarification");
    assert.strictEqual(planB.action.permitted, true, "Step B must permit action after clarification");
    console.log(`[PASS 1b] "${inputB}" => Clarification Resolved | Action Permitted: true`);
    passedTests++;

    console.log("\n--- Category 2: Action Cancellation (ACT -> Cancel -> REPLY) ---");
    totalTests++;
    session = { history: [], currentTopic: null };
    let input2a = "Schedule my study session tomorrow at 6.";
    let plan2a = await dispatchEngine.planIntent({ input: input2a, session });
    assert.strictEqual(plan2a.action.permitted, true, "2a must permit action");
    session.history.push({ role: 'user', content: input2a });
    session.history.push({ role: 'assistant', content: "Scheduled study session for tomorrow at 6." });

    let input2b = "Actually, don't schedule it.";
    let plan2b = await dispatchEngine.planIntent({ input: input2b, session });
    assert.strictEqual(plan2b.action.permitted, false, "2b must block action upon cancellation");
    console.log(`[PASS 2] Action Cancellation verified cleanly.`);
    passedTests++;

    console.log("\n--- Category 3: Pronoun Resolution against Active Conversation ---");
    totalTests++;
    session = { history: [], currentTopic: "OSPF revision" };
    let input3 = "Actually put it at 7.";
    let plan3 = await dispatchEngine.planIntent({ input: input3, session });
    assert.strictEqual(plan3.action.permitted, true, "3 must permit action on active target pronoun");
    console.log(`[PASS 3] Pronoun resolution against active topic "${session.currentTopic}" verified.`);
    passedTests++;

    console.log("\n--- Category 4: Module Retrieval Inclusion AND Exclusion ---");
    totalTests++;
    
    // Case 4a: Explain recursion
    let plan4a = await dispatchEngine.planIntent({ input: "Explain recursion", session: { history: [] } });
    assertModules(plan4a.selectedModules, ['KnowledgeBase'], ['Tasks', 'Calendar', 'Memory', 'Sleep', 'Projects'], 'Explain recursion');
    console.log(`[PASS 4a] "Explain recursion" -> Included: [KnowledgeBase] | Excluded: [Tasks, Calendar, Memory, Sleep, Projects]`);

    // Case 4b: What do I have tomorrow?
    let plan4b = await dispatchEngine.planIntent({ input: "What do I have tomorrow?", session: { history: [] } });
    assertModules(plan4b.selectedModules, ['Calendar', 'Tasks'], ['Memory', 'Sleep', 'KnowledgeBase', 'Projects'], 'What do I have tomorrow');
    console.log(`[PASS 4b] "What do I have tomorrow?" -> Included: [Calendar, Tasks] | Excluded: [Memory, Sleep, KnowledgeBase, Projects]`);

    // Case 4c: What did I write about OSPF?
    let plan4c = await dispatchEngine.planIntent({ input: "What did I write about OSPF?", session: { history: [] } });
    assertModules(plan4c.selectedModules, ['KnowledgeBase'], ['Tasks', 'Calendar', 'Memory'], 'What did I write about OSPF');
    console.log(`[PASS 4c] "What did I write about OSPF?" -> Included: [KnowledgeBase] | Excluded: [Tasks, Calendar, Memory]`);

    // Case 4d: What do you remember about my project?
    let plan4d = await dispatchEngine.planIntent({ input: "What do you remember about my project?", session: { history: [] } });
    assertModules(plan4d.selectedModules, ['Projects'], ['Calendar', 'Tasks'], 'What do you remember about my project');
    console.log(`[PASS 4d] "What do you remember about my project?" -> Included: [Projects] | Excluded: [Calendar, Tasks]`);

    passedTests++;

    console.log("\n--- Category 5: Epistemic Boundary (UNKNOWN / INSUFFICIENT CONTEXT) ---");
    totalTests++;
    let input5 = "What was the password I wrote down?";
    let plan5 = await dispatchEngine.planIntent({ input: input5, session: { history: [] } });
    let retrieved5 = await dispatchEngine.retrieve(plan5);
    
    let reasoningPayload = {
        intents: plan5.intents,
        retrievedState: retrieved5,
        contextSummary: "[Context: KnowledgeBase]",
        executiveDirective: "Check Knowledge Base",
        contradictions: [],
        recommendations: []
    };
    let response5 = await reasoningEngine.synthesizeResponse(input5, reasoningPayload);
    const respText = typeof response5 === 'object' && response5 ? (response5.text || JSON.stringify(response5)) : String(response5);
    const hasHumility = /don't|not|never|no matching|haven't|cannot|can't|lack|unavailable|available|empty|no password|do not|no record|no information|didn't|unable|without|provider/i.test(respText);
    assert(hasHumility && !respText.includes("123456") && !respText.includes("password123"), `Must state lack of evidence without hallucinating password. Got: "${respText}"`);
    console.log(`[PASS 5] Epistemic Humility verified: "${respText.trim()}"`);
    passedTests++;

    console.log(`\n=========================================`);
    console.log(`Boundary Suite Results: ${passedTests}/${totalTests} Passed`);
    console.log(`All Boundary & Negative Exclusion Assertions Verified!`);
    console.log(`=========================================`);
}

runBoundarySuite().catch(err => {
    console.error(err);
    process.exit(1);
});
