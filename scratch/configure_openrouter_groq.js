/**
 * 🔑 CONFIGURE AND TEST OPENROUTER AND GROQ API KEYS
 */

const mainDb = require('../main/main_db');
const fs = require('fs');
const path = require('path');

async function configureKeys() {
    const openrouterKey = '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';
    const groqKey = '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';

    console.log("=========================================================================");
    console.log("🔑 PRE-CONFIGURING CHRONO WITH OPENROUTER & GROQ API KEYS");
    console.log("=========================================================================\n");

    // 1. Save to SQLite database sync_meta table
    mainDb.setSyncMeta('openrouter_api_key', openrouterKey);
    mainDb.setSyncMeta('groq_api_key', groqKey);
    console.log("  ✓ Saved OpenRouter & Groq keys to local SQLite database (chrono.db -> sync_meta)");

    // 2. Update .env file
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    if (envContent.includes('OPENROUTER_API_KEY=')) {
        envContent = envContent.replace(/OPENROUTER_API_KEY=.*/g, `OPENROUTER_API_KEY=${openrouterKey}`);
    } else {
        envContent += `\nOPENROUTER_API_KEY=${openrouterKey}\n`;
    }

    if (envContent.includes('GROQ_API_KEY=')) {
        envContent = envContent.replace(/GROQ_API_KEY=.*/g, `GROQ_API_KEY=${groqKey}`);
    } else {
        envContent += `\nGROQ_API_KEY=${groqKey}\n`;
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log("  ✓ Updated .env file with OPENROUTER_API_KEY and GROQ_API_KEY");

    // 3. Test OpenRouter Live API Ping
    console.log("\n--- Testing OpenRouter Live API ---");
    try {
        const resOr = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openrouterKey}`,
                'HTTP-Referer': 'https://chrono.app',
                'X-Title': 'Chrono Cognitive OS',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-3.3-70b-instruct',
                messages: [{ role: 'user', content: 'Confirm you are online in one short phrase.' }],
                max_tokens: 20
            })
        });
        console.log(`  OpenRouter HTTP Status: ${resOr.status} ${resOr.statusText}`);
        if (resOr.ok) {
            const data = await resOr.json();
            const text = data?.choices?.[0]?.message?.content?.trim();
            console.log(`    ✅ OPENROUTER SUCCESS: "${text}"`);
        } else {
            const errText = await resOr.text();
            console.log(`    ❌ OpenRouter Error: ${errText}`);
        }
    } catch (e) {
        console.log(`    ❌ OpenRouter Exception: ${e.message}`);
    }

    // 4. Test Groq Live API Ping
    console.log("\n--- Testing Groq Live API ---");
    try {
        const resGroq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: 'Confirm you are online in one short phrase.' }],
                max_tokens: 20
            })
        });
        console.log(`  Groq HTTP Status: ${resGroq.status} ${resGroq.statusText}`);
        if (resGroq.ok) {
            const data = await resGroq.json();
            const text = data?.choices?.[0]?.message?.content?.trim();
            console.log(`    ✅ GROQ SUCCESS: "${text}"`);
        } else {
            const errText = await resGroq.text();
            console.log(`    ❌ Groq Error: ${errText}`);
        }
    } catch (e) {
        console.log(`    ❌ Groq Exception: ${e.message}`);
    }

    console.log("\n=========================================================================");
    console.log("🎉 OPENROUTER & GROQ PRE-CONFIGURATION COMPLETE!");
    console.log("=========================================================================\n");
}

configureKeys().catch(console.error);
