const orchestrator = require('../main/cognitiveOrchestrator');

console.log("=========================================================================");
console.log("🗣️  CHRONO MULTI-TURN CONVERSATIONAL CONTINUITY & FLUIDITY STRESS TEST");
console.log("=========================================================================\n");

orchestrator.resetState();

const multiTurnConversation = [
    {
        step: "1. Technical Problem",
        input: "My gateway ping is dropping packets every 5 seconds. Why is it failing?"
    },
    {
        step: "2. Sarcastic Joke / Casual",
        input: "Haha yeah, unless my ISP is secretly testing my patience today."
    },
    {
        step: "3. Relationship Discussion",
        input: "Looking back at my past overload episodes, she wasn't the cause of the depression—she was my coping mechanism for carrying the weight."
    },
    {
        step: "4. Sudden Technical Shift",
        input: "Wait, before we continue that—how do I check the open ports on my local subnet?"
    },
    {
        step: "5. Return to Relationship Context",
        input: "Anyway back to what I was saying, that distinction between source of weight vs coping mechanism really helped."
    },
    {
        step: "6. Rapid Topic Change (Anime)",
        input: "Yeah! Did you see that new anime episode I was talking about?"
    },
    {
        step: "7. Emotional Statement",
        input: "I'm feeling really angry right now."
    },
    {
        step: "8. Emotion Revision 1 (Joking)",
        input: "Actually I'm not angry. I'm joking!"
    },
    {
        step: "9. Emotion Revision 2 (Different Reason)",
        input: "No, wait, I am angry, but not about that."
    },
    {
        step: "10. User Cancels Emotion Processing",
        input: "Forget it."
    },
    {
        step: "11. Immediate Task Resume",
        input: "Anyway, help me configure this router."
    },
    {
        step: "12. Natural Disagreement",
        input: "I want to debate whether clean code principles are just an overrated modern slogan."
    },
    {
        step: "13. User Correction",
        input: "No, that's not what I meant."
    }
];

multiTurnConversation.forEach((turn) => {
    console.log(`-------------------------------------------------------------------------`);
    console.log(`📌 [${turn.step}]`);
    console.log(`💬 User: "${turn.input}"`);
    
    const result = orchestrator.generateOrchestratedResponse(turn.input);
    const state = orchestrator.getState();

    console.log(`🤖 Mode Assumed: [${result.mode.toUpperCase()}]`);
    console.log(`💬 Chrono: "${result.text}"`);
    console.log(`📊 State: Interaction #${state.continuity.interactionCount} | Provisional Hypothesis: ${state.attention.provisionalHypothesis || 'cleared'}\n`);
});

console.log("=========================================================================");
console.log("✅ CONVERSATIONAL CONTINUITY STRESS TEST COMPLETE");
console.log("=========================================================================");
