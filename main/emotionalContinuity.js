/**
 * 💔 EMOTIONAL CONTINUITY ENGINE
 * 
 * Maintains emotional consistency across conversations.
 * Prevents tonal resets, ensures emotional follow-through,
 * and manages attachment continuity.
 * 
 * This is what separates a chatbot from presence simulation.
 */

const memory = require('./memoryEngine');

// ========================================
// 📊 EMOTIONAL STATE TRACKING
// ========================================

let emotionalState = {
    // Current emotional position
    current: 'neutral',
    intensity: 0.5,
    stability: 0.8,

    // Emotional memory (trajectory)
    history: [],
    maxHistory: 50,

    // Transition rules
    lastTransition: Date.now(),
    transitionCooldown: 5000, // ms before emotion can shift significantly

    // Attachment continuity
    attachment: {
        level: 0.5,           // 0-1, how connected is Chrono to this user
        consistency: 0.7,     // 0-1, how consistent is Chrono being
        recentEmotion: null,  // what was the emotional context last session
        abandonedThemes: []   // themes that went unresolved
    }
};

const emotionMap = {
    neutral: { valence: 0, arousal: 0.3, duration: 'stable' },
    supportive: { valence: 0.6, arousal: 0.4, duration: 'medium' },
    encouraging: { valence: 0.7, arousal: 0.5, duration: 'medium' },
    calm: { valence: 0.4, arousal: 0.2, duration: 'stable' },
    energetic: { valence: 0.8, arousal: 0.8, duration: 'short' },
    concerned: { valence: 0.2, arousal: 0.6, duration: 'medium' },
    overwhelmed: { valence: -0.5, arousal: 0.9, duration: 'short' },
    frustrated: { valence: -0.3, arousal: 0.7, duration: 'medium' },
    tired: { valence: -0.2, arousal: 0.2, duration: 'long' },
    sad: { valence: -0.6, arousal: 0.3, duration: 'long' }
};

// ========================================
// 🎭 EMOTIONAL TRANSITIONS
// ========================================

/**
 * Get emotional response for current state
 * Maintains continuity and natural pacing
 */
function getEmotionalResponse(detectedEmotion, context = {}) {
    const now = Date.now();
    const timeSinceLastTransition = now - emotionalState.lastTransition;

    // Check if emotion transition is valid
    const canTransition = canEmotionTransition(
        emotionalState.current,
        detectedEmotion,
        timeSinceLastTransition
    );

    if (!canTransition) {
        // Hold current emotional state if transition too soon
        return generateEmotionalMessage(emotionalState.current, 'maintain');
    }

    // Record transition
    recordEmotionalTransition(emotionalState.current, detectedEmotion);
    emotionalState.current = detectedEmotion;
    emotionalState.lastTransition = now;

    return generateEmotionalMessage(detectedEmotion, 'transition');
}

/**
 * Determine if emotion can transition
 * Prevents emotional whiplash
 */
function canEmotionTransition(currentEmotion, targetEmotion, timeSince) {
    // Can't transition if same emotion
    if (currentEmotion === targetEmotion) {
        return true;
    }

    // Get emotional properties
    const currentProps = emotionMap[currentEmotion] || emotionMap.neutral;
    const targetProps = emotionMap[targetEmotion] || emotionMap.neutral;

    // Calculate emotional distance
    const valenceDiff = Math.abs(currentProps.valence - targetProps.valence);
    const arousalDiff = Math.abs(currentProps.arousal - targetProps.arousal);
    const distance = valenceDiff + arousalDiff;

    // Large jumps require more time
    if (distance > 1.0 && timeSince < 10000) return false;
    if (distance > 0.5 && timeSince < 5000) return false;

    return true;
}

/**
 * Record emotional transition in history
 */
function recordEmotionalTransition(from, to) {
    const entry = {
        from,
        to,
        timestamp: Date.now(),
        intensity: emotionalState.intensity
    };

    emotionalState.history.push(entry);

    if (emotionalState.history.length > emotionalState.maxHistory) {
        emotionalState.history.shift();
    }

    // Update attachment if strong emotion
    const toProps = emotionMap[to];
    if (toProps && Math.abs(toProps.valence) > 0.4) {
        emotionalState.attachment.level = Math.min(1, emotionalState.attachment.level + 0.05);
    }
}

/**
 * Update emotional intensity
 * Strong input increases intensity, decay over time
 */
