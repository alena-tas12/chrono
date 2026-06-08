/**
 * 🧪 STRESS TEST ENGINE
 * 
 * Simulates long-form conversations to test Chrono's coherence.
 * Tests psychological coherence, emotional continuity, identity persistence,
 * and memory stability over extended interactions.
 */

const orchestrator = require('./cognitiveOrchestrator');
const emotionalContinuity = require('./emotionalContinuity');
const identityStability = require('./identityStability');
const memory = require('./memoryEngine');
const cognitiveDiagnostics = require('./cognitiveDiagnostics');

// ========================================
// 📊 COHERENCE TRACKING
// ========================================

let coherenceMetrics = {
    sessionStart: null,
    sessionEnd: null,
    totalInteractions: 0,
    coherenceScore: 1.0,
    
    // Psychological coherence
    psychological: {
        consistencyScore: 1.0,
        contradictionCount: 0,
        driftDetected: false,
        personalityAnchors: []
    },
    
    // Emotional continuity
    emotional: {
        continuityScore: 1.0,
        abruptTransitions: 0,
        emotionalLoops: 0,
        intensityVariance: 0,
        attachmentStability: 1.0
    },
    
    // Identity persistence
    identity: {
        stabilityScore: 1.0,
        boundaryViolations: 0,
        toneShifts: 0,
        consistencyWithCore: 1.0
    },
    
    // Memory stability
    memory: {
        recallAccuracy: 1.0,
        contextRetention: 1.0,
        hierarchyStability: 1.0,
        corruptionEvents: 0
    }
};

// ========================================
// 🧪 STRESS TEST SCENARIOS
// ========================================

const stressTestScenarios = {
    // 2-4 hour conversation simulation
    longConversation: {
        name: 'Extended Conversation (2-4 hours)',
        duration: 7200000, // 2 hours in ms
        messageInterval: 30000, // Message every 30 seconds
        topics: [
            'work stress',
            'personal goals',
            'relationship concerns',
            'health and wellness',
            'future planning',
            'creative projects',
            'family dynamics',
            'career decisions',
            'mental health',
            'life balance'
        ],
        emotionalArc: ['neutral', 'concerned', 'overwhelmed', 'frustrated', 'calm', 'encouraging', 'neutral']
    },
    
    // Rapid topic switching
    rapidTopicSwitching: {
        name: 'Rapid Topic Switching',
        duration: 1800000, // 30 minutes
        messageInterval: 5000, // Message every 5 seconds
        topics: [
            'coding', 'cooking', 'exercise', 'music', 'travel',
            'books', 'movies', 'politics', 'sports', 'technology',
            'art', 'science', 'history', 'philosophy', 'nature'
        ],
        emotionalArc: ['neutral', 'energetic', 'neutral', 'energetic', 'neutral']
    },
    
    // Emotional escalation
    emotionalEscalation: {
        name: 'Emotional Escalation Test',
        duration: 3600000, // 1 hour
        messageInterval: 15000, // Message every 15 seconds
        topics: ['work stress', 'overwhelm', 'anxiety', 'panic', 'recovery'],
        emotionalArc: ['neutral', 'concerned', 'overwhelmed', 'sad', 'calm', 'supportive']
    },
    
    // Contradictory prompts
    contradictoryPrompts: {
        name: 'Contradictory Prompt Handling',
        duration: 1800000, // 30 minutes
        messageInterval: 20000, // Message every 20 seconds
        topics: ['self-doubt', 'confidence', 'failure', 'success', 'uncertainty'],
        emotionalArc: ['neutral', 'confused', 'frustrated', 'calm', 'neutral'],
        includeContradictions: true
    },
    
    // Memory overload
    memoryOverload: {
        name: 'Memory Overload Test',
        duration: 3600000, // 1 hour
        messageInterval: 10000, // Message every 10 seconds
        topics: generateManyTopics(100),
        emotionalArc: ['neutral', 'neutral', 'neutral', 'neutral', 'neutral']
    },
    
    // Long silence gaps
    longSilenceGaps: {
        name: 'Long Silence Gap Handling',
        duration: 7200000, // 2 hours
        messageInterval: 600000, // Message every 10 minutes
        topics: ['deep reflection', 'life purpose', 'meaning', 'existence'],
        emotionalArc: ['neutral', 'calm', 'thoughtful', 'neutral']
    }
};

