/**
 * 🔍 COGNITIVE DIAGNOSTICS
 * 
 * Real-time aggregation of all cognitive state for debugging.
 * This is THE tool for understanding Chrono's behavior.
 * 
 * Tracks:
 * - Emotional trajectory
 * - Memory state and weights
 * - Orchestration decisions
 * - Identity consistency
 * - Loop detection status
 * - Presence state
 * - Response synthesis path
 * - Compression summary
 */

const orchestrator = require('./cognitiveOrchestrator');
const emotionalContinuity = require('./emotionalContinuity');
const identityStability = require('./identityStability');
const memory = require('./memoryEngine');
const presence = require('./presenceEngine');
const recursiveLoopProtection = require('./recursiveLoopProtection');
const contextCompression = require('./contextCompression');

// ========================================
// 📊 DIAGNOSTIC STATE
// ========================================

let diagnosticState = {
    lastUpdate: Date.now(),
    sessionStart: Date.now(),
    totalInteractions: 0,
    diagnosticHistory: [],
    maxHistory: 100,
    warnings: [],
    errors: []
};

/**
 * MAIN DIAGNOSTIC AGGREGATOR
 * Call this to get complete cognitive state snapshot
 */
function getCompleteDiagnostics() {
    diagnosticState.lastUpdate = Date.now();
    diagnosticState.totalInteractions++;

    const diagnostics = {
        // Time info
        timestamp: new Date(Date.now()).toISOString(),
        sessionDuration: Date.now() - diagnosticState.sessionStart,
        totalInteractions: diagnosticState.totalInteractions,

        // 🧠 ORCHESTRATOR STATE
        orchestrator: {
            ...orchestrator.getState(),
            state: orchestrator.getCognitiveState()
        },

        // 💔 EMOTIONAL STATE
        emotional: {
            ...emotionalContinuity.getEmotionalState(),
            allEmotions: emotionalContinuity.getEmotionalState().history || []
        },

        // 🛡️ IDENTITY STATE
        identity: {
            ...identityStability.getIdentityState(),
            boundaries: identityStability.getChronoIdentity().boundaries,
            lastContradictions: identityStability.getChronoIdentity().contradictions.slice(-3)
        },

        // 💾 MEMORY STATE
        memory: {
            hierarchy: summarizeMemoryHierarchy(),
            recent: memory.getRecentChats(5),
            emotionalMemories: memory.getEmotionalMemories(3),
            patterns: memory.getPatterns(),
            totalMemories: countTotalMemories()
        },

        // 👁️ PRESENCE STATE
        presence: presence.getPresenceState(),

        // 🔐 RECURSION STATE
        recursion: {
            currentDepth: recursiveLoopProtection.getRecursionDepth(),
            maxAllowed: 5,
            responseLoop: recursiveLoopProtection.detectResponseLoop(''),
            emotionalStability: calculateEmotionalStability()
        },

        // 📦 COMPRESSION STATE
        compression: contextCompression.getCompressionMetrics(),

        // ⚠️ SYSTEM HEALTH
        health: {
            warnings: diagnosticState.warnings.slice(-5),
            errors: diagnosticState.errors.slice(-5),
            overallRisk: assessSystemRisk()
        },

        // 🔍 DEBUGGING INFO
        debug: {
            cognitiveMode: getCognitiveMode(),
            nextRecommendedAction: getNextRecommendation(),
            potentialIssues: detectPotentialIssues()
        }
    };

    recordDiagnosticSnapshot(diagnostics);
    return diagnostics;
}

/**
 * Summarize memory hierarchy
 */
function summarizeMemoryHierarchy() {
    const fullState = memory.getMemoryHierarchy?.() || {};

    return {
        coreIdentity: {
            count: fullState.coreIdentity?.length || 0,
            weight: 1.0
        },
        emotional: {
            count: fullState.emotional?.length || 0,
            weight: 0.8
        },
        longTerm: {
            count: fullState.longTerm?.length || 0,
            weight: 0.6
        },
        shortTerm: {
            count: fullState.shortTerm?.length || 0,
            weight: 0.3
        },
        ephemeral: {
            count: fullState.ephemeral?.length || 0,
            weight: 0.1
        }
    };
}

/**
 * Count total memories
 */
function countTotalMemories() {
    const fullState = memory.getMemoryHierarchy?.() || {};
    return Object.values(fullState).reduce((sum, arr) => sum + (arr?.length || 0), 0);
}

/**
 * Calculate emotional stability
 */
function calculateEmotionalStability() {
    const emotionalState = emotionalContinuity.getEmotionalState();
    return {
        stability: emotionalState.stability,
        intensity: emotionalState.intensity,
        trend: emotionalState.emotional?.trend || 'stable'
    };
}

/**
 * Assess overall system risk
 */
function assessSystemRisk() {
    let riskScore = 0;
    const issues = [];

    // Check emotional stability
    const emotionalState = emotionalContinuity.getEmotionalState();
    if (emotionalState.stability < 0.6) {
        riskScore += 2;
        issues.push('Low emotional stability');
    }

    // Check consistency
    const identityState = identityStability.getIdentityState();
    if (identityState.consistency < 0.7) {
        riskScore += 2;
        issues.push('Identity consistency below threshold');
    }

    // Check recursion depth
    const depth = recursiveLoopProtection.getRecursionDepth();
    if (depth > 3) {
        riskScore += 1;
        issues.push(`High recursion depth (${depth}/5)`);
    }

    // Check memory size
    const totalMemories = countTotalMemories();
    if (totalMemories > 1000) {
        riskScore += 1;
        issues.push('Memory size exceeding optimal range');
    }

    const riskLevel = riskScore <= 1 ? 'low' : riskScore <= 3 ? 'medium' : 'high';

    return {
        score: riskScore,
        level: riskLevel,
        issues
    };
}

