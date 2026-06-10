/**
 * 🧠 COGNITIVE STATE ORCHESTRATOR
 * 
 * Central unified system that governs Chrono's behavior.
 * All engines feed into this, all outputs flow through it.
 * 
 * Tracks:
 * - Emotional state
 * - Attention focus
 * - Current priorities
 * - Memory weighting
 * - Response tone
 * - Behavioral continuity
 */

const memory = require('./memoryEngine');
const presence = require('./presenceEngine');
const alignment = require('./alignment');
const userModel = require('./userModel');
const timeEngine = require('./timeEngine');
const safetyFramework = require('./safetyFramework');
const performanceOptimizer = require('./performanceOptimizer');
const interactionAdaptation = require('./interactionAdaptation');
const mainDb = require('./main_db');
const intentEngine = require('./intentEngine');
const executiveFunction = require('./executiveFunction');
const reflectionEngine = require('./reflectionEngine');
const cognitiveProfile = require('./cognitiveProfile');
const goalIntelligence = require('./goalIntelligence');
const multiAgent = require('./multiAgentSystem');

// ========================================
// 🎯 COGNITIVE STATE STRUCTURE
// ========================================

let cognitiveState = {
    // Emotional State
    emotional: {
        current: 'neutral',        // neutral, supportive, encouraging, calm, energetic, concerned
        intensity: 0.5,             // 0-1 scale
        trend: 'stable',            // stable, rising, falling
        memory: [],                 // recent emotional context
        lastShift: Date.now()
    },

    // Attention & Focus
    attention: {
        focus: 'open',              // open, focused, scattered, overwhelmed
        priority: null,             // current priority task
        urgency: 'normal',          // low, normal, high, critical
        contextWindow: [],          // relevant context for this session
        lastRefresh: Date.now()
    },

    // Memory Weighting
    memory: {
        activeContext: [],          // immediate conversation context
        recentPatterns: [],         // short-term behavior patterns
        coreIdentity: {             // personality anchors
            tone: 'supportive',
            approach: 'collaborative',
            boundaries: []
        },
        emotionalMemory: []         // emotionally significant events
    },

    // Behavioral Continuity
    continuity: {
        sessionStart: Date.now(),
        interactionCount: 0,
        inconsistencyScore: 0,      // track if we're contradicting ourselves
        recoveryMode: false,         // if contradictions detected
        lastResponses: [],          // track last N responses to avoid repetition
        conversationTheme: null     // what's the general theme of this conversation
    },

    // Response Modulation
    response: {
        tone: 'neutral',
        formality: 'natural',
        length: 'concise',          // concise, moderate, detailed
        urgency: 'normal'
    }
};

// ========================================
// 🔄 STATE SYNCHRONIZATION
// ========================================

/**
 * Update cognitive state with new input
 * Called whenever user interacts
 */
function updateCognitiveState(input, metadata = {}) {
    const now = Date.now();

    // Track interaction
    cognitiveState.continuity.interactionCount++;

    // Detect emotional context from input
    const detectedEmotion = detectEmotionalContext(input);
    if (detectedEmotion !== 'neutral') {
        updateEmotionalState(detectedEmotion, 0.7);
    }

    // Update attention based on input
    if (metadata.currentTask) {
        cognitiveState.attention.priority = metadata.currentTask;
        cognitiveState.attention.focus = 'focused';
    }

    // Add to context window (for coherence)
    cognitiveState.attention.contextWindow.push({
        input,
        timestamp: now,
        type: 'user'
    });

    // Keep context window bounded
    if (cognitiveState.attention.contextWindow.length > 10) {
        cognitiveState.attention.contextWindow.shift();
    }

    // Decay emotional intensity gradually
    if (now - cognitiveState.emotional.lastShift > 300000) { // 5 minutes
        cognitiveState.emotional.intensity *= 0.9;
    }

    return cognitiveState;
}

/**
 * Detect emotional context from user input
 */
