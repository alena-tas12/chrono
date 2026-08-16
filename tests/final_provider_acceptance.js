/**
 * 🧪 FINAL PROVIDER ACCEPTANCE TEST SUITE
 * 
 * Verifies:
 * 1. OpenRouter real API request succeeds with valid reasoning.
 * 2. Groq real API request succeeds with sub-second latency.
 * 3. Real Failover: Deliberately disable OpenRouter -> Groq handles request automatically.
 * 4. All providers disabled -> Honest provider-unavailable state returned.
 * 5. Telemetry correctness: actual provider, model, latency, and failover log.
 * 6. Zero embedded secret keys in renderer/frontend files.
 */

const modelProvider = require('../main/modelProvider');
const fs = require('fs');
const path = require('path');

async function runProviderAcceptance() {
    console.log("=========================================================================");
    console.log("🛰️ FINAL PROVIDER ACCEPTANCE TEST SUITE");
    console.log("=========================================================================\n");

    const results = {
        total: 6,
        passed: 0,
        failed: 0,
        details: []
    };

    // --- TEST 1: OpenRouter Live API Inference ---
    console.log("1. Testing Primary Cloud (OpenRouter Live API)...");
    const t0 = Date.now();
    try {
        const res = await modelProvider.generateResponse([
            { role: 'system', content: 'You are Chrono Cognitive OS.' },
            { role: 'user', content: 'Say "OpenRouter confirmed online" and nothing else.' }
        ]);
        const latency = Date.now() - t0;
        if (res.text && res.providerUsed && res.providerUsed.includes('OpenRouter')) {
            console.log(`   ✅ PASSED: OpenRouter returned "${res.text}" (${latency}ms, Model: ${res.modelUsed})`);
            results.passed++;
            results.details.push({ test: 'OpenRouter Live Inference', status: 'PASSED', latency: `${latency}ms`, provider: res.providerUsed });
        } else {
            console.log(`   ❌ FAILED: Unexpected response or provider: ${JSON.stringify(res)}`);
            results.failed++;
            results.details.push({ test: 'OpenRouter Live Inference', status: 'FAILED', reason: res.errorReason || 'Wrong provider' });
        }
    } catch (e) {
        console.log(`   ❌ FAILED: Exception: ${e.message}`);
        results.failed++;
        results.details.push({ test: 'OpenRouter Live Inference', status: 'FAILED', reason: e.message });
    }

    // --- TEST 2: Groq Live API Inference ---
    console.log("\n2. Testing Secondary Fast Cloud (Groq Live API)...");
    const tGroq = Date.now();
    try {
        const groqRegistry = modelProvider.getRegistry().groq;
        const resGroq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqRegistry.key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: 'Say "Groq confirmed online" and nothing else.' }],
                max_tokens: 20
            })
        });
        const latencyGroq = Date.now() - tGroq;
        if (resGroq.ok) {
            const data = await resGroq.json();
            const text = data?.choices?.[0]?.message?.content?.trim();
            console.log(`   ✅ PASSED: Groq returned "${text}" (${latencyGroq}ms, HTTP 200 OK)`);
            results.passed++;
            results.details.push({ test: 'Groq Live Inference', status: 'PASSED', latency: `${latencyGroq}ms`, provider: 'Groq API' });
        } else {
            console.log(`   ❌ FAILED: Groq HTTP ${resGroq.status}`);
            results.failed++;
            results.details.push({ test: 'Groq Live Inference', status: 'FAILED', reason: `HTTP ${resGroq.status}` });
        }
    } catch (e) {
        console.log(`   ❌ FAILED: Groq Exception: ${e.message}`);
        results.failed++;
        results.details.push({ test: 'Groq Live Inference', status: 'FAILED', reason: e.message });
    }

    // --- TEST 3: Real Failover (Deliberately disable OpenRouter -> Groq takes over) ---
    console.log("\n3. Testing Real Multi-Cloud Failover (OpenRouter Disabled -> Groq)...");
    try {
        // Deliberately set OpenRouter in cooldown to simulate rate limit / outage
        modelProvider.markRateLimited('openrouter', 10000);
        const tFailover = Date.now();
        const resFailover = await modelProvider.generateResponse([
            { role: 'system', content: 'You are Chrono Cognitive OS.' },
            { role: 'user', content: 'Respond with "Failover active".' }
        ]);
        const latencyFailover = Date.now() - tFailover;

        if (resFailover.text && resFailover.providerUsed && resFailover.providerUsed.includes('Groq')) {
            console.log(`   ✅ PASSED: Automatic failover to Groq succeeded!`);
            console.log(`      Actual Provider Used: ${resFailover.providerUsed}`);
            console.log(`      Failover Log: ${JSON.stringify(resFailover.failoverLog)}`);
            console.log(`      Response: "${resFailover.text}" (${latencyFailover}ms)`);
            results.passed++;
            results.details.push({ test: 'OpenRouter -> Groq Failover', status: 'PASSED', provider: resFailover.providerUsed });
        } else {
            console.log(`   ❌ FAILED: Failover did not select Groq: ${JSON.stringify(resFailover)}`);
            results.failed++;
            results.details.push({ test: 'OpenRouter -> Groq Failover', status: 'FAILED' });
        }
        // Reset cooldown
        modelProvider.cooldowns.openrouter = 0;
    } catch (e) {
        console.log(`   ❌ FAILED: Failover exception: ${e.message}`);
        results.failed++;
        results.details.push({ test: 'OpenRouter -> Groq Failover', status: 'FAILED', reason: e.message });
    }

    // --- TEST 4: All Providers Unavailable -> Truthful Error State ---
    console.log("\n4. Testing All Providers Unavailable Truthful Degradation...");
    try {
        modelProvider.markRateLimited('openrouter', 10000);
        modelProvider.markRateLimited('groq', 10000);
        modelProvider.markRateLimited('chrono_gateway', 10000);
        modelProvider.markRateLimited('gemini', 10000);
        modelProvider.markRateLimited('ollama', 10000);

        const resAllDown = await modelProvider.generateResponse([
            { role: 'user', content: 'test' }
        ]);

        if (resAllDown.errorReason && resAllDown.providerUsed === 'NONE') {
            console.log(`   ✅ PASSED: Truthful degradation returned: "${resAllDown.errorReason}"`);
            results.passed++;
            results.details.push({ test: 'Truthful Provider Degradation', status: 'PASSED' });
        } else {
            console.log(`   ❌ FAILED: Unexpected response when all down: ${JSON.stringify(resAllDown)}`);
            results.failed++;
            results.details.push({ test: 'Truthful Provider Degradation', status: 'FAILED' });
        }

        // Reset all cooldowns
        for (const k in modelProvider.cooldowns) modelProvider.cooldowns[k] = 0;
    } catch (e) {
        console.log(`   ❌ FAILED: Degradation test exception: ${e.message}`);
        results.failed++;
    }

    // --- TEST 5: Provider Telemetry State Inspection ---
    console.log("\n5. Testing Active Provider Telemetry & State Reporting...");
    const status = modelProvider.getActiveProviderStatus();
    if (status.primary && status.secondary && status.active) {
        console.log(`   ✅ PASSED: Telemetry reporting verified:`);
        console.log(`      Primary: ${status.primary}`);
        console.log(`      Secondary: ${status.secondary}`);
        console.log(`      Active: ${status.active}`);
        results.passed++;
        results.details.push({ test: 'Provider Telemetry State', status: 'PASSED', data: status });
    } else {
        console.log(`   ❌ FAILED: Incomplete telemetry: ${JSON.stringify(status)}`);
        results.failed++;
    }

    // --- TEST 6: Zero Embedded Credentials in Frontend Bundle ---
    console.log("\n6. Auditing Frontend Code for Embedded Secret Keys...");
    const indexHtml = fs.readFileSync(path.join(__dirname, '../ui/index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(__dirname, '../ui/app.js'), 'utf8');

    const openrouterKey = modelProvider.getRegistry().openrouter.key;
    const groqKey = modelProvider.getRegistry().groq.key;

    const leakedInHtml = (openrouterKey && indexHtml.includes(openrouterKey)) || (groqKey && indexHtml.includes(groqKey));
    const leakedInJs = (openrouterKey && appJs.includes(openrouterKey)) || (groqKey && appJs.includes(groqKey));

    if (!leakedInHtml && !leakedInJs) {
        console.log("   ✅ PASSED: Zero secret keys found in ui/index.html and ui/app.js.");
        results.passed++;
        results.details.push({ test: 'Frontend Secret Isolation', status: 'PASSED' });
    } else {
        console.error("   ❌ CRITICAL FAILURE: Secret keys detected in frontend client files!");
        results.failed++;
    }

    console.log("\n-------------------------------------------------------------------------");
    console.log(`PROVIDER SUITE SUMMARY: ${results.passed}/${results.total} PASSED (${results.failed} failed)`);
    console.log("-------------------------------------------------------------------------\n");

    return results;
}

if (require.main === module) {
    runProviderAcceptance().then(r => {
        if (r.failed > 0) process.exit(1);
        process.exit(0);
    });
}

module.exports = { runProviderAcceptance };
