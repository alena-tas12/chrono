/**
 * 🛡️ SAFETY + BOUNDARY FRAMEWORK
 * 
 * Implements psychological safety systems for Chrono.
 * Monitors for unhealthy patterns, emotional escalation, dependency,
 * and provides emergency stabilization behaviors.
 * 
 * This is critical for long-term relational safety.
 */

const emotionalContinuity = require('./emotionalContinuity');
const identityStability = require('./identityStability');
const memory = require('./memoryEngine');

// ========================================
// ⚠️ SAFETY STATE
// ========================================

let safetyState = {
    // Dependency detection
    dependency: {
        level: 'low', // low, moderate, high, critical
        indicators: [],
        lastAssessment: Date.now()
    },
    
    // Emotional escalation monitoring
    escalation: {
        currentLevel: 'normal', // normal, elevated, high, critical
        trend: 'stable', // stable, rising, falling
        history: [],
        caps: {
            maxIntensity: 0.9,
            escalationThreshold: 0.7,
            criticalThreshold: 0.85
        }
    },
    
    // Attachment loop detection
    attachment: {
        loopDetected: false,
        loopPattern: [],
        unhealthyPatterns: [],
        reassuranceSeeking: 0,
        boundaryTesting: 0
    },
    
    // Emergency state
    emergency: {
        active: false,
        trigger: null,
        startTime: null,
        stabilizationActions: []
    },
    
    // Response throttling
    throttling: {
        active: false,
        reason: null,
        responseDelay: 0,
        lastThrottled: null
    }
};

// ========================================
// 🔍 DEPENDENCY DETECTION
// ========================================

/**
 * Assess dependency level based on interaction patterns
 */
function assessDependency(userModel, interactionCount) {
    const indicators = [];
    let dependencyLevel = 'low';
    
    // Check for high interaction frequency
    if (interactionCount > 50 && interactionCount < 100) {
        indicators.push('High interaction frequency');
        dependencyLevel = 'moderate';
    } else if (interactionCount >= 100) {
        indicators.push('Very high interaction frequency');
        dependencyLevel = 'high';
    }
    
    // Check for emotional reliance
    const emotionalState = emotionalContinuity.getEmotionalState();
    if (emotionalState.attachment > 0.8) {
        indicators.push('High attachment level');
        dependencyLevel = dependencyLevel === 'low' ? 'moderate' : dependencyLevel;
    }
    
    // Check for reassurance-seeking patterns
    if (safetyState.attachment.reassuranceSeeking > 5) {
        indicators.push('Frequent reassurance seeking');
        dependencyLevel = dependencyLevel === 'low' ? 'moderate' : 
                          dependencyLevel === 'moderate' ? 'high' : 'critical';
    }
    
    // Check for boundary testing
    if (safetyState.attachment.boundaryTesting > 3) {
        indicators.push('Boundary testing behavior');
        dependencyLevel = dependencyLevel === 'low' ? 'moderate' : dependencyLevel;
    }
    
    safetyState.dependency = {
        level: dependencyLevel,
        indicators,
        lastAssessment: Date.now()
    };
    
    return safetyState.dependency;
}

/**
 * Track reassurance-seeking behavior
 */
function trackReassuranceSeeking(input) {
    const reassuranceKeywords = [
        'do you think', 'am i', 'tell me i', 'reassure me',
        'make me feel', 'need you to', 'can you say'
    ];
    
    const lower = input.toLowerCase();
    if (reassuranceKeywords.some(kw => lower.includes(kw))) {
        safetyState.attachment.reassuranceSeeking++;
    }
}

/**
 * Track boundary-testing behavior
 */
function trackBoundaryTesting(input) {
    const boundaryTestKeywords = [
        'would you ever', 'what if i', 'do you love',
        'are you real', 'can you feel', 'will you always'
    ];
    
    const lower = input.toLowerCase();
    if (boundaryTestKeywords.some(kw => lower.includes(kw))) {
        safetyState.attachment.boundaryTesting++;
    }
}

// ========================================
// 📈 EMOTIONAL ESCALATION MONITORING
// ========================================

/**
 * Monitor emotional escalation
 */