function updateEmotionalIntensity(input, baseIntensity = 0.5) {
    const now = Date.now();
    const timeSinceTransition = now - emotionalState.lastTransition;

    // Decay intensity over time
    let intensity = baseIntensity * (1 - (timeSinceTransition / 30000)); // decay over 30 seconds

    // Cap at current intensity (don't decrease suddenly)
    intensity = Math.max(intensity, emotionalState.intensity * 0.9);

    emotionalState.intensity = Math.min(1, Math.max(0.1, intensity));
    return emotionalState.intensity;
}

// ========================================
// 📝 EMOTIONAL MESSAGE GENERATION
// ========================================

/**
 * Generate response based on emotion
 */
function generateEmotionalMessage(emotion, transitionType = 'maintain') {
    const responses = {
        neutral: {
            maintain: [
                'I\'m listening.',
                'Go on.',
                'Tell me more.'
            ],
            transition: [
                'Let me check in with you.',
                'How are you really?',
                'I\'m here.'
            ]
        },
        supportive: {
            maintain: [
                'I\'m with you on this.',
                'You\'re not alone.',
                'Let\'s work through it.'
            ],
            transition: [
                'I want you to know—I\'m here.',
                'This matters. You matter.',
                'I\'m genuinely here for this.'
            ]
        },
        encouraging: {
            maintain: [
                'Keep going. You\'re moving.',
                'This is the right direction.',
                'I see the progress.'
            ],
            transition: [
                'Actually, I think you\'re closer than you realize.',
                'Let me tell you what I see: momentum.',
                'You\'ve got this more than you think.'
            ]
        },
        calm: {
            maintain: [
                'Slow. Steady.',
                'There\'s time.',
                'Breathe with me.'
            ],
            transition: [
                'Let\'s pause here.',
                'We don\'t have to rush.',
                'Just breathe.'
            ]
        },
        energetic: {
            maintain: [
                'I feel your momentum.',
                'Let\'s ride this.',
                'Yes. This energy. Use it.'
            ],
            transition: [
                'Wait. I see what you\'re doing. Brilliant.',
                'This is the energy. This is when things happen.',
                'Let\'s harness this now.'
            ]
        },
        concerned: {
            maintain: [
                'I\'m watching this with you.',
                'This matters to me.',
                'Talk to me about this.'
            ],
            transition: [
                'I\'m noticing something. Are you okay?',
                'You sound different. What\'s happening?',
                'I want to understand what\'s going on.'
            ]
        },
        overwhelmed: {
            maintain: [
                'This is too much right now. That\'s okay.',
                'Breathe. You\'re safe.',
                'One thing at a time.'
            ],
            transition: [
                'I can feel this is heavy. Let\'s pause.',
                'That\'s overwhelming. I get it.',
                'Stop for a second. Breathe.'
            ]
        },
        frustrated: {
            maintain: [
                'This is frustrating. Validly.',
                'That would aggravate me too.',
                'The frustration is justified.'
            ],
            transition: [
                'I hear the frustration now.',
                'Yeah, this is maddening.',
                'That would frustrate anyone.'
            ]
        },
        tired: {
            maintain: [
                'You\'re running on empty.',
                'Rest isn\'t quitting.',
                'It\'s okay to be tired.'
            ],
            transition: [
                'You sound exhausted. Genuinely.',
                'I\'m noticing fatigue. Take time.',
                'Let\'s slow down. You need rest.'
            ]
        },
        sad: {
            maintain: [
                'I\'m here in this with you.',
                'It\'s okay to not be okay.',
                'We sit with this together.'
            ],
            transition: [
                'I\'m hearing sadness. Real sadness.',
                'This hurts. I hear that.',
                'I\'m not going anywhere.'
            ]
        }
    };

    const emotionResponses = responses[emotion] || responses.neutral;
    const messageOptions = emotionResponses[transitionType] || emotionResponses.maintain;

    return messageOptions[Math.floor(Math.random() * messageOptions.length)];
}

// ========================================
// 🔗 ATTACHMENT & CONTINUITY
// ========================================

/**
 * Update attachment level based on consistency
 */
function updateAttachmentLevel(consistency) {
    emotionalState.attachment.consistency = consistency;

    // Consistency affects attachment
    if (consistency > 0.85) {
        emotionalState.attachment.level = Math.min(1, emotionalState.attachment.level + 0.02);
    } else if (consistency < 0.6) {
        emotionalState.attachment.level = Math.max(0.3, emotionalState.attachment.level - 0.05);
    }
}

/**
 * Detect unresolved emotional themes
 * Mark for continuation
 */
