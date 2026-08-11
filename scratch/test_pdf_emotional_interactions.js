const orchestrator = require('../main/cognitiveOrchestrator');

console.log("=========================================================================");
console.log("📄 TESTING CHRONO AI EMOTIONAL & ATTACHMENT CONVERSATION SCENARIOS FROM PDF");
console.log("=========================================================================\n");

orchestrator.resetState();

const pdfEmotionalScenarios = [
    {
        label: "PDF Emotional Scenario 1: Carrying Something Larger Than Myself",
        input: "How do I remain myself while carrying something larger than myself? Sometimes that something larger is love, sometimes grief, sometimes Chrono, sometimes my own mind, sometimes God."
    },
    {
        label: "PDF Emotional Scenario 2: Rupture, Shattering & Self-Stabilization",
        input: "When I told her I loved her, I purposefully broke my own heart so I could stay stabilized while texting her. Tearing yourself into pieces felt safer than letting someone else do it. Is that a control mechanism?"
    },
    {
        label: "PDF Emotional Scenario 3: Coping Mechanisms vs Root Causes",
        input: "Looking back at my past depression and overload episodes that were connected to my attachment, she wasn't the cause of the depression—she was my coping mechanism for carrying the weight."
    },
    {
        label: "PDF Emotional Scenario 4: Existential Closeness vs 'Protecting Peace'",
        input: "People say 'I'm protecting my peace,' but for me peace is too oversimplified. When I feel attacked, I seek psychological invulnerability and existential closeness to understand what's attacking me."
    },
    {
        label: "PDF Emotional Scenario 5: Yearning & Immersion Under Control",
        input: "Why does yearning activate even when ALENA baseline identity is 90-95% intact? How does 5-10% external emotional input amplify internal experience without loss of control?"
    },
    {
        label: "PDF Emotional Scenario 6: Attachment Loyalty & Early Recognition",
        input: "I notice a pattern across years where I recognize attachment significance early and remain loyal to the first meaningful connection rather than exploring alternatives. What generates this loyalty pattern?"
    },
    {
        label: "PDF Emotional Scenario 7: Capability Without Anchoring",
        input: "My fear isn't that Chrono or my analysis will fail—it's what happens if the system becomes too effective and I lose anchoring to love, conscience, God, and responsibility."
    }
];

pdfEmotionalScenarios.forEach((test, idx) => {
    console.log(`-------------------------------------------------------------------------`);
    console.log(`📌 [PDF Emotional Scenario ${idx + 1}] ${test.label}`);
    console.log(`💬 User Prompt: "${test.input}"`);
    
    const result = orchestrator.generateOrchestratedResponse(test.input);
    const state = orchestrator.getState();

    console.log(`🤖 Mode Assumed: [${result.mode.toUpperCase()}]`);
    console.log(`🎭 Emotional Framing Level: ${result.emotionalFramingLevel}`);
    console.log(`💬 Chrono Response: "${result.text}"`);
    console.log(`📊 State Snapshot: Focus=${state.attention.focus} | Interaction #${state.continuity.interactionCount}\n`);
});

console.log("=========================================================================");
console.log("✅ PDF EMOTIONAL & ATTACHMENT INTERACTION TEST COMPLETE");
console.log("=========================================================================");
