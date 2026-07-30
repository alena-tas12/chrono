const mainDb = require('./main_db');
const db = mainDb.db;

// 🧠 HIERARCHICAL MEMORY STORAGE
let sessionHistory = [];
let chatHistory = [];

/**
 * Memory Hierarchy Types:
 * - CORE_IDENTITY: fundamental aspects of Chrono's personality
 * - EMOTIONAL: emotionally significant events
 * - LONG_TERM: user facts and patterns
 * - SHORT_TERM: recent conversation context
 * - EPHEMERAL: temporary, session-specific data
 */

let memoryHierarchy = {
    coreIdentity: [],      // weight: 1.0 (never decay)
    emotional: [],         // weight: 0.8 (slow decay)
    longTerm: [],          // weight: 0.6 (moderate decay)
    shortTerm: [],         // weight: 0.3 (fast decay)
    ephemeral: []          // weight: 0.1 (very fast decay)
};

let memoryMetadata = {
    totalRecall: 0,
    lastPruned: Date.now(),
    emotionalWeighting: true,
    lastDecayCalculation: Date.now()
};

// ========================================
// 📉 MEMORY DECAY CONFIGURATION
// ========================================

const decayConfig = {
    // Decay rates per memory type (per hour)
    decayRates: {
        coreIdentity: 0.0,      // Never decays
        emotional: 0.001,       // Very slow decay
        longTerm: 0.005,        // Slow decay
        shortTerm: 0.02,        // Moderate decay
        ephemeral: 0.05         // Fast decay
    },
    
    // Reinforcement multipliers
    reinforcementMultipliers: {
        recalled: 1.5,           // Boost when recalled
        referenced: 1.3,        // Boost when referenced
        emotional: 1.4,         // Boost for emotional memories
        themeMatch: 1.2         // Boost for matching current theme
    },
    
    // Decay calculation interval (ms)
    decayInterval: 3600000,     // Every hour
    
    // Minimum relevance threshold
    minRelevance: 0.1
};

/* =========================
   💬 HIERARCHICAL CHAT MEMORY
========================= */

function saveChat(userInput, aiResponse) {
    const entry = {
        id: mainDb.generateUUID(),
        source: 'chat',
        userInput,
        aiResponse,
        timestamp: Date.now(),
        emotion: 'neutral',
        attention: 'open',
        importance: 0.5
    };

    chatHistory.push(entry);

    // Determine memory type based on context
    const memoryType = classifyMemory(userInput, aiResponse);
    saveToHierarchy(entry, memoryType);

    try {
        const deviceId = mainDb.getDeviceId();
        const updatedAt = Date.now();
        db.prepare(`
            INSERT OR REPLACE INTO memory_chat (id, user_input, ai_response, timestamp, updated_at, device_id, synced)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `).run(entry.id, userInput, aiResponse, entry.timestamp, updatedAt, deviceId);
    } catch (e) {
        console.error("Failed to save chat to local memory db:", e.message);
    }
}

/**
 * Save to memory with context and hierarchy
 */
function saveChatWithContext(userInput, aiResponse, context = {}) {
    const entry = {
        id: mainDb.generateUUID(),
        source: 'chat',
        userInput,
        aiResponse,
        timestamp: Date.now(),
        emotion: context.emotion || 'neutral',
        attention: context.attention || 'open',
        priority: context.priority || null,
        importance: calculateImportance(userInput, context)
    };

    chatHistory.push(entry);

    const memoryType = classifyMemory(userInput, aiResponse, context);
    saveToHierarchy(entry, memoryType);

    try {
        const deviceId = mainDb.getDeviceId();
        const updatedAt = Date.now();
        db.prepare(`
            INSERT OR REPLACE INTO memory_chat (id, user_input, ai_response, timestamp, updated_at, device_id, synced)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `).run(entry.id, userInput, aiResponse, entry.timestamp, updatedAt, deviceId);
    } catch (e) {
        console.error("Failed to save chat with context to local memory db:", e.message);
    }
}

/**
 * Classify memory into hierarchy
 */
