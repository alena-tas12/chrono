/**
 * 🧪 TEST: Real Runtime Pipeline & Cognitive Gap Verification
 *
 * Verifies:
 * 1. Full IPC -> Dispatch -> Executive -> Reasoning execution pipeline
 * 2. Multi-turn Session History continuity (Turn 1 info remembered in Turn 2)
 * 3. Hypothesis generation lifecycle (Observation -> FACT/INFERENCE/HYPOTHESIS -> DB persistence & retrieval)
 * 4. Episodic Replay context inclusion in the actual LLM prompt / system prompt context
 *
 * Run via: $env:ELECTRON_RUN_AS_NODE=1; npx electron tests/test_runtime_pipeline_gaps.js
 */

const path = require('path');
process.env.CHRONO_SEED_TEST_PEERS = 'false';

const db = require(path.join(__dirname, '../main/main_db'));
const { DispatchEngine } = require(path.join(__dirname, '../main/dispatchEngine'));
const { ExecutiveLayer } = require(path.join(__dirname, '../main/executiveLayer'));
const { ReasoningEngine } = require(path.join(__dirname, '../main/reasoningEngine'));
const orchestrator = require(path.join(__dirname, '../main/cognitiveOrchestrator'));
const episodicReplay = require(path.join(__dirname, '../main/episodicReplay'));
const memory = require(path.join(__dirname, '../main/memoryEngine'));

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${label}`);
        failed++;
    }
}

async function runTests() {
    console.log('\n🧪 TEST: Real Runtime Pipeline & Cognitive Gap Verification\n');

    // Setup Test User / Active Leaf
    const userId = db.getActiveUserId() || 'local_user';

    // ------------------------------------------------------------------
    // TEST 1: Multi-Turn Session History Continuity Propagation
    // ------------------------------------------------------------------
    console.log('--- Step 1: Testing Multi-Turn Session History Continuity Propagation ---');

    // Turn 1 message creation (Simulating IPC ai-response)
    const turn1UserMsg = db.addWorkspaceMessage({
        role: 'user',
        content: 'My favorite subject is data structures.',
        parent_id: null
    });

    const turn1Branch = db.getWorkspaceBranch(turn1UserMsg.id);
    const turn1History = turn1Branch.map(m => ({ role: m.role, content: m.content }));

const { StateManager } = require(path.join(__dirname, '../main/stateManager'));

    const stateManager = new StateManager();
    const dispatch = new DispatchEngine({ stateManager, registry: null });
    const executive = new ExecutiveLayer();
    const reasoning = new ReasoningEngine();

    const plan1 = await dispatch.planIntent({ input: turn1UserMsg.content, session: { history: turn1History } });
    const state1 = await dispatch.retrieve(plan1);
    const pipeline1 = executive.executePipeline(plan1, state1, [], [], turn1History);

    assert(Array.isArray(pipeline1.sessionHistory), 'pipelineResult contains sessionHistory array');
    assert(pipeline1.sessionHistory.length === 1, `sessionHistory has Turn 1 user message (length: ${pipeline1.sessionHistory.length})`);
    assert(pipeline1.sessionHistory[0].content === 'My favorite subject is data structures.', 'Turn 1 user content matched');

    // Add Turn 1 Assistant response
    const turn1AssistantMsg = db.addWorkspaceMessage({
        role: 'assistant',
        content: 'Got it! Data structures is a foundational subject.',
        parent_id: turn1UserMsg.id
    });
    db.setActiveLeafId(turn1AssistantMsg.id);

    // Turn 2 message creation
    const turn2UserMsg = db.addWorkspaceMessage({
        role: 'user',
        content: 'What subject did I just mention?',
        parent_id: turn1AssistantMsg.id
    });

    const turn2Branch = db.getWorkspaceBranch(turn2UserMsg.id);
    const turn2History = turn2Branch.map(m => ({ role: m.role, content: m.content }));

    const plan2 = await dispatch.planIntent({ input: turn2UserMsg.content, session: { history: turn2History } });
    const state2 = await dispatch.retrieve(plan2);
    const pipeline2 = executive.executePipeline(plan2, state2, [], [], turn2History);

    assert(pipeline2.sessionHistory.length === 3, `Turn 2 sessionHistory carries full conversation thread (length: ${pipeline2.sessionHistory.length})`);
    assert(pipeline2.sessionHistory[0].content === 'My favorite subject is data structures.', 'Turn 2 prompt context retains Turn 1 input');
    assert(pipeline2.sessionHistory[1].content === 'Got it! Data structures is a foundational subject.', 'Turn 2 prompt context retains Turn 1 response');

    // Stub / LLM test for Turn 2 response
    const turn2Response = await reasoning.synthesizeResponse(turn2UserMsg.content, pipeline2);
    assert(typeof turn2Response === 'string' && turn2Response.length > 0, 'Reasoning engine produced non-empty response for Turn 2');


    // ------------------------------------------------------------------
    // TEST 2: Real Hypothesis Generation & Persistence
    // ------------------------------------------------------------------
    console.log('\n--- Step 2: Testing Real Hypothesis Generation & Persistence ---');

    const testInputFact = "I love competitive programming and algorithms";
    const testInputHypothesis = "Maybe I will switch my major next semester";

    const generatedFacts = orchestrator.generateHypotheses(userId, testInputFact, {});
    assert(generatedFacts.length > 0, 'Hypothesis generator produced candidate for fact input');
    assert(generatedFacts[0].category === 'FACT', `Category classified as FACT (got: ${generatedFacts[0].category})`);

    const generatedHypo = orchestrator.generateHypotheses(userId, testInputHypothesis, {});
    assert(generatedHypo.length > 0, 'Hypothesis generator produced candidate for speculative input');
    assert(generatedHypo[0].category === 'HYPOTHESIS', `Category classified as HYPOTHESIS (got: ${generatedHypo[0].category})`);

    // Retrieve hypotheses from DB
    const dbHypotheses = db.db.prepare(`
        SELECT * FROM chat_hypotheses
        WHERE user_id = ? AND status = 'active'
        ORDER BY created_at DESC LIMIT 5
    `).all(userId);

    assert(dbHypotheses.length >= 2, `DB stored hypotheses successfully (found ${dbHypotheses.length})`);
    assert(dbHypotheses.some(h => h.category === 'FACT'), 'DB contains FACT entry');
    assert(dbHypotheses.some(h => h.category === 'HYPOTHESIS'), 'DB contains HYPOTHESIS entry');


    // ------------------------------------------------------------------
    // TEST 3: Episodic Replay in LLM Context
    // ------------------------------------------------------------------
    console.log('\n--- Step 3: Testing Episodic Replay Inclusion in LLM Context ---');

    const todayStr = new Date().toISOString().split('T')[0];
    const taskId = db.generateUUID();
    db.addTask({
        id: taskId,
        text: 'Synthetic Test Task for Replay',
        date: todayStr,
        calendar: 'personal'
    });
    db.completeTask(taskId);

    // Replay completed episodes
    const replayRes = episodicReplay.replayCompletedEpisodes(userId, 1);
    assert(replayRes.replayed >= 1, `Episodic replay scanned and logged completed task (replayed: ${replayRes.replayed})`);

    // Query state via Dispatch Engine
    const planReplay = await dispatch.planIntent({ input: 'What did I complete recently?', session: { history: [] } });
    const stateReplay = await dispatch.retrieve(planReplay);

    assert(Array.isArray(stateReplay.episodicReplay), 'retrievedState contains episodicReplay array');
    assert(stateReplay.episodicReplay.length > 0, `episodicReplay has entries (count: ${stateReplay.episodicReplay.length})`);

    // Verify Executive Layer context summary includes episode content
    const pipelineReplay = executive.executePipeline(planReplay, stateReplay, [], []);
    assert(pipelineReplay.contextSummary.includes('Recently completed episodes'), 'Executive contextSummary header contains Episodic Replay section');
    assert(pipelineReplay.contextSummary.includes('Synthetic Test Task for Replay'), 'Executive contextSummary contains verbatim completed task text');

    // Clean up synthetic task
    db.deleteTask(taskId);
    db.db.prepare(`DELETE FROM cognitive_memories WHERE content LIKE ?`).run(`%task:${taskId}%`);


    console.log(`\n📊 Result: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
});
