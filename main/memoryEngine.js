const mainDb = require('./main_db');

function getDb() {
    return (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
}

let sessionHistory = [];
let chatHistory = [];

/* =========================
   📖 CHAT & SESSION LOGGING
========================= */

function saveChat(userInput, aiResponse) {
    const entry = { userInput, aiResponse, timestamp: Date.now() };
    chatHistory.push(entry);

    try {
        const db = getDb();
        const uuid = mainDb.generateUUID();
        const deviceId = mainDb.getDeviceId();
        db.prepare(`
            INSERT OR REPLACE INTO memory_chat (id, user_input, ai_response, timestamp, updated_at, device_id, synced)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `).run(uuid, userInput, aiResponse, entry.timestamp, Date.now(), deviceId);
    } catch (e) {
        console.error("Failed to save chat:", e.message);
    }
}

function saveChatWithContext(userInput, aiResponse, context = {}) {
    return saveChat(userInput, aiResponse);
}

function getRecentChats(limit = 5) {
    return chatHistory.slice(-limit);
}

function logSession(task, duration) {
    const entry = { task, duration, time: new Date(), timestamp: Date.now() };
    sessionHistory.push(entry);
    saveBehavior("session", JSON.stringify(entry));
}

function getHistory() {
    return sessionHistory;
}

function saveBehavior(type, value) {
    try {
        db.prepare(`
            INSERT INTO memory_behavior (type, value, timestamp)
            VALUES (?, ?, ?)
        `).run(type, value, Date.now());
    } catch (e) {
        console.error("Failed to save behavior:", e.message);
    }
}

/* =========================
   🧠 EVIDENCE-BASED BELIEF ENGINE (Phase 4)
========================= */

/**
 * @param {string} statement The explicit belief/memory to store
 * @param {string} source Where did this come from? (e.g. "Conversation #abc")
 * @param {string} evidence What specifically justifies this?
 * @param {string} confidence 'low', 'medium', or 'high'
 * @param {string} sourceType 'user_explicit', 'conversation_inference', 'system_observation'
 */
function storeObservation(statement, source, evidence, confidence = 'medium', sourceType = 'conversation_inference') {
    const db = getDb();
    try {
        const uuid = mainDb.generateUUID();
        const activeUserId = mainDb.getActiveUserId() || 'local_user';
        db.prepare(`
            INSERT INTO cognitive_memories (
                id, user_id, memory_type, content, source_type, evidence, confidence, status, created_at, updated_at, device_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            uuid, activeUserId, 'belief', statement, sourceType, evidence, confidence, 'active', 
            Date.now(), Date.now(), mainDb.getDeviceId()
        );
        return uuid;
    } catch (e) {
        console.error("Failed to store observation:", e.message);
        return null;
    }
}

/**
 * Retrieve active memories.
 */
function retrieveMemory(query) {
    const db = getDb();
    try {
        if (query) {
            const param = `%${query}%`;
            return db.prepare(`
                SELECT * FROM cognitive_memories 
                WHERE status = 'active' AND deleted = 0 AND content LIKE ?
                ORDER BY updated_at DESC
            `).all(param);
        }

        const memories = db.prepare(`
            SELECT * FROM cognitive_memories 
            WHERE status = 'active' AND deleted = 0
            ORDER BY updated_at DESC
        `).all();
        
        return memories;
    } catch (e) {
        console.error("Failed to retrieve memory:", e.message);
        return [];
    }
}

/**
 * Update an existing memory's metadata.
 */
function updateMemory(memoryId, updates = {}) {
    const db = getDb();
    try {
        const setClauses = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updates)) {
            setClauses.push(`${key} = ?`);
            values.push(value);
        }
        
        if (setClauses.length === 0) return;
        
        values.push(Date.now());
        values.push(memoryId);
        
        db.prepare(`
            UPDATE cognitive_memories 
            SET ${setClauses.join(', ')}, updated_at = ?
            WHERE id = ?
        `).run(...values);
    } catch (e) {
        console.error("Failed to update memory:", e.message);
    }
}

/**
 * Correct a memory. Does NOT overwrite history.
 * Marks old as 'corrected' and creates a new 'active' observation.
 */
function correctMemory(memoryId, newStatement, newEvidence, newConfidence = 'medium', newSourceType = 'user_explicit') {
    const db = getDb();
    try {
        const oldMem = db.prepare("SELECT * FROM cognitive_memories WHERE id = ?").get(memoryId);
        if (!oldMem) return null;

        // 1. Mark old as corrected
        db.prepare("UPDATE cognitive_memories SET status = 'corrected', updated_at = ? WHERE id = ?").run(Date.now(), memoryId);

        // 2. Insert new
        return storeObservation(newStatement, `Correction of ${memoryId}`, newEvidence, newConfidence, newSourceType);
    } catch (e) {
        console.error("Failed to correct memory:", e.message);
        return null;
    }
}

/**
 * Forget a memory. Retained in DB but marked as forgotten so it's excluded from context.
 */
function forgetMemory(memoryId) {
    const db = getDb();
    try {
        db.prepare("UPDATE cognitive_memories SET status = 'forgotten', updated_at = ? WHERE id = ?").run(Date.now(), memoryId);
    } catch (e) {
        console.error("Failed to forget memory:", e.message);
    }
}


/* =========================
    🏛️ HIERARCHICAL MEMORY RETRIEVAL
 ========================= */

/**
 * Retrieves memories ordered by importance and recency — the top-tier "remembered" set.
 * Used by contextCompression, cognitiveDiagnostics, and the hierarchical-memories IPC.
 */
function getHierarchicalMemories(limit = 10) {
    try {
        return db.prepare(`
            SELECT * FROM cognitive_memories
            WHERE status = 'active' AND deleted = 0
            ORDER BY importance_score DESC, updated_at DESC
            LIMIT ?
        `).all(limit);
    } catch (e) {
        console.error('getHierarchicalMemories failed:', e.message);
        return [];
    }
}

/**
 * Retrieves memories that contain emotional language signals.
 * Looks for rows whose content or source_type references emotional context.
 */
function getEmotionalMemories(limit = 5) {
    try {
        const emotionalKeywords = ['feel', 'emotion', 'stress', 'anxious', 'happy', 'sad', 'nervous', 'excited', 'worried', 'frustrated', 'proud', 'afraid', 'grief', 'joy', 'tired'];
        const conditions = emotionalKeywords.map(() => `content LIKE ?`).join(' OR ');
        const params = emotionalKeywords.map(k => `%${k}%`);
        params.push(limit);
        return db.prepare(`
            SELECT * FROM cognitive_memories
            WHERE status = 'active' AND deleted = 0 AND (${conditions})
            ORDER BY updated_at DESC
            LIMIT ?
        `).all(...params);
    } catch (e) {
        console.error('getEmotionalMemories failed:', e.message);
        return [];
    }
}

/**
 * Returns the user's highest-importance self-defining memories:
 * beliefs, decisions, goals — the "who am I" context layer.
 */
function getCoreIdentity(userId = null) {
    try {
        const activeUser = userId || mainDb.getActiveUserId() || 'local_user';
        return db.prepare(`
            SELECT * FROM cognitive_memories
            WHERE user_id = ? AND status = 'active' AND deleted = 0
              AND memory_type IN ('belief', 'Decision', 'Goal', 'Fact')
            ORDER BY importance_score DESC, updated_at DESC
            LIMIT 5
        `).all(activeUser);
    } catch (e) {
        console.error('getCoreIdentity failed:', e.message);
        return [];
    }
}

/**
 * Returns the task the user has scheduled or completed most frequently.
 * Groups by normalized text and returns the top-1 row.
 */
function getMostFrequentTask() {
    try {
        const row = db.prepare(`
            SELECT text, COUNT(*) as frequency
            FROM tasks
            WHERE deleted = 0
            GROUP BY lower(trim(text))
            ORDER BY frequency DESC
            LIMIT 1
        `).get();
        return row || null;
    } catch (e) {
        console.error('getMostFrequentTask failed:', e.message);
        return null;
    }
}

/**
 * Computes the mean focus session duration (seconds) from behavior log.
 * Behavior rows with type='session' store JSON: { task, duration, timestamp }.
 */
function getAverageFocusTime() {
    try {
        const rows = db.prepare(`
            SELECT value FROM memory_behavior WHERE type = 'session'
        `).all();
        if (rows.length === 0) return 0;
        let total = 0;
        let count = 0;
        for (const row of rows) {
            try {
                const parsed = JSON.parse(row.value);
                if (typeof parsed.duration === 'number' && parsed.duration > 0) {
                    total += parsed.duration;
                    count++;
                }
            } catch (_) {}
        }
        return count > 0 ? Math.round(total / count) : 0;
    } catch (e) {
        console.error('getAverageFocusTime failed:', e.message);
        return 0;
    }
}

/* =========================
    📦 EXPORTS
 ========================= */

function initializeMemory() {
    try {
        const db = getDb();
        sessionHistory = [];
        chatHistory = [];

        // Load sessions
        const sessions = db.prepare("SELECT * FROM memory_behavior WHERE type = 'session' ORDER BY timestamp ASC").all();
        sessions.forEach(row => {
            try { sessionHistory.push(JSON.parse(row.value)); } catch (e) {}
        });

        // Load chats
        const chats = db.prepare("SELECT * FROM memory_chat ORDER BY timestamp ASC").all();
        chats.forEach(row => {
            chatHistory.push({ userInput: row.user_input, aiResponse: row.ai_response, timestamp: row.timestamp });
        });

        console.log(`🧠 Memory initialized: loaded ${sessionHistory.length} sessions and ${chatHistory.length} chats from DB.`);
    } catch (error) {
        console.error("🚨 Failed to initialize memory from DB:", error.message);
    }
}

initializeMemory();

module.exports = {
    initializeMemory,
    saveChat,
    saveChatWithContext,
    getRecentChats,
    saveBehavior,
    logSession,
    getHistory,
    
    // Phase 4 Strict Evidence Engine
    storeObservation,
    retrieveMemory,
    updateMemory,
    correctMemory,
    forgetMemory,

    // Hierarchical / Emotional / Identity Retrieval
    getHierarchicalMemories,
    getEmotionalMemories,
    getCoreIdentity,
    getMostFrequentTask,
    getAverageFocusTime
};