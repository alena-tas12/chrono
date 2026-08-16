const { ReasoningEngine } = require('../main/reasoningEngine');
const assert = require('assert');

async function runTests() {
    console.log("=== Running Phase 4: Context Conflict Tests ===");

    const engine = new ReasoningEngine();

    // Mock an assembled state where multiple pillars have conflicting temporal information
    const pipelineResult = {
        executiveDirective: "Respond naturally",
        intents: ["Troubleshoot"],
        retrievedState: {
            knowledge: [
                { fact: "[Note] I study in the morning." }
            ],
            memory: [
                { content: "[Observation] User usually studies at night.", status: "active" }
            ],
            calendar: [
                { title: "Study session", date: "Today 8 PM" }
            ],
            tasks: [
                { text: "Finish evening study block", calendar: "work" }
            ]
        }
    };

    console.log("[Test 1] Preserving Context Boundaries");
    const response = await engine.synthesizeResponse("When should I study?", pipelineResult);
    
    // Assert that the Reasoning Engine stub respects the boundaries and prints them separately
    assert(response.includes("(Knowledge Base Blocks Used:\n- [Note] I study in the morning.)"), "Knowledge Base section missing or merged");
    assert(response.includes("(Observations Loaded:\n- [Observation] User usually studies at night.)"), "Observations section missing or merged");
    assert(response.includes("(Tasks Loaded:\n- [work] Finish evening study block)"), "Tasks section missing or merged");
    
    // As long as they are printed in separate structured blocks, the LLM will see them as distinct evidence
    console.log("  ✓ Reasoning Engine correctly separates conflicting evidence into distinct structural pillars");

    console.log("=== All Context Conflict Tests Passed! ===");
}

runTests().catch(console.error);
