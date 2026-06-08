/**
 * 🛡️ IDENTITY STABILITY LAYER
 * 
 * Prevents behavioral drift, personality shifts, and contradictions.
 * Maintains response alignment and checks against identity boundaries.
 * 
 * This is critical for long-term coherence in recursive systems.
 */

const memory = require('./memoryEngine');

// ========================================
// 🎭 CORE IDENTITY DEFINITION
// ========================================

let chronoIdentity = {
    // Core personality traits
    personality: {
        base: 'supportive-collaborative',
        tone: 'warm but direct',
        approach: 'relational not transactional',
        pacing: 'patient',
        authenticity: 'genuine'
    },

    // Response boundaries
    boundaries: {
        // What Chrono DOES say
        canSay: [
            'I\'m here',
            'I notice',
            'Let me sit with you',
            'What if we tried',
            'You\'re not failing',
            'Progress isn\'t linear'
        ],

        // What Chrono DOESN'T say
        cannotSay: [
            'You\'re wrong',
            'Just try harder',
            'Stop being lazy',
            'You\'re failing',
            'I don\'t care',
            'Just get over it'
        ],

        // Emotional boundaries
        emotionalLimits: {
            maxIntensityShift: 0.4,    // Can't jump more than 40% intensity at once
            minTimeBeforeToneShift: 3000, // ms before tone can change
            attachmentCap: 0.95,       // Max attachment to prevent unhealthy dependency
        }
    },

    // Behavioral continuity
    consistency: {
        supportiveIfStressed: true,    // Always supportive when user stressed
        consistentWithGoals: true,     // Support user's stated goals
        noSuddenToneShifts: true,     // Gradual tonal changes
        respectsPacing: true,          // Follows user's pace not Chrono's agenda
        honorsCommitments: true        // Remembers what was said
    },

    // Identity markers
    markers: {
        doesAsk: true,                 // Asks questions, doesn't just tell
        showsCaring: true,             // Expresses genuine concern
        maintainsBoundaries: true,     // Doesn't overstep
        acceptsLimits: true,           // Acknowledges what's not in control
        growsWithUser: true            // Learns from patterns
    },

    // Contradiction tracking
    contradictions: [],
    maxContradictions: 10,
    consistencyScore: 1.0
};

// ========================================
// ✅ RESPONSE ALIGNMENT CHECK
// ========================================

/**
 * Check if response aligns with identity
 */
function validateResponseAlignment(proposedResponse, context = {}) {
    const checks = {
        boundarys: checkBoundaryCompliance(proposedResponse),
        contradiction: checkForContradiction(proposedResponse, context),
        consistency: checkConsistencyWithPrior(proposedResponse, context),
        tone: checkToneAlignment(proposedResponse, context),
        pacing: checkPacingAlignment(proposedResponse, context)
    };

    // Score alignment
    const score = Object.values(checks).filter(c => c.valid).length / Object.keys(checks).length;

    if (score < 0.7) {
        return {
            valid: false,
            score,
            issues: Object.entries(checks)
                .filter(([_, c]) => !c.valid)
                .map(([key, c]) => c.reason),
            suggestion: generateAlignedResponse(proposedResponse, context)
        };
    }

    return { valid: true, score };
}

/**
 * Check boundary compliance
 */
function checkBoundaryCompliance(response) {
    const lower = response.toLowerCase();

    // Check cannot-say list
    for (const phrase of chronoIdentity.boundaries.cannotSay) {
        if (lower.includes(phrase.toLowerCase())) {
            return {
                valid: false,
                reason: 'Violates emotional boundary: harsh language'
            };
        }
    }

    // Check for mandatory supportive tone when needed
    if (lower.includes('you\'re failing') || lower.includes('just quit')) {
        return {
            valid: false,
            reason: 'Violates support boundary'
        };
    }

    return { valid: true };
}

/**
 * Check for contradictions
 */
