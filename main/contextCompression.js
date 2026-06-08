/**
 * 📦 CONTEXT COMPRESSION SYSTEM
 * 
 * Handles memory compression and abstraction to prevent
 * token overflow and maintain coherence over long conversations.
 * 
 * Summarizes, abstracts, and compresses memories for efficiency.
 */

const memory = require('./memoryEngine');

// ========================================
// 🔍 CONTEXT COMPRESSION
// ========================================

let compressionState = {
    totalSessions: 0,
    compressionRatio: 0,
    lastCompression: Date.now(),
    abstractions: []
};

/**
 * Create abstraction (high-level summary) from memories
 */
function createAbstraction(memories = []) {
    if (memories.length === 0) return null;

    // Extract themes
    const themes = extractThemes(memories);

    // Extract patterns
    const patterns = extractPatterns(memories);

    // Emotional trajectory
    const emotionalTrajectory = getEmotionalTrajectory(memories);

    const abstraction = {
        timestamp: Date.now(),
        themes,
        patterns,
        emotionalTrajectory,
        memoryCount: memories.length,
        summary: generateSummary(themes, patterns)
    };

    compressionState.abstractions.push(abstraction);

    // Keep bounded
    if (compressionState.abstractions.length > 50) {
        compressionState.abstractions.shift();
    }

    return abstraction;
}

/**
 * Extract key themes from conversation
 */
function extractThemes(memories = []) {
    const themes = {};

    for (const mem of memories) {
        const input = mem.userInput || '';
        const keywords = extractKeywords(input);

        for (const keyword of keywords) {
            themes[keyword] = (themes[keyword] || 0) + 1;
        }
    }

    // Return top themes
    return Object.entries(themes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme]) => theme);
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
    if (!text) return [];

    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
        'to', 'for', 'of', 'with', 'from', 'is', 'are', 'be',
        'it', 'this', 'that', 'i', 'you', 'we', 'they', 'me'
    ]);

    const words = text.toLowerCase()
        .split(/[\s\-_\.,:;!?()]+/)
        .filter(w => w.length > 3 && !stopWords.has(w));

    return [...new Set(words)]; // Unique words
}

/**
 * Extract patterns (behavioral or conversational)
 */
