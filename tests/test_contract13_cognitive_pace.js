/**
 * 🧪 CONTRACT 13 COGNITIVE PACE & THOUGHT TRAJECTORY TEST SUITE
 * 
 * Verifies that Chrono's Cognitive Pace & Thought Trajectory Engine (`cognitivePaceEngine.js`)
 * correctly detects rapid stream-of-consciousness externalization, trajectory jumps ("wait", "actually"),
 * association density, and adapts response pacing without forcing machine commands.
 */

const { analyzeCognitivePace } = require('../main/cognitivePaceEngine');
const { ReasoningEngine } = require('../main/reasoningEngine');
const assert = require('assert');

async function runContract13Tests() {
    console.log('==================================================================');
    console.log('🧠 CHRONO CONTRACT 13: PRIMACY OF COGNITIVE PACE TEST SUITE');
    console.log('==================================================================\n');

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

    // ── TEST 1: Rapid Stream of Consciousness & Trajectory Jumps ────────
    console.log('--- TEST 1: Rapid Stream of Consciousness Detection ---');
    const rapidStreamInput = "I was thinking about the OSPF network architecture—wait, actually, database indexing connects to this because of the I/O bottleneck—oh and remember what I mentioned about memory limits earlier?";
    const pace1 = analyzeCognitivePace(rapidStreamInput);

    check('Detected rapid stream of consciousness externalization style', pace1.externalizationStyle === 'RAPID_STREAM_OF_CONSCIOUSNESS');
    check('Identified trajectory jumps ("wait", "actually", "oh and")', pace1.jumpRate >= 2);
    check('Recommended pacing is FOLLOW_TRAJECTORY', pace1.recommendedPacing === 'FOLLOW_TRAJECTORY');

    // ── TEST 2: Short Terse Burst / Venting Pacing ──────────────────────
    console.log('\n--- TEST 2: Short Terse Burst / Venting Pacing ---');
    const terseInput = "my brain is fried today";
    const pace2 = analyzeCognitivePace(terseInput);

    check('Detected short terse burst or venting style', pace2.externalizationStyle === 'SHORT_TERSE_BURST');
    check('Recommended response depth is CONCISE', pace2.suggestedResponseDepth === 'CONCISE');
    check('Recommended pacing is UNOBTRUSIVE_COMPANION', pace2.recommendedPacing === 'UNOBTRUSIVE_COMPANION');

    // ── TEST 3: Reasoning Engine Response Pacing Integration ───────────
    console.log('\n--- TEST 3: Reasoning Engine Response Pacing Integration ---');
    const reasoningEngine = new ReasoningEngine();
    const response1 = await reasoningEngine.synthesizeResponse(rapidStreamInput, { intents: ['conversational'], retrievedState: {} });

    check('Reasoning engine follows thought trajectory without demanding command formatting', response1.includes('trajectory of your thought') || response1.includes('connected ideas'));

    console.log('\n==================================================================');
    console.log(`🎉 CONTRACT 13 COGNITIVE PACE TEST RESULTS: ${passed} / ${total} PASSED`);
    console.log('==================================================================\n');

    if (passed !== total) {
        process.exit(1);
    }
}

runContract13Tests().catch(err => {
    console.error('Contract 13 test failed with error:', err);
    process.exit(1);
});
