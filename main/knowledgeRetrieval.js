const mainDb = require('./main_db');

/**
 * knowledgeRetrieval.js
 * 
 * RESPONSIBILITY: Find relevant explicit user-authored knowledge (Notes).
 * STRICT BOUNDARY: Does not interpret, rank personality, modify memory, infer preferences, or create tasks.
 * It merely finds blocks of notes and returns them with strict provenance.
 */

/**
 * Searches the local Workspace Notes for blocks matching keywords.
 * @param {string} query The user's query or keywords
 * @param {number} limit Max blocks to return
 * @returns {Array} Array of formatted block objects with provenance
 */
function retrieveExplicitKnowledge(query, limit = 5) {
    const db = mainDb.db;
    if (!db || !query) return [];

    try {
        // Simple keyword extraction for the search
        const keywords = query.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3);

        if (keywords.length === 0) return [];

        const results = [];
        const seenBlocks = new Set();

        // Very basic local search against blocks and note titles
        for (const word of keywords) {
            const param = `%${word}%`;
            const matches = db.prepare(`
                SELECT 
                    b.id as block_id, 
                    b.content as block_content, 
                    b.type as block_type,
                    n.id as note_id,
                    n.title as note_title
                FROM workspace_blocks b
                JOIN workspace_notes n ON b.note_id = n.id
                WHERE (b.content LIKE ? OR n.title LIKE ?)
                  AND n.deleted = 0
                LIMIT ?
            `).all(param, param, limit);

            for (const match of matches) {
                if (!seenBlocks.has(match.block_id)) {
                    seenBlocks.add(match.block_id);
                    results.push(match);
                }
            }
        }

        // Sort roughly by how many times we found it, or just return top N
        return results.slice(0, limit);

    } catch (e) {
        console.error("Failed to retrieve explicit knowledge:", e.message);
        return [];
    }
}

/**
 * Formats the retrieved blocks into strict provenance strings for the LLM context.
 */
function formatKnowledgeForContext(blocks) {
    if (!blocks || blocks.length === 0) return null;

    let formattedString = `[EXPLICIT USER-AUTHORED KNOWLEDGE]\n`;
    formattedString += `(Note: The following information was explicitly written by the user in their Notes workspace. Do not treat it as AI-inferred memory, but as established user facts.)\n\n`;

    blocks.forEach(block => {
        formattedString += `SOURCE: User-authored Note\n`;
        formattedString += `NOTE: ${block.note_title}\n`;
        formattedString += `CONTENT:\n${block.block_content}\n\n`;
    });

    return formattedString.trim();
}

module.exports = {
    retrieveExplicitKnowledge,
    formatKnowledgeForContext
};
