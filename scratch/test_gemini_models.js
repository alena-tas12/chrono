const mainDb = require('../main/main_db');

async function testWorkingModels() {
    const key = mainDb.getSyncMeta('gemini_api_key') || process.env.GEMINI_API_KEY;
    const testList = [
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-3.7-flash',
        'gemini-3-flash-preview',
        'gemini-pro-latest'
    ];

    for (const m of testList) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Respond with OK.' }] }]
                })
            });
            console.log(`Model ${m}: Status ${res.status}`);
            if (res.ok) {
                const data = await res.json();
                console.log(`  ✅ ${m} WORKS:`, data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
            } else {
                const err = await res.json().catch(() => ({}));
                console.log(`  ❌ ${m} FAILED:`, err?.error?.message);
            }
        } catch (e) {
            console.log(`  ❌ ${m} ERROR:`, e.message);
        }
    }
}

testWorkingModels();