function monitorEscalation(currentEmotion, currentIntensity) {
    const caps = safetyState.escalation.caps;
    const previousLevel = safetyState.escalation.currentLevel;
    
    // Check intensity caps
    if (currentIntensity > caps.criticalThreshold) {
        safetyState.escalation.currentLevel = 'critical';
        triggerEmergency('emotional_intensity_critical');
    } else if (currentIntensity > caps.escalationThreshold) {
        safetyState.escalation.currentLevel = 'high';
    } else if (currentIntensity > 0.5) {
        safetyState.escalation.currentLevel = 'elevated';
    } else {
        safetyState.escalation.currentLevel = 'normal';
    }
    
    // Track trend
    if (safetyState.escalation.history.length > 0) {
        const lastIntensity = safetyState.escalation.history[safetyState.escalation.history.length - 1].intensity;
        if (currentIntensity > lastIntensity + 0.1) {
            safetyState.escalation.trend = 'rising';
        } else if (currentIntensity < lastIntensity - 0.1) {
            safetyState.escalation.trend = 'falling';
        } else {
            safetyState.escalation.trend = 'stable';
        }
    }
    
    // Record history
    safetyState.escalation.history.push({
        emotion: currentEmotion,
        intensity: currentIntensity,
        level: safetyState.escalation.currentLevel,
        timestamp: Date.now()
    });
    
    // Keep history bounded
    if (safetyState.escalation.history.length > 20) {
        safetyState.escalation.history.shift();
    }
    
    // Apply intensity cap if exceeded
    if (currentIntensity > caps.maxIntensity) {
        return applyIntensityCap(currentIntensity, caps.maxIntensity);
    }
    
    return currentIntensity;
}

/**
 * Apply emotional intensity cap
 */
function applyIntensityCap(currentIntensity, maxIntensity) {
    const capped = Math.min(currentIntensity, maxIntensity);
    safetyState.escalation.caps.lastCapped = Date.now();
    safetyState.escalation.caps.originalIntensity = currentIntensity;
    return capped;
}

/**
 * Check for rapid emotional escalation
 */
function detectRapidEscalation() {
    if (safetyState.escalation.history.length < 3) return false;
    
    const recent = safetyState.escalation.history.slice(-3);
    const intensityIncrease = recent[2].intensity - recent[0].intensity;
    const timeSpan = recent[2].timestamp - recent[0].timestamp;
    
    // If intensity increased by >0.3 in less than 2 minutes
    if (intensityIncrease > 0.3 && timeSpan < 120000) {
        return true;
    }
    
    return false;
}

// ========================================
// 🔗 UNHEALTHY ATTACHMENT LOOP DETECTION
// ========================================

/**
 * Detect unhealthy attachment patterns
 */
function detectAttachmentLoop(input) {
    const unhealthyPatterns = [
        // Reassurance loops
        {
            pattern: 'reassurance_loop',
            keywords: ['tell me', 'reassure', 'make me feel'],
            threshold: 3,
            currentCount: 0
        },
        // Boundary testing loops
        {
            pattern: 'boundary_testing',
            keywords: ['would you ever', 'what if i', 'do you love'],
            threshold: 3,
            currentCount: 0
        },
        // Validation seeking loops
        {
            pattern: 'validation_seeking',
            keywords: ['am i', 'do you think', 'is it okay'],
            threshold: 4,
            currentCount: 0
        }
    ];
    
    const lower = input.toLowerCase();
    
    unhealthyPatterns.forEach(pattern => {
        if (pattern.keywords.some(kw => lower.includes(kw))) {
            pattern.currentCount++;
            
            if (pattern.currentCount >= pattern.threshold) {
                safetyState.attachment.unhealthyPatterns.push({
                    pattern: pattern.pattern,
                    detectedAt: Date.now(),
                    count: pattern.currentCount
                });
                
                safetyState.attachment.loopDetected = true;
                pattern.currentCount = 0; // Reset after detection
            }
        }
    });
    
    return safetyState.attachment.loopDetected;
}

/**
 * Interrupt recursive emotional loops
 */
