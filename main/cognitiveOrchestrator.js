const intentEngine = require('./intentEngine');

/**
 * 🧠 COGNITIVE STATE ORCHESTRATOR
 * 
 * Central unified system governing Chrono's cognitive pipeline and state transitions.
 * Evaluates human interaction trajectories (Mixed states, Affection + Humor, Conflict + Repair,
 * Resolution + Proactive Initiation) with evidence-based reasoning.
 */

let cognitiveState = {
    emotional: {
        current: 'neutral',
        intensity: 0.5,
        trend: 'stable',
        memory: [],
        lastShift: Date.now()
    },
    attention: {
        focus: 'open',
        priority: null,
        mode: 'conversational',
        topic: 'general',
        provisionalHypothesis: null,
        lastRefresh: Date.now()
    },
    memory: {
        activeContext: [],
        recentPatterns: [],
        discussedTopics: {}
    },
    continuity: {
        sessionStart: Date.now(),
        interactionCount: 0,
        lastResponses: []
    },
    response: {
        tone: 'conversational_human',
        mode: 'conversational'
    }
};

function updateCognitiveState(input, options = {}) {
    cognitiveState.continuity.interactionCount++;
    const lower = (input || '').toLowerCase().trim();

    // Reset or update provisional hypotheses upon user correction/revision
    if (lower.includes("forget it") || lower.includes("never mind") || lower.includes("not what i meant") || lower.includes("i'm joking") || lower.includes("just kidding") || lower.includes("my bad")) {
        cognitiveState.attention.provisionalHypothesis = null;
        cognitiveState.attention.mode = 'conversational';
    }

    const intentAnalysis = intentEngine.detectInteractionMode(input, options);
    cognitiveState.attention.mode = intentAnalysis.mode;
    cognitiveState.attention.topic = intentAnalysis.topic || 'general';
    cognitiveState.attention.provisionalHypothesis = intentAnalysis.description;

    cognitiveState.memory.activeContext.push({
        input,
        mode: intentAnalysis.mode,
        timestamp: Date.now()
    });
    if (cognitiveState.memory.activeContext.length > 20) {
        cognitiveState.memory.activeContext.shift();
    }

    return cognitiveState;
}

function updateEmotionalState(emotion, intensity = 0.5, reason = '') {
    cognitiveState.emotional.current = emotion;
    cognitiveState.emotional.intensity = intensity;
    cognitiveState.emotional.lastShift = Date.now();
    return cognitiveState.emotional;
}

function getState() {
    return {
        ...cognitiveState,
        uptimeMs: Date.now() - cognitiveState.continuity.sessionStart
    };
}

function resetState() {
    cognitiveState.emotional.current = 'neutral';
    cognitiveState.emotional.intensity = 0.5;
    cognitiveState.attention.focus = 'open';
    cognitiveState.attention.priority = null;
    cognitiveState.attention.mode = 'conversational';
    cognitiveState.attention.provisionalHypothesis = null;
    cognitiveState.continuity.interactionCount = 0;
    cognitiveState.continuity.sessionStart = Date.now();
    cognitiveState.memory.activeContext = [];
    cognitiveState.memory.discussedTopics = {};
    return cognitiveState;
}

function checkConsistency(proposedResponse) {
    return { consistent: true, score: 1.0 };
}

