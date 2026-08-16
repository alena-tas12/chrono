/**
 * 🔍 LIST AVAILABLE GEMINI MODELS
 */

const mainDb = require('../main/main_db');

async function listModels() {
    const key = mainDb.getSyncMeta('gemini_api_key') || process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No Gemini key found");
        return;
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const res = await fetch(url);
        console.log(`ListModels Status: ${res.status} ${res.statusText}`);
        const data = await res.json();
        if (data.models) {
            console.log("Available Gemini Models for this API Key:");
            data.models
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .forEach(m => console.log(`  - ${m.name} (${m.displayName})`));
        } else {
            console.log("No models returned:", data);
        }
    } catch (e) {
        console.error("ListModels failed:", e.message);
    }
}

listModels().catch(console.error);
