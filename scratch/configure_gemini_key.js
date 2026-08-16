/**
 * 🔑 CONFIGURE AND TEST NEW GEMINI API KEY
 */

const mainDb = require('../main/main_db');
const fs = require('fs');
const path = require('path');

async function configureGeminiKey() {
    const newKey = 'AQ.Ab8RN6JoRSA44ABC5OGoS5q_VglpuNDzQOuWdeC4fPaD0nccnw';

    console.log("=========================================================================");
    console.log("🔑 PRE-CONFIGURING CHRONO WITH USER GEMINI API KEY");
    console.log("=========================================================================\n");

    // 1. Save to SQLite database sync_meta table
    mainDb.setSyncMeta('gemini_api_key', newKey);
    console.log("  ✓ Saved key to local SQLite database (chrono.db -> sync_meta)");

    // 2. Update/create .env file
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    if (envContent.includes('GEMINI_API_KEY=')) {
        envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${newKey}`);
    } else {
        envContent += `\nGEMINI_API_KEY=${newKey}\n`;
    }
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log("  ✓ Updated .env file with GEMINI_API_KEY");

    // 3. Test the key directly against Google Gemini v1beta API
    console.log("\n--- Testing Live API Key against Google Gemini ---");
    const testModels = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-2.5-flash'];

    let liveSuccess = false;
    for (const m of testModels) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${newKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Hello Chrono, confirm this key is active in one sentence.' }] }]
                })
            });
            console.log(`  Model [${m}] Status: ${res.status} ${res.statusText}`);
            if (res.ok) {
                const data = await res.json();
                const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                console.log(`    ✅ SUCCESS: "${reply}"`);
                liveSuccess = true;
                break;
            } else {
                const errData = await res.json().catch(() => ({}));
                console.log(`    ❌ Error: ${errData?.error?.message || res.statusText}`);
            }
        } catch (e) {
            console.log(`    ❌ Network Error: ${e.message}`);
        }
    }

    if (liveSuccess) {
        console.log("\n🎉 API KEY FULLY ACTIVE & CONFIGURED IN CHRONO!");
    } else {
        console.log("\n⚠️ Key saved, but provider returned error. Please check Google AI Studio project status.");
    }
}

configureGeminiKey().catch(console.error);
