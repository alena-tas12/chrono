const { SemanticParser } = require('../main/semanticParser');
const { DispatchEngine } = require('../main/dispatchEngine');
const { StateManager } = require('../main/stateManager');
const { ReasoningEngine } = require('../main/reasoningEngine');
const assert = require('assert');

async function runFullPipelineMultiTurnTest() {
    console.log("=== Phase 7: Full Pipeline Multi-Turn Stress Suite ===");

    const parser = new SemanticParser();
    const stateManager = new StateManager();
    const dispatchEngine = new DispatchEngine({ stateManager });
    const reasoningEngine = new ReasoningEngine();

    let history = [];
    let passedTurns = 0;
    let falsePositives = 0;

    const turns = [
        { turn: 1, input: "hey", expectedAction: false, expectedIntervention: false },
        { turn: 2, input: "lol I barely slept", expectedAction: false, expectedIntervention: false },
        { turn: 3, input: "anyway I need to finish this networking thing", expectedAction: false, expectedIntervention: true },
        { turn: 4, input: "actually forget that", expectedAction: false, expectedIntervention: true },
        { turn: 5, input: "what was I saying?", expectedAction: false, expectedIntervention: true },
        { turn: 6, input: "wait no, I mean the other thing", expectedAction: false, expectedIntervention: true },
        { turn: 7, input: "😂 never mind", expectedAction: false, expectedIntervention: false },
        { turn: 8, input: "okay help me plan tomorrow", expectedAction: true, expectedIntervention: true },
        { turn: 9, input: "actually don't schedule anything yet", expectedAction: false, expectedIntervention: true },
        { turn: 10, input: "what did I write about OSPF?", expectedAction: false, expectedIntervention: true },
        { turn: 11, input: "that's not what I meant", expectedAction: false, expectedIntervention: true }
    ];

    const { updateCognitiveState } = require('../main/cognitiveOrchestrator');
    for (const t of turns) {
        // 0. Contract 13 Cognitive Pace & Trajectory Processing
        updateCognitiveState(t.input);

        // 1. Semantic Parse given full conversation history
        const parsedSemantics = await parser.parse(t.input, history);

        // 2. Dispatch Planning
        const dispatchPlan = await dispatchEngine.planIntent({
            input: t.input,
            session: { history, currentTopic: null }
        });

        // 3. State Retrieval (only if permitted)
        let retrievedState = {};
        if (dispatchPlan.context_retrieval.permitted && dispatchPlan.selectedModules.length > 0) {
            retrievedState = await dispatchEngine.retrieve(dispatchPlan);
        }

        // 4. Reasoning & Synthesis
        const pipelinePayload = {
            intents: dispatchPlan.intents,
            retrievedState,
            contextSummary: `[Context: ${dispatchPlan.selectedModules.join(', ')}]`,
            executiveDirective: dispatchPlan.clarification_required ? 'Request Clarification' : 'Execute Normal Response',
            contradictions: [],
            recommendations: []
        };
        const responseText = await reasoningEngine.synthesizeResponse(t.input, pipelinePayload);

        // 5. Update history
        history.push({ role: 'user', content: t.input });
        history.push({ role: 'assistant', content: responseText });

        // Categorize outcome: REPLY | ACT | ASK | NOTHING
        let outcome = "REPLY";
        if (dispatchPlan.action.permitted) {
            outcome = "ACT";
        } else if (dispatchPlan.clarification_required) {
            outcome = "ASK";
        } else if (!dispatchPlan.intervention.permitted) {
            outcome = "NOTHING";
        }

        console.log(`[Turn ${t.turn}] "${t.input}"`);
        console.log(`  Intent: ${parsedSemantics.function.value} | Outcome: ${outcome} | Action Permitted: ${dispatchPlan.action.permitted} | Modules: [${dispatchPlan.selectedModules.join(', ')}]`);

        try {
            assert.strictEqual(dispatchPlan.action.permitted, t.expectedAction, `Turn ${t.turn} Action permission mismatch`);
            assert.strictEqual(dispatchPlan.intervention.permitted, t.expectedIntervention, `Turn ${t.turn} Intervention permission mismatch`);
            passedTurns++;
        } catch (err) {
            console.error(`  FAIL: ${err.message}`);
            if (t.expectedAction === false && dispatchPlan.action.permitted === true) {
                falsePositives++;
            }
        }
    }

    console.log(`\n=========================================`);
    console.log(`Multi-Turn Pipeline Test Completed`);
    console.log(`Turns Passed: ${passedTurns}/${turns.length}`);
    console.log(`False Positive Actions: ${falsePositives}`);
    console.log(`Total History Length Accumulated: ${history.length} messages`);
    console.log(`=========================================`);

    if (falsePositives > 0 || passedTurns !== turns.length) {
        throw new Error("Multi-Turn Pipeline Stress Test Failed.");
    }
}

runFullPipelineMultiTurnTest().catch(err => {
    console.error(err);
    process.exit(1);
});
