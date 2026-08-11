/**
 * 🗣️ CONVERSATION SEMANTICS TEST SUITE
 * 
 * Verifies that Chrono understands *what* the human is doing with their message,
 * independent of the emotional vocabulary or implicit memory triggers.
 * Ensures unknown/ambiguous are valid classifications.
 */

const { SemanticParser } = require('../main/semanticParser');

console.log('\n' + '='.repeat(80));
console.log('🗣️  CONVERSATION SEMANTICS TEST SUITE');
console.log('='.repeat(80));

let testsPassed = 0;
let testsFailed = 0;

function assertMatch(testName, expected, actual) {
    let passed = true;
    let errors = [];

    for (const key of Object.keys(expected)) {
        if (expected[key] === undefined) continue;

        if (key === 'emotion') {
            const expectedEmotions = expected[key] || [];
            const actualEmotions = (actual[key] && actual[key].labels) ? actual[key].labels : [];
            const hasAll = expectedEmotions.every(e => actualEmotions.includes(e));
            if (!hasAll && expectedEmotions.length > 0) {
                passed = false;
                errors.push(`Expected emotion to include [${expectedEmotions}], got [${actualEmotions}]`);
            }
        } else {
            const expectedVal = expected[key];
            const actualVal = actual[key] ? actual[key].value : undefined;
            if (expectedVal !== actualVal) {
                passed = false;
                errors.push(`Expected ${key}='${expectedVal}', got '${actualVal}'`);
            }
        }
    }

    if (passed) {
        console.log(`✅ PASS: ${testName}`);
        testsPassed++;
    } else {
        console.log(`❌ FAIL: ${testName}`);
        errors.forEach(e => console.log(`   - ${e}`));
        console.log(`   [Parsed Output]:`, JSON.stringify(actual, null, 2));
        testsFailed++;
    }
}

async function runTests() {
    const parser = new SemanticParser();

    const testCases = [
        // 1. Social
        {
            name: "Social: How are you?",
            history: [],
            input: "how are you?",
            expected: { target: "chrono", function: "social_inquiry", relationToConversation: "new" }
        },
        {
            name: "Social: What are you up to?",
            history: [],
            input: "what are you up to?",
            expected: { target: "chrono", function: "social_inquiry" }
        },
        
        // 2. About Chrono
        {
            name: "Meta: How do you work?",
            history: [],
            input: "How do you work?",
            expected: { target: "chrono", function: "meta_inquiry" }
        },

        // 3. Self-directed
        {
            name: "Self-directed: Why am I feeling this way?",
            history: [],
            input: "Why am I feeling this way?",
            expected: { target: "user", function: "self_exploration", relationToConversation: "new" }
        },
        {
            name: "Self-directed: I don't understand why I'm angry.",
            history: [],
            input: "I don't understand why I'm angry.",
            expected: { target: "user", function: "self_exploration", emotion: ["anger"] }
        },

        // 4. Technical
        {
            name: "Technical: Why is my code failing?",
            history: [],
            input: "Why is my code failing?",
            expected: { target: "user_data", function: "troubleshoot", domain: "programming" }
        },
        {
            name: "Technical: Explain TCP.",
            history: [],
            input: "Explain TCP.",
            expected: { target: "general_knowledge", function: "explain", domain: "networking" }
        },

        // 5. Emotional + Technical (The big disambiguation test)
        {
            name: "Emotional+Technical: This stupid code is driving me insane.",
            history: [],
            input: "This stupid code is driving me insane.",
            expected: { target: "user_data", function: "troubleshoot", emotion: ["frustration"] }
        },
        {
            name: "Emotional+Technical: I'm frustrated because the router won't ping.",
            history: [],
            input: "I'm frustrated because the router won't ping.",
            expected: { target: "user_data", function: "troubleshoot", domain: "networking", emotion: ["frustration"] }
        },

        // 6. Casual
        {
            name: "Casual: lol",
            history: [],
            input: "lol",
            expected: { function: "casual_reaction" }
        },
        {
            name: "Casual: wait what 😂",
            history: [],
            input: "wait what 😂",
            expected: { function: "casual_reaction" }
        },

        // 7. Corrections
        {
            name: "Correction: No, that's not what I meant.",
            history: [{ role: 'assistant', content: 'You want to build a router.' }],
            input: "No, that's not what I meant.",
            expected: { target: "chrono", function: "correction", relationToConversation: "correction" }
        },
        {
            name: "Correction: Actually forget that.",
            history: [{ role: 'user', content: 'Tell me about TCP.' }],
            input: "Actually forget that.",
            expected: { function: "topic_abandonment", relationToConversation: "correction" }
        },

        // 8. Topic Transitions
        {
            name: "Topic Transition: Anyway, back to the router...",
            history: [{ role: 'user', content: 'How is the weather?' }],
            input: "Anyway, back to the router...",
            expected: { function: "troubleshoot", domain: "networking", relationToConversation: "return_to_topic" }
        },

        // 9. Ambiguous
        {
            name: "Ambiguous: I'm not sure.",
            history: [],
            input: "I'm not sure.",
            expected: { function: "ambiguous", relationToConversation: "new" }
        },
        {
            name: "Ambiguous: What now?",
            history: [],
            input: "What now?",
            expected: { function: "ambiguous" }
        }
    ];

    console.log('\n🔬 RUNNING SINGLE-TURN AND SHORT-HISTORY TESTS');
    console.log('-'.repeat(80));

    for (const tc of testCases) {
        const parsed = await parser.parse(tc.input, tc.history);
        assertMatch(tc.name, tc.expected, parsed);
    }

    console.log('\n🔄 RUNNING THE "HOW ARE YOU" REGRESSION TEST (MULTI-TURN)');
    console.log('-'.repeat(80));

    // Turn 1
    const t1 = await parser.parse("how are you?", []);
    assertMatch("Turn 1: how are you?", { target: "chrono", function: "social_inquiry" }, t1);

    // Turn 2
    const h1 = [
        { role: 'user', content: 'how are you?' },
        { role: 'assistant', content: "I'm doing well. What's up?" }
    ];
    const t2 = await parser.parse("actually I'm feeling sad today.", h1);
    assertMatch("Turn 2: actually I'm feeling sad today.", { target: "user", function: "self_exploration", emotion: ["sadness"], relationToConversation: "continuation" }, t2);

    // Turn 3
    const h2 = [
        ...h1,
        { role: 'user', content: "actually I'm feeling sad today." },
        { role: 'assistant', content: "I'm sorry to hear that. Do you want to talk about what's making you feel sad, or would you rather focus on something else?" }
    ];
    const t3 = await parser.parse("anyway, how do I fix my router?", h2);
    // Crucially, emotion should NOT leak from the previous turn unless the user connects them.
    assertMatch("Turn 3: anyway, how do I fix my router?", { target: "user_data", function: "troubleshoot", domain: "networking", relationToConversation: "topic_shift" }, t3);
    
    // Check that emotion is NONE or undefined in T3
    if (t3.emotion && t3.emotion.labels && t3.emotion.labels.length > 0) {
        console.log(`❌ FAIL: Turn 3: Emotion leaked! Got ${t3.emotion.labels.join(', ')}`);
        testsFailed++;
    } else {
        console.log(`✅ PASS: Turn 3: Emotion did not leak.`);
        testsPassed++;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`📊 TEST SUMMARY`);
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    
    if (testsFailed === 0) {
        console.log('\n🎉 SEMANTICS TEST PASSED! 🎉');
        process.exit(0);
    } else {
        console.log(`\n⚠️  ${testsFailed} test(s) failed.`);
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test framework crashed:', err);
    process.exit(1);
});
