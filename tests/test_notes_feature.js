const notesService = require('../main/notesService');
const mainDb = require('../main/main_db');
const { DispatchEngine } = require('../main/dispatchEngine');
const { ReasoningEngine } = require('../main/reasoningEngine');
const assert = require('assert');

async function runNotesFeatureTest() {
    console.log("=== Phase 7: Notes Feature Complete Acceptance Test Suite ===");
    
    const userId = `notes_user_${Date.now()}`;
    const testTitle1 = "OSPF Link-State Protocol Architecture";
    const testContent1 = "OSPF uses link-state routing and Dijkstra Shortest Path First algorithm for network topology calculations.";
    
    const testTitle2 = "BGP Path Vector Routing";
    const testContent2 = "BGP handles inter-domain routing using path vectors and autonomous system numbers.";

    // ------------------------------------------------------------------
    // Step 1: Create Notes & Verify Storage
    // ------------------------------------------------------------------
    console.log("1. Creating Notes via Notes Service...");
    const note1 = await notesService.addNote(userId, testTitle1, testContent1);
    const note2 = await notesService.addNote(userId, testTitle2, testContent2);
    
    assert(note1 && note1.noteId, "Note 1 must be created with valid noteId");
    assert(note2 && note2.noteId, "Note 2 must be created with valid noteId");
    console.log(`   ✓ Created Note 1 [${note1.noteId}] and Note 2 [${note2.noteId}]`);

    // ------------------------------------------------------------------
    // Step 2: Fetch Notes & Verify User Scoping & Distinctness
    // ------------------------------------------------------------------
    console.log("2. Fetching Notes & Verifying User Scoping...");
    const userNotes = await notesService.getNotes(userId);
    assert.strictEqual(userNotes.length, 2, "User must have exactly 2 notes");
    
    const fetched1 = userNotes.find(n => n.id === note1.noteId);
    const fetched2 = userNotes.find(n => n.id === note2.noteId);
    
    assert(fetched1 && fetched1.content.includes("Dijkstra"), "Note 1 content mismatch");
    assert(fetched2 && fetched2.content.includes("autonomous system"), "Note 2 content mismatch");
    console.log("   ✓ User Scoping & Content Distinctness Verified!");

    // ------------------------------------------------------------------
    // Step 3: Edit Note & Verify Persistence
    // ------------------------------------------------------------------
    console.log("3. Editing Note & Verifying Updated Content...");
    const updatedContent1 = "OSPF uses link-state routing, SPF algorithm, and Area 0 backbone requirements.";
    await notesService.editNote(userId, note1.noteId, testTitle1, updatedContent1);
    
    const reFetchedNotes = await notesService.getNotes(userId);
    const updated1 = reFetchedNotes.find(n => n.id === note1.noteId);
    assert(updated1.content.includes("Area 0 backbone"), "Edited note content must persist!");
    console.log("   ✓ Note Edit & Persistence Verified!");

    // ------------------------------------------------------------------
    // Step 4: Conversational Retrieval from KnowledgeBase (Notes Pillar)
    // ------------------------------------------------------------------
    console.log("4. Testing Conversational Retrieval from Notes Pillar...");
    const { StateManager } = require('../main/stateManager');
    const dispatchEngine = new DispatchEngine({ stateManager: new StateManager() });
    const reasoningEngine = new ReasoningEngine();
    
    const inputQuery = "What did I write about OSPF?";
    const plan = await dispatchEngine.planIntent({ input: inputQuery, session: { history: [] } });
    
    assert(plan.selectedModules.includes('KnowledgeBase'), "Notes query MUST include KnowledgeBase module");
    assert(!plan.selectedModules.includes('Tasks'), "Notes query MUST exclude Tasks");
    assert(!plan.selectedModules.includes('Memory'), "Notes query MUST exclude Memory");
    console.log(`   ✓ Dispatch Selected Modules: [${plan.selectedModules.join(', ')}]`);

    // ------------------------------------------------------------------
    // Step 5: Delete Note & Verify Cleanup
    // ------------------------------------------------------------------
    console.log("5. Deleting Note & Verifying Isolation...");
    await notesService.deleteNote(note2.noteId);
    
    const finalNotes = await notesService.getNotes(userId);
    assert.strictEqual(finalNotes.length, 1, "Only selected note should remain after deletion");
    assert.strictEqual(finalNotes[0].id, note1.noteId, "Note 1 must remain intact after deleting Note 2");
    console.log("   ✓ Single Note Deletion Verified!");

    // Final Cleanup of Test Note 1
    await notesService.deleteNote(note1.noteId);
    const emptyCheck = await notesService.getNotes(userId);
    assert.strictEqual(emptyCheck.length, 0, "Test notes fully cleaned up");

    console.log("\n=========================================");
    console.log("🎉 Notes Feature Complete Acceptance Test PASSED!");
    console.log("=========================================");
}

runNotesFeatureTest().catch(err => {
    console.error(err);
    process.exit(1);
});