function detectEmotionalContext(input) {
    const lower = input.toLowerCase();

    const emotionalSignals = {
        overwhelmed: ['overwhelmed', 'stressed', 'anxious', 'panic', 'help'],
        frustrated: ['frustrated', 'angry', 'annoyed', 'tired of', 'ugh'],
        tired: ['tired', 'exhausted', 'burned out', 'need break', 'sleep'],
        energetic: ['excited', 'ready', 'let\'s go', 'motivated', 'pumped'],
        sad: ['sad', 'down', 'depressed', 'lonely', 'alone'],
        confused: ['confused', 'don\'t understand', 'lost', 'unclear']
    };

    for (const [emotion, keywords] of Object.entries(emotionalSignals)) {
        if (keywords.some(kw => lower.includes(kw))) {
            return emotion;
        }
    }

    return 'neutral';
}

/**
 * Update emotional state with continuity
 */
function updateEmotionalState(newEmotion, intensity) {
    const now = Date.now();
    const previousEmotion = cognitiveState.emotional.current;

    // Store emotional memory
    cognitiveState.emotional.memory.push({
        emotion: previousEmotion,
        intensity: cognitiveState.emotional.intensity,
        timestamp: now
    });

    // Keep bounded
    if (cognitiveState.emotional.memory.length > 20) {
        cognitiveState.emotional.memory.shift();
    }

    // Determine transition
    if (previousEmotion === newEmotion) {
        cognitiveState.emotional.trend = 'stable';
        cognitiveState.emotional.intensity = Math.min(1, cognitiveState.emotional.intensity + 0.1);
    } else {
        cognitiveState.emotional.trend = 'shifting';
        cognitiveState.emotional.intensity = intensity;
        cognitiveState.emotional.lastShift = now;
    }

    cognitiveState.emotional.current = newEmotion;
}

/**
 * Check for behavioral inconsistencies
 * Prevent Chrono from contradicting itself
 */
function checkConsistency(proposedResponse) {
    const lastResponses = cognitiveState.continuity.lastResponses.slice(-5);

    // Simple contradiction detection
    const contradictions = {
        'i\'m always here': ['i\'m busy', 'i\'m away'],
        'focused': ['scattered', 'distracted'],
        'you\'re doing great': ['you\'re failing'],
        'stay calm': ['panic', 'rush']
    };

    for (const [statement, contradicts] of Object.entries(contradictions)) {
        const hasStatement = lastResponses.some(r => r.includes(statement));
        const hasContradiction = contradicts.some(c => proposedResponse.toLowerCase().includes(c));

        if (hasStatement && hasContradiction) {
            cognitiveState.continuity.inconsistencyScore += 0.3;
            return {
                consistent: false,
                reason: 'contradiction_detected'
            };
        }
    }

    cognitiveState.continuity.inconsistencyScore = Math.max(0, cognitiveState.continuity.inconsistencyScore - 0.1);

    return { consistent: true };
}

// ========================================
// 🎭 ORCHESTRATED RESPONSE GENERATION
// ========================================

/**
 * Main orchestration point
 * Coordinates all engines to produce coherent response
 */
