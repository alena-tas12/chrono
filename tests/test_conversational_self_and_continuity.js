/**
 * 🧪 STABILIZATION TEST: Multi-Turn Conversational Self & Continuity
 *
 * Verifies the exact 3-turn sequence from the user's manual walkthrough:
 * Turn 1: "hello how are you doing" -> Natural greeting response.
 * Turn 2: "can you actually interact with me like a normal human does" -> Direct meta-conversational response.
 * Turn 3: "answer the question above" -> Resolves previous turn question from sessionHistory and answers it directly.
 *
 * Run via: $env:ELECTRON_RUN_AS_NODE=1; npx electron tests/test_conversational_self_and_continuity.js
 */

const path = require('path');
process.env.CHRONO_SEED_TEST_PEERS = 'false';

const { ReasoningEngine } = require(path.join(__dirname, '../main/reasoningEngine'));

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

async function runTest() {
    console.log('\n🧪 STABILIZATION TEST: Multi-Turn Conversational Self & Continuity\n');

    const reasoning = new ReasoningEngine();
    reasoning.setApiKey('');

    // Turn 1
    const history = [];
    const t1Input = 'hello how are you doing';
    const r1 = await reasoning.synthesizeResponse(t1Input, { sessionHistory: history });
    console.log(`User: ${t1Input}`);
    console.log(`Chrono: ${r1}\n`);

    assert(!r1.includes('assist you with your workspace or tasks'), 'Turn 1 avoids task-assistant boilerplate');
    assert(r1.includes("doing well") || r1.includes("mind today"), 'Turn 1 produces natural greeting');

    history.push({ role: 'user', content: t1Input });
    history.push({ role: 'assistant', content: r1 });

    // Turn 2
    const t2Input = 'can you actually interact with me like a normal human does';
    const r2 = await reasoning.synthesizeResponse(t2Input, { sessionHistory: history });
    console.log(`User: ${t2Input}`);
    console.log(`Chrono: ${r2}\n`);

    assert(!r2.includes('assist you with your workspace or tasks'), 'Turn 2 avoids task-assistant boilerplate');
    assert(r2.includes('talk naturally') || r2.includes('without converting everything into tasks'), 'Turn 2 directly answers meta-conversational question');

    history.push({ role: 'user', content: t2Input });
    history.push({ role: 'assistant', content: r2 });

    // Turn 3: "answer the question above"
    const t3Input = 'answer the question above';
    const r3 = await reasoning.synthesizeResponse(t3Input, { sessionHistory: history });
    console.log(`User: ${t3Input}`);
    console.log(`Chrono: ${r3}\n`);

    assert(!r3.includes('assist you with your workspace or tasks'), 'Turn 3 avoids task-assistant boilerplate');
    assert(r3.includes('talk naturally') || r3.includes('without converting everything into tasks') || r3.includes('normal human'), 'Turn 3 resolves previous question from history and answers it directly');

    console.log(`\n📊 Result: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
    console.error('Test failure:', err);
    process.exit(1);
});
