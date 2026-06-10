/**
 * ⚡ PERFORMANCE + LATENCY OPTIMIZATION
 * 
 * Optimizes Chrono's performance as architecture scales.
 * Implements selective engine activation, memory caching,
 * async orchestration optimization, and prioritization layers.
 */

const memory = require('./memoryEngine');
const emotionalContinuity = require('./emotionalContinuity');
const identityStability = require('./identityStability');

// ========================================
// 🚀 PERFORMANCE STATE
// ========================================

let performanceState = {
    // Engine activation state
    engines: {
        cognitiveOrchestrator: { active: true, lastUsed: Date.now(), activationCount: 0 },
        presenceEngine: { active: true, lastUsed: Date.now(), activationCount: 0 },
        memoryEngine: { active: true, lastUsed: Date.now(), activationCount: 0 },
        emotionalContinuity: { active: true, lastUsed: Date.now(), activationCount: 0 },
        identityStability: { active: true, lastUsed: Date.now(), activationCount: 0 },
        safetyFramework: { active: true, lastUsed: Date.now(), activationCount: 0 }
    },
    
    // Memory cache
    cache: {
        enabled: true,
        maxSize: 100,
        currentSize: 0,
        hits: 0,
        misses: 0,
        store: new Map()
    },
    
    // Prioritization layers
    prioritization: {
        currentLayer: 'normal', // minimal, normal, comprehensive
        adaptive: true,
        loadBased: true
    },
    
    // Async operations
    async: {
        enabled: true,
        pendingOperations: 0,
        completedOperations: 0,
        averageLatency: 0
    },
    
    // Performance metrics
    metrics: {
        responseTimes: [],
        averageResponseTime: 0,
        peakResponseTime: 0,
        lastOptimization: Date.now()
    }
};

// ========================================
// 🔧 SELECTIVE ENGINE ACTIVATION
// ========================================

/**
 * Determine which engines should be activated based on context
 */
function determineEngineActivation(context = {}) {
    const activation = {
        cognitiveOrchestrator: true,
        presenceEngine: true,
        memoryEngine: true,
        emotionalContinuity: true,
        identityStability: true,
        safetyFramework: true
    };
    
    // Minimal layer - only essential engines
    if (performanceState.prioritization.currentLayer === 'minimal') {
        activation.emotionalContinuity = context.emotion !== 'neutral';
        activation.identityStability = context.interactionCount > 10;
        activation.presenceEngine = context.idleTime > 60000; // Only if idle > 1 min
    }
    
    // Adaptive activation based on context
    if (performanceState.prioritization.adaptive) {
        // Deactivate emotional continuity if emotion is stable
        const emotionalState = emotionalContinuity.getEmotionalState();
        if (emotionalState.stability > 0.9 && emotionalState.intensity < 0.3) {
            activation.emotionalStability = false;
        }
        
        // Deactivate identity checks if consistency is high
        const identityState = identityStability.getIdentityState();
        if (identityState.consistency > 0.95) {
            activation.identityStability = false;
        }
    }
    
    // Update engine state
    for (const [engine, shouldActivate] of Object.entries(activation)) {
        if (performanceState.engines[engine]) {
            performanceState.engines[engine].active = shouldActivate;
            if (shouldActivate) {
                performanceState.engines[engine].lastUsed = Date.now();
                performanceState.engines[engine].activationCount++;
            }
        }
    }
    
    return activation;
}

/**
 * Set prioritization layer
 */
function setPrioritizationLayer(layer) {
    const validLayers = ['minimal', 'normal', 'comprehensive'];
    if (!validLayers.includes(layer)) {
        layer = 'normal';
    }
    
    performanceState.prioritization.currentLayer = layer;
    performanceState.metrics.lastOptimization = Date.now();
    
    return layer;
}

/**
 * Auto-adjust prioritization based on system load
 */