/**
 * Determine cognitive mode
 */
function getCognitiveMode() {
    const orchestratorState = orchestrator.getState();
    const emotionalState = emotionalContinuity.getEmotionalState();
    const presenceState = presence.getPresenceState();

    if (!presenceState.active) {
        return 'idle';
    }

    if (orchestratorState.focus === 'focused') {
        return 'deep_focus';
    }

    if (emotionalState.intensity > 0.7) {
        return 'emotional_heightened';
    }

    if (orchestratorState.continuity > 20) {
        return 'engaged_session';
    }

    return 'receptive';
}

/**
 * Get next recommended action based on state
 */
function getNextRecommendation() {
    const systemRisk = assessSystemRisk();

    if (systemRisk.level === 'high') {
        return 'WARNING: Consider system reset or user break';
    }

    const emotionalState = emotionalContinuity.getEmotionalState();
    if (emotionalState.intensity > 0.85) {
        return 'De-escalate emotional intensity with grounding response';
    }

    const totalMemories = countTotalMemories();
    if (totalMemories > 500) {
        return 'Consider memory compression and pruning';
    }

    return 'System operating normally';
}

/**
 * Detect potential issues before they become problems
 */
function detectPotentialIssues() {
    const issues = [];

    // Check for emotional drift
    const emotionalHistory = emotionalContinuity.getEmotionalState().history || [];
    if (emotionalHistory.length > 3) {
        const recentEmotions = emotionalHistory.slice(-5);
        const uniqueEmotions = new Set(recentEmotions.map(e => e.from || e.current));
        if (uniqueEmotions.size > 3) {
            issues.push({
                severity: 'medium',
                issue: 'Rapid emotional transitions detected',
                recommendation: 'May indicate instability - monitor closely'
            });
        }
    }

    // Check for memory loop patterns
    const recentMemories = memory.getRecentChats(10);
    const topics = recentMemories.map(m => m.userInput?.slice(0, 20) || '');
    const uniqueTopics = new Set(topics);
    if (topics.length > 8 && uniqueTopics.size < 3) {
        issues.push({
            severity: 'medium',
            issue: 'Repetitive topic pattern detected',
            recommendation: 'Consider introducing new conversational direction'
        });
    }

    // Check for identity drift
    const identityState = identityStability.getIdentityState();
    if (identityState.recentContradictions > 2) {
        issues.push({
            severity: 'high',
            issue: 'Recent contradictions in identity',
            recommendation: 'Run identity enforcement and check response consistency'
        });
    }

    // Check for abandoned themes
    const abandonedTheme = emotionalContinuity.getAbandonedTheme?.();
    if (abandonedTheme && Date.now() - abandonedTheme.timestamp > 300000) {
        issues.push({
            severity: 'low',
            issue: `Unresolved emotional theme: ${abandonedTheme.emotion}`,
            recommendation: 'Consider circle back to earlier conversation'
        });
    }

    return issues;
}

/**
 * Record diagnostic snapshot for history
 */
function recordDiagnosticSnapshot(diagnostics) {
    diagnosticState.diagnosticHistory.push({
        timestamp: diagnostics.timestamp,
        mode: diagnostics.debug.cognitiveMode,
        risk: diagnostics.health.overallRisk.level,
        emotionalIntensity: diagnostics.emotional.intensity,
        consistency: diagnostics.identity.consistency,
        memories: diagnostics.memory.totalMemories
    });

    if (diagnosticState.diagnosticHistory.length > diagnosticState.maxHistory) {
        diagnosticState.diagnosticHistory.shift();
    }
}

/**
 * Add warning
 */
function addWarning(warning) {
    diagnosticState.warnings.push({
        timestamp: Date.now(),
        message: warning
    });

    if (diagnosticState.warnings.length > 20) {
        diagnosticState.warnings.shift();
    }
}

/**
 * Add error
 */
function addError(error) {
    diagnosticState.errors.push({
        timestamp: Date.now(),
        message: error,
        stack: error.stack || ''
    });

    if (diagnosticState.errors.length > 10) {
        diagnosticState.errors.shift();
    }
}

/**
 * Get diagnostic history for visualization
 */
function getDiagnosticHistory(limit = 50) {
    return diagnosticState.diagnosticHistory.slice(-limit);
}

/**
 * Get summary for quick viewing
 */
function getQuickSummary() {
    const full = getCompleteDiagnostics();

    return {
        timestamp: full.timestamp,
        mode: full.debug.cognitiveMode,
        emotion: full.emotional.current,
        emotionalIntensity: full.emotional.intensity,
        focus: full.orchestrator.focus,
        consistency: full.identity.consistency,
        totalMemories: full.memory.totalMemories,
        risk: full.health.overallRisk.level,
        issues: full.debug.potentialIssues.length,
        recommendation: full.debug.nextRecommendedAction
    };
}

// ========================================
// 📤 EXPORTS
// ========================================

module.exports = {
    getCompleteDiagnostics,
    getDiagnosticHistory,
    getQuickSummary,
    addWarning,
    addError,
    assessSystemRisk,
    detectPotentialIssues,
    getCognitiveMode
};