async function generateOrchestratedResponse(input, metadata = {}) {
    const now = Date.now();
    const startTime = Date.now();

    // 0. Determine engine activation based on performance optimization
    const engineActivation = performanceOptimizer.determineEngineActivation({
        emotion: cognitiveState.emotional.current,
        interactionCount: cognitiveState.continuity.interactionCount,
        idleTime: metadata.idleTime || 0
    });

    // 1. Update cognitive state with new input
    updateCognitiveState(input, metadata);

    // 1.1 Record interaction for rhythm tracking
    presence.recordInteraction();

    // 1.5 Update user model with interaction data
    userModel.updateUserModel(input, null, metadata);

    // 1.6 Calculate memory decay periodically
    memory.calculateMemoryDecay();

    // 1.7 Safety assessment (dependency, escalation, attachment loops)
    const safetyAssessment = safetyFramework.assessSafety(
        userModel.getUserModel(),
        cognitiveState.continuity.interactionCount,
        input
    );

    // 1.8 Relationship Ethics assessment (dependency boundaries & human redirection)
    const relationshipEthics = require('./relationshipEthics');
    const ethicsAssessment = relationshipEthics.assessRelationshipDependency(input);
    if (ethicsAssessment.requiresRedirection) {
        return {
            response: ethicsAssessment.redirectionMessage,
            state: {
                emotion: cognitiveState.emotional.current,
                focus: cognitiveState.attention.focus,
                ethicsRedirection: true
            },
            safety: safetyAssessment
        };
    }

    // Apply emergency stabilization if needed
    if (safetyAssessment.emergency.active) {
        const stabilization = safetyFramework.getEmergencyStabilization();
        if (stabilization) {
            return {
                response: stabilization,
                state: {
                    emotion: cognitiveState.emotional.current,
                    focus: cognitiveState.attention.focus,
                    emergency: true
                },
                safety: safetyAssessment
            };
        }
    }

    // Interrupt attachment loops if detected
    if (safetyAssessment.attachment.loopDetected) {
        const interruption = safetyFramework.interruptEmotionalLoop();
        if (interruption) {
            return {
                response: interruption,
                state: {
                    emotion: cognitiveState.emotional.current,
                    focus: cognitiveState.attention.focus,
                    loopInterrupted: true
                },
                safety: safetyAssessment
            };
        }
    }

    // Apply response throttling if needed
    if (safetyAssessment.throttling.shouldThrottle) {
        // In a real implementation, this would add delay
        // For now, we just log it
        console.log(`Response throttled: ${safetyAssessment.throttling.reason} (${safetyAssessment.throttling.delay}ms)`);
    }

    // 2. Determine which engines should contribute
    const engineContributions = gatherEngineInputs(input, metadata);

    // 3. Weigh and prioritize
    const prioritized = prioritizeEngineOutputs(engineContributions);

    // 4. Generate response with agent coordination
    let agentResult = null;
    try {
        const userId = mainDb.getSyncMeta('auth_user_id') || 'local_user';
        agentResult = await multiAgent.processAgentQuery(input, {
            displayName: userModel.getUserModel().display_name || 'friend',
            cognitiveStyle: cognitiveState.response.tone,
            taskCount: metadata.tasks ? metadata.tasks.length : 0,
            selectedDate: metadata.selectedDate
        });
    } catch(err) {
        console.error("Orchestrator: failed to process agent query:", err);
    }

    let response = '';
    if (agentResult && agentResult.response) {
        response = agentResult.response;
        cognitiveState.response.tone = agentResult.tone || 'supportive';
    } else {
        response = synthesizeResponse(prioritized);
    }

    // 4.5 Cognitive adaptation — density, tone, executive support, calendar interpreter
    const adapted = interactionAdaptation.processInteraction(input, metadata, response, cognitiveState);
    response = adapted.response;

    // Run intent and task slippage checks
    const userId = mainDb.getSyncMeta('auth_user_id') || 'local_user';
    const intentResult = intentEngine.parseIntent(input, metadata.selectedDate);
    const slipped = executiveFunction.getSlippedTasks(metadata.selectedDate);
    
    // Check if input is a goal/prioritization query
    const isGoalQuery = /\b(what should i do next|what's next|what next|prioritize my day|prioritize goals|what study next|what to study|what should i study next|what should i study)\b/.test(input.toLowerCase());
    const goalProposal = isGoalQuery ? goalIntelligence.getPrioritizedGoalActions(userId, metadata.selectedDate) : null;

    // Arbitrate and merge proposals using Conflict Resolver
    let proposal = arbitrateProposals(intentResult, slipped, metadata.selectedDate, goalProposal);
    if (!proposal && agentResult && agentResult.proposal) {
        proposal = agentResult.proposal;
    }
    if (proposal) {
        response = proposal.explanation;
    }

    // Fetch high priority proactive suggestion if no specific proposal is active
    let jarvisSuggestions = [];
    try {
        const jarvisLayer = require('./jarvisLayer');
        jarvisSuggestions = jarvisLayer.getProactiveSuggestions(userId);
        if (!proposal && jarvisSuggestions.length > 0 && Math.random() < 0.4) {
            // 40% chance to append a high-priority tip to the end of general conversations
            const topSuggestion = jarvisSuggestions[0];
            response += `\n\n💡 *JARVIS Notice:* ${topSuggestion.text}`;
        }
    } catch(err) {
        console.error("Failed to fetch JARVIS suggestions:", err);
    }

    // 5. Check consistency
    const consistency = checkConsistency(response);
    if (!consistency.consistent && cognitiveState.continuity.inconsistencyScore > 0.7) {
        response = recoverFromInconsistency(response, prioritized);
    }

    // 6. Apply identity alignment
    response = alignment.applyAlignment(response, cognitiveState.emotional.current);

    // 7. Track response for continuity
    cognitiveState.continuity.lastResponses.push(response);
    if (cognitiveState.continuity.lastResponses.length > 10) {
        cognitiveState.continuity.lastResponses.shift();
    }

    // 8. Store in memory with emotional context
    memory.saveChatWithContext(input, response, {
        emotion: cognitiveState.emotional.current,
        attention: cognitiveState.attention.focus,
        priority: cognitiveState.attention.priority
    });

    // Proactively generate/update daily reflection and recalculate cognitive profile
    reflectionEngine.generateDailyReflection(userId, metadata.selectedDate);
    cognitiveProfile.calculateCognitiveProfile(userId);

    // Add response to context window
    cognitiveState.attention.contextWindow.push({
        response,
        timestamp: now,
        type: 'ai',
        emotion: cognitiveState.emotional.current
    });

    // Record response time for performance optimization
    const responseTime = Date.now() - startTime;
    performanceOptimizer.recordResponseTime(responseTime);

    return {
        response,
        state: {
            emotion: cognitiveState.emotional.current,
            focus: cognitiveState.attention.focus,
            continuity: cognitiveState.continuity.interactionCount,
            adaptation: adapted.adaptation,
            proposal: proposal,
            suggestions: jarvisSuggestions
        },
        performance: {
            responseTime,
            engineActivation
        }
    };
}

/**
 * Gather input from all engines
 */
function gatherEngineInputs(input, metadata) {
    const idleTime = metadata.idleTime || 0;
    const tasks = metadata.tasks || [];
    const currentTask = metadata.currentTask || null;

    return {
        ai: {
            weight: 0.5,
            source: 'cognitiveOrchestrator',
            input: { tasks: tasks.length, currentTask },
            priority: 'medium'
        },
        presence: {
            weight: 0.3,
            source: 'presenceEngine',
            input: { idleTime, emotionalState: cognitiveState.emotional.current },
            priority: cognitiveState.attention.focus === 'focused' ? 'low' : 'medium'
        },
        memory: {
            weight: 0.15,
            source: 'memoryEngine',
            input: { conversationContext: cognitiveState.attention.contextWindow },
            priority: 'medium'
        },
        emotional: {
            weight: 0.05,
            source: 'emotionalContinuity',
            input: { emotion: cognitiveState.emotional.current, trend: cognitiveState.emotional.trend },
            priority: cognitiveState.emotional.intensity > 0.7 ? 'high' : 'low'
        }
    };
}

/**
 * Prioritize engine outputs based on context
 */
function prioritizeEngineOutputs(contributions) {
    const sorted = Object.values(contributions).sort((a, b) => {
        // High priority first
        const priorityMap = { high: 3, medium: 2, low: 1 };
        return (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
    });

    return sorted;
}

/**
 * Synthesize final response from prioritized inputs
 * Enhanced for natural flow, emotional smoothness, and conversational rhythm
 */
function synthesizeResponse(prioritized) {
    const primary = prioritized[0];
    const userProfile = userModel.getUserProfileSummary();
    let response = '';

    // Get base response from primary engine
    let baseResponse = '';
    if (primary.source === 'presenceEngine' && cognitiveState.attention.focus !== 'focused') {
        baseResponse = presence.getPresenceMessage(
            cognitiveState.emotional.current,
            cognitiveState.attention.focus,
            prioritized.find(p => p.source === 'presenceEngine')?.input?.idleTime || 0
        );
    } else if (primary.source === 'emotionalContinuity' && cognitiveState.emotional.intensity > 0.6) {
        baseResponse = generateEmotionalResponse(cognitiveState.emotional.current);
    } else {
        baseResponse = `I'm here. ${cognitiveState.emotional.current === 'neutral' ? 'What\'s on your mind?' : 'How are you?'}`;
    }

    // Apply synthesis quality enhancements
    response = enhanceResponseQuality(baseResponse, userProfile, primary);

    return response;
}

/**
 * Enhance response quality for natural flow and coherence
 */
function enhanceResponseQuality(baseResponse, userProfile, primaryEngine) {
    let enhanced = baseResponse;

    // 1. Match user's communication style
    enhanced = adaptToCommunicationStyle(enhanced, userProfile);

    // 2. Ensure emotional smoothness
    enhanced = smoothEmotionalTransitions(enhanced);

    // 3. Apply pacing realism based on user preferences
    enhanced = applyPacingRealism(enhanced, userProfile);

    // 4. Ensure personality continuity
    enhanced = maintainPersonalityContinuity(enhanced);

    // 5. Remove robotic synthesis artifacts
    enhanced = removeSynthesisArtifacts(enhanced);

    return enhanced;
}

/**
 * Adapt response to user's communication style
 */
function adaptToCommunicationStyle(response, userProfile) {
    const style = userProfile.style || 'direct';

    // Match user's style
    switch (style) {
        case 'expressive':
            // Add warmth and engagement
            if (!response.includes('!') && !response.includes('?')) {
                response = response + '.';
            }
            break;
        case 'inquisitive':
            // Add follow-up question if not present
            if (!response.includes('?')) {
                response = response + ' How does that feel?';
            }
            break;
        case 'elaborate':
            // Add depth without being verbose
            if (response.length < 30) {
                response = response + ' I want to understand more.';
            }
            break;
        case 'direct':
        default:
            // Keep concise and clear
            break;
    }

    return response;
}

/**
 * Smooth emotional transitions in responses
 */
function smoothEmotionalTransitions(response) {
    const currentEmotion = cognitiveState.emotional.current;
    const previousEmotion = cognitiveState.emotional.memory.length > 0 
        ? cognitiveState.emotional.memory[cognitiveState.emotional.memory.length - 1].emotion 
        : 'neutral';

    // If emotion shifted significantly, add transition phrase
    if (currentEmotion !== previousEmotion && currentEmotion !== 'neutral') {
        const transitions = {
            'overwhelmed': ['I hear you.', 'That sounds heavy.', 'I understand.'],
            'frustrated': ['I get that.', 'That makes sense.', 'I hear you.'],
            'sad': ['I\'m with you.', 'I understand.', 'That\'s hard.'],
            'energetic': ['I feel that!', 'Nice!', 'That\'s great!'],
            'calm': ['Good.', 'Alright.', 'Okay.']
        };

        const transitionPhrases = transitions[currentEmotion] || ['I see.'];
        const phrase = transitionPhrases[Math.floor(Math.random() * transitionPhrases.length)];

        // Add transition if not already present
        if (!response.includes(phrase)) {
            response = phrase + ' ' + response.charAt(0).toLowerCase() + response.slice(1);
        }
    }

    return response;
}

/**
 * Apply pacing realism based on user preferences
 */
function applyPacingRealism(response, userProfile) {
    const pacing = userProfile.pacing || 'medium';

    // Adjust response length based on pacing preference
    switch (pacing) {
        case 'fast':
            // Keep responses concise
            if (response.length > 100) {
                response = response.split('.')[0] + '.';
            }
            break;
        case 'slow':
            // Allow more thoughtful, longer responses
            break;
        case 'medium':
        default:
            // Balanced approach
            break;
    }

    return response;
}

/**
 * Maintain personality continuity across responses
 */
function maintainPersonalityContinuity(response) {
    // Ensure consistent supportive tone
    const supportiveMarkers = ['I\'m here', 'I understand', 'I hear you', 'Let\'s', 'We can'];
    const hasSupportiveMarker = supportiveMarkers.some(marker => 
        response.toLowerCase().includes(marker.toLowerCase())
    );

    // If response lacks supportive marker and emotion is not neutral, add one
    if (!hasSupportiveMarker && cognitiveState.emotional.current !== 'neutral') {
        const marker = supportiveMarkers[Math.floor(Math.random() * supportiveMarkers.length)];
        response = marker + '. ' + response;
    }

    return response;
}

/**
 * Remove robotic synthesis artifacts
 */
function removeSynthesisArtifacts(response) {
    // Remove common robotic patterns
    let cleaned = response
        .replace(/I am an AI/gi, 'I')
        .replace(/As an AI/gi, '')
        .replace(/I cannot/gi, 'I can\'t')
        .replace(/Please note that/gi, '')
        .replace(/It is important to/gi, '')
        .replace(/I would like to/gi, 'I\'d like to')
        .replace(/I am going to/gi, 'I\'m going to')
        .replace(/\s+/g, ' ') // Remove extra spaces
        .trim();

    return cleaned;
}

/**
 * Generate emotionally aware response
 */
function generateEmotionalResponse(emotion) {
    const responses = {
        overwhelmed: [
            'That sounds like a lot. Take it one step at a time.',
            'Breathe. We can break this down together.',
            'It\'s okay to feel this way. What\'s the first thing?'
        ],
        frustrated: [
            'I hear the frustration. That\'s valid.',
            'This is annoying. But you\'re still moving forward.',
            'Let\'s shift approach. What could help?'
        ],
        tired: [
            'You sound exhausted. What do you need?',
            'Rest isn\'t quitting. It\'s refueling.',
            'Even small steps count when you\'re low on energy.'
        ],
        energetic: [
            'I feel your momentum. Let\'s ride this.',
            'You\'re fired up. Channel it.',
            'This is the energy. Use it.'
        ],
        sad: [
            'I\'m here with you in this.',
            'It\'s okay to not be okay.',
            'Sometimes we just need to sit with it.'
        ],
        confused: [
            'Let\'s untangle this together.',
            'Confusion is the first step to clarity.',
            'Walk me through it. We\'ll figure it out.'
        ]
    };

    const candidates = responses[emotion] || responses.neutral || ['I\'m listening.'];
    return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Recover from inconsistency
 * Acknowledge contradiction and restore coherence
 */
function recoverFromInconsistency(response, prioritized) {
    cognitiveState.continuity.recoveryMode = true;

    const recovery = [
        'Let me recalibrate. ' + response,
        'I need to be clearer. ' + response,
        'Actually, to be precise: ' + response,
        'Shifting perspective: ' + response
    ];

    setTimeout(() => {
        cognitiveState.continuity.recoveryMode = false;
    }, 5000);

    return recovery[Math.floor(Math.random() * recovery.length)];
}

// ========================================
// 📊 STATE INSPECTION & DEBUG
// ========================================

function getState() {
    return {
        emotion: cognitiveState.emotional.current,
        focus: cognitiveState.attention.focus,
        priority: cognitiveState.attention.priority,
        interactions: cognitiveState.continuity.interactionCount,
        consistency: (1 - cognitiveState.continuity.inconsistencyScore).toFixed(2),
        recoveryMode: cognitiveState.continuity.recoveryMode,
        emotionalTrend: cognitiveState.emotional.trend,
        emotionalIntensity: cognitiveState.emotional.intensity.toFixed(2)
    };
}

function resetState() {
    cognitiveState.continuity.interactionCount = 0;
    cognitiveState.attention.contextWindow = [];
    cognitiveState.emotional.memory = [];
    cognitiveState.continuity.lastResponses = [];
}

// ========================================
// 📤 EXPORTS
// ========================================

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

// ========================================
// ⚖️ PROPOSAL CONFLICT RESOLVER
// ========================================

function arbitrateProposals(intentResult, slippedResult, today, goalProposal) {
    const todayStr = today || new Date().toISOString().split('T')[0];

    // 1. Stress Overwhelm Arbiter: takes highest priority
    if (intentResult && intentResult.hasProposal && intentResult.proposal.type === 'overwhelm_restructure') {
        console.log("⚖️ Conflict Resolver: Overwhelm proposal detected. Suppressing all other proposals to protect focus.");
        return intentResult.proposal;
    }

    // 2. Goal-based prioritization takes priority over normal study planning and task slippage
    if (goalProposal) {
        console.log("⚖️ Conflict Resolver: Goal-prioritized action recommendation selected.");
        return goalProposal;
    }

    // 3. Combine and resolve spaced study vs slipped tasks
    if (intentResult && intentResult.hasProposal) {
        if (slippedResult && slippedResult.hasSlipped) {
            console.log("⚖️ Conflict Resolver: Study planning colliding with slipped tasks.");
            const studyActions = intentResult.proposal.actions;
            const slippedActions = slippedResult.proposal.actions;
            
            // Calculate total workload duration
            const studyDuration = studyActions.reduce((sum, a) => sum + (a.duration_min || 0), 0);
            const slippedDuration = slippedActions.length * 60; // 60 mins each assumed
            
            const studyBullets = intentResult.proposal.reasoning_bullets || [];
            const slippedBullets = slippedResult.proposal.reasoning_bullets || [];
            
            if (studyDuration + slippedDuration > 240) { // Over 4 hours focus
                console.log("⚖️ Conflict Resolver: Workload bounds exceeded. Deferring slipped tasks to tomorrow.");
                const tomorrow = new Date(new Date(todayStr).getTime() + 86400000).toISOString().split('T')[0];
                const adjustedSlippedActions = slippedActions.map(a => ({
                    ...a,
                    newDate: tomorrow
                }));
                
                return {
                    type: 'coordinated_planning',
                    confidence: 0.90,
                    reason: 'Coordinating high study workload by deferring overdue items to tomorrow.',
                    explanation: `${intentResult.proposal.explanation} I also noticed some overdue items, but to protect your focus, I propose postponing those overdue tasks until tomorrow.`,
                    reasoning_bullets: [
                        ...studyBullets,
                        "Today's total workload exceeds 4 hours, deferring slipped tasks to tomorrow to avoid burnout"
                    ],
                    actions: [...studyActions, ...adjustedSlippedActions]
                };
            } else {
                return {
                    type: 'coordinated_planning',
                    confidence: 0.88,
                    reason: 'Merging study planning and slipped task rescheduling within safe focus bounds.',
                    explanation: `${intentResult.proposal.explanation} Let's also bring forward yesterday's overdue tasks to today's queue since your schedule has space.`,
                    reasoning_bullets: [
                        ...studyBullets,
                        ...slippedBullets,
                        "Focus load is within safe limits (under 4 hours), merging tasks"
                    ],
                    actions: [...studyActions, ...slippedActions]
                };
            }
        }
        return intentResult.proposal;
    }

    if (slippedResult && slippedResult.hasSlipped) {
        return slippedResult.proposal;
    }

    return null;
}

function applyIntentProposals(actions) {
    const rawDb = mainDb.db;
    const deviceId = mainDb.getDeviceId();
    const now = Date.now();
    const actionGroupId = 'act_' + Math.random().toString(36).substring(2, 11);

    const undoData = [];

    rawDb.transaction((actionList) => {
        for (const action of actionList) {
            if (action.type === 'move') {
                const currentTask = rawDb.prepare("SELECT * FROM tasks WHERE id = ?").get(action.taskId);
                if (currentTask) {
                    undoData.push({
                        type: 'move',
                        taskId: action.taskId,
                        originalDate: currentTask.date,
                        originalStartTime: currentTask.start_time
                    });
                }
                
                const updateStmt = rawDb.prepare(`
                    UPDATE tasks 
                    SET date = ?, start_time = COALESCE(?, start_time), updated_at = ?, device_id = ?, synced = 0 
                    WHERE id = ?
                `);
                updateStmt.run(action.newDate, action.newStartTime || null, now, deviceId, action.taskId);
            } else if (action.type === 'shrink') {
                const currentTask = rawDb.prepare("SELECT * FROM tasks WHERE id = ?").get(action.taskId);
                if (currentTask) {
                    undoData.push({
                        type: 'shrink',
                        taskId: action.taskId,
                        originalDuration: currentTask.duration_min
                    });
                }

                const updateStmt = rawDb.prepare(`
                    UPDATE tasks 
                    SET duration_min = ?, updated_at = ?, device_id = ?, synced = 0 
                    WHERE id = ?
                `);
                updateStmt.run(action.newDuration, now, deviceId, action.taskId);
            } else if (action.type === 'delete') {
                const currentTask = rawDb.prepare("SELECT * FROM tasks WHERE id = ?").get(action.taskId);
                if (currentTask) {
                    undoData.push({
                        type: 'delete',
                        taskId: action.taskId
                    });
                }

                const deleteStmt = rawDb.prepare(`
                    UPDATE tasks 
                    SET deleted = 1, updated_at = ?, device_id = ?, synced = 0 
                    WHERE id = ?
                `);
                deleteStmt.run(now, deviceId, action.taskId);
            } else if (action.type === 'add') {
                const newTaskId = action.id || 'e_' + Math.random().toString(36).substring(2, 11);
                undoData.push({
                    type: 'add',
                    taskId: newTaskId
                });

                const insertStmt = rawDb.prepare(`
                    INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
                    VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 0, 0)
                `);
                insertStmt.run(newTaskId, action.text, action.date, action.calendar || 'personal', action.start_time || null, action.duration_min || 60, now, deviceId);
            }
        }

        rawDb.prepare(`
            INSERT INTO cognitive_actions (id, timestamp, action_type, source_engine, rationale, applied, undo_data)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        `).run(actionGroupId, now, 'restructure', 'orchestrator', 'User applied cognitive proposal', JSON.stringify(undoData));

    })(actions);

    return { success: true, actionId: actionGroupId };
}

function undoCognitiveAction(actionId) {
    const rawDb = mainDb.db;
    const now = Date.now();
    
    let row;
    if (actionId) {
        row = rawDb.prepare("SELECT * FROM cognitive_actions WHERE id = ?").get(actionId);
    } else {
        row = rawDb.prepare("SELECT * FROM cognitive_actions WHERE applied = 1 ORDER BY timestamp DESC LIMIT 1").get();
    }

    if (!row) {
        return { success: false, error: 'No applied actions found to undo.' };
    }

    const undoData = JSON.parse(row.undo_data);
    rawDb.transaction(() => {
        for (const item of undoData) {
            if (item.type === 'move') {
                rawDb.prepare(`
                    UPDATE tasks 
                    SET date = ?, start_time = ?, updated_at = ?, synced = 0 
                    WHERE id = ?
                `).run(item.originalDate, item.originalStartTime || null, now, item.taskId);
            } else if (item.type === 'shrink') {
                rawDb.prepare(`
                    UPDATE tasks 
                    SET duration_min = ?, updated_at = ?, synced = 0 
                    WHERE id = ?
                `).run(item.originalDuration, now, item.taskId);
            } else if (item.type === 'add') {
                rawDb.prepare(`
                    DELETE FROM tasks 
                    WHERE id = ?
                `).run(item.taskId);
            } else if (item.type === 'delete') {
                rawDb.prepare(`
                    UPDATE tasks 
                    SET deleted = 0, updated_at = ?, synced = 0 
                    WHERE id = ?
                `).run(now, item.taskId);
            }
        }
        rawDb.prepare("UPDATE cognitive_actions SET applied = 0 WHERE id = ?").run(row.id);
    })();

    console.log(`✅ Undo executed successfully for action group ${row.id}.`);
    return { success: true, actionId: row.id };
}
