/**
 * 🔍 DIAGNOSTIC: PROBE EVERY EXTERNAL API CALL & ENDPOINT
 */

const mainDb = require('../main/main_db');
const modelProvider = require('../main/modelProvider');

async function testAllApis() {
    console.log("=========================================================================");
    console.log("🔍 PROBING ALL MODEL PROVIDERS & CLOUD ENDPOINTS FOR 404 / 500 ERRORS");
    console.log("=========================================================================\n");

    const registry = modelProvider.getRegistry();
    console.log("Registered Providers Configuration Status:");
    for (const [key, p] of Object.entries(registry)) {
        console.log(`  - ${key}: Configured = ${p.configured}, Model = ${p.model}, Healthy = ${p.healthy}`);
    }

    console.log("\n--- Testing ModelProvider.generateResponse ---");
    try {
        const response = await modelProvider.generateResponse([
            { role: 'user', content: 'Say hello in one word' }
        ]);
        console.log("✅ ModelProvider Success:", response);
    } catch (e) {
        console.error("❌ ModelProvider generateResponse Failed:", e.message, e.stack);
    }

    console.log("\n--- Testing Individual Providers Directly ---");

    // 1. Gemini
    const geminiKey = mainDb.getSyncMeta('gemini_api_key') || process.env.GEMINI_API_KEY;
    if (geminiKey) {
        console.log("Testing Gemini API directly...");
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'ping' }] }]
                })
            });
            console.log(`  Gemini Response Status: ${res.status} ${res.statusText}`);
            const data = await res.json();
            if (res.ok) {
                console.log("  ✅ Gemini OK:", data?.candidates?.[0]?.content?.parts?.[0]?.text);
            } else {
                console.error("  ❌ Gemini Error Body:", JSON.stringify(data));
            }
        } catch (err) {
            console.error("  ❌ Gemini Network Error:", err.message);
        }
    } else {
        console.log("  ⚠️ Gemini key not set.");
    }

    // 2. Groq
    const groqKey = mainDb.getSyncMeta('groq_api_key') || process.env.GROQ_API_KEY;
    if (groqKey) {
        console.log("\nTesting Groq API directly...");
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 10
                })
            });
            console.log(`  Groq Response Status: ${res.status} ${res.statusText}`);
            const data = await res.json();
            if (res.ok) {
                console.log("  ✅ Groq OK:", data?.choices?.[0]?.message?.content);
            } else {
                console.error("  ❌ Groq Error Body:", JSON.stringify(data));
            }
        } catch (err) {
            console.error("  ❌ Groq Network Error:", err.message);
        }
    } else {
        console.log("  ⚠️ Groq key not set.");
    }
}

testAllApis().catch(console.error);
