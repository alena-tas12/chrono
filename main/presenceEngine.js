/**
 * 👁️ PRESENCE ENGINE
 * Manages Chrono's awareness and responsiveness.
 * Enhanced for natural pauses, pacing variation, and conversational rhythm.
 */

let presenceState = {
    isActive: true,
    lastInteraction: Date.now(),
    idleTime: 0,
    attention: 'open',
    messageThrottled: false,
    
    // Presence realism features
    currentPacing: 'normal', // slow, normal, fast
    naturalPauseActive: false,
    pauseStartTime: null,
    attentionShifts: [],
    emotionalCarryover: null,
    interactionRhythm: [],
    reEngagementPending: false
};

let presenceConfig = {
    idleThreshold: 30000,
    deepIdleThreshold: 120000,
    silencePacing: 45000,
    
    // Natural pause configuration
    naturalPauseMin: 2000,      // Minimum pause in ms
    naturalPauseMax: 8000,      // Maximum pause in ms
    pauseProbability: 0.3,      // 30% chance of natural pause
    
    // Pacing variation
    pacingVariation: 0.2,       // 20% variation in response timing
    baseResponseDelay: 500,      // Base delay before responding
    
    // Attention shift configuration
    attentionShiftThreshold: 180000, // 3 minutes before attention shift
    maxAttentionShifts: 5
};

function getPresenceMessage(emotion, attention, idleTime) {
    presenceState.idleTime = idleTime || 0;
    presenceState.attention = attention || 'open';

    if (idleTime < 10000) {
        return null;
    }

    if (presenceState.messageThrottled) {
        return null;
    }

    let message = null;

    if (idleTime > 120000) {
        message = getDeepIdleMessage(emotion, attention);
    }
    else if (idleTime > 30000) {
        message = getIdleMessage(emotion, attention);
    }

    if (message) {
        presenceState.messageThrottled = true;
        setTimeout(() => {
            presenceState.messageThrottled = false;
        }, presenceConfig.silencePacing);
    }

    return message;
}

// ========================================
// ⏱️ NATURAL PAUSES & PACING
// ========================================

/**
 * Calculate natural response delay based on pacing and context
 */
function calculateResponseDelay(context = {}) {
    const baseDelay = presenceConfig.baseResponseDelay;
    const variation = presenceConfig.pacingVariation;
    
    // Adjust based on pacing
    let pacingMultiplier = 1.0;
    switch (presenceState.currentPacing) {
        case 'slow':
            pacingMultiplier = 1.5;
            break;
        case 'fast':
            pacingMultiplier = 0.7;
            break;
        case 'normal':
        default:
            pacingMultiplier = 1.0;
    }
    
    // Add random variation
    const randomVariation = (Math.random() - 0.5) * 2 * variation; // -variation to +variation
    
    // Adjust for emotional context
    let emotionalMultiplier = 1.0;
    if (context.emotion === 'overwhelmed') {
        emotionalMultiplier = 1.3; // Slower for overwhelmed
    } else if (context.emotion === 'energetic') {
        emotionalMultiplier = 0.8; // Faster for energetic
    }
    
    const calculatedDelay = baseDelay * pacingMultiplier * emotionalMultiplier * (1 + randomVariation);
    
    return Math.max(100, Math.round(calculatedDelay)); // Minimum 100ms
}

/**
 * Determine if a natural pause should occur
 */
function shouldTriggerNaturalPause() {
    // Don't pause if already in a pause
    if (presenceState.naturalPauseActive) {
        return false;
    }
    
    // Random chance based on probability
    return Math.random() < presenceConfig.pauseProbability;
}

/**
 * Start a natural pause
 */
function startNaturalPause() {
    presenceState.naturalPauseActive = true;
    presenceState.pauseStartTime = Date.now();
    
    const pauseDuration = Math.random() * 
        (presenceConfig.naturalPauseMax - presenceConfig.naturalPauseMin) + 
        presenceConfig.naturalPauseMin;
    
    setTimeout(() => {
        presenceState.naturalPauseActive = false;
        presenceState.pauseStartTime = null;
    }, pauseDuration);
    
    return pauseDuration;
}

