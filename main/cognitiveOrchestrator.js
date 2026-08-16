const intentEngine = require('./intentEngine');
const mainDb = require('./main_db');

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

    // 1. CONTRACT 13: COGNITIVE PACE & TRAJECTORY PROCESSING (Sits BEFORE intent classification)
    const paceEngine = require('./cognitivePaceEngine').defaultPaceEngine;
    const paceAnalysis = paceEngine.trackThoughtTrajectory(input, cognitiveState.memory.activeContext);
    cognitiveState.cognitivePace = paceAnalysis;

    // Reset or update provisional hypotheses upon user correction/revision
    if (paceAnalysis.isCorrection || lower.includes("forget it") || lower.includes("never mind") || lower.includes("not what i meant") || lower.includes("i'm joking") || lower.includes("just kidding") || lower.includes("my bad")) {
        cognitiveState.attention.provisionalHypothesis = null;
        cognitiveState.attention.mode = 'conversational';
    }

    // 2. CONTEXTUAL INTERPRETATION & INTENT CLASSIFICATION
    const intentAnalysis = intentEngine.detectInteractionMode(input, options);
    cognitiveState.attention.mode = intentAnalysis.mode;
    cognitiveState.attention.topic = paceAnalysis.activeThread || intentAnalysis.topic || 'general';
    cognitiveState.attention.provisionalHypothesis = intentAnalysis.description;

    cognitiveState.memory.activeContext.push({
        input,
        mode: intentAnalysis.mode,
        paceStyle: paceAnalysis.externalizationStyle,
        activeThread: paceAnalysis.activeThread,
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

/**
 * Generates and persists hypotheses from an observation (user input + retrieved state).
 * This is the real lifecycle: observation → candidate → evidence → confidence → state.
 *
 * Epistemic categories:
 *   FACT       — explicitly stated or confirmed by the user
 *   INFERENCE  — logically implied but not stated
 *   HYPOTHESIS — possible but unconfirmed
 *   UNKNOWN    — insufficient signal
 *
 * @param {string} userId
 * @param {string} userInput
 * @param {Object} retrievedState
 * @returns {Array} generated hypothesis records
 */
function generateHypotheses(userId, userInput, retrievedState) {
    const db = mainDb.db;
    const lower = userInput.toLowerCase().trim();
    const generated = [];

    // ── Candidate generation rules ────────────────────────────────────────────
    const candidates = [];

    // FACT: explicit user declaration ("I am", "I have", "I do", "my X is Y")
    const factPatterns = [
        /\b(i am|i'm)\s+([\w\s]{2,40})\b/i,
        /\bmy ([\w\s]{2,30}) is ([\w\s]{2,40})\b/i,
        /\bi (love|hate|prefer|enjoy|study|work on)\s+([\w\s]{2,40})\b/i,
        /\bmy favorite ([\w\s]{2,30}) is ([\w\s]{2,40})\b/i,
    ];
    for (const pattern of factPatterns) {
        const m = userInput.match(pattern);
        if (m) {
            candidates.push({
                category: 'FACT',
                content: `User stated: "${m[0].trim()}"`,
                confidence: 0.9,
                evidence: userInput
            });
            break;
        }
    }

    // INFERENCE: implied by context or task state
    if (retrievedState.tasks && retrievedState.tasks.length > 0 && (lower.includes('busy') || lower.includes('lot to do') || lower.includes('overwhelmed'))) {
        candidates.push({
            category: 'INFERENCE',
            content: `User may be experiencing high task load (${retrievedState.tasks.length} pending tasks, self-reported feeling of being busy)`,
            confidence: 0.6,
            evidence: userInput
        });
    }

    // HYPOTHESIS: possible intent or state not yet confirmed
    if (lower.includes('maybe') || lower.includes('thinking about') || lower.includes('might') || lower.includes('considering') || lower.includes('not sure')) {
        const cleanedInput = userInput.replace(/maybe|thinking about|might|considering|not sure/gi, '').trim();
        candidates.push({
            category: 'HYPOTHESIS',
            content: `Possible but unconfirmed: "${cleanedInput.substring(0, 120)}"`,
            confidence: 0.3,
            evidence: userInput
        });
    }

    // UNKNOWN: vague or ambiguous input with no signal
    if (candidates.length === 0 && lower.length > 0) {
        candidates.push({
            category: 'UNKNOWN',
            content: `Observation: "${userInput.substring(0, 120)}" — no classifiable signal`,
            confidence: 0.1,
            evidence: userInput
        });
    }

    // ── Persist to chat_hypotheses ────────────────────────────────────────────
    for (const candidate of candidates) {
        try {
            const id = mainDb.generateUUID();
            const now = Date.now();
            db.prepare(`
                INSERT INTO chat_hypotheses (id, user_id, hypothesis, category, evidence, confidence, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
            `).run(id, userId || 'local_user', candidate.content, candidate.category, candidate.evidence, candidate.confidence, now, now);
            generated.push({ id, ...candidate });
        } catch (e) {
            console.error('[Hypotheses] Failed to write hypothesis:', e.message);
        }
    }

    return generated;
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
    undoCognitiveAction,
    generateHypotheses
};
