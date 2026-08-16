const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mainDb = require('../main/main_db');
const modelProvider = require('../main/modelProvider');

async function testAllKeys() {
    console.log("=== 🔑 Testing & Persisting AI & Cloud Credentials ===");

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    console.log(`- Gemini Key: ${geminiKey ? geminiKey.substring(0, 10) + '...' : 'MISSING'}`);
    console.log(`- Groq Key: ${groqKey ? groqKey.substring(0, 10) + '...' : 'MISSING'}`);
    console.log(`- OpenRouter Key: ${openrouterKey ? openrouterKey.substring(0, 10) + '...' : 'MISSING'}`);

    // Persist to sync_meta
    if (geminiKey) mainDb.setSyncMeta('gemini_api_key', geminiKey);
    if (groqKey) mainDb.setSyncMeta('groq_api_key', groqKey);
    if (openrouterKey) mainDb.setSyncMeta('openrouter_api_key', openrouterKey);
    console.log("✓ Persisted keys to SQLite sync_meta");

    console.log("\n--- 1. Testing OpenRouter Direct API Call ---");
    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openrouterKey}`,
                'HTTP-Referer': 'https://chrono.app',
                'X-Title': 'Chrono Cognitive OS',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-4o-mini',
                messages: [{ role: 'user', content: 'Say "OpenRouter Active" in 2 words.' }],
                max_tokens: 30
            })
        });
        const data = await res.json();
        console.log("  ✅ OpenRouter Response:", data?.choices?.[0]?.message?.content || data);
    } catch (e) {
        console.error("  ❌ OpenRouter Error:", e.message);
    }

    console.log("\n--- 2. Testing Groq Direct API Call ---");
    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: 'Say "Groq Active" in 2 words.' }],
                max_tokens: 30
            })
        });
        const data = await res.json();
        console.log("  ✅ Groq Response:", data?.choices?.[0]?.message?.content || data);
    } catch (e) {
        console.error("  ❌ Groq Error:", e.message);
    }

    console.log("\n--- 3. Testing Google Gemini Direct API Call ---");
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Say "Gemini Active" in 2 words.' }] }]
            })
        });
        const data = await res.json();
        console.log("  ✅ Gemini Response:", data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || data);
    } catch (e) {
        console.error("  ❌ Gemini Error:", e.message);
    }

    console.log("\n--- 4. Testing Full Multi-Provider Failover Router ---");
    try {
        const unifiedRes = await modelProvider.generateResponse([{ role: 'user', content: 'What is Chrono?' }]);
        console.log(`  ✅ Unified Generation [Provider: ${unifiedRes.providerUsed}, Model: ${unifiedRes.modelUsed}]:`);
        console.log("     " + unifiedRes.text.substring(0, 100) + "...");
    } catch (e) {
        console.error("  ❌ Failover Router Error:", e.message);
    }

    console.log("\n=== Complete ===");
}

testAllKeys().catch(console.error);