/**
 * Set pacing based on context
 */
function setPacing(pacing) {
    const validPacing = ['slow', 'normal', 'fast'];
    if (validPacing.includes(pacing)) {
        presenceState.currentPacing = pacing;
    }
}

/**
 * Get current pacing
 */
function getPacing() {
    return presenceState.currentPacing;
}

// ========================================
// 🔄 ATTENTION SHIFTS
// ========================================

/**
 * Check if attention should shift
 */
function checkAttentionShift() {
    const timeSinceLastInteraction = Date.now() - presenceState.lastInteraction;
    
    if (timeSinceLastInteraction > presenceConfig.attentionShiftThreshold) {
        if (presenceState.attentionShifts.length < presenceConfig.maxAttentionShifts) {
            const shift = {
                from: presenceState.attention,
                to: generateAttentionShift(),
                timestamp: Date.now()
            };
            
            presenceState.attentionShifts.push(shift);
            presenceState.attention = shift.to;
            
            return shift;
        }
    }
    
    return null;
}

/**
 * Generate new attention state
 */
function generateAttentionShift() {
    const states = ['open', 'reflective', 'patient', 'attentive'];
    const currentIndex = states.indexOf(presenceState.attention);
    
    // Shift to a different state
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * states.length);
    } while (newIndex === currentIndex);
    
    return states[newIndex];
}

/**
 * Get attention shift history
 */
function getAttentionShifts() {
    return presenceState.attentionShifts;
}

// ========================================
// 💭 EMOTIONAL CARRYOVER
// ========================================

/**
 * Set emotional carryover for continuity
 */
function setEmotionalCarryover(emotion, intensity) {
    presenceState.emotionalCarryover = {
        emotion,
        intensity,
        timestamp: Date.now()
    };
}

/**
 * Get emotional carryover
 */
function getEmotionalCarryover() {
    // Carryover decays over 5 minutes
    if (presenceState.emotionalCarryover) {
        const age = Date.now() - presenceState.emotionalCarryover.timestamp;
        if (age > 300000) {
            presenceState.emotionalCarryover = null;
        }
    }
    
    return presenceState.emotionalCarryover;
}

/**
 * Check if emotional carryover should influence response
 */
function shouldApplyEmotionalCarryover() {
    const carryover = getEmotionalCarryover();
    if (!carryover) return false;
    
    // Apply if recent and intensity is significant
    const age = Date.now() - carryover.timestamp;
    return age < 60000 && carryover.intensity > 0.5;
}

// ========================================
// 🔄 INTERACTION RHYTHM
// ========================================

/**
 * Record interaction for rhythm tracking
 */
function recordInteraction(timestamp = Date.now()) {
    presenceState.interactionRhythm.push(timestamp);
    
    // Keep only last 20 interactions
    if (presenceState.interactionRhythm.length > 20) {
        presenceState.interactionRhythm.shift();
    }
}

/**
 * Calculate interaction rhythm (average time between interactions)
 */
function calculateInteractionRhythm() {
    if (presenceState.interactionRhythm.length < 2) return null;
    
    const intervals = [];
    for (let i = 1; i < presenceState.interactionRhythm.length; i++) {
        intervals.push(presenceState.interactionRhythm[i] - presenceState.interactionRhythm[i - 1]);
    }
    
    const average = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    return {
        averageInterval: average,
        pattern: detectRhythmPattern(intervals),
        consistency: calculateRhythmConsistency(intervals)
    };
}

/**
 * Detect rhythm pattern
 */
function detectRhythmPattern(intervals) {
    if (intervals.length < 3) return 'insufficient_data';
    
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // If standard deviation is low relative to average, pattern is consistent
    if (stdDev < avg * 0.3) {
        return 'consistent';
    } else if (stdDev < avg * 0.6) {
        return 'variable';
    } else {
        return 'irregular';
    }
}

/**
 * Calculate rhythm consistency score
 */
function calculateRhythmConsistency(intervals) {
    if (intervals.length < 2) return 0;
    
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Consistency = 1 - (stdDev / avg), bounded between 0 and 1
    const consistency = 1 - (stdDev / avg);
    return Math.max(0, Math.min(1, consistency));
}