function autoAdjustPrioritization(loadMetrics = {}) {
    if (!performanceState.prioritization.loadBased) return;
    
    const { responseTime, memoryUsage, pendingOperations } = loadMetrics;
    
    // If response time is high, switch to minimal
    if (responseTime > 1000) {
        setPrioritizationLayer('minimal');
    }
    // If response time is normal, use normal layer
    else if (responseTime < 500) {
        setPrioritizationLayer('normal');
    }
    // If system is under low load, use comprehensive
    else if (responseTime < 200 && pendingOperations < 2) {
        setPrioritizationLayer('comprehensive');
    }
}

// ========================================
// 💾 MEMORY CACHING
// ========================================

/**
 * Get cached value if available
 */
function getCached(key) {
    if (!performanceState.cache.enabled) return null;
    
    const cached = performanceState.cache.store.get(key);
    
    if (cached) {
        // Check if cache is still valid (5 minute TTL)
        if (Date.now() - cached.timestamp < 300000) {
            performanceState.cache.hits++;
            return cached.value;
        } else {
            // Cache expired
            performanceState.cache.store.delete(key);
            performanceState.cache.currentSize--;
        }
    }
    
    performanceState.cache.misses++;
    return null;
}

/**
 * Set cached value
 */
function setCached(key, value) {
    if (!performanceState.cache.enabled) return;
    
    // Evict oldest if at capacity
    if (performanceState.cache.currentSize >= performanceState.cache.maxSize) {
        const oldestKey = performanceState.cache.store.keys().next().value;
        performanceState.cache.store.delete(oldestKey);
        performanceState.cache.currentSize--;
    }
    
    performanceState.cache.store.set(key, {
        value,
        timestamp: Date.now()
    });
    
    performanceState.cache.currentSize++;
}

/**
 * Clear cache
 */
function clearCache() {
    performanceState.cache.store.clear();
    performanceState.cache.currentSize = 0;
    performanceState.cache.hits = 0;
    performanceState.cache.misses = 0;
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    const totalRequests = performanceState.cache.hits + performanceState.cache.misses;
    const hitRate = totalRequests > 0 ? performanceState.cache.hits / totalRequests : 0;
    
    return {
        enabled: performanceState.cache.enabled,
        currentSize: performanceState.cache.currentSize,
        maxSize: performanceState.cache.maxSize,
        hits: performanceState.cache.hits,
        misses: performanceState.cache.misses,
        hitRate: hitRate.toFixed(3)
    };
}

// ========================================
// ⚡ ASYNC ORCHESTRATION OPTIMIZATION
// ========================================

/**
 * Execute operation asynchronously with timeout
 */
