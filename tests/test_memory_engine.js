const mainDb = require('../main/main_db');
const memoryEngine = require('../main/memoryEngine');
const { StateManager } = require('../main/stateManager');
const assert = require('assert');

async function runTests() {
    console.log("=== Running Phase 3: Productivity & Memory Engine Tests ===");

    // Clean up
    mainDb.db.prepare("DELETE FROM cognitive_memories WHERE content = 'User prefers dark mode'").run();
    mainDb.db.prepare("DELETE FROM tasks WHERE text = 'Finish architectural refactor'").run();

    console.log("[Test 1] Explicit Observation Storage");
    memoryEngine.saveObservation('User prefers dark mode', 'long_term', 8);
    const obs = mainDb.db.prepare("SELECT * FROM cognitive_memories WHERE content = 'User prefers dark mode'").get();
    assert(obs, "Observation was not saved");
    assert(obs.memory_type === 'long_term', "Observation type mismatch");
    console.log("  ✓ Observation successfully stored in cognitive_memories");

    console.log("[Test 2] Task Creation");
    const taskId = mainDb.generateUUID();
    mainDb.db.prepare(`
        INSERT INTO tasks (id, text, date, calendar, updated_at) 
        VALUES (?, 'Finish architectural refactor', '2026-08-12', 'work', ?)
    `).run(taskId, Date.now());
    const task = mainDb.db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
    assert(task, "Task was not created");
    console.log("  ✓ Task successfully stored in database");

    console.log("[Test 3] StateManager Context Assembly");
    const stateManager = new StateManager();
    const state = stateManager.queryState(['Tasks', 'Memory'], { userInput: "What's my plan?" });
    
    assert(state.tasks && state.tasks.length > 0, "Tasks were not retrieved by StateManager");
    const retrievedTask = state.tasks.find(t => t.text === 'Finish architectural refactor');
    assert(retrievedTask, "Specific task was not found in retrieved context");
    
    assert(state.memory && state.memory.length > 0, "Memories were not retrieved by StateManager");
    const retrievedObs = state.memory.find(m => m.content === 'User prefers dark mode');
    assert(retrievedObs, "Specific observation was not found in retrieved context");
    console.log("  ✓ StateManager successfully integrated Tasks and Memory into context");

    console.log("=== All Memory & Task Tests Passed! ===");
}

runTests().catch(console.error);