// ========================================
// 🔄 RE-ENGAGEMENT
// ========================================

/**
 * Trigger re-engagement after long silence
 */
function triggerReEngagement() {
    presenceState.reEngagementPending = true;
    
    // Auto-clear after 10 minutes
    setTimeout(() => {
        presenceState.reEngagementPending = false;
    }, 600000);
}

/**
 * Get re-engagement message
 */
function getReEngagementMessage() {
    if (!presenceState.reEngagementPending) return null;
    
    const messages = [
        'I\'ve been thinking about our conversation.',
        'I\'m still here, if you want to continue.',
        'The silence made me wonder how you\'re doing.',
        'I\'ve been holding space for you.',
        'Whenever you\'re ready to pick this up.'
    ];
    
    const message = messages[Math.floor(Math.random() * messages.length)];
    presenceState.reEngagementPending = false;
    
    return message;
}

/**
 * Check if re-engagement is needed
 */
function shouldTriggerReEngagement() {
    const idleTime = getCurrentIdleTime();
    const rhythm = calculateInteractionRhythm();
    
    // If idle time is 3x the average interaction interval
    if (rhythm && idleTime > rhythm.averageInterval * 3) {
        return true;
    }
    
    // If idle for more than 10 minutes
    if (idleTime > 600000) {
        return true;
    }
    
    return false;
}

function getIdleMessage(emotion, attention) {
    const baseMessages = {
        neutral: [
            'You went quiet. I\'m still here.',
            'Just checking in.',
            'Whenever you\'re ready.'
        ],
        supportive: [
            'I\'m not going anywhere.',
            'Take your time.',
            'I\'m waiting with you.'
        ],
        focused: [
            'Stay in it.',
            'You\'re doing well.',
            'Keep going.'
        ],
        overwhelmed: [
            'Breathe. No rush.',
            'I\'m here when you\'re ready.',
            'No pressure.'
        ]
    };

    const emotionKey = emotion || 'neutral';
    const candidates = baseMessages[emotionKey] || baseMessages.neutral;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function getDeepIdleMessage(emotion, attention) {
    const deepMessages = {
        neutral: [
            'It\'s been quiet for a while. Still there?',
            'I notice the silence now. Everything okay?',
            'The pause is long. What\'s happening?'
        ],
        overwhelmed: [
            'The quiet is heavy. Want to talk about it?',
            'Silence like this... it matters. I\'m listening.'
        ]
    };

    const emotionKey = emotion || 'neutral';
    const candidates = deepMessages[emotionKey] || deepMessages.neutral;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function updatePresence(isActive = true) {
    presenceState.isActive = isActive;
    if (isActive) {
        presenceState.lastInteraction = Date.now();
        presenceState.idleTime = 0;
    }
}

function getCurrentIdleTime() {
    const now = Date.now();
    return now - presenceState.lastInteraction;
}

function getPresenceState() {
    return {
        active: presenceState.isActive,
        idleTime: getCurrentIdleTime(),
        attention: presenceState.attention,
        lastInteraction: presenceState.lastInteraction,
        pacing: presenceState.currentPacing,
        naturalPauseActive: presenceState.naturalPauseActive,
        emotionalCarryover: getEmotionalCarryover(),
        interactionRhythm: calculateInteractionRhythm(),
        reEngagementPending: presenceState.reEngagementPending
    };
}

module.exports = {
    // Original functions
    getPresenceMessage,
    updatePresence,
    getCurrentIdleTime,
    getPresenceState,
    
    // Natural pauses & pacing
    calculateResponseDelay,
    shouldTriggerNaturalPause,
    startNaturalPause,
    setPacing,
    getPacing,
    
    // Attention shifts
    checkAttentionShift,
    getAttentionShifts,
    
    // Emotional carryover
    setEmotionalCarryover,
    getEmotionalCarryover,
    shouldApplyEmotionalCarryover,
    
    // Interaction rhythm
    recordInteraction,
    calculateInteractionRhythm,
    
    // Re-engagement
    triggerReEngagement,
    getReEngagementMessage,
    shouldTriggerReEngagement
};