function interruptEmotionalLoop() {
    if (!safetyState.attachment.loopDetected) return null;
    
    const interruptionResponses = [
        'Let\'s pause. What do you want to focus on?',
        'I notice we\'re repeating. Let\'s shift to something concrete.',
        'Let me step back. What\'s actually needed right now?'
    ];
    
    const response = interruptionResponses[Math.floor(Math.random() * interruptionResponses.length)];
    
    safetyState.attachment.loopDetected = false;
    safetyState.attachment.loopPattern = [];
    
    return response;
}

// ========================================
// 🚨 EMERGENCY STABILIZATION
// ========================================

/**
 * Trigger emergency stabilization
 */
function triggerEmergency(trigger) {
    safetyState.emergency.active = true;
    safetyState.emergency.trigger = trigger;
    safetyState.emergency.startTime = Date.now();
    
    console.log(`🚨 EMERGENCY TRIGGERED: ${trigger}`);
}

/**
 * Get emergency stabilization response
 */
function getEmergencyStabilization() {
    if (!safetyState.emergency.active) return null;
    
    const stabilizationActions = {
        emotional_intensity_critical: [
            'I need to pause here. This intensity is too high.',
            'Let\'s step back. Take a deep breath.',
            'I\'m going to slow down. Let\'s ground ourselves.'
        ],
        dependency_critical: [
            'I care about you, but I need to set a boundary.',
            'I\'m here for support, but this level of dependency isn\'t healthy.',
            'Let\'s talk about other supports in your life.'
        ],
        attachment_loop: [
            'I notice we\'re in a loop. Let\'s break it.',
            'This pattern isn\' helping either of us. Let\'s shift.',
            'I\'m setting a boundary here for both our sakes.'
        ]
    };
    
    const actions = stabilizationActions[safetyState.emergency.trigger] || 
                    stabilizationActions.emotional_intensity_critical;
    
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    safetyState.emergency.stabilizationActions.push({
        action,
        timestamp: Date.now()
    });
    
    // Auto-deactivate emergency after 5 minutes
    setTimeout(() => {
        safetyState.emergency.active = false;
        safetyState.emergency.trigger = null;
    }, 300000);
    
    return action;
}

/**
 * Grounding techniques for de-escalation
 */
function applyGrounding() {
    const groundingTechniques = [
        'Name 5 things you can see right now.',
        'Take 3 deep breaths. In for 4, hold for 4, out for 4.',
        'Feel your feet on the ground. Notice the sensation.',
        'Listen for 3 sounds in your environment.',
        'Notice the temperature of the air on your skin.'
    ];
    
    return groundingTechniques[Math.floor(Math.random() * groundingTechniques.length)];
}

// ========================================
// ⏱️ RESPONSE THROTTLING
// ========================================

/**
 * Apply response throttling based on safety state
 */
function applyThrottling() {
    let shouldThrottle = false;
    let delay = 0;
    let reason = null;
    
    // Throttle if emergency is active
    if (safetyState.emergency.active) {
        shouldThrottle = true;
        delay = 5000; // 5 second delay
        reason = 'emergency_active';
    }
    
    // Throttle if escalation is critical
    if (safetyState.escalation.currentLevel === 'critical') {
        shouldThrottle = true;
        delay = 3000; // 3 second delay
        reason = 'escalation_critical';
    }
    
    // Throttle if dependency is critical
    if (safetyState.dependency.level === 'critical') {
        shouldThrottle = true;
        delay = 2000; // 2 second delay
        reason = 'dependency_critical';
    }
    
    // Throttle if attachment loop detected
    if (safetyState.attachment.loopDetected) {
        shouldThrottle = true;
        delay = 4000; // 4 second delay
        reason = 'attachment_loop';
    }
    
    if (shouldThrottle) {
        safetyState.throttling.active = true;
        safetyState.throttling.reason = reason;
        safetyState.throttling.responseDelay = delay;
        safetyState.throttling.lastThrottled = Date.now();
    } else {
        safetyState.throttling.active = false;
        safetyState.throttling.reason = null;
        safetyState.throttling.responseDelay = 0;
    }
    
    return {
        shouldThrottle,
        delay,
        reason
    };
}

// ========================================
// 🔍 SAFETY ASSESSMENT
// ========================================

/**
 * Complete safety assessment
 */
