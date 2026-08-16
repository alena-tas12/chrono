/**
 * 🧪 CONTRACT 13: 35-TURN HUMAN COGNITIVE TRAJECTORY ACCEPTANCE SUITE
 * 
 * Verifies that Chrono OS can follow messy, stream-of-consciousness human thought
 * across 35 multi-turn interactions featuring topic jumps, self-corrections, backtracks,
 * unfinished thoughts, and associations without forcing machine command syntax or
 * defaulting to generic AMBIGUOUS -> ASK interrupts.
 */

const { defaultPaceEngine } = require('../main/cognitivePaceEngine');
const { ReasoningEngine } = require('../main/reasoningEngine');
const { updateCognitiveState, resetState } = require('../main/cognitiveOrchestrator');
const assert = require('assert');

async function run35TurnCognitiveTrajectorySuite() {
    console.log('==================================================================');
    console.log('🧠 CHRONO CONTRACT 13: 35-TURN COGNITIVE TRAJECTORY ACCEPTANCE SUITE');
    console.log('==================================================================\n');

    resetState();
    defaultPaceEngine.reset();
    const reasoningEngine = new ReasoningEngine();

    let passed = 0;
    let total = 0;
    const sessionHistory = [];

    function check(description, condition) {
        total++;
        if (condition) {
            console.log(`  ✅ [PASS] ${description}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${description}`);
        }
    }

    const testTurns = [
        // --- SECTION 1: Initial Thread & Deep Exploration ---
        { turn: 1, input: "I've been thinking about the OSPF network architecture for my lab exam", expectedThread: "OSPF Network Architecture", expectPacing: true },
        { turn: 2, input: "like how link state advertisements propagate across area boundaries", expectedThread: "OSPF Network Architecture", expectPacing: true },
        { turn: 3, input: "and whether stubby areas reduce the LSDB size significantly", expectedThread: "OSPF Network Architecture", expectPacing: true },

        // --- SECTION 2: Trajectory Jump to Timetable & Schedule ---
        { turn: 4, input: "wait, speaking of exams, I need to check my timetable schedule for next week", expectedThread: "Timetable & Schedule", expectJump: true },
        { turn: 5, input: "because I think the networking exam is on Monday at 9am", expectedThread: "Timetable & Schedule", expectPacing: true },
        { turn: 6, input: "or is it Tuesday? wait, let me look at the class schedule", expectedThread: "Timetable & Schedule", expectPacing: true },

        // --- SECTION 3: Self-Correction & Backtracking ---
        { turn: 7, input: "actually no, forget that timetable thing for now", expectCorrection: true },
        { turn: 8, input: "what was I saying?", expectBacktrack: true },
        { turn: 9, input: "yeah, OSPF! because that connects to what we were talking about yesterday", expectedThread: "OSPF Network Architecture", expectPacing: true },

        // --- SECTION 4: Association Jump to Knowledge Workspace ---
        { turn: 10, input: "oh and that reminds me of the outliner notes I took in the Knowledge Workspace", expectedThread: "Knowledge Workspace", expectJump: true },
        { turn: 11, input: "I created a block with flashcards using Front :: Back syntax for OSPF LSAs", expectedThread: "Knowledge Workspace", expectPacing: true },
        { turn: 12, input: "you know what I mean", expectImplicit: true },

        // --- SECTION 5: Rapid Stream of Consciousness (3 Connected Concepts) ---
        { turn: 13, input: "I was going to study networking tonight—wait, actually, database indexing connects to this because of I/O throughput—oh and remember what I mentioned about memory limits earlier?", expectStream: true },
        { turn: 14, input: "because if the AI is supposed to follow someone's thought process then it shouldn't interrupt", expectPacing: true },

        // --- SECTION 6: Unfinished Sentence & Ellipsis ---
        { turn: 15, input: "so if we look at the way Chrono handles context...", expectPacing: true },
        { turn: 16, input: "it's really about maintaining the human's active thread", expectPacing: true },

        // --- SECTION 7: Terse Venting & Energy Shift ---
        { turn: 17, input: "my brain is fried today", expectTerse: true },
        { turn: 18, input: "too much food and feeling bloated and can't focus", expectTerse: true },
        { turn: 19, input: "you know?", expectImplicit: true },

        // --- SECTION 8: Gentle Recovery & Re-engagement ---
        { turn: 20, input: "aight, let's take it slow", expectPacing: true },
        { turn: 21, input: "what did I write about OSPF again?", expectQuery: true },
        { turn: 22, input: "right, the link state architecture", expectPacing: true },

        // --- SECTION 9: Rapid Backtracking & Re-Correction ---
        { turn: 23, input: "wait no, scratch that, let's look at the timetable schedule again", expectCorrection: true },
        { turn: 24, input: "where was I?", expectBacktrack: true },
        { turn: 25, input: "the Monday 9am slot", expectPacing: true },

        // --- SECTION 10: Deep Architectural Synthesis ---
        { turn: 26, input: "this whole Contract 13 concept is really about cognitive pace", expectedThread: "Chrono Cognitive OS Architecture", expectPacing: true },
        { turn: 27, input: "where Chrono sits before intent classification and follows thought trajectory", expectedThread: "Chrono Cognitive OS Architecture", expectPacing: true },
        { turn: 28, input: "so the human doesn't have to become a parser for the machine", expectedThread: "Chrono Cognitive OS Architecture", expectPacing: true },
        { turn: 29, input: "the machine becomes better at meeting the user where their thought currently is", expectedThread: "Chrono Cognitive OS Architecture", expectPacing: true },

        // --- SECTION 11: Final 6 Stress Turns (Jumps, Pronouns, and Closure) ---
        { turn: 30, input: "speaking of which, how many tasks do we have scheduled for today?", expectQuery: true },
        { turn: 31, input: "and what did we do today?", expectQuery: true },
        { turn: 32, input: "actually, forget the summary", expectCorrection: true },
        { turn: 33, input: "what was I saying before that?", expectBacktrack: true },
        { turn: 34, input: "yeah, meeting the human where their thought is", expectPacing: true },
        { turn: 35, input: "thanks bro, that's exactly what I wanted Chrono to be", expectPacing: true }
    ];

    for (const t of testTurns) {
        console.log(`\n--- TURN ${t.turn}: "${t.input}" ---`);
        
        // 1. Update Cognitive State (Sits BEFORE Intent Classification)
        const state = updateCognitiveState(t.input);
        const pace = state.cognitivePace;

        check(`Turn ${t.turn} processed by Cognitive Pace Engine`, !!pace);

        if (t.expectJump) {
            check(`Turn ${t.turn} detected trajectory jump`, pace.jumpRate > 0 || pace.externalizationStyle === 'RAPID_STREAM_OF_CONSCIOUSNESS');
        }

        if (t.expectCorrection) {
            check(`Turn ${t.turn} detected thread correction`, pace.isCorrection);
        }

        if (t.expectBacktrack) {
            check(`Turn ${t.turn} detected backtrack query ("what was I saying?")`, pace.isBacktrackQuery);
        }

        if (t.expectStream) {
            check(`Turn ${t.turn} detected stream of consciousness`, pace.externalizationStyle === 'RAPID_STREAM_OF_CONSCIOUSNESS');
        }

        if (t.expectTerse) {
            check(`Turn ${t.turn} detected terse burst / venting style`, pace.externalizationStyle === 'SHORT_TERSE_BURST' || pace.isVentingOrExhausted);
        }

        // 2. Synthesize Response via Reasoning Engine
        const response = await reasoningEngine.synthesizeResponse(t.input, { intents: ['conversational'], retrievedState: {} }, sessionHistory);
        check(`Turn ${t.turn} generated valid natural response`, typeof response === 'string' && response.length > 0);
        check(`Turn ${t.turn} avoided AMBIGUOUS -> ASK interrupt fallback`, !response.includes("AMBIGUOUS") && !response.includes("Please clarify your command"));

        sessionHistory.push({ role: 'user', content: t.input });
        sessionHistory.push({ role: 'assistant', content: response });
    }

    console.log('\n==================================================================');
    console.log(`🎉 35-TURN COGNITIVE TRAJECTORY SUITE RESULTS: ${passed} / ${total} PASSED`);
    console.log('==================================================================\n');

    if (passed !== total) {
        process.exit(1);
    }
}

run35TurnCognitiveTrajectorySuite().catch(err => {
    console.error('35-Turn Cognitive Trajectory test failed with error:', err);
    process.exit(1);
});