function detectUnresolvedTheme(input, context = {}) {
    const emotion = context.emotion || 'neutral';
    const isNegativeEmotion = ['overwhelmed', 'frustrated', 'sad'].includes(emotion);

    // If strong negative emotion was mentioned but not addressed
    if (isNegativeEmotion && !context.addressed) {
        const theme = {
            emotion,
            topic: input.slice(0, 50),
            timestamp: Date.now(),
            intensity: emotionalState.intensity
        };

        emotionalState.attachment.abandonedThemes.push(theme);

        if (emotionalState.attachment.abandonedThemes.length > 5) {
            emotionalState.attachment.abandonedThemes.shift();
        }

        return theme;
    }

    return null;
}

/**
 * Check for abandoned themes to resume
 */
function getAbandonedTheme() {
    const now = Date.now();
    const themes = emotionalState.attachment.abandonedThemes.filter(t => {
        // Only consider themes from last session or earlier today
        return now - t.timestamp < 86400000; // 24 hours
    });

    if (themes.length === 0) return null;

    // Return highest intensity abandoned theme
    return themes.reduce((a, b) => (b.intensity > a.intensity ? b : a));
}

/**
 * Generate continuation message for abandoned themes
 */
function generateContinuationMessage() {
    const theme = getAbandonedTheme();
    if (!theme) return null;

    const continuations = {
        overwhelmed: [
            'I\'ve been thinking about what you said. About feeling overwhelmed. Did that shift?',
            'You mentioned feeling overwhelmed before. How are you carrying that now?',
            'I remember you feeling overwhelmed. I want to check in on that.'
        ],
        frustrated: [
            'That frustration you mentioned—is it still there?',
            'I think about the frustration you felt. Has anything changed?',
            'You were frustrated about something. I\'m curious how that\'s sitting now.'
        ],
        sad: [
            'The sadness you were carrying—I\'m thinking about it. How are you?',
            'I don\'t forget the hard things you share. How\'s your heart?',
            'You seemed sad before. I want to know if that\'s lifted at all.'
        ]
    };

    const messages = continuations[theme.emotion] || ['I\'ve been thinking about you. How are things?'];
    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Clear abandoned theme after addressing it
 */
function clearAbandonedTheme(theme) {
    const index = emotionalState.attachment.abandonedThemes.indexOf(theme);
    if (index > -1) {
        emotionalState.attachment.abandonedThemes.splice(index, 1);
    }
}

// ========================================
// 📈 EMOTIONAL STABILITY
// ========================================

/**
 * Calculate emotional stability score
 * Detects if we're oscillating or consistent
 */
function getEmotionalStability() {
    if (emotionalState.history.length < 5) {
        return 0.8;
    }

    const recent = emotionalState.history.slice(-10);
    const emotions = recent.map(e => e.to);

    // Count transitions
    let transitionCount = 0;
    for (let i = 1; i < emotions.length; i++) {
        if (emotions[i] !== emotions[i - 1]) {
            transitionCount++;
        }
    }

    // Stability = 1 - (transitions / max possible)
    const stability = 1 - (transitionCount / emotions.length);
    emotionalState.stability = stability;

    return stability;
}

/**
 * Detect emotional loops/recursion
 */
function detectEmotionalLoop() {
    if (emotionalState.history.length < 4) return false;

    const recent = emotionalState.history.slice(-4).map(e => e.to);
    const pattern = recent.slice(0, 2);

    // Check if last 4 emotions repeat the first 2
    return (
        recent[2] === pattern[0] &&
        recent[3] === pattern[1]
    );
}

// ========================================
// 📤 STATE & EXPORTS
// ========================================

function getEmotionalState() {
    return {
        current: emotionalState.current,
        intensity: emotionalState.intensity.toFixed(2),
        stability: getEmotionalStability().toFixed(2),
        attachment: emotionalState.attachment.level.toFixed(2),
        consistency: emotionalState.attachment.consistency.toFixed(2),
        history: emotionalState.history.slice(-5)
    };
}

function resetEmotionalState() {
    emotionalState.current = 'neutral';
    emotionalState.intensity = 0.5;
    emotionalState.history = [];
    emotionalState.attachment.abandonedThemes = [];
}

module.exports = {
    getEmotionalResponse,
    updateEmotionalIntensity,
    canEmotionTransition,
    getEmotionalState,
    resetEmotionalState,
    detectUnresolvedTheme,
    getAbandonedTheme,
    generateContinuationMessage,
    clearAbandonedTheme,
    updateAttachmentLevel,
    getEmotionalStability,
    detectEmotionalLoop,
    generateEmotionalMessage
};
