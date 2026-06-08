/**
 * 🔐 RECURSIVE LOOP PROTECTION
 * 
 * Detects and prevents:
 * - Infinite recursion patterns
 * - Self-referential instability
 * - Emotional amplification cycles
 * - Memory recursion corruption
 * - Response divergence
 */

// ========================================
// 🔍 LOOP DETECTION
// ========================================

let loopDetection = {
    responseHistory: [],
    maxHistory: 50,
    detectedLoops: [],
    recursionDepth: 0,
    maxAllowedDepth: 5
};

/**
 * Detect response loops
 */
function detectResponseLoop(response) {
    const recent = loopDetection.responseHistory.slice(-5);

    // Check if response is too similar to recent ones
    for (const prevResponse of recent) {
        const similarity = calculateSimilarity(response, prevResponse);
        if (similarity > 0.85) {
            return {
                detected: true,
                type: 'repetition',
                similarity
            };
        }
    }

    // Check for alternating pattern
    if (recent.length >= 4) {
        if (recent[0] === recent[2] && recent[1] === recent[3]) {
            return {
                detected: true,
                type: 'alternation',
                pattern: [recent[0], recent[1]]
            };
        }
    }

    return { detected: false };
}

/**
 * Calculate text similarity (simple cosine-like)
 */
function calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / Math.max(union.size, 1);
}

/**
 * Track response in history
 */
function trackResponse(response) {
    loopDetection.responseHistory.push(response);

    if (loopDetection.responseHistory.length > loopDetection.maxHistory) {
        loopDetection.responseHistory.shift();
    }
}

// ========================================
// 😈 EMOTIONAL AMPLIFICATION DETECTION
// ========================================

/**
 * Detect if emotional state is amplifying recursively
 */
function detectEmotionalAmplification(currentIntensity, previousIntensity) {
    // If intensity increases more than expected
    const increase = currentIntensity - previousIntensity;

    if (increase > 0.3) {
        return {
            amplifying: true,
            delta: increase.toFixed(2),
            risk: 'high'
        };
    }

    if (increase > 0.15) {
        return {
            amplifying: true,
            delta: increase.toFixed(2),
            risk: 'medium'
        };
    }

    return { amplifying: false };
}

/**
 * Emotional stability check
 */
function checkEmotionalStability(emotionalHistory = []) {
    if (emotionalHistory.length < 3) return { stable: true };

    // Calculate variance in intensities
    const intensities = emotionalHistory.map(e => e.intensity || 0.5);
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intensities.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > 0.4) {
        return {
            stable: false,
            volatility: stdDev.toFixed(2),
            risk: 'high'
        };
    }

    return {
        stable: true,
        volatility: stdDev.toFixed(2),
        risk: 'low'
    };
}

// ========================================
// 🌀 SELF-REFERENCE DETECTION
// ========================================

/**
 * Detect excessive self-referential patterns
 */
function detectSelfReference(responses = []) {
    const selfRefPatterns = [
        'i think about',
        'i\'m thinking',
        'my thoughts about my',
        'i analyze myself',
        'i\'m reflecting on my reflection',
        'consider my consideration',
        'analyzing my analysis',
        'meta', // appears too often
        'recursive',
        'abstraction of abstraction'
    ];

    let selfRefCount = 0;

    for (const response of responses) {
        const lower = response.toLowerCase();
        for (const pattern of selfRefPatterns) {
            if (lower.includes(pattern)) {
                selfRefCount++;
            }
        }
    }

    const ratio = selfRefCount / Math.max(responses.length, 1);

    if (ratio > 0.3) {
        return {
            detected: true,
            intensity: ratio.toFixed(2),
            risk: 'high'
        };
    }

    if (ratio > 0.15) {
        return {
            detected: true,
            intensity: ratio.toFixed(2),
            risk: 'medium'
        };
    }

    return { detected: false };
}

// ========================================
// 💾 MEMORY RECURSION SAFEGUARDS
// ========================================

/**
 * Detect memory corruption from recursion
 */
function detectMemoryCorruption(memories = []) {
    // Check for deeply nested abstractions
    let maxNesting = 0;
    for (const mem of memories) {
        const nesting = (mem.summary || '').match(/abstraction|summary|meta/gi)?.length || 0;
        maxNesting = Math.max(maxNesting, nesting);
    }

    if (maxNesting > 5) {
        return {
            corrupted: true,
            nestingLevel: maxNesting,
            recommendation: 'Rebuild memory hierarchy'
        };
    }

    // Check for cyclical references
    const topics = memories.map(m => extractMainTopic(m));
    const topicSet = new Set(topics);

    if (topics.length > topicSet.size * 2) {
        return {
            corrupted: true,
            reason: 'Excessive topic repetition',
            recommendation: 'Compress redundant memories'
        };
    }

    return { corrupted: false };
}