async function executeAsync(operation, timeout = 5000) {
    if (!performanceState.async.enabled) {
        return operation();
    }
    
    performanceState.async.pendingOperations++;
    const startTime = Date.now();
    
    try {
        const result = await Promise.race([
            operation(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
        
        const latency = Date.now() - startTime;
        performanceState.async.completedOperations++;
        performanceState.async.pendingOperations--;
        
        // Update average latency
        const totalOps = performanceState.async.completedOperations;
        performanceState.async.averageLatency = 
            (performanceState.async.averageLatency * (totalOps - 1) + latency) / totalOps;
        
        return result;
    } catch (error) {
        performanceState.async.pendingOperations--;
        throw error;
    }
}

/**
 * Execute multiple operations in parallel where possible
 */
async function executeParallel(operations) {
    if (!performanceState.async.enabled) {
        return operations.map(op => op());
    }
    
    return Promise.all(operations.map(op => executeAsync(op)));
}

/**
 * Execute operations with priority (high priority first)
 */
async function executePrioritized(operations) {
    if (!performanceState.async.enabled) {
        return operations.map(op => op());
    }
    
    // Sort by priority
    const sorted = operations.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // Execute high priority first, then others in parallel
    const highPriority = sorted.filter(op => (op.priority || 0) >= 8);
    const normalPriority = sorted.filter(op => (op.priority || 0) < 8);
    
    const highResults = await Promise.all(highPriority.map(op => executeAsync(op.fn)));
    const normalResults = await Promise.all(normalPriority.map(op => executeAsync(op.fn)));
    
    return [...highResults, ...normalResults];
}

// ========================================
// 📊 PERFORMANCE METRICS
// ========================================

/**
 * Record response time
 */
function recordResponseTime(responseTime) {
    performanceState.metrics.responseTimes.push({
        time: responseTime,
        timestamp: Date.now()
    });
    
    // Keep only last 100 measurements
    if (performanceState.metrics.responseTimes.length > 100) {
        performanceState.metrics.responseTimes.shift();
    }
    
    // Update average
    const times = performanceState.metrics.responseTimes.map(r => r.time);
    performanceState.metrics.averageResponseTime = 
        times.reduce((a, b) => a + b, 0) / times.length;
    
    // Update peak
    performanceState.metrics.peakResponseTime = Math.max(
        performanceState.metrics.peakResponseTime,
        responseTime
    );
    
    // Auto-adjust prioritization based on performance
    autoAdjustPrioritization({
        responseTime,
        pendingOperations: performanceState.async.pendingOperations
    });
}

/**
 * Get performance metrics
 */
function getPerformanceMetrics() {
    return {
        engines: performanceState.engines,
        cache: getCacheStats(),
        prioritization: performanceState.prioritization,
        async: {
            enabled: performanceState.async.enabled,
            pendingOperations: performanceState.async.pendingOperations,
            completedOperations: performanceState.async.completedOperations,
            averageLatency: performanceState.async.averageLatency.toFixed(2)
        },
        metrics: {
            averageResponseTime: performanceState.metrics.averageResponseTime.toFixed(2),
            peakResponseTime: performanceState.metrics.peakResponseTime,
            lastOptimization: new Date(performanceState.metrics.lastOptimization).toISOString()
        }
    };
}

/**
 * Optimize for current load
 */
function optimizeForLoad() {
    const metrics = getPerformanceMetrics();
    
    // If average response time is high, enable minimal layer
    if (metrics.metrics.averageResponseTime > 800) {
        setPrioritizationLayer('minimal');
    }
    // If response time is good, enable comprehensive
    else if (metrics.metrics.averageResponseTime < 300) {
        setPrioritizationLayer('comprehensive');
    }
    
    // If cache hit rate is low, increase cache size
    if (parseFloat(metrics.cache.hitRate) < 0.3 && performanceState.cache.maxSize < 200) {
        performanceState.cache.maxSize += 50;
    }
    
    return metrics;
}

/**
 * Reset performance state
 */
function resetPerformanceState() {
    performanceState = {
        engines: {
            cognitiveOrchestrator: { active: true, lastUsed: Date.now(), activationCount: 0 },
            presenceEngine: { active: true, lastUsed: Date.now(), activationCount: 0 },
            memoryEngine: { active: true, lastUsed: Date.now(), activationCount: 0 },
            emotionalContinuity: { active: true, lastUsed: Date.now(), activationCount: 0 },
            identityStability: { active: true, lastUsed: Date.now(), activationCount: 0 },
            safetyFramework: { active: true, lastUsed: Date.now(), activationCount: 0 }
        },
        cache: {
            enabled: true,
            maxSize: 100,
            currentSize: 0,
            hits: 0,
            misses: 0,
            store: new Map()
        },
        prioritization: {
            currentLayer: 'normal',
            adaptive: true,
            loadBased: true
        },
        async: {
            enabled: true,
            pendingOperations: 0,
            completedOperations: 0,
            averageLatency: 0
        },
        metrics: {
            responseTimes: [],
            averageResponseTime: 0,
            peakResponseTime: 0,
            lastOptimization: Date.now()
        }
    };
}

module.exports = {
    // Engine activation
    determineEngineActivation,
    setPrioritizationLayer,
    autoAdjustPrioritization,
    
    // Memory caching
    getCached,
    setCached,
    clearCache,
    getCacheStats,
    
    // Async operations
    executeAsync,
    executeParallel,
    executePrioritized,
    
    // Performance metrics
    recordResponseTime,
    getPerformanceMetrics,
    optimizeForLoad,
    resetPerformanceState
};