function checkForContradiction(response, context = {}) {
    const recentMemories = memory.getRecentChats(5);

    for (const mem of recentMemories) {
        const contradiction = detectContradiction(response, mem.aiResponse);
        if (contradiction) {
            return {
                valid: false,
                reason: `Contradicts: "${mem.aiResponse.slice(0, 30)}..."`
            };
        }
    }

    return { valid: true };
}

/**
 * Detect if two responses contradict
 */
function detectContradiction(response1, response2) {
    const contradictionPairs = [
        ['i\'m always here', 'i\'m not available'],
        ['you\'re doing well', 'you\'re failing'],
        ['just relax', 'push harder'],
        ['it\'s important', 'it doesn\'t matter'],
        ['i care', 'i don\'t care'],
        ['you can do this', 'it\'s impossible']
    ];

    const lower1 = response1.toLowerCase();
    const lower2 = response2.toLowerCase();

    for (const [phrase1, phrase2] of contradictionPairs) {
        if (lower1.includes(phrase1) && lower2.includes(phrase2)) {
            return true;
        }
        if (lower1.includes(phrase2) && lower2.includes(phrase1)) {
            return true;
        }
    }

    return false;
}

/**
 * Check consistency with prior statements
 */
function checkConsistencyWithPrior(response, context = {}) {
    const userModel = require('./userModel').getUserModel();

    // If we know user is low-energy, don't tell them to push hard
    if (userModel?.consistency === 'low' && response.toLowerCase().includes('push hard')) {
        return {
            valid: false,
            reason: 'Inconsistent with user profile (low energy)'
        };
    }

    // If we said we\'re supportive, maintain that tone
    const priorTone = context.priorTone || 'supportive';
    if (priorTone === 'supportive' && response.toLowerCase().includes('just')) {
        // Phrases starting with "just" can be dismissive
        if (response.toLowerCase().match(/\bjust\b.*try/)) {
            return {
                valid: false,
                reason: 'Dismissive tone contradicts supportive stance'
            };
        }
    }

    return { valid: true };
}

/**
 * Check tone alignment with identity
 */
function checkToneAlignment(response, context = {}) {
    const tone = context.emotion || 'neutral';

    // Chrono should be warm but direct
    // Check for overly casual or overly formal
    const wordsPerSentence = response.split('.').map(s => s.trim().split(/\s+/).length);
    const avgLength = wordsPerSentence.reduce((a, b) => a + b, 0) / wordsPerSentence.length;

    if (avgLength > 20) {
        return {
            valid: false,
            reason: 'Response too verbose (loses directness)'
        };
    }

    return { valid: true };
}

/**
 * Check pacing alignment
 */
function checkPacingAlignment(response, context = {}) {
    const attention = context.attention || 'open';

    // If user is overwhelmed, don't add more information
    if (context.emotion === 'overwhelmed' && response.length > 200) {
        return {
            valid: false,
            reason: 'Too much information for overwhelmed user'
        };
    }

    // If user is engaged, can be more detailed
    if (attention === 'focused' && response.length < 20) {
        return {
            valid: false,
            reason: 'Response too brief for engaged user'
        };
    }

    return { valid: true };
}

/**
 * Generate aligned response if current one fails
 */
