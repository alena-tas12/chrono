const db = require('../main/main_db');
const { planIntent } = require('../main/dispatchEngine');

console.log('\n' + '='.repeat(80));
console.log('🧪 GENERALIZATION TEST SUITE (PHASE 1: CONVERSATIONAL SPINE)');
console.log('='.repeat(80));

const personas = [
    {
        name: 'Student',
        messages: [
            "I have a mid-term tomorrow.",
            "Can you help me quiz on mitosis?",
            "Wait, what was the first phase again?" // Branching test
        ]
    },
    {
        name: 'Developer',
        messages: [
            "I'm setting up a new React project.",
            "How do I configure Vite with HTTPS?",
            "Actually, let's use Webpack instead." // Branching test
        ]
    },
    {
        name: 'Researcher',
        messages: [
            "I'm reading a paper on CRISPR.",
            "Can you summarize the off-target effects section?",
            "Can you summarize the introduction instead?" // Branching test
        ]
    },
    {
        name: 'Creative',
        messages: [
            "I have an idea for a sci-fi story.",
            "The main character is a space pirate.",
            "Let's make them a rogue AI instead." // Branching test
        ]
    },
    {
        name: 'Minimalist',
        messages: [
            "To-do list for today.",
            "Add groceries.",
            "Delete groceries." // Branching test
        ]
    }
];

async function runPersonaTest(persona) {
    console.log(`\n👤 Testing Persona: ${persona.name}`);
    
    // Clear DB for test isolation (if we had a real test DB setup, we'd reset it)
    // For now we just create isolated message threads
    
    // 1. Initial message
    const msg1 = db.addWorkspaceMessage({
        role: 'user',
        content: persona.messages[0],
        parent_id: null
    });
    const ai1 = db.addWorkspaceMessage({
        role: 'assistant',
        content: `Acknowledged: ${persona.messages[0]}`,
        parent_id: msg1.id
    });
    console.log(`  ✅ Turn 1 recorded. Node ID: ${ai1.id}`);

    // 2. Second message
    const msg2 = db.addWorkspaceMessage({
        role: 'user',
        content: persona.messages[1],
        parent_id: ai1.id
    });
    const ai2 = db.addWorkspaceMessage({
        role: 'assistant',
        content: `Acknowledged: ${persona.messages[1]}`,
        parent_id: msg2.id
    });
    console.log(`  ✅ Turn 2 recorded. Node ID: ${ai2.id}`);

    // 3. Edit Turn 2 (Branching)
    const msg2_alt = db.addWorkspaceMessage({
        role: 'user',
        content: persona.messages[2],
        parent_id: ai1.id // Branches from Turn 1 AI response
    });
    const ai2_alt = db.addWorkspaceMessage({
        role: 'assistant',
        content: `Acknowledged: ${persona.messages[2]}`,
        parent_id: msg2_alt.id
    });
    console.log(`  ✅ Turn 2 (EDITED) recorded. Node ID: ${ai2_alt.id}`);

    // Verify Context Reconstruction for the alternate branch
    const branch = db.getWorkspaceBranch(ai2_alt.id);
    const contextContent = branch.map(b => b.content);
    
    if (contextContent.includes(persona.messages[1])) {
        console.error(`  ❌ FAIL: The edited branch erroneously contains the original sibling message "${persona.messages[1]}"`);
        return false;
    }
    if (!contextContent.includes(persona.messages[0])) {
        console.error(`  ❌ FAIL: The edited branch is missing the parent message "${persona.messages[0]}"`);
        return false;
    }
    if (!contextContent.includes(persona.messages[2])) {
        console.error(`  ❌ FAIL: The edited branch is missing its own message "${persona.messages[2]}"`);
        return false;
    }
    
    console.log(`  ✅ Context Reconstruction strictly follows the semantic tree branch.`);
    return true;
}

async function runAll() {
    let passed = 0;
    for (const p of personas) {
        const success = await runPersonaTest(p);
        if (success) passed++;
    }

    console.log('\n' + '='.repeat(80));
    if (passed === personas.length) {
        console.log(`🎉 ALL PERSONA TESTS PASSED (${passed}/${personas.length})`);
    } else {
        console.log(`⚠️ SOME PERSONA TESTS FAILED (${passed}/${personas.length})`);
    }
    console.log('='.repeat(80));
}

runAll();
