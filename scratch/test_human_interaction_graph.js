const orchestrator = require('../main/cognitiveOrchestrator');

console.log("=========================================================================");
console.log("🌐 TESTING CHRONO HUMAN INTERACTION GRAPH & BEHAVIORAL TRAJECTORIES");
console.log("=========================================================================\n");

orchestrator.resetState();

const trajectories = [
    {
        name: "Trajectory A: Mixed Emotion (Joy + Loss + Relational Reflection)",
        steps: [
            { input: "I'm really happy for her moving to a new city, but I'm also sad that I'm not part of her daily life anymore." },
            { input: "It's strange how you can celebrate someone while feeling that distance at the same time." }
        ]
    },
    {
        name: "Trajectory B: Affection + Familiar Teasing (Humor & Closeness)",
        input: "You idiot 😂 I was testing whether you'd notice the typo in my SQL query!"
    },
    {
        name: "Trajectory C: Fear + High Curiosity (Investigation Over Avoidance)",
        input: "I'm worried this memory leak could crash the production server, but I really want to trace the heap snapshot to see why it's growing."
    },
    {
        name: "Trajectory D: Conflict $\\rightarrow$ Clarification $\\rightarrow$ Repair",
        steps: [
            { input: "I'm annoyed that you didn't catch that missing environment variable earlier." },
            { input: "Wait, actually it was in my own config file. My bad!" }
        ]
    },
    {
        name: "Trajectory E: Technical Frustration $\\rightarrow$ Resolution $\\rightarrow$ Casual Initiation",
        steps: [
            { input: "This gateway ping is still dropping packets and it's super frustrating." },
            { input: "Fixed it! Re-flashing the firmware solved it." },
            { input: "Anyway, what's next on our agenda today?" }
        ]
    }
];

trajectories.forEach((traj, idx) => {
    console.log(`-------------------------------------------------------------------------`);
    console.log(`📌 [${traj.name}]`);
    
    if (traj.steps) {
        traj.steps.forEach((step, sIdx) => {
            console.log(`  Step ${sIdx + 1}: User: "${step.input}"`);
            const res = orchestrator.generateOrchestratedResponse(step.input);
            console.log(`  Chrono [${res.mode.toUpperCase()}]: "${res.text}"\n`);
        });
    } else {
        console.log(`  User: "${traj.input}"`);
        const res = orchestrator.generateOrchestratedResponse(traj.input);
        console.log(`  Chrono [${res.mode.toUpperCase()}]: "${res.text}"\n`);
    }
});

console.log("=========================================================================");
console.log("✅ HUMAN INTERACTION GRAPH BEHAVIORAL TRAJECTORY TEST COMPLETE");
console.log("=========================================================================");
