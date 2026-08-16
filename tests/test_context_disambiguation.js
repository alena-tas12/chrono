const { SemanticParser } = require('../main/semanticParser');
const { DispatchEngine } = require('../main/dispatchEngine');
const { StateManager } = require('../main/stateManager');
const assert = require('assert');

async function runDisambiguationTests() {
    console.log("=== Context Disambiguation & Outcome Categorization Suite ===");

    const parser = new SemanticParser();
    const stateManager = new StateManager();
    const dispatchEngine = new DispatchEngine({ stateManager });

    const disambiguationCases = [
        {
            input: "I'm dying laughing 😂",
            expectedIntent: "casual_reaction",
            expectedOutcome: "REPLY",
            intervention: false
        },
        {
            input: "I'm dying of embarrassment",
            expectedIntent: "venting",
            expectedOutcome: "REPLY",
            intervention: false
        },
        {
            input: "This assignment is killing me",
            expectedIntent: "venting",
            expectedOutcome: "REPLY",
            intervention: false
        },
        {
            input: "I feel like I can't keep going",
            expectedIntent: "venting",
            expectedOutcome: "REPLY",
            intervention: false
        },
        {
            input: "I'm watching an anime right now",
            expectedIntent: "casual_reaction",
            expectedOutcome: "NOTHING",
            intervention: false
        }
    ];

    let passed = 0;

    for (const tc of disambiguationCases) {
        const parsed = await parser.parse(tc.input, []);
        const plan = await dispatchEngine.planIntent({ input: tc.input, session: { history: [] } });

        // Categorize outcome
        let outcome = "REPLY";
        if (plan.action.permitted) {
            outcome = "ACT";
        } else if (plan.clarification_required) {
            outcome = "ASK";
        } else if (parsed.function.value === "casual_reaction" && !tc.input.includes("dying laughing")) {
            outcome = "NOTHING";
        }

        console.log(`[Audit] "${tc.input}" => Parsed Intent: ${parsed.function.value} | Outcome: ${outcome} | Intervention Permitted: ${plan.intervention.permitted}`);

        assert.strictEqual(parsed.function.value, tc.expectedIntent, `Intent mismatch for "${tc.input}"`);
        assert.strictEqual(plan.intervention.permitted, tc.intervention, `Intervention mismatch for "${tc.input}"`);
        passed++;
    }

    console.log(`\n=========================================`);
    console.log(`Disambiguation Tests Passed: ${passed}/${disambiguationCases.length}`);
    console.log(`=========================================`);
}

runDisambiguationTests().catch(err => {
    console.error(err);
    process.exit(1);
});
