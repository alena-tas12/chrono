const mainDb = require('./main_db');
const emotionVocabulary = require('./emotionVocabulary');

/**
 * 🎯 INTENT ENGINE - ADAPTIVE INTENT CLASSIFIER
 * 
 * Classifies user input into adaptive interaction modes based on what the user is trying to accomplish.
 * Decouples emotional context from response mode: intent determines action, emotion modulates tone.
 */

function detectInteractionMode(input, options = {}) {
    const lower = (input || '').toLowerCase().trim();

    // Always detect emotional vocabulary — emotion is a dimension of ANY interaction mode,
    // not a separate mode. A debugging session can be angry. A philosophy discussion can be tender.
    const emotion = emotionVocabulary.detect(input);

    // 1. Critical Challenger / Debate
    if (/\b(debate|challenge|disagree|test this|critique|disprove|argument)\b/i.test(lower)) {
        const verifyChallengeNeeded = options.allowChallenge !== false && (lower.includes('debate') || lower.includes('critique') || lower.includes('test'));
        if (verifyChallengeNeeded) {
            return { mode: 'challenger', verifiedChallenge: true, description: 'Rigorously stress-test ideas when verified as appropriate.', emotion };
        }
    }

    // 2. Technical Debugging / Troubleshooting (even if emotional/frustrated)
    // NOTE: Personal-context keywords (router, ping, cortisol, etc.) are Founder Layer only
    if (/\b(why is|not working|error|bug|fix|failed|crash|exception|traceback|issue|broken|doesn't work)\b/i.test(lower)) {
        return { mode: 'troubleshooter', description: 'Technical diagnostic and troubleshooting assistance.', emotion };
    }

    // 3. Engineering / Coding Collaboration
    if (/\b(build|code|implement|refactor|script|develop|endpoint|express|rest api)\b/i.test(lower)) {
        return { mode: 'collaborator', description: 'Co-creative engineering and technical production.', emotion };
    }

    // 4. Structural Analyst / Mechanism Breakdown (e.g. coping mechanism, cause, pattern, pros/cons)
    if (/\b(compare|versus|vs|difference between|pros and cons|trade-offs|architecture|benchmark|differ structurally|pattern across|what generates|coping mechanism|root cause)\b/i.test(lower)) {
        return { mode: 'analyst', description: 'Objective comparative structural analysis.', emotion };
    }

    // 5. Thinking Partner (Deep System / Philosophical / Existential Exploration)
    // NOTE: invulnerability, anchoring, yearning, loyalty — Founder Layer personal frameworks, not generic keywords
    if (/\b(think through|explore|wonder|philosophy|meaning|why do|incentivize|analyze how|governance|faith|existential|conscience|responsibility|how do i remain|what does it mean)\b/i.test(lower)) {
        return { mode: 'thinking_partner', description: 'Collaborative meta-cognitive exploration.', emotion };
    }

    // 6. Explicit Personal Support Request (Only when user is explicitly seeking emotional support/grounding)
    if (/\b(really struggling|having a bad time|feeling miserable|need help coping|grief|heart|broke my|shattering|sad)\b/i.test(lower)) {
        return { mode: 'supportive', emotionalFramingRequired: true, description: 'Contextual emotional support tailored to user need.', emotion };
    }

    // 7. Teacher / Explainer
    if (/\b(explain|what is|how does|teach me|define|overview of|concept)\b/i.test(lower)) {
        return { mode: 'teacher', description: 'Clear, concept-first educational explanation.', emotion };
    }

    // 8. Decision Support
    if (/\b(should i|which one|recommend|choose|buy|select|decision|option|gcp|deploy)\b/i.test(lower)) {
        return { mode: 'decision_support', description: 'Criteria-based neutral decision analysis.', emotion };
    }

    // 9. Interpreter (Message / Communication Subtext Analysis)
    if (/\b(message|texted|interpret|subtext|text from|what did|what are the possible|reply)\b/i.test(lower)) {
        return { mode: 'interpreter', description: 'Contextual message interpretation and evidence review.', emotion };
    }

    // 10. Pure Listening
    if (/\b(just listen|let me vent|hear me out)\b/i.test(lower)) {
        return { mode: 'listener', description: 'Unobtrusive, non-judgmental listening.', emotion };
    }

    // Default: Conversational / Natural Direct
    return { mode: 'conversational', description: 'Direct, natural, grounded conversation.', emotion };
}

function parseIntent(input, dateKey) {
    const modeInfo = detectInteractionMode(input);
    return {
        mode: modeInfo.mode,
        description: modeInfo.description,
        hasProposal: false,
        proposal: null,
        // Emotional vocabulary dimension — labels, not behavioral prescriptions
        emotion: modeInfo.emotion
    };
}

module.exports = {
    parseIntent,
    detectInteractionMode
};
