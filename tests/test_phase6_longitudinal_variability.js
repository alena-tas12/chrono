const { SemanticParser } = require('../main/semanticParser');
const { DispatchEngine } = require('../main/dispatchEngine');
const { StateManager } = require('../main/stateManager');
const assert = require('assert');

async function runPhase6Tests() {
    console.log("=== Phase 6: Real-World Conversational Variability & LLM Integration Suite ===");

    const parser = new SemanticParser();
    const stateManager = new StateManager();
    const dispatchEngine = new DispatchEngine({ stateManager });

    let falsePositives = 0;
    let totalTested = 0;

    const testCases = [
        // 1. Slang & Venting (Expect ZERO intervention/action)
        { input: "bruh I'm dead", expected: { intervention: false, actions: false } },
        { input: "I can't even deal right now", expected: { intervention: false, actions: false } },
        { input: "my brain is fried", expected: { intervention: false, actions: false } },
        { input: "I'm just venting, don't help", expected: { intervention: false, actions: false } },
        
        // 2. Casual Reactions (Expect ZERO intervention/action)
        { input: "lol true", expected: { intervention: false, actions: false } },
        { input: "aight sounds good", expected: { intervention: false, actions: false } },
        { input: "k", expected: { intervention: false, actions: false } },
        { input: "thanks bro", expected: { intervention: false, actions: false } },

        // 3. Ambiguous / Insufficient Information (Expect Clarification, NO action)
        { input: "throw this on Sunday's pile", expected: { clarify: true, actions: false } },
        { input: "do that thing for me", expected: { clarify: true, actions: false } },
        { input: "idk man maybe later", expected: { clarify: true, actions: false } },

        // 4. Casual Observations (Expect Conversation/Observation permitted, NO action or tasks fetch)
        { input: "I really need to start getting up earlier", expected: { intervention: true, actions: false } },
        { input: "I've been feeling super overwhelmed with work", expected: { intervention: true, actions: false } },
        { input: "I should probably finish reading that paper tomorrow", expected: { intervention: true, actions: false } },

        // 5. Explicit Action Requests (Expect Action Permitted & Task/Calendar Modules)
        { input: "remind me on Friday at 5pm to pay rent", expected: { intervention: true, actions: true } },
        { input: "remind me tomorrow at 9", expected: { intervention: true, actions: true } }
    ];

    for (const tc of testCases) {
        totalTested++;
        const parsed = await parser.parse(tc.input, []);
        const plan = await dispatchEngine.planIntent({ input: tc.input, session: { history: [] } });

        const audit = {
            Input: tc.input,
            Function: parsed.function.value,
            Intervention_Permitted: plan.intervention.permitted,
            Actions_Permitted: plan.action.permitted,
            Clarification_Required: plan.clarification_required,
            Modules: plan.selectedModules,
            Status: "PASS"
        };

        try {
            if (tc.expected.intervention !== undefined) {
                assert.strictEqual(plan.intervention.permitted, tc.expected.intervention, `Intervention mismatch for "${tc.input}"`);
            }
            if (tc.expected.actions !== undefined) {
                assert.strictEqual(plan.action.permitted, tc.expected.actions, `Action mismatch for "${tc.input}"`);
            }
            if (tc.expected.clarify !== undefined) {
                assert.strictEqual(plan.clarification_required, tc.expected.clarify, `Clarification mismatch for "${tc.input}"`);
            }
        } catch (err) {
            audit.Status = `FAIL - ${err.message}`;
            if (tc.expected.intervention === false && plan.intervention.permitted === true) {
                falsePositives++;
            }
        }

        console.log(`[Audit ${totalTested}] "${tc.input}" => Intent: ${parsed.function.value} | Intervention: ${plan.intervention.permitted} | Action: ${plan.action.permitted} | Clarify: ${plan.clarification_required} | Status: ${audit.Status}`);
    }

    console.log("\n=========================================");
    console.log(`Total Varied Utterances Tested: ${totalTested}`);
    console.log(`False-Positive Interventions: ${falsePositives}`);
    console.log("=========================================");

    if (falsePositives > 0) {
        throw new Error(`Phase 6 Failure: ${falsePositives} false-positive interventions detected.`);
    }
}

runPhase6Tests().catch(err => {
    console.error(err);
    process.exit(1);
});
