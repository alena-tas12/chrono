/**
 * 🧠 CHRONO COGNITIVE OS - ADAPTIVE INTERACTION LAYER
 * 
 * Architecture:
 *                    CHRONO
 *                       │
 *             ┌─────────┴─────────┐
 *             │                   │
 *       DETERMINISTIC        MODEL LAYER
 *          KERNEL                 │
 *             │            ┌──────┴───────┐
 *             │            │              │
 *             │       COMPREHENSION    GENERATION
 *             │            │              │
 *             └────────────┼──────────────┘
 *                          │
 *                 ADAPTIVE INTERACTION LAYER
 *                          │
 *        ┌─────────────────┼─────────────────┐
 *        │                 │                 │
 *   User Feedback     Conversation       Corrections
 *        │             Trajectory             │
 *        └─────────────────┼─────────────────┘
 *                          │
 *                    USER MODEL
 *                          │
 *          ┌───────────────┼────────────────┐
 *          │               │                │
 *       Preferences      Pace          Interaction
 *       & Habits        & Depth         Patterns
 *       (Explicit vs Inferred with Confidence/Evidence)
 *          │               │                │
 *          └───────────────┼────────────────┘
 *                          │
 *                    NEXT RESPONSE
 *
 * 5 CORE COMPONENTS:
 * 1. Preference Inference (Explicit vs. Inferred with confidence & evidence counts)
 * 2. Interaction Pattern Detection (Direct/Concise vs. Deep/Explanatory vs. Fragmented Think-Aloud)
 * 3. Feedback Interpretation (Acceptance, Rejection, Correction, Pacing adjustment)
 * 4. Self-Correction Loop ("A correction is evidence, not absolute truth")
 * 5. Calibration Memory (User-scoped, persistent, zero cross-user leakage)
 */

const mainDb = require('./main_db');
const userModel = require('./userModel');

// ============================================================================
// 1. PREFERENCE INFERENCE ENGINE
// ============================================================================
class PreferenceInference {
    static recordExplicit(userId, key, value) {
        mainDb.setUserInteractionPref(userId, key, value, 'explicit', 1.0, 1, { source: 'user_explicit' });
        return { key, value, type: 'explicit', confidence: 1.0 };
    }

    static recordInferred(userId, key, value, evidenceIncrement = 1, metadata = {}) {
        const existing = mainDb.getUserInteractionPref(userId, key);
        const currentCount = existing ? (existing.evidence_count || 1) : 0;
        const newCount = currentCount + evidenceIncrement;
        
        // Confidence asymptotically increases with evidence: 0.5 + (0.45 * (1 - 1/(1 + newCount/5)))
        const confidence = Math.min(0.95, parseFloat((0.55 + 0.40 * (1 - Math.exp(-newCount / 8))).toFixed(2)));

        mainDb.setUserInteractionPref(userId, key, value, 'inferred', confidence, evidenceIncrement, {
            ...metadata,
            last_confirmed: Date.now()
        });

        return { key, value, type: 'inferred', confidence, evidence_count: newCount };
    }

    static getEffective(userId, key, sessionOverride = null) {
        if (sessionOverride) {
            return {
                value: sessionOverride,
                type: 'session_override',
                confidence: 1.0
            };
        }

        const pref = mainDb.getUserInteractionPref(userId, key);
        if (pref) return pref;

        // Default fallbacks
        if (key === 'response_depth') return { value: 'BALANCED', type: 'default', confidence: 0.5 };
        if (key === 'pacing_style') return { value: 'adaptive', type: 'default', confidence: 0.5 };
        if (key === 'externalization_tolerance') return { value: 'moderate', type: 'default', confidence: 0.5 };
        return null;
    }
}

// ============================================================================
// 2. INTERACTION PATTERN DETECTION
// ============================================================================
class InteractionPatternDetection {
    static analyzeInput(userId, input, history = []) {
        const text = (input || '').toLowerCase().trim();
        const words = text.split(/\s+/).filter(Boolean);
        const length = words.length;

        // 1. Direct / Concise Signals
        const directPhrases = ['just tell me', 'just give me the answer', 'short', 'brief', 'quick update', 'don\'t explain all of that', 'bullet points'];
        const isDirect = directPhrases.some(p => text.includes(p)) || (length < 6 && !text.includes('why') && !text.includes('how'));

        // 2. Deep / Explanatory Signals
        const deepPhrases = ['explain why', 'go deep', 'in detail', 'how does this work', 'why does', 'architecture', 'crispr', 'mechanism', 'underlying principle'];
        const isDeep = deepPhrases.some(p => text.includes(p)) || length > 35;

        // 3. Fragmented Externalization Signals (Stream-of-consciousness think-aloud)
        const thinkAloudPhrases = ['wait...', 'actually...', 'no, hold on', 'what i meant was', 'let me think', 'never mind actually', 'uhm', 'so basically... wait'];
        const isFragmented = thinkAloudPhrases.some(p => text.includes(p)) || (text.includes('...') && (text.includes('wait') || text.includes('actually')));

        if (isDirect) {
            PreferenceInference.recordInferred(userId, 'response_depth', 'CONCISE', 1, { pattern: 'direct_concise' });
            PreferenceInference.recordInferred(userId, 'pacing_style', 'direct', 1);
            return 'direct_concise';
        }

        if (isDeep) {
            PreferenceInference.recordInferred(userId, 'response_depth', 'DEEP', 1, { pattern: 'deep_explanatory' });
            PreferenceInference.recordInferred(userId, 'pacing_style', 'explanatory', 1);
            return 'deep_explanatory';
        }

        if (isFragmented) {
            PreferenceInference.recordInferred(userId, 'externalization_tolerance', 'high', 1, { pattern: 'fragmented_think_aloud' });
            return 'fragmented_think_aloud';
        }

        return 'balanced';
    }
}

