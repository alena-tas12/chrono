const orchestrator = require('../main/cognitiveOrchestrator');

console.log("=========================================================================");
console.log("📄 TESTING CHRONO AI INTERACTION WITH PDF CONVERSATION SCENARIOS");
console.log("=========================================================================\n");

orchestrator.resetState();

const pdfScenarios = [
    {
        label: "PDF Topic 1: Computer Networking Lecture (Educational / Concept)",
        input: "This 3-hour computer networking lecture has too much blabbering and storytelling. Can you cut the bullshit and explain TCP/IP routing and addressing directly?"
    },
    {
        label: "PDF Topic 2: Sleep & Physiology Analysis (Troubleshooting / System)",
        input: "I woke up at 3:30 AM again after walking 28,000 steps today. Why is cortisol spiking and how does cognitive load affect recovery?"
    },
    {
        label: "PDF Topic 3: Architecture & Deployment (Engineering / Strategy)",
        input: "Should I deploy server.js and ai_gateway.js to GCP Cloud Run while keeping the local Founder Layer and SQLite on device?"
    },
    {
        label: "PDF Topic 4: Faith & System Alignment (Thinking Partner / Philosophy)",
        input: "I want to analyze how faith functions as a baseline orientation for internal governance rather than an external ritual performance."
    },
    {
        label: "PDF Topic 5: Category Integrity & Structural Analysis (Analyst)",
        input: "Compare how identity bonds, trust bonds, care bonds, and social bonds differ structurally so they don't get mixed together."
    },
    {
        label: "PDF Topic 6: Communication Subtext (Interpreter)",
        input: "My partner texted 'I'm fine, let's talk tomorrow.' What are the possible subtexts based on evidence without over-psychoanalyzing?"
    },
    {
        label: "PDF Topic 7: Educational System Critique (Verified Debate / Challenger)",
        input: "I want to debate whether modern educational institutions force conformity and fragment human continuity instead of building understanding.",
        options: { allowChallenge: true }
    }
];

pdfScenarios.forEach((test, idx) => {
    console.log(`-------------------------------------------------------------------------`);
    console.log(`📌 [PDF Scenario ${idx + 1}] ${test.label}`);
    console.log(`💬 User Prompt: "${test.input}"`);
    
    const result = orchestrator.generateOrchestratedResponse(test.input, test.options || {});
    const state = orchestrator.getState();

    console.log(`🤖 Mode Assumed: [${result.mode.toUpperCase()}]`);
    console.log(`🎭 Emotional Framing Level: ${result.emotionalFramingLevel}`);
    console.log(`💬 Chrono Response: "${result.text}"`);
    console.log(`📊 State Snapshot: Focus=${state.attention.focus} | Interaction #${state.continuity.interactionCount}\n`);
});

console.log("=========================================================================");
console.log("✅ PDF CONVERSATION INTERACTION TEST COMPLETE");
console.log("=========================================================================");
