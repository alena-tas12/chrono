const mainDb = require('../main/main_db');
const memoryEngine = require('../main/memoryEngine');
const assert = require('assert');

async function runTests() {
    console.log("=== Running Phase 4: Memory Lifecycle & Provenance Tests ===");

    // Clean up
    mainDb.db.prepare("DELETE FROM cognitive_memories WHERE evidence LIKE '%test_lifecycle%'").run();

    console.log("[Test 1] Store Observation with Provenance");
    const mem1Id = memoryEngine.storeObservation(
        "User prefers concise answers", 
        "Conversation #123", 
        "test_lifecycle: user explicitly requested it", 
        "high", 
        "user_explicit"
    );
    
    let obs = mainDb.db.prepare("SELECT * FROM cognitive_memories WHERE id = ?").get(mem1Id);
    assert(obs, "Observation not saved");
    assert(obs.source_type === 'user_explicit', "source_type mismatch");
    assert(obs.confidence === 'high', "confidence mismatch");
    assert(obs.status === 'active', "status should be active");
    assert(obs.evidence.includes("test_lifecycle"), "evidence mismatch");
    console.log("  ✓ Provenance explicitly stored");

    console.log("[Test 2] Correct Memory (Supersession)");
    const mem2Id = memoryEngine.correctMemory(
        mem1Id, 
        "User prefers detailed answers", 
        "test_lifecycle: user changed preference in Conversation #456",
        "medium",
        "user_explicit"
    );
    
    const oldObs = mainDb.db.prepare("SELECT * FROM cognitive_memories WHERE id = ?").get(mem1Id);
    assert(oldObs.status === 'corrected', "Old memory was not marked as corrected");
    
    const newObs = mainDb.db.prepare("SELECT * FROM cognitive_memories WHERE id = ?").get(mem2Id);
    assert(newObs.status === 'active', "New memory was not marked as active");
    assert(newObs.content === "User prefers detailed answers", "New memory content mismatch");
    console.log("  ✓ Correction created a new belief and preserved history");

    console.log("[Test 3] Forget Memory");
    memoryEngine.forgetMemory(mem2Id);
    
    const forgottenObs = mainDb.db.prepare("SELECT * FROM cognitive_memories WHERE id = ?").get(mem2Id);
    assert(forgottenObs.status === 'forgotten', "Memory was not marked as forgotten");
    
    const activeMemories = memoryEngine.retrieveMemory();
    const found = activeMemories.find(m => m.id === mem2Id || m.id === mem1Id);
    assert(!found, "Forgotten/Corrected memory appeared in active retrieval");
    console.log("  ✓ Forgotten memory properly suppressed from active context");

    console.log("=== All Memory Lifecycle Tests Passed! ===");
}

runTests().catch(console.error);
