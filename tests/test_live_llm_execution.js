/**
 * 🧪 STABILIZATION TEST 1: Live LLM Call Structure & Dual-Mode Execution
 *
 * Verifies:
 * 1. Mode A (No Key): ReasoningEngine produces clean objective stub response
 * 2. Mode B (API Key Set): ReasoningEngine constructs correct OpenAI fetch request (URL, Bearer token header, model, system prompt, session history, and user input)
 * 3. Dynamic key switching updates ReasoningEngine without restart
 *
 * Run via: $env:ELECTRON_RUN_AS_NODE=1; npx electron tests/test_live_llm_execution.js
 */

const path = require('path');
process.env.CHRONO_SEED_TEST_PEERS = 'false';

const db = require(path.join(__dirname, '../main/main_db'));
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
    console.log('\n🧪 STABILIZATION TEST 1: Live LLM Call Structure & Dual-Mode Execution\n');

    const reasoning = new ReasoningEngine();

    // Mode A: Stub Fallback
    reasoning.setApiKey('');
    const stubResult = await reasoning.synthesizeResponse('Hello, test prompt', {
        contextSummary: 'Facts:\n- Test fact',
        sessionHistory: []
    });
    assert(!stubResult.includes('[Stub') && typeof stubResult === 'string' && stubResult.length > 0, 'Mode A (No Key): ReasoningEngine produces clean stub fallback');

    // Mode B: Intercept real fetch call to verify payload formatting
    const originalFetch = global.fetch;
    let fetchCalled = false;
    let requestUrl = '';
    let requestHeaders = {};
    let requestBody = {};

    global.fetch = async (url, options) => {
        fetchCalled = true;
        requestUrl = url;
        requestHeaders = options.headers || {};
        requestBody = JSON.parse(options.body || '{}');
        return {
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: 'Real LLM synthesized response from OpenAI API.'
                    }
                }]
            })
        };
    };

    try {
        const testKey = 'sk-live-test-key-999999';
        reasoning.setApiKey(testKey);

        const realResult = await reasoning.synthesizeResponse('What is Project Aurora?', {
            contextSummary: 'Facts:\n- Project Aurora is a 3-layer cognitive OS',
            sessionHistory: [
                { role: 'user', content: 'Tell me about my project' },
                { role: 'assistant', content: 'Sure, what project?' }
            ]
        });

        assert(fetchCalled === true, 'Mode B (API Key Set): fetch was called to https://api.openai.com');
        assert(requestUrl === 'https://api.openai.com/v1/chat/completions', 'OpenAI API endpoint URL matched');
        assert(requestHeaders['Authorization'] === `Bearer ${testKey}`, 'Authorization Bearer header matches active API key');
        assert(requestBody.model === 'gpt-4o', 'LLM model matched default gpt-4o');
        assert(Array.isArray(requestBody.messages) && requestBody.messages.length === 4, `Messages array contains System + 2 History Turns + User Input (count: ${requestBody.messages.length})`);
        assert(requestBody.messages[0].content.includes('Project Aurora is a 3-layer cognitive OS'), 'System prompt contains context summary');
        assert(realResult === 'Real LLM synthesized response from OpenAI API.', 'ReasoningEngine returns parsed choices[0].message.content text');

    } finally {
        global.fetch = originalFetch;
        reasoning.setApiKey('');
    }

    console.log(`\n📊 Result: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
    console.error('Test failure:', err);
    process.exit(1);
});
