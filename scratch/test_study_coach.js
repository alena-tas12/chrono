const path = require('path');
const Database = require('better-sqlite3');
const db = require('../main/main_db').db;
const orchestrator = require('../main/cognitiveOrchestrator');

async function testStudyCoach() {
    console.log("⚙️ Running Study Coach DSA Agent verification...");
    
    // Set user ID in DB
    db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('auth_user_id', 'local_user')").run();
    db.prepare("DELETE FROM tasks").run();

    // 1. Query general info about Segment Tree
    console.log("\nQuery 1: 'tell me about segment trees'");
    const res1 = await orchestrator.generateOrchestratedResponse("tell me about segment trees", { selectedDate: '2026-06-01' });
    console.log("Response text:\n", res1.response);
    console.log("Has Proposal:", !!res1.state.proposal);

    // 2. Query scheduling action
    console.log("\nQuery 2: 'schedule study segment trees'");
    const res2 = await orchestrator.generateOrchestratedResponse("schedule study segment trees", { selectedDate: '2026-06-01' });
    console.log("Response text:\n", res2.response);
    console.log("Has Proposal:", !!res2.state.proposal);
    if (res2.state.proposal) {
        console.log("Proposal Type:", res2.state.proposal.type);
        console.log("Actions:", res2.state.proposal.actions);
    }
    
    process.exit(0);
}

testStudyCoach();