function extractPatterns(memories = []) {
    const patterns = [];

    // Look for recurring topics
    const topicCounts = {};
    for (const mem of memories) {
        const topics = extractKeywords(mem.userInput);
        for (const topic of topics) {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
    }

    // Recurring topics are patterns
    for (const [topic, count] of Object.entries(topicCounts)) {
        if (count >= 2) {
            patterns.push({
                type: 'recurring_topic',
                value: topic,
                frequency: count
            });
        }
    }

    // Check for emotional patterns
    const emotions = memories
        .map(m => m.emotion)
        .filter(Boolean);

    if (emotions.length > 0) {
        const mostCommon = emotions.reduce((a, b) =>
            emotions.filter(e => e === a).length >
            emotions.filter(e => e === b).length ? a : b
        );

        patterns.push({
            type: 'dominant_emotion',
            value: mostCommon,
            frequency: emotions.filter(e => e === mostCommon).length
        });
    }

    return patterns;
}

/**
 * Track emotional trajectory
 */
function getEmotionalTrajectory(memories = []) {
    const emotions = memories
        .map(m => m.emotion)
        .filter(Boolean);

    if (emotions.length < 2) return null;

    const start = emotions[0];
    const end = emotions[emotions.length - 1];

    const transitions = [];
    for (let i = 1; i < emotions.length; i++) {
        if (emotions[i] !== emotions[i - 1]) {
            transitions.push({
                from: emotions[i - 1],
                to: emotions[i]
            });
        }
    }

    return {
        start,
        end,
        transitionCount: transitions.length,
        stability: 1 - (transitions.length / emotions.length)
    };
}

/**
 * Generate natural language summary
 */
function generateSummary(themes = [], patterns = []) {
    let summary = 'Theme: ';

    if (themes.length > 0) {
        summary += themes.slice(0, 3).join(', ');
    } else {
        summary += 'General conversation';
    }

    if (patterns.length > 0) {
        const emotionalPattern = patterns.find(p => p.type === 'dominant_emotion');
        if (emotionalPattern) {
            summary += `. Tone: ${emotionalPattern.value}.`;
        }
    }

    return summary;
}

// ========================================
// 🗜️ MEMORY COMPRESSION
// ========================================

/**
 * Compress old memories into abstractions
 */
function compressOldMemories(daysOld = 7) {
    const threshold = Date.now() - (daysOld * 86400000);
    const oldMemories = memory.getHierarchicalMemories(1000)
        .filter(m => m.timestamp < threshold);

    if (oldMemories.length > 10) {
        const abstraction = createAbstraction(oldMemories);
        compressionState.compressionRatio = abstraction.memoryCount / (abstraction.summary.length);
        compressionState.lastCompression = Date.now();
        return abstraction;
    }

    return null;
}

/**
 * Generate compressed context from abstractions
 */
function getCompressedContext(limit = 5) {
    const recent = compressionState.abstractions.slice(-limit);

    return recent.map(abs => ({
        period: new Date(abs.timestamp).toLocaleDateString(),
        themes: abs.themes,
        summary: abs.summary,
        emotionalState: abs.emotionalTrajectory?.end || 'unknown'
    }));
}

// ========================================
// 📊 SELECTIVE RECALL
// ========================================

/**
 * Recall only relevant memories for context
 * Prevents token bloat with smart filtering
 */
function selectiveRecall(currentTopic, maxTokens = 500) {
    const allMemories = memory.getHierarchicalMemories(100);

    // Rank by relevance to current topic
    const topicKeywords = extractKeywords(currentTopic);
    const scored = allMemories.map(mem => {
        const memKeywords = extractKeywords(mem.userInput);
        const overlap = topicKeywords.filter(k => memKeywords.includes(k)).length;
        return {
            ...mem,
            relevanceScore: overlap / Math.max(topicKeywords.length, 1)
        };
    });

    // Sort by relevance
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Select until token limit
    let tokenCount = 0;
    const selected = [];

    for (const mem of scored) {
        const estimate = (mem.userInput?.length || 0) / 4; // rough token estimate
        if (tokenCount + estimate < maxTokens) {
            selected.push(mem);
            tokenCount += estimate;
        } else {
            break;
        }
    }

    return selected;
}

// ========================================
// 🔄 SYMBOLIC INDEXING
// ========================================

/**
 * Create symbolic anchors for quick memory retrieval
 */
function createSymbolicAnchor(theme, memory) {
    const anchor = {
        symbol: theme.slice(0, 3).toUpperCase(),
        theme,
        memory: memory.slice(0, 100),
        timestamp: Date.now(),
        weight: 1.0
    };

    return anchor;
}

/**
 * Find memories by symbolic anchor
 */
function findBySymbol(symbol) {
    const memories = memory.getHierarchicalMemories(200);

    return memories.filter(mem => {
        const input = mem.userInput.toUpperCase();
        return input.includes(symbol);
    });
}

// ========================================
// 📈 COMPRESSION METRICS
// ========================================

function getCompressionMetrics() {
    return {
        totalAbstractions: compressionState.abstractions.length,
        lastCompression: new Date(compressionState.lastCompression).toISOString(),
        compressionRatio: compressionState.compressionRatio.toFixed(2),
        abstractionsInMemory: compressionState.abstractions.slice(-5).map(a => ({
            summary: a.summary,
            memoryCount: a.memoryCount
        }))
    };
}

// ========================================
// 🗜️ SIGNIFICANCE DB CLEANUP
// ========================================

function compressAndCleanDb() {
    const mainDb = require('./main_db');
    const db = mainDb.db;
    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 86400000;

    try {
        // 1. Delete tasks that are marked deleted and are older than 14 days
        const deleteCount = db.prepare("DELETE FROM tasks WHERE deleted = 1 AND updated_at < ?").run(fourteenDaysAgo).changes;

        // 2. Count low-significance tasks (e.g. calendar = 'personal' or 'family', importance_score < 5, completed = 1, not linked to goals/projects) older than 14 days
        const lowSigRows = db.prepare(`
            SELECT id, text, calendar FROM tasks 
            WHERE completed = 1 
              AND deleted = 0 
              AND updated_at < ? 
              AND importance_score < 5 
              AND goal_id IS NULL 
              AND project_id IS NULL
        `).all(fourteenDaysAgo);

        if (lowSigRows.length > 0) {
            // Aggregate counts by calendar
            const counts = {};
            lowSigRows.forEach(r => {
                counts[r.calendar] = (counts[r.calendar] || 0) + 1;
            });

            // Create an abstraction string
            const summaryParts = Object.entries(counts).map(([cal, count]) => `${count} minor ${cal} tasks`);
            const summaryText = `Archived/compressed: completed ${summaryParts.join(', ')} older than 14 days.`;

            // Insert this rollup summary as a cognitive memory
            const rollupId = `rollup_${now}`;
            db.prepare(`
                INSERT INTO cognitive_memories (id, user_id, memory_type, content, importance_score, created_at, updated_at, device_id, synced)
                VALUES (?, 'local_user', 'rollup_summary', ?, 2, ?, ?, ?, 0)
            `).run(rollupId, summaryText, now, now, mainDb.getDeviceId());

            // Delete the low-significance tasks we just rolled up
            const idsToDelete = lowSigRows.map(r => `'${r.id}'`).join(',');
            db.prepare(`DELETE FROM tasks WHERE id IN (${idsToDelete})`).run();
            
            console.log(`[Compression] Rolled up and purged ${lowSigRows.length} low-significance tasks: "${summaryText}"`);
        }

        return {
            success: true,
            purgedDeleted: deleteCount,
            rolledUpTasks: lowSigRows.length
        };
    } catch(e) {
        console.error("Compression: database cleanup failed:", e.message);
        return { success: false, error: e.message };
    }
}

// ========================================
// 📤 EXPORTS
// ========================================

module.exports = {
    createAbstraction,
    compressOldMemories,
    getCompressedContext,
    selectiveRecall,
    createSymbolicAnchor,
    findBySymbol,
    getCompressionMetrics,
    extractThemes,
    extractPatterns,
    extractKeywords,
    compressAndCleanDb
};
