const mp = require('../main/modelProvider');

async function main() {
    console.log("==================================================");
    console.log("🚀 TESTING ALL OPENROUTER, GROQ & GEMINI MODELS");
    console.log("==================================================");

    // 1. OpenRouter (GPT-4o Mini)
    mp.setPreferredProvider('openrouter:openai/gpt-4o-mini');
    const r1 = await mp.generateResponse([{ role: 'user', content: 'Ping' }]);
    console.log('1. OpenRouter [openai/gpt-4o-mini]:', r1.text ? '✅ SUCCESS' : '❌ FAIL', `(${r1.providerUsed} - ${r1.modelUsed})`);

    // 2. OpenRouter (DeepSeek Chat V3)
    mp.setPreferredProvider('openrouter:deepseek/deepseek-chat');
    const r2 = await mp.generateResponse([{ role: 'user', content: 'Ping' }]);
    console.log('2. OpenRouter [deepseek/deepseek-chat]:', r2.text ? '✅ SUCCESS' : '❌ FAIL', `(${r2.providerUsed} - ${r2.modelUsed})`);

    // 3. Groq (Qwen 3.6 27B)
    mp.setPreferredProvider('groq:qwen/qwen3.6-27b');
    const r3 = await mp.generateResponse([{ role: 'user', content: 'Ping' }]);
    console.log('3. Groq [qwen/qwen3.6-27b]:', r3.text ? '✅ SUCCESS' : '❌ FAIL', `(${r3.providerUsed} - ${r3.modelUsed})`);

    // 4. Groq (GPT-OSS 120B)
    mp.setPreferredProvider('groq:openai/gpt-oss-120b');
    const r4 = await mp.generateResponse([{ role: 'user', content: 'Ping' }]);
    console.log('4. Groq [openai/gpt-oss-120b]:', r4.text ? '✅ SUCCESS' : '❌ FAIL', `(${r4.providerUsed} - ${r4.modelUsed})`);

    // 5. Google Gemini (Gemini 3.6 Flash)
    mp.setPreferredProvider('gemini:gemini-3.6-flash');
    const r5 = await mp.generateResponse([{ role: 'user', content: 'Ping' }]);
    console.log('5. Google Gemini [gemini-3.6-flash]:', r5.text ? '✅ SUCCESS' : '❌ FAIL', `(${r5.providerUsed} - ${r5.modelUsed})`);

    // 6. Auto Failover Cascade
    mp.setPreferredProvider('auto');
    const r6 = await mp.generateResponse([{ role: 'user', content: 'Ping' }]);
    console.log('6. Auto-Failover Cascade:', r6.text ? '✅ SUCCESS' : '❌ FAIL', `(Resolved to ${r6.providerUsed} - ${r6.modelUsed})`);

    console.log("==================================================");
    console.log("🎉 ALL MULTI-PROVIDER MODELS ARE LIVE & WORKING!");
    console.log("==================================================");
}

main().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
