const orchestrator = require('../main/cognitiveOrchestrator');

console.log("=========================================================================");
console.log("🎮 TESTING CHRONO ADAPTIVE BEHAVIORAL INTENT ENGINE");
console.log("=========================================================================\n");

orchestrator.resetState();

const userScenarios = [
    { label: "Technical Learning", input: "Can you explain how TCP/IP handshakes work?" },
    { label: "Debugging / Troubleshooting", input: "Why is my router not pinging the gateway?" },
    { label: "Structural Analysis", input: "Compare monolithic vs microservices architecture pros and cons." },
    { label: "Decision Support", input: "Should I buy an OLED monitor or an IPS panel for coding?" },
    { label: "Engineering Collaboration", input: "Help me build a REST endpoint in Express for user auth." },
    { label: "Message Interpretation", input: "What does this message from my project partner mean?" },
    { label: "Critical Challenger", input: "I want to debate whether clean code principles are overrated." },
    { label: "Deep System Exploration", input: "Let's think through why institutional systems incentivize bureaucracy." },
    { label: "Casual Interaction", input: "I'm feeling a bit bored today." }
];

userScenarios.forEach((test, idx) => {
    console.log(`--- [Scenario ${idx + 1}: ${test.label}] ---`);
    console.log(`💬 User Input: "${test.input}"`);
    
    const result = orchestrator.generateOrchestratedResponse(test.input);
    const state = orchestrator.getState();

    console.log(`🤖 Mode Assumed: [${result.mode.toUpperCase()}]`);
    console.log(`💬 Chrono Output: "${result.text}"\n`);
});

console.log("=========================================================================");
console.log("✅ ADAPTIVE INTENT BEHAVIORAL TEST COMPLETE");
console.log("=========================================================================");
