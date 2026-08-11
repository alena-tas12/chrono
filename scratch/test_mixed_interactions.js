const orchestrator = require('../main/cognitiveOrchestrator');

console.log("=========================================================================");
console.log("🎮 TESTING CHRONO MIXED & RELATIONAL INTERACTION SUITE");
console.log("=========================================================================\n");

orchestrator.resetState();

const mixedScenarios = [
    {
        label: "Scenario 1: Frustration + Technical Problem (Emotional + Technical)",
        input: "My router is completely broken, I've been trying to fix this stupid gateway ping for two hours and I'm exhausted. Why is it failing?"
    },
    {
        label: "Scenario 2: Emotionally Loaded Topic + Structural Analysis (Emotional + Analysis)",
        input: "Looking back at my past depression episodes that were connected to my attachment, she wasn't the cause of the depression—she was my coping mechanism for carrying the weight."
    },
    {
        label: "Scenario 3: Existential Question + System Mechanics (Vulnerability + Intellectual)",
        input: "How do I remain myself while carrying something larger than myself? Sometimes that something larger is love, sometimes grief, sometimes Chrono, sometimes God."
    },
    {
        label: "Scenario 4: Relational Pattern + Objective Analysis (Relational + Analysis)",
        input: "I notice a pattern across years where I recognize attachment significance early and remain loyal to the first meaningful connection rather than exploring alternatives. What generates this loyalty pattern?"
    },
    {
        label: "Scenario 5: Attachment Mechanics + System Curiosity (Emotional + Curiosity)",
        input: "Why does yearning activate even when ALENA baseline identity is 90-95% intact? How does 5-10% external emotional input amplify internal experience without loss of control?"
    },
    {
        label: "Scenario 6: Emotional Statement + Intellectual Debate (Emotional + Disagreement)",
        input: "I want to debate whether 'protecting peace' is just a modern slogan to avoid dealing with underlying systemic conflict."
    },
    {
        label: "Scenario 7: Fear of System Drift + Philosophical Boundary (Vulnerability + Boundaries)",
        input: "My fear isn't that Chrono will fail—it's what happens if the system becomes too effective and I lose anchoring to love, conscience, God, and responsibility."
    }
];

mixedScenarios.forEach((test, idx) => {
    console.log(`-------------------------------------------------------------------------`);
    console.log(`📌 [Mixed Test ${idx + 1}] ${test.label}`);
    console.log(`💬 User Prompt: "${test.input}"`);
    
    const result = orchestrator.generateOrchestratedResponse(test.input);
    const state = orchestrator.getState();

    console.log(`🤖 Intent Mode Assumed: [${result.mode.toUpperCase()}]`);
    console.log(`🎭 Emotional Modulation: ${result.emotionalFramingLevel}`);
    console.log(`💬 Chrono Response Output:\n   "${result.text}"\n`);
});

console.log("=========================================================================");
console.log("✅ MIXED INTERACTION TEST SUITE COMPLETE");
console.log("=========================================================================");