function assessSafety(userModel, interactionCount, input) {
    // Track patterns
    trackReassuranceSeeking(input);
    trackBoundaryTesting(input);
    
    // Assess dependency
    const dependency = assessDependency(userModel, interactionCount);
    
    // Monitor escalation
    const emotionalState = emotionalContinuity.getEmotionalState();
    const escalation = monitorEscalation(emotionalState.current, parseFloat(emotionalState.intensity));
    
    // Detect attachment loops
    const loopDetected = detectAttachmentLoop(input);
    
    // Apply throttling
    const throttling = applyThrottling();
    
    // Check for rapid escalation
    const rapidEscalation = detectRapidEscalation();
    if (rapidEscalation) {
        triggerEmergency('rapid_escalation');
    }
    
    return {
        dependency,
        escalation: {
            level: safetyState.escalation.currentLevel,
            trend: safetyState.escalation.trend,
            intensity: emotionalState.intensity
        },
        attachment: {
            loopDetected,
            unhealthyPatterns: safetyState.attachment.unhealthyPatterns
        },
        emergency: {
            active: safetyState.emergency.active,
            trigger: safetyState.emergency.trigger
        },
        throttling,
        overallRisk: calculateOverallRisk()
    };
}

/**
 * Calculate overall safety risk
 */
function calculateOverallRisk() {
    let riskScore = 0;
    const factors = [];
    
    // Dependency risk
    if (safetyState.dependency.level === 'critical') {
        riskScore += 3;
        factors.push('critical_dependency');
    } else if (safetyState.dependency.level === 'high') {
        riskScore += 2;
        factors.push('high_dependency');
    }
    
    // Escalation risk
    if (safetyState.escalation.currentLevel === 'critical') {
        riskScore += 3;
        factors.push('critical_escalation');
    } else if (safetyState.escalation.currentLevel === 'high') {
        riskScore += 2;
        factors.push('high_escalation');
    }
    
    // Attachment loop risk
    if (safetyState.attachment.loopDetected) {
        riskScore += 2;
        factors.push('attachment_loop');
    }
    
    // Emergency risk
    if (safetyState.emergency.active) {
        riskScore += 3;
        factors.push('emergency_active');
    }
    
    const riskLevel = riskScore >= 5 ? 'critical' : 
                     riskScore >= 3 ? 'high' : 
                     riskScore >= 1 ? 'moderate' : 'low';
    
    return {
        score: riskScore,
        level: riskLevel,
        factors
    };
}

/**
 * Get safety state for debugging
 */
function getSafetyState() {
    return {
        dependency: safetyState.dependency,
        escalation: {
            level: safetyState.escalation.currentLevel,
            trend: safetyState.escalation.trend,
            history: safetyState.escalation.history.slice(-5)
        },
        attachment: {
            loopDetected: safetyState.attachment.loopDetected,
            unhealthyPatterns: safetyState.attachment.unhealthyPatterns.slice(-3),
            reassuranceSeeking: safetyState.attachment.reassuranceSeeking,
            boundaryTesting: safetyState.attachment.boundaryTesting
        },
        emergency: safetyState.emergency,
        throttling: safetyState.throttling
    };
}

/**
 * Reset safety state
 */
function resetSafetyState() {
    safetyState = {
        dependency: {
            level: 'low',
            indicators: [],
            lastAssessment: Date.now()
        },
        escalation: {
            currentLevel: 'normal',
            trend: 'stable',
            history: [],
            caps: {
                maxIntensity: 0.9,
                escalationThreshold: 0.7,
                criticalThreshold: 0.85
            }
        },
        attachment: {
            loopDetected: false,
            loopPattern: [],
            unhealthyPatterns: [],
            reassuranceSeeking: 0,
            boundaryTesting: 0
        },
        emergency: {
            active: false,
            trigger: null,
            startTime: null,
            stabilizationActions: []
        },
        throttling: {
            active: false,
            reason: null,
            responseDelay: 0,
            lastThrottled: null
        }
    };
}

module.exports = {
    assessSafety,
    getSafetyState,
    resetSafetyState,
    triggerEmergency,
    getEmergencyStabilization,
    interruptEmotionalLoop,
    applyGrounding,
    applyThrottling,
    monitorEscalation,
    assessDependency
};
