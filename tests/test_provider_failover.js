/**
 * 🧪 CHRONO COGNITIVE OS - CAPABILITY REGISTRY TEST SUITE
 */

const modelProvider = require('../main/modelProvider');

async function runCapabilitySuite() {
    console.log("=========================================================================");
    console.log("🧪 CHRONO OS: CAPABILITY-BASED PROVIDER FAILOVER & RECOVERY SUITE");
    console.log("=========================================================================\n");

    function resetCooldowns() {
        modelProvider.cooldowns = { gemini: 0, groq: 0, qwen: 0, openrouter: 0, openai: 0, ollama: 0 };
    }

    const suiteResults = [];

    // ── 1. PROVIDER CAPABILITY REGISTRY AUDIT ──────────────────────────────
    console.log("--- 1. Provider Capability Registry ---");
    const registry = modelProvider.getRegistry();
    for (const [pKey, p] of Object.entries(registry)) {
        console.log(`  Provider [${p.name}]: Configured=${p.configured}, Healthy=${p.healthy}, Capabilities=[${p.capabilities.join(', ')}]`);
    }

    // ── 2. FAILOVER & COOLDOWN RECOVERY SCENARIO ───────────────────────────
    console.log("\n--- 2. Rate-Limit Failover & Recovery Scenario ---");
    resetCooldowns();
    modelProvider.markRateLimited('gemini', 2000); // 2s short cooldown for recovery testing

    const failoverRes = await modelProvider.generateResponse([
        { role: 'user', content: 'Say hello in 3 words.' }
    ]);

    console.log("  Provider Selected During Gemini Cooldown:", failoverRes.providerUsed);
    console.log("  Response Text:", failoverRes.text);

    suiteResults.push({
        scenario: "Rate-Limit Failover",
        primaryState: "GEMINI IN COOLDOWN",
        selectedProvider: failoverRes.providerUsed,
        modelUsed: failoverRes.modelUsed,
        result: failoverRes.text ? "✅ FAILOVER SUCCESSFUL" : "⚠️ ALTERNATE NEEDED"
    });

    // Wait for 2.1s cooldown to expire and test recovery
    console.log("\n  Waiting 2.1s for Gemini cooldown recovery...");
    await new Promise(r => setTimeout(r, 2100));

    const recoveredRes = await modelProvider.generateResponse([
        { role: 'user', content: 'Say hello in 3 words.' }
    ]);

    console.log("  Provider Selected After Cooldown Expiry:", recoveredRes.providerUsed);
    console.log("  Response Text:", recoveredRes.text);

    suiteResults.push({
        scenario: "Provider Cooldown Recovery",
        primaryState: "COOLDOWN EXPIRED",
        selectedProvider: recoveredRes.providerUsed,
        modelUsed: recoveredRes.modelUsed,
        result: recoveredRes.providerUsed === 'Google Gemini' ? "✅ RECOVERY SUCCESSFUL" : "⚠️ ALTERNATE SELECTED"
    });

    // ── 3. TOTAL BLACKOUT & TRUTHFUL ERROR ENFORCEMENT ─────────────────────
    console.log("\n--- 3. Total Blackout Truthful Error Scenario ---");
    resetCooldowns();
    Object.keys(registry).forEach(p => modelProvider.markRateLimited(p, 60000));

    const blackoutRes = await modelProvider.generateResponse([
        { role: 'user', content: 'Test blackout.' }
    ]);

    console.log("  Blackout Error Message:", blackoutRes.errorReason);

    suiteResults.push({
        scenario: "Total Blackout Enforcement",
        primaryState: "ALL PROVIDERS UNAVAILABLE",
        selectedProvider: "NONE",
        modelUsed: "NONE",
        result: blackoutRes.errorReason && blackoutRes.errorReason.includes("No AI provider is currently available")
            ? "✅ TRUTHFUL ERROR ENFORCED (0 Canned Text)"
            : "❌ FAILED"
    });

    console.log("\n=========================================================================");
    console.log("📊 CAPABILITY REGISTRY & RECOVERY MATRIX:");
    console.table(suiteResults);
    console.log("=========================================================================\n");

    resetCooldowns();
}

runCapabilitySuite().catch(err => {
    console.error("Capability suite error:", err);
    process.exit(1);
});