// ============================================================================
// 3. FEEDBACK INTERPRETATION & REACTION DISCOVERY
// ============================================================================
class FeedbackInterpretation {
    static interpret(input, previousResponse = '') {
        const text = (input || '').toLowerCase().trim();

        if (text.startsWith('no,') || text.includes('that\'s wrong') || text.includes('not what i meant') || text.includes('incorrect')) {
            return {
                type: 'correction',
                signal: 'reconsider_context',
                strength: 'high'
            };
        }

        if (text.includes('too long') || text.includes('too much text') || text.includes('make it shorter')) {
            return {
                type: 'pacing_correction',
                direction: 'CONCISE',
                strength: 'high'
            };
        }

        if (text.includes('go deeper') || text.includes('explain more') || text.includes('elaborate')) {
            return {
                type: 'pacing_correction',
                direction: 'DEEP',
                strength: 'high'
            };
        }

        if (text === 'thanks' || text === 'perfect' || text === 'got it' || text === 'nice' || text === 'aight sounds good' || text === 'k') {
            return {
                type: 'acceptance',
                strength: 'medium'
            };
        }

        return {
            type: 'neutral_continuation',
            strength: 'low'
        };
    }
}

// ============================================================================
// 4. SELF-CORRECTION LOOP (Evidence-based calibration, not blind rewriting)
// ============================================================================
class SelfCorrectionLoop {
    static process(userId, feedback, currentContext = {}) {
        if (!feedback) return null;

        // Invariant: "A correction is evidence, not absolute truth."
        if (feedback.type === 'correction') {
            PreferenceInference.recordInferred(userId, 'correction_sensitivity', 'high', 1, {
                note: 'User rejected recent interpretation; adjust retrieval weighting without hallucinating absolute truth.'
            });
            return {
                action: 'reconsider_context',
                epistemicNotice: 'User indicated mismatch with interpretation. Re-evaluating context.'
            };
        }

        if (feedback.type === 'pacing_correction') {
            PreferenceInference.recordInferred(userId, 'response_depth', feedback.direction, 2, {
                explicit_correction: true
            });
            return {
                action: 'calibrate_depth',
                newDepth: feedback.direction
            };
        }

        return null;
    }
}

// ============================================================================
// 5. CALIBRATION MEMORY & ADAPTIVE PROFILE
// ============================================================================
const PROFILES = {
    architect: {
        id: 'architect',
        label: 'Deep / Systems',
        description: 'Layered, analytical, continuity architecture',
        density: 'layered',
        tone: 'analytical',
        executive: 'synthesis',
        maxSentences: 4,
        maxChars: 420
    },
    companion: {
        id: 'companion',
        label: 'Warm / Guided',
        description: 'Clear, gentle, practical pacing — lower cognitive load',
        density: 'short',
        tone: 'soft',
        executive: 'scaffolding',
        maxSentences: 2,
        maxChars: 200
    },
    adaptive: {
        id: 'adaptive',
        label: 'Adaptive',
        description: 'Infers pacing and calibration from how you interact',
        density: 'medium',
        tone: 'grounding',
        executive: 'scaffolding',
        maxSentences: 3,
        maxChars: 280
    }
};

let activeProfileId = 'adaptive';
let sessionModifiers = { overwhelm: 0.0, drift: false, calendarFocus: false };

function getActiveProfile(userId) {
    const uId = userId || mainDb.getActiveUserId() || 'local_user';
    const depthPref = PreferenceInference.getEffective(uId, 'response_depth');

    let profile = { ...PROFILES.adaptive };
    if (depthPref && depthPref.value === 'DEEP') {
        profile = { ...PROFILES.architect };
    } else if (depthPref && depthPref.value === 'CONCISE') {
        profile = { ...PROFILES.companion, maxChars: 180, maxSentences: 2 };
    }

    return profile;
}

function processInteraction(input, metadata = {}, response = '', cognitiveState = {}, userId = null) {
    const uId = userId || mainDb.getActiveUserId() || 'local_user';

    // 1. Detect Interaction Pattern
    const pattern = InteractionPatternDetection.analyzeInput(uId, input);

    // 2. Feedback Interpretation
    const feedback = FeedbackInterpretation.interpret(input);

    // 3. Self-Correction Loop
    SelfCorrectionLoop.process(uId, feedback);

    // 4. Response Adaptation
    const profile = getActiveProfile(uId);
    let adapted = response;

    return {
        response: adapted,
        pattern,
        feedback,
        adaptation: {
            activeProfile: profile.id,
            profile,
            userPreferences: mainDb.getUserInteractionPrefs(uId)
        }
    };
}

module.exports = {
    PreferenceInference,
    InteractionPatternDetection,
    FeedbackInterpretation,
    SelfCorrectionLoop,
    PROFILES,
    getActiveProfile,
    processInteraction,
    sessionModifiers
};