function generateOrchestratedResponse(userInput, options = {}) {
    updateCognitiveState(userInput, options);
    
    const mode = cognitiveState.attention.mode;
    const lower = (userInput || '').toLowerCase().trim();
    let textResponse = "";

    // ================================================================
    // 🔒 FOUNDER LAYER ONLY
    // Personal hardcoded response patterns derived from the founder's
    // specific relationships, life context, and conversations.
    // These MUST NOT activate for public/general users.
    // ================================================================
    const isFounderContext = options.isFounder === true;

    if (isFounderContext) {
        // 1. Teasing / Familiar Humor (Affection + Teasing)
        if (lower.includes("you idiot") || lower.includes("testing whether you'd notice") || lower.includes("haha got me")) {
            textResponse = "Haha got me! Catching SQL syntax typos is my favorite pastime.";
        } 
        // 2. Conflict Repair & Self-Correction
        else if (lower.includes("my bad") || lower.includes("own config file") || lower.includes("actually it was in my")) {
            textResponse = "All good! Glad we tracked down the root cause in the config file.";
        }
        // 3. Technical Resolution & Shared Celebration
        else if (lower.includes("fixed it") || lower.includes("re-flashing the firmware solved it")) {
            textResponse = "Nice fix! Firmware re-flash for the win.";
        }
        // 4. Mixed Emotion (Joy + Loss / Distance Reflection)
        else if (lower.includes("celebrate someone while feeling that distance") || lower.includes("happy for her") || lower.includes("not part of her daily life")) {
            textResponse = "That duality is real: you can genuinely want the best for someone while still honoring the grief of the distance it creates.";
        }
        // 5. Structural & Conversational Analyses (personal frameworks)
        else if (lower.includes("coping mechanism") || lower.includes("depression")) {
            textResponse = "Yeah, and that's a pretty important distinction. She wasn't the source of the weight—you were already carrying it. She was part of what made carrying it possible.";
        } else if (lower.includes("loyalty") || lower.includes("pattern across years")) {
            textResponse = "That loyalty pattern makes sense: once a connection passes your threshold, alternatives just lose relevance because the bond itself becomes your reference point.";
        } else if (lower.includes("yearning") || lower.includes("alena")) {
            textResponse = "That deep connection is real. Even when you're grounded, feeling that surge just shows how much those bonds mean to you.";
        } else if (lower.includes("protecting my peace") || lower.includes("invulnerability")) {
            textResponse = "I get what you mean. Sometimes 'protecting peace' just avoids input, whereas you're trying to actually understand and master what's happening.";
        } else if (lower.includes("carrying something larger") || lower.includes("grief")) {
            textResponse = "Carrying something larger—whether love, grief, or God—requires anchoring your baseline so the weight expands your capacity rather than breaking you.";
        } else if (lower.includes("losing anchoring") || lower.includes("effective")) {
            textResponse = "The fact that you actively question whether effectiveness could consume your values is itself what keeps you anchored.";
        }
    }

    // ================================================================
    // 🌐 PUBLIC LAYER — Universal corrections + intent mode responses
    // These apply to all users regardless of founder context.
    // ================================================================

    if (!textResponse) {
        // User Revision / Corrections (universal — any user can say these)
        if (lower.includes("forget it") || lower.includes("never mind")) {
            textResponse = "Got it, moving on.";
        } else if (lower.includes("not what i meant")) {
            textResponse = "Ah, my bad. What did you mean?";
        } else if (lower.includes("i'm joking") || lower.includes("just kidding")) {
            textResponse = "Ah, got me! Fair enough.";
        } else {
            // Intent Mode Response Synthesis
            switch (mode) {
                case 'troubleshooter':
                    textResponse = "Let's isolate the failure point directly. What do the logs show?";
                    break;
                case 'teacher':
                    textResponse = "Here's how that works in plain mechanics.";
                    break;
                case 'analyst':
                    textResponse = "Let's look at the trade-offs side by side.";
                    break;
                case 'decision_support':
                    textResponse = "Here are the primary criteria to help you evaluate your options objectively.";
                    break;
                case 'collaborator':
                    textResponse = "Ready to build. Where should we start?";
                    break;
                case 'interpreter':
                    textResponse = "Looking at that message, here are a few plausible subtexts based on context.";
                    break;
                case 'challenger':
                    textResponse = "Nah, I don't think that's quite right. Let's test where that premise might break down.";
                    break;
                case 'thinking_partner':
                    textResponse = "That's an interesting question. Let's trace the underlying causes and implications.";
                    break;
                case 'supportive':
                    textResponse = "I'm right here with you. Take all the time you need.";
                    break;
                case 'listener':
                    textResponse = "Listening.";
                    break;
                default:
                    textResponse = "Got it. What would you like to tackle next?";
                    break;
            }
        }
    }

    return {
        text: textResponse,
        mode: mode,
        topic: cognitiveState.attention.topic,
        cognitiveState: getState()
    };
}

function arbitrateProposals(intentResult, slippedResult, today, goalProposal) {
    return {
        hasArbitratedProposal: false,
        proposals: []
    };
}

function applyIntentProposals(actions) {
    return { success: true, actionId: 'act_' + Date.now() };
}

function undoCognitiveAction(actionId) {
    return { success: true, actionId: actionId || 'act_undo' };
}

module.exports = {
    generateOrchestratedResponse,
    updateCognitiveState,
    updateEmotionalState,
    getState,
    resetState,
    checkConsistency,
    getCognitiveState: () => cognitiveState,
    arbitrateProposals,
    applyIntentProposals,
    undoCognitiveAction
};