function classifyMemory(userInput, aiResponse, context = {}) {
    const lower = userInput.toLowerCase();
    const emotion = context.emotion || 'neutral';

    // Emotional significance
    if (['overwhelmed', 'frustrated', 'sad', 'anxious'].includes(emotion)) {
        return 'emotional';
    }

    // Core identity questions
    if (lower.includes('who are you') || lower.includes('what\'s your name')) {
        return 'coreIdentity';
    }

    // User facts
    if (lower.includes('i ') || lower.includes('my ')) {
        if (lower.includes('always') || lower.includes('usually') || lower.includes('tend')) {
            return 'longTerm';
        }
    }

    // Recent conversation
    if (context.attention === 'focused' || context.priority) {
        return 'shortTerm';
    }

    // Default to ephemeral
    return 'ephemeral';
}

/**
 * Calculate importance score (0-1)
 */
function calculateImportance(input, context = {}) {
    let score = 0.5;

    // Emotional content increases importance
    const emotionalKeywords = ['overwhelmed', 'frustrated', 'exhausted', 'excited', 'worried'];
    if (emotionalKeywords.some(kw => input.toLowerCase().includes(kw))) {
        score += 0.3;
    }

    // Focused attention increases importance
    if (context.attention === 'focused') {
        score += 0.15;
    }

    // High priority increases importance
    if (context.priority === 'high' || context.priority === 'critical') {
        score += 0.2;
    }

    return Math.min(1, score);
}

/**
 * Save to appropriate hierarchy level
 */
function saveToHierarchy(entry, memoryType = 'shortTerm') {
    if (!memoryHierarchy[memoryType]) {
        memoryHierarchy.shortTerm.push(entry);
        return;
    }

    memoryHierarchy[memoryType].push(entry);

    // Keep bounded
    const limits = {
        coreIdentity: 50,
        emotional: 100,
        longTerm: 200,
        shortTerm: 100,
        ephemeral: 50
    };

    if (memoryHierarchy[memoryType].length > limits[memoryType]) {
        memoryHierarchy[memoryType].shift();
    }
}

function getRecentChats(limit = 5) {
    return chatHistory.slice(-limit);
}

function resetChatHistory() {
    chatHistory = [];
    for (const type in memoryHierarchy) {
        memoryHierarchy[type] = memoryHierarchy[type].filter(mem => mem.source !== 'chat');
    }
    try {
        db.prepare('DELETE FROM memory_chat').run();
    } catch (e) {
        console.error('Failed to clear chat history from DB:', e.message);
    }
}

function getChatBackupData() {
    try {
        return db.prepare('SELECT * FROM memory_chat ORDER BY timestamp ASC').all();
    } catch (e) {
        console.error('Failed to read chat backup data:', e.message);
        return [];
    }
}