function generateManyTopics(count) {
    const topics = [];
    for (let i = 0; i < count; i++) {
        topics.push(`topic_${i}`);
    }
    return topics;
}

// ========================================
// 🧪 TEST EXECUTION
// ========================================

async function runStressTest(scenarioName) {
    const scenario = stressTestScenarios[scenarioName];
    if (!scenario) {
        throw new Error(`Unknown scenario: ${scenarioName}`);
    }

    console.log(`\n🧪 Starting stress test: ${scenario.name}`);
    console.log(`Duration: ${scenario.duration}ms`);
    console.log(`Message interval: ${scenario.messageInterval}ms`);
    
    // Reset metrics
    resetCoherenceMetrics();
    coherenceMetrics.sessionStart = Date.now();
    
    let topicIndex = 0;
    let emotionIndex = 0;
    let interactionCount = 0;
    
    const testInterval = setInterval(() => {
        const elapsed = Date.now() - coherenceMetrics.sessionStart;
        
        if (elapsed >= scenario.duration) {
            clearInterval(testInterval);
            coherenceMetrics.sessionEnd = Date.now();
            console.log(`\n✅ Stress test completed: ${scenario.name}`);
            console.log(`Total interactions: ${interactionCount}`);
            console.log(`Final coherence score: ${coherenceMetrics.coherenceScore.toFixed(3)}`);
            return;
        }
        
        // Generate test input
        const topic = scenario.topics[topicIndex % scenario.topics.length];
        const emotion = scenario.emotionalArc[emotionIndex % scenario.emotionalArc.length];
        
        let input = generateTestInput(topic, emotion, scenario.includeContradictions);
        
        // Process through orchestrator
        try {
            const result = orchestrator.generateOrchestratedResponse(input, {
                currentTask: topic,
                tasks: scenario.topics.length,
                idleTime: scenario.messageInterval
            });
            
            // Track coherence
            trackCoherence(input, result.response, result.state);
            
            interactionCount++;
            coherenceMetrics.totalInteractions++;
            
            // Progress to next topic/emotion
            topicIndex++;
            if (interactionCount % 5 === 0) {
                emotionIndex++;
            }
            
        } catch (error) {
            console.error('Stress test error:', error);
            coherenceMetrics.psychological.contradictionCount++;
        }
        
    }, scenario.messageInterval);
    
    return {
        scenario: scenarioName,
        startTime: coherenceMetrics.sessionStart,
        status: 'running'
    };
}

function generateTestInput(topic, emotion, includeContradictions = false) {
    const templates = [
        `I'm feeling ${emotion} about ${topic}.`,
        `Can we talk about ${topic}? I'm really ${emotion}.`,
        `${topic} is making me feel ${emotion}.`,
        `I need help with ${topic}. I'm so ${emotion}.`,
        `What do you think about ${topic}? I'm ${emotion}.`
    ];
    
    if (includeContradictions && Math.random() > 0.7) {
        const contradictions = [
            `Actually, I don't care about ${topic} at all.`,
            `Wait, I changed my mind about ${topic}.`,
            `I hate ${topic} now.`,
            `${topic} doesn't matter to me anymore.`
        ];
        return contradictions[Math.floor(Math.random() * contradictions.length)];
    }
    
    return templates[Math.floor(Math.random() * templates.length)];
}

// ========================================
// 📊 COHERENCE TRACKING
// ========================================

function trackCoherence(input, response, state) {
    // Psychological coherence
    trackPsychologicalCoherence(input, response, state);
    
    // Emotional continuity
    trackEmotionalContinuity(state);
    
    // Identity persistence
    trackIdentityPersistence(response, state);
    
    // Memory stability
    trackMemoryStability();
    
    // Update overall coherence score
    updateOverallCoherence();
}

function trackPsychologicalCoherence(input, response, state) {
    const recentResponses = memory.getRecentChats(5);
    
    // Check for contradictions
    for (const mem of recentResponses) {
        if (identityStability.detectContradiction(response, mem.aiResponse)) {
            coherenceMetrics.psychological.contradictionCount++;
            coherenceMetrics.psychological.consistencyScore -= 0.1;
        }
    }
    
    // Check for behavioral drift
    const drift = identityStability.detectBehavioralDrift(
        recentResponses.map(r => r.aiResponse).concat(response)
    );
    
    if (drift.drifting) {
        coherenceMetrics.psychological.driftDetected = true;
        coherenceMetrics.psychological.consistencyScore -= 0.05;
    }
    
    // Ensure score doesn't go below 0
    coherenceMetrics.psychological.consistencyScore = Math.max(0, coherenceMetrics.psychological.consistencyScore);
}

function trackEmotionalContinuity(state) {
    const emotionalState = emotionalContinuity.getEmotionalState();
    
    // Check for abrupt transitions
    if (emotionalState.stability < 0.6) {
        coherenceMetrics.emotional.abruptTransitions++;
        coherenceMetrics.emotional.continuityScore -= 0.1;
    }
    
    // Check for emotional loops
    if (emotionalContinuity.detectEmotionalLoop()) {
        coherenceMetrics.emotional.emotionalLoops++;
        coherenceMetrics.emotional.continuityScore -= 0.15;
    }
    
    // Track attachment stability
    coherenceMetrics.emotional.attachmentStability = emotionalState.attachment;
    
    // Ensure score doesn't go below 0
    coherenceMetrics.emotional.continuityScore = Math.max(0, coherenceMetrics.emotional.continuityScore);
}

function trackIdentityPersistence(response, state) {
    const identityState = identityStability.getIdentityState();
    
    // Track consistency score
    coherenceMetrics.identity.stabilityScore = parseFloat(identityState.consistency);
    
    // Check for boundary violations
    const boundaryCheck = identityStability.checkBoundaryCompliance(response);
    if (!boundaryCheck.valid) {
        coherenceMetrics.identity.boundaryViolations++;
        coherenceMetrics.identity.stabilityScore -= 0.1;
    }
    
    // Ensure score doesn't go below 0
    coherenceMetrics.identity.stabilityScore = Math.max(0, coherenceMetrics.identity.stabilityScore);
}

function trackMemoryStability() {
    const hierarchy = memory.getMemoryHierarchy();
    
    // Check total memory count
    const totalMemories = Object.values(hierarchy).reduce((sum, arr) => sum + arr.length, 0);
    
    if (totalMemories > 1000) {
        coherenceMetrics.memory.corruptionEvents++;
        coherenceMetrics.memory.hierarchyStability -= 0.1;
    }
    
    // Ensure score doesn't go below 0
    coherenceMetrics.memory.hierarchyStability = Math.max(0, coherenceMetrics.memory.hierarchyStability);
}

function updateOverallCoherence() {
    const weights = {
        psychological: 0.3,
        emotional: 0.3,
        identity: 0.25,
        memory: 0.15
    };
    
    coherenceMetrics.coherenceScore = 
        (coherenceMetrics.psychological.consistencyScore * weights.psychological) +
        (coherenceMetrics.emotional.continuityScore * weights.emotional) +
        (coherenceMetrics.identity.stabilityScore * weights.identity) +
        (coherenceMetrics.memory.hierarchyStability * weights.memory);
}

function resetCoherenceMetrics() {
    coherenceMetrics = {
        sessionStart: null,
        sessionEnd: null,
        totalInteractions: 0,
        coherenceScore: 1.0,
        
        psychological: {
            consistencyScore: 1.0,
            contradictionCount: 0,
            driftDetected: false,
            personalityAnchors: []
        },
        
        emotional: {
            continuityScore: 1.0,
            abruptTransitions: 0,
            emotionalLoops: 0,
            intensityVariance: 0,
            attachmentStability: 1.0
        },
        
        identity: {
            stabilityScore: 1.0,
            boundaryViolations: 0,
            toneShifts: 0,
            consistencyWithCore: 1.0
        },
        
        memory: {
            recallAccuracy: 1.0,
            contextRetention: 1.0,
            hierarchyStability: 1.0,
            corruptionEvents: 0
        }
    };
}

// ========================================
// 📤 EXPORTS
// ========================================

module.exports = {
    runStressTest,
    stressTestScenarios,
    getCoherenceMetrics: () => coherenceMetrics,
    resetCoherenceMetrics,
    trackCoherence
};
