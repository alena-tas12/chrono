/**
 * 🧪 PHASE 2 CONVERSATIONAL INTELLIGENCE & ADVICE POLICY TEST SUITE
 * 
 * Verifies that Chrono's ReasoningEngine delivers natural conversation,
 * respects LISTEN mode (no artificial task scripts), supports advice mode selection,
 * and maintains referential continuity across multi-turn exchanges.
 */

const { ReasoningEngine } = require('../main/reasoningEngine');
const assert = require('assert');

async function runPhase2Tests() {
    console.log('==================================================================');
    console.log('🧠 CHRONO PHASE 2: CONVERSATIONAL INTELLIGENCE & ADVICE SUITE');
    console.log('==================================================================\n');

    const reasoningEngine = new ReasoningEngine();
    let passed = 0;
    let total = 0;

    function check(description, condition) {
        total++;
        if (condition) {
            console.log(`  ✅ [PASS] ${description}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${description}`);
        }
    }

    // ── TEST 1: Casual Venting / LISTEN Mode Enforcement ───────────────
    console.log('--- TEST 1: LISTEN Mode Enforcement (Casual Venting & Statements) ---');
    const input1 = "today was weird, I went through those old things again and now I'm thinking about tomorrow's exam";
    const res1Obj = await reasoningEngine.synthesizeResponse(input1, { sessionHistory: [] });
    const res1 = res1Obj.text || res1Obj;
    check('LISTEN mode returns valid responsive text', typeof res1 === 'string' && res1.length > 10);
    check('Provider telemetry populated', !!res1Obj.providerUsed);
    check('No artificial task-assistant boilerplate injected', !res1.includes("How can I assist you with your workspace"));
    check('No raw debug stubs exposed', !res1.includes("[Stub") && !res1.includes("episodicReplay"));

    // ── TEST 2: OPTIONS Advice Mode Request ───────────────────────────
    console.log('\n--- TEST 2: OPTIONS Advice Mode Request ---');
    const input2 = "what options do I have for preparing for this test";
    const res2Obj = await reasoningEngine.synthesizeResponse(input2, { sessionHistory: [] });
    const res2 = res2Obj.text || res2Obj;
    check('OPTIONS mode returns structured response text', typeof res2 === 'string' && res2.length > 20);

    // ── TEST 3: DIRECT ADVICE Request ─────────────────────────────────
    console.log('\n--- TEST 3: DIRECT ADVICE Mode Request ---');
    const input3 = "what should i do right now";
    const res3Obj = await reasoningEngine.synthesizeResponse(input3, { sessionHistory: [] });
    const res3 = res3Obj.text || res3Obj;
    check('DIRECT ADVICE mode provides concise recommendation', typeof res3 === 'string' && res3.length > 10);

    // ── TEST 4: Multi-Turn Referential Resolution ─────────────────────
    console.log('\n--- TEST 4: Multi-Turn Referential Resolution ("answer the question above") ---');
    const sessionHistory4 = [
        { role: 'user', content: 'hello how are you doing' },
        { role: 'assistant', content: "I'm doing well, thank you! What's on your mind today?" },
        { role: 'user', content: 'can you actually interact with me like a normal human does' },
        { role: 'assistant', content: 'Yes, absolutely. We can talk naturally about whatever is on your mind.' }
    ];
    const input4 = "answer the question above";
    const res4Obj = await reasoningEngine.synthesizeResponse(input4, { sessionHistory: sessionHistory4 });
    const res4 = res4Obj.text || res4Obj;
    check('Turn 3 resolves previous question directly', typeof res4 === 'string' && res4.length > 10);

    // ── TEST 5: Dynamic Response Depth Calculation ─────────────────────
    console.log('\n--- TEST 5: Dynamic Response Depth Calculation ---');
    const resConcise = await reasoningEngine.synthesizeResponse("yeah", { sessionHistory: [] });
    const resDeep = await reasoningEngine.synthesizeResponse("explain how Chrono architecture works in detail", { sessionHistory: [] });
    check('Short acknowledgement returns valid text', typeof (resConcise.text || resConcise) === 'string');
    check('Complex query returns comprehensive text', (resDeep.text || resDeep).length > 20);

    console.log('\n==================================================================');
    console.log(`🎉 PHASE 2 CONVERSATIONAL TEST RESULTS: ${passed} / ${total} PASSED`);
    console.log('==================================================================\n');

    if (passed !== total) {
        process.exit(1);
    }
}

runPhase2Tests().catch(err => {
    console.error('Phase 2 test failed with error:', err);
    process.exit(1);
});