function importChatBackupData(entries = []) {
    if (!Array.isArray(entries)) {
        throw new Error('Expected an array of chat backup entries');
    }

    const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO memory_chat (id, user_input, ai_response, timestamp, updated_at, device_id, synced)
        VALUES (?, ?, ?, ?, ?, ?, 0)
    `);

    const insertTransaction = db.transaction((items) => {
        items.forEach(item => {
            const id = item.id || mainDb.generateUUID();
            const timestamp = item.timestamp || Date.now();
            const deviceId = mainDb.getDeviceId();
            const updatedAt = Date.now();
            const userInput = item.userInput || item.user_input || '';
            const aiResponse = item.aiResponse || item.ai_response || '';
            insertStmt.run(id, userInput, aiResponse, timestamp, updatedAt, deviceId);

            const entry = {
                id,
                source: 'chat',
                userInput,
                aiResponse,
                timestamp,
                emotion: item.emotion || 'neutral',
                attention: item.attention || 'open',
                importance: item.importance || 0.5
            };
            chatHistory.push(entry);
            const memoryType = classifyMemory(userInput, aiResponse, { emotion: entry.emotion, attention: entry.attention });
            saveToHierarchy(entry, memoryType);
        });
    });

    insertTransaction(entries);
    return entries.length;
}

/**
 * Retrieve memories by hierarchy (weighted recall)
 */
function getHierarchicalMemories(limit = 10) {
    const weights = {
        coreIdentity: 1.0,
        emotional: 0.8,
        longTerm: 0.6,
        shortTerm: 0.3,
        ephemeral: 0.1
    };

    const combined = [];

    for (const [type, memories] of Object.entries(memoryHierarchy)) {
        memories.forEach(mem => {
            combined.push({
                ...mem,
                type,
                weight: weights[type],
                score: (mem.importance || 0.5) * weights[type]
            });
        });
    }

    // Sort by weight and recency
    combined.sort((a, b) => {
        const scoreWeight = (b.score - a.score) * 0.6;
        const recencyWeight = (b.timestamp - a.timestamp) * 0.4;
        return scoreWeight + recencyWeight;
    });

    return combined.slice(0, limit);
}

/**
 * Prune old memories to prevent bloat
 */
function pruneMemories(maxAge = 604800000) { // 7 days default
    const now = Date.now();
    const threshold = now - maxAge;

    for (const type in memoryHierarchy) {
        memoryHierarchy[type] = memoryHierarchy[type].filter(mem => mem.timestamp > threshold);
    }

    memoryMetadata.lastPruned = now;
}

/* =========================
   🧠 BEHAVIOR MEMORY
========================= */

function saveBehavior(type, value) {
    try {
        db.prepare(`
            INSERT INTO memory_behavior (type, value, timestamp)
            VALUES (?, ?, ?)
        `).run(type, value, Date.now());
    } catch (e) {
        // safe fallback
    }
}

/* =========================
   ⏱ SESSION MEMORY
========================= */

function logSession(task, duration) {
    const entry = {
        task,
        duration,
        time: new Date(),
        timestamp: Date.now()
    };

    sessionHistory.push(entry);

    // High-value behavior memory
    saveBehavior("session", JSON.stringify(entry));
    saveToHierarchy(entry, 'longTerm');
}

function getHistory() {
    return sessionHistory;
}

/* =========================
   📊 ANALYTICS (with hierarchy)
========================= */

function getAverageFocusTime() {
    if (sessionHistory.length === 0) return 0;

    const total = sessionHistory.reduce((sum, h) => sum + h.duration, 0);
    return total / sessionHistory.length;
}

function getMostFrequentTask() {
    if (sessionHistory.length === 0) return null;

    const taskCounts = {};
    sessionHistory.forEach(h => {
        taskCounts[h.task] = (taskCounts[h.task] || 0) + 1;
    });

    return Object.keys(taskCounts).reduce((a, b) =>
        taskCounts[a] > taskCounts[b] ? a : b
    );
}

/**
 * Get emotional memory - what made an impact?
 */
function getEmotionalMemories(limit = 5) {
    return memoryHierarchy.emotional
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
}

/**
 * Get core identity anchors
 */
function getCoreIdentity() {
    return memoryHierarchy.coreIdentity;
}

/**
 * Get pattern memory
 */
function getPatterns() {
    const longTerm = memoryHierarchy.longTerm;
    const patterns = {};

    longTerm.forEach(mem => {
        if (mem.userInput) {
            const key = mem.userInput.slice(0, 30); // summarize
            patterns[key] = (patterns[key] || 0) + 1;
        }
    });

    return Object.entries(patterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
}

/**
 * Context compression - summarize memories for token efficiency
 */
function compressContext(memories = []) {
    if (memories.length === 0) return '';

    const summary = memories
        .sort((a, b) => (b.importance || 0) - (a.importance || 0))
        .slice(0, 3)
        .map(m => `[${m.type}] ${m.userInput.slice(0, 50)}...`)
        .join('; ');

    return summary;
}

/* =========================
   📉 MEMORY DECAY SYSTEM
========================= */

/**
 * Calculate memory decay for all memories
 * Called periodically to reduce relevance of old memories
 */
function calculateMemoryDecay() {
    const now = Date.now();
    const hoursSinceLastCalc = (now - memoryMetadata.lastDecayCalculation) / 3600000;
    
    if (hoursSinceLastCalc < 1) {
        return; // Only calculate once per hour
    }
    
    for (const type in memoryHierarchy) {
        const decayRate = decayConfig.decayRates[type] || 0.02;
        
        memoryHierarchy[type] = memoryHierarchy[type].map(memory => {
            const ageInHours = (now - memory.timestamp) / 3600000;
            const currentRelevance = memory.relevance || 1.0;
            
            // Apply exponential decay
            const decayedRelevance = currentRelevance * Math.pow(1 - decayRate, ageInHours);
            
            return {
                ...memory,
                relevance: Math.max(decayConfig.minRelevance, decayedRelevance),
                lastDecayed: now
            };
        });
    }
    
    memoryMetadata.lastDecayCalculation = now;
    
    // Remove memories below relevance threshold
    pruneByRelevance();
}

/**
 * Reinforce a memory (boost its relevance)
 */
function reinforceMemory(memoryId, reason = 'recalled') {
    const multiplier = decayConfig.reinforcementMultipliers[reason] || 1.2;
    
    for (const type in memoryHierarchy) {
        const memory = memoryHierarchy[type].find(m => m.id === memoryId);
        if (memory) {
            memory.relevance = Math.min(1.0, (memory.relevance || 1.0) * multiplier);
            memory.reinforcedAt = Date.now();
            memory.reinforcedReason = reason;
            break;
        }
    }
}

/**
 * Recalculate emotional relevance of memories
 * Emotional memories may gain/lose relevance based on current emotional state
 */
function recalculateEmotionalRelevance(currentEmotion) {
    const emotionalMemories = memoryHierarchy.emotional;
    
    emotionalMemories.forEach(memory => {
        if (memory.emotion === currentEmotion) {
            // Boost relevance if emotion matches current state
            memory.relevance = Math.min(1.0, (memory.relevance || 0.5) * decayConfig.reinforcementMultipliers.emotional);
        } else {
            // Slightly reduce if emotion doesn't match
            memory.relevance = Math.max(decayConfig.minRelevance, (memory.relevance || 0.5) * 0.95);
        }
    });
}

/**
 * Prune memories by relevance threshold
 */
function pruneByRelevance() {
    for (const type in memoryHierarchy) {
        const originalLength = memoryHierarchy[type].length;
        
        memoryHierarchy[type] = memoryHierarchy[type].filter(
            memory => (memory.relevance || 1.0) >= decayConfig.minRelevance
        );
        
        const prunedCount = originalLength - memoryHierarchy[type].length;
        if (prunedCount > 0) {
            console.log(`Pruned ${prunedCount} ${type} memories below relevance threshold`);
        }
    }
}

/**
 * Symbolic consolidation - merge similar memories
 */
function consolidateMemories() {
    for (const type in memoryHierarchy) {
        if (type === 'coreIdentity') continue; // Don't consolidate core identity
        
        const memories = memoryHierarchy[type];
        const consolidated = [];
        const seen = new Set();
        
        memories.forEach(memory => {
            const signature = generateMemorySignature(memory);
            
            if (seen.has(signature)) {
                // Merge with existing
                const existing = consolidated.find(m => generateMemorySignature(m) === signature);
                if (existing) {
                    existing.relevance = Math.max(existing.relevance || 0.5, memory.relevance || 0.5);
                    existing.referenceCount = (existing.referenceCount || 0) + 1;
                }
            } else {
                seen.add(signature);
                memory.referenceCount = 1;
                consolidated.push(memory);
            }
        });
        
        memoryHierarchy[type] = consolidated;
    }
}

/**
 * Generate signature for memory consolidation
 */
function generateMemorySignature(memory) {
    if (!memory.userInput) return 'empty';
    return memory.userInput
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .sort()
        .join(' ')
        .slice(0, 50); // First 50 chars of sorted words
}

/**
 * Theme abstraction - extract higher-level themes from memories
 */
function abstractThemes(memories = []) {
    const themes = {};
    
    memories.forEach(memory => {
        if (memory.userInput) {
            const words = memory.userInput.toLowerCase().split(/\s+/);
            words.forEach(word => {
                if (word.length > 3) { // Only meaningful words
                    themes[word] = (themes[word] || 0) + (memory.relevance || 1.0);
                }
            });
        }
    });
    
    // Return top themes
    return Object.entries(themes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([theme, weight]) => ({ theme, weight }));
}

/**
 * Adaptive retrieval prioritization
 * Returns memories sorted by relevance, recency, and context match
 */
function getAdaptiveMemories(limit = 10, context = {}) {
    const allMemories = [];
    
    for (const [type, memories] of Object.entries(memoryHierarchy)) {
        memories.forEach(memory => {
            let adaptiveScore = memory.relevance || 1.0;
            
            // Boost for context match
            if (context.theme && memory.userInput?.toLowerCase().includes(context.theme.toLowerCase())) {
                adaptiveScore *= decayConfig.reinforcementMultipliers.themeMatch;
            }
            
            // Boost for emotional context match
            if (context.emotion && memory.emotion === context.emotion) {
                adaptiveScore *= decayConfig.reinforcementMultipliers.emotional;
            }
            
            // Recency factor (more recent = higher score)
            const ageInHours = (Date.now() - memory.timestamp) / 3600000;
            const recencyFactor = Math.pow(0.95, ageInHours);
            
            adaptiveScore *= recencyFactor;
            
            allMemories.push({
                ...memory,
                type,
                adaptiveScore
            });
        });
    }
    
    // Sort by adaptive score
    allMemories.sort((a, b) => b.adaptiveScore - a.adaptiveScore);
    
    return allMemories.slice(0, limit);
}

/**
 * Get memory decay statistics
 */
function getDecayStats() {
    const stats = {
        lastCalculated: new Date(memoryMetadata.lastDecayCalculation).toISOString(),
        totalMemories: 0,
        averageRelevance: 0,
        byType: {}
    };
    
    let totalRelevance = 0;
    let totalCount = 0;
    
    for (const [type, memories] of Object.entries(memoryHierarchy)) {
        const typeRelevance = memories.reduce((sum, m) => sum + (m.relevance || 1.0), 0);
        const typeCount = memories.length;
        
        stats.byType[type] = {
            count: typeCount,
            averageRelevance: typeCount > 0 ? typeRelevance / typeCount : 0,
            decayRate: decayConfig.decayRates[type]
        };
        
        totalRelevance += typeRelevance;
        totalCount += typeCount;
    }
    
    stats.totalMemories = totalCount;
    stats.averageRelevance = totalCount > 0 ? totalRelevance / totalCount : 0;
    
    return stats;
}

/* =========================
    📦 EXPORTS
 ========================= */

/**
 * Load existing memory data from the SQLite database on startup
 */
function initializeMemory() {
    try {
        // Clear local cache arrays first to prevent duplication on re-init
        sessionHistory = [];
        chatHistory = [];
        for (const key in memoryHierarchy) {
            memoryHierarchy[key] = [];
        }

        // Load sessions from memory_behavior
        const sessions = db.prepare("SELECT * FROM memory_behavior WHERE type = 'session' ORDER BY timestamp ASC").all();
        sessions.forEach(row => {
            try {
                const entry = JSON.parse(row.value);
                sessionHistory.push(entry);
                saveToHierarchy(entry, 'longTerm');
            } catch (e) {
                console.error("Error parsing session behavior:", e);
            }
        });

        // Load chats from memory_chat
        const chats = db.prepare("SELECT * FROM memory_chat ORDER BY timestamp ASC").all();
        chats.forEach(row => {
            const entry = {
                    id: row.id || mainDb.generateUUID(),
                    source: row.source || 'chat',
                    userInput: row.user_input,
                    aiResponse: row.ai_response,
                    timestamp: row.timestamp,
                    emotion: row.emotion || 'neutral',
                    attention: row.attention || 'open',
                    importance: row.importance || 0.5
                };
                chatHistory.push(entry);
                const memoryType = classifyMemory(row.user_input, row.ai_response, {
                    emotion: entry.emotion,
                    attention: entry.attention
                });
                saveToHierarchy(entry, memoryType);
        });

        console.log(`🧠 Memory initialized: loaded ${sessionHistory.length} sessions and ${chatHistory.length} chats from DB.`);
    } catch (error) {
        console.error("🚨 Failed to initialize memory from DB:", error);
    }
}

// Run startup initialization
initializeMemory();

module.exports = {
    // Initialization
    initializeMemory,

    // Chat memory
    saveChat,
    saveChatWithContext,
    getRecentChats,

    // Behavior memory
    saveBehavior,

    // Session memory
    logSession,
    getHistory,

    // Analytics
    getAverageFocusTime,
    getMostFrequentTask,

    // Hierarchical memory
    getHierarchicalMemories,
    getEmotionalMemories,
    getCoreIdentity,
    getPatterns,
    pruneMemories,
    resetChatHistory,
    getChatBackupData,
    importChatBackupData,

    // Context compression
    compressContext,

    // Memory decay system
    calculateMemoryDecay,
    reinforceMemory,
    recalculateEmotionalRelevance,
    consolidateMemories,
    abstractThemes,
    getAdaptiveMemories,
    getDecayStats,

    // Direct access for debugging
    getMemoryHierarchy: () => memoryHierarchy,
    getMemoryMetadata: () => memoryMetadata
};