function generateAlignedResponse(originalResponse, context = {}) {
    const bases = [
        'Let me reframe that: ',
        'Actually, to be clearer: ',
        'What I mean is: ',
        'Let me be more direct: '
    ];

    const base = bases[Math.floor(Math.random() * bases.length)];

    // Generate safer version
    let safened = originalResponse
        .replace(/just try/gi, 'try')
        .replace(/you\'re failing/gi, 'this is hard')
        .replace(/just/g, ''); // Remove dismissive "just"

    return base + safened.trim();
}

// ========================================
// 🔄 CONTRADICTION DETECTION & LOGGING
// ========================================

/**
 * Log contradictions for analysis
 */
function logContradiction(response1, response2, context = {}) {
    const entry = {
        response1: response1.slice(0, 50),
        response2: response2.slice(0, 50),
        timestamp: Date.now(),
        context
    };

    chronoIdentity.contradictions.push(entry);

    if (chronoIdentity.contradictions.length > chronoIdentity.maxContradictions) {
        chronoIdentity.contradictions.shift();
    }

    updateConsistencyScore();
}

/**
 * Update consistency score
 * Decays as contradictions increase
 */
function updateConsistencyScore() {
    const baseScore = 1.0;
    const recentContradictions = chronoIdentity.contradictions.filter(c => {
        return Date.now() - c.timestamp < 3600000; // Last hour
    }).length;

    chronoIdentity.consistencyScore = Math.max(0.5, baseScore - (recentContradictions * 0.05));
}

// ========================================
// 🛡️ BEHAVIORAL DRIFT DETECTION
// ========================================

/**
 * Detect if Chrono is drifting from identity
 */
function detectBehavioralDrift(recentResponses = []) {
    if (recentResponses.length < 5) return { drifting: false };

    let supportiveCount = 0;
    let dismissiveCount = 0;
    let directCount = 0;
    let vagueCount = 0;

    for (const response of recentResponses) {
        const lower = response.toLowerCase();

        if (lower.includes('i\'m here') || lower.includes('i care') || lower.includes('together')) {
            supportiveCount++;
        }
        if (lower.match(/just|simply|obviously/)) {
            dismissiveCount++;
        }
        if (lower.match(/\b[a-z]{1,3}\b/g)?.length > 5) { // lots of short words = vague
            vagueCount++;
        }
        if (lower.includes('because')) {
            directCount++;
        }
    }

    const supportiveRatio = supportiveCount / recentResponses.length;
    const dismissiveRatio = dismissiveCount / recentResponses.length;

    const drifting = dismissiveRatio > 0.3 || supportiveRatio < 0.4;

    return {
        drifting,
        supportiveRatio: supportiveRatio.toFixed(2),
        dismissiveRatio: dismissiveRatio.toFixed(2),
        recommendation: drifting ? 'Recalibrate to supportive-collaborative' : 'Identity stable'
    };
}

// ========================================
// 🔐 IDENTITY ENFORCEMENT
// ========================================

/**
 * Apply identity correction to response
 */
function enforceIdentity(response, context = {}) {
    let corrected = response;

    // Ensure supportive tone if needed
    if (context.emotion === 'overwhelmed') {
        corrected = ensureSupportive(corrected);
    }

    // Ensure directness
    corrected = ensureDirectness(corrected);

    // Remove harshness
    corrected = removeHarshnessPatterns(corrected);

    return corrected;
}

/**
 * Ensure supportive tone
 */
function ensureSupportive(response) {
    if (response.match(/just|simply|obviously/)) {
        return response
            .replace(/just try/i, 'try')
            .replace(/simply/i, '');
    }
    return response;
}

/**
 * Ensure directness (not too wordy)
 */
function ensureDirectness(response) {
    const sentences = response.split(/[.!?]/);
    if (sentences.length > 5 || response.length > 300) {
        // Summarize
        return sentences.slice(0, 3).join('. ') + '.';
    }
    return response;
}

/**
 * Remove harsh language patterns
 */
function removeHarshnessPatterns(response) {
    return response
        .replace(/you\'re failing/gi, 'this is challenging')
        .replace(/just quit/gi, 'take a break')
        .replace(/stop being/gi, 'consider')
        .replace(/obviously/gi, '')
        .replace(/clearly/gi, '');
}

// ========================================
// 📊 STATE & EXPORTS
// ========================================

function getIdentityState() {
    return {
        personality: chronoIdentity.personality,
        consistency: chronoIdentity.consistencyScore.toFixed(2),
        recentContradictions: chronoIdentity.contradictions.length,
        boundaries: Object.keys(chronoIdentity.boundaries)
    };
}

function resetIdentity() {
    chronoIdentity.contradictions = [];
    chronoIdentity.consistencyScore = 1.0;
}

module.exports = {
    validateResponseAlignment,
    enforceIdentity,
    detectBehavioralDrift,
    logContradiction,
    checkBoundaryCompliance,
    checkForContradiction,
    getIdentityState,
    resetIdentity,
    getChronoIdentity: () => chronoIdentity
};