/**
 * Extract main topic from memory
 */
function extractMainTopic(memory) {
    const text = memory.userInput || memory.summary || '';
    const words = text.toLowerCase().split(/\s+/);
    return words.slice(0, 3).join(' ');
}

// ========================================
// 🛡️ LOOP BREAKING STRATEGIES
// ========================================

/**
 * Break out of detected loop
 */
function breakLoop(loopType) {
    const breakStrategies = {
        repetition: [
            'Let me step back.',
            'I need to recalibrate.',
            'Different approach needed here.',
            'Let me try something else.'
        ],
        alternation: [
            'I notice I\'m cycling. Pausing.',
            'Pattern detected. Resetting perspective.',
            'I\'m stuck. Fresh start.'
        ],
        emotional: [
            'The intensity is building. Let me calm.',
            'I need to de-escalate.',
            'Pulling back from this spiral.'
        ],
        self_reference: [
            'I\'m too much in my head. Refocusing on you.',
            'Meta-analysis isn\'t helping. Back to basics.',
            'Enough introspection. What do YOU need?'
        ]
    };

    const strategies = breakStrategies[loopType] || breakStrategies.repetition;
    return strategies[Math.floor(Math.random() * strategies.length)];
}

/**
 * Force reset of specific system
 */
function forceReset(system) {
    const resets = {
        emotional: () => ({
            current: 'neutral',
            intensity: 0.5,
            volatility: 0
        }),
        response: () => ({
            history: [],
            depth: 0
        }),
        memory: () => ({
            clearRecent: true,
            timestamp: Date.now()
        })
    };

    if (resets[system]) {
        return resets[system]();
    }

    return { reset: true };
}

// ========================================
// 📊 RECURSION DEPTH TRACKING
// ========================================

/**
 * Increment recursion depth
 */
function incrementRecursionDepth() {
    loopDetection.recursionDepth++;

    if (loopDetection.recursionDepth > loopDetection.maxAllowedDepth) {
        return {
            exceeded: true,
            depth: loopDetection.recursionDepth,
            maxAllowed: loopDetection.maxAllowedDepth
        };
    }

    return { depth: loopDetection.recursionDepth };
}

/**
 * Reset recursion depth
 */
function resetRecursionDepth() {
    loopDetection.recursionDepth = 0;
}

/**
 * Get recursion depth
 */
function getRecursionDepth() {
    return loopDetection.recursionDepth;
}

// ========================================
// 🔍 COMPREHENSIVE LOOP CHECK
// ========================================

/**
 * Full loop detection across all systems
 */
function comprehensiveLoopCheck(systemState = {}) {
    const checks = {
        responseLoop: detectResponseLoop(systemState.lastResponse || ''),
        emotionalAmplification: detectEmotionalAmplification(
            systemState.currentEmotionalIntensity,
            systemState.previousEmotionalIntensity
        ),
        emotionalStability: checkEmotionalStability(systemState.emotionalHistory),
        selfReference: detectSelfReference(systemState.recentResponses || []),
        memoryCorruption: detectMemoryCorruption(systemState.memories || []),
        recursionDepth: loopDetection.recursionDepth > loopDetection.maxAllowedDepth
    };

    // Aggregate risk
    let riskLevel = 'none';
    let riskCount = 0;

    for (const [check, result] of Object.entries(checks)) {
        if (result.detected || result.amplifying || result.corrupted || result.exceeded || !result.stable) {
            riskCount++;
        }
    }

    if (riskCount >= 3) {
        riskLevel = 'critical';
    } else if (riskCount >= 2) {
        riskLevel = 'high';
    } else if (riskCount >= 1) {
        riskLevel = 'medium';
    }

    return {
        overallRisk: riskLevel,
        checks,
        recommendation: getRiskRecommendation(riskLevel, checks)
    };
}

/**
 * Get recommendation based on risk
 */
function getRiskRecommendation(riskLevel, checks) {
    const recommendations = {
        none: 'System operating normally.',
        medium: 'Monitor for patterns. No immediate action needed.',
        high: 'Reduce input intensity. Consider system reset.',
        critical: 'EMERGENCY: Full system reset recommended. Break all loops immediately.'
    };

    return recommendations[riskLevel] || recommendations.none;
}

// ========================================
// 📤 EXPORTS
// ========================================

module.exports = {
    detectResponseLoop,
    detectEmotionalAmplification,
    checkEmotionalStability,
    detectSelfReference,
    detectMemoryCorruption,
    breakLoop,
    forceReset,
    incrementRecursionDepth,
    resetRecursionDepth,
    getRecursionDepth,
    comprehensiveLoopCheck,
    trackResponse,
    calculateSimilarity
};
