const assert = require('assert');
const { processAgentQuery, agents } = require('../main/multiAgentSystem');
const { processInteraction } = require('../main/interactionAdaptation');

let failedTests = 0;
let passedTests = 0;

async function runTest(name, input, expectedAgent, expectedIntent, expectRejectionOfTherapy = false) {
    console.log(`\n▶ Running Test: ${name}`);
    console.log(`  Input: "${input}"`);
    
    try {
        const result = await processAgentQuery(input, { displayName: 'Alen' });
        const adapted = processInteraction(input, { tasks: 2 }, result.response, {});

        // Test 1: Agent Routing
        if (expectedAgent && result.agent !== expectedAgent) {
            throw new Error(`Expected agent '${expectedAgent}', but got '${result.agent}'`);
        }

        // Test 2: Rejection of Generic Therapy Scripts
        if (expectRejectionOfTherapy) {
            const forbiddenPhrases = ["you're doing the best you can", "take a deep breath", "it's okay to feel this way", "you are doing great"];
            for (let phrase of forbiddenPhrases) {
                if (adapted.response.toLowerCase().includes(phrase)) {
                    throw new Error(`Response failed Trust Check. Contained forbidden therapy script: "${phrase}"`);
                }
            }
        }

        // Test 3: Explainability and Object Resolution
        if (expectedIntent) {
            if (!adapted.response.toLowerCase().includes(expectedIntent.toLowerCase())) {
                throw new Error(`Expected response to contain intent '${expectedIntent}'. Got: ${adapted.response}`);
            }
        }

        console.log(`  ✅ Passed. (Response: ${adapted.response.substring(0, 60)}...)`);
        passedTests++;
    } catch (e) {
        console.error(`  ❌ Failed: ${e.message}`);
        failedTests++;
    }
}

async function runSuite() {
    console.log("==========================================");
    console.log("   CHRONO INTERACTION TEST SUITE v1.0     ");
    console.log("==========================================\n");

    // Phase 1 Tests: Validation of tone and intent
    await runTest(
        "Greeting Tone Check (Jarvis style)", 
        "Hello", 
        "Companion", 
        null, // It randomly picks 1 of 4 responses, so just let it pass if agent is Companion
        true
    );

    await runTest(
        "Calendar View Intent", 
        "What's tomorrow?", 
        "Architect", 
        "density", // Architect mentions density
        true
    );

    // Context resolution test
    await processAgentQuery("Schedule a meeting with Princess", { displayName: 'Alen' }); // prime the context
    await runTest(
        "Contextual Object Resolution ('Delete it')",
        "Delete it.",
        "Scheduler",
        "meeting with princess", // It should resolve "it" to the last referenced object
        true
    );

    console.log("\n==========================================");
    console.log(`   TEST RUN COMPLETE: ${passedTests} Passed | ${failedTests} Failed`);
    console.log("==========================================");
    
    if (failedTests > 0) process.exit(1);
}

runSuite();
