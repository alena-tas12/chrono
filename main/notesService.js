const mainDb = require('./main_db');

/**
 * 📝 KNOWLEDGE WORKSPACE - LOCAL NOTES SERVICE
 * 
 * Replaces the legacy cloud-only, mixed-memory approach with a 
 * strict block-level local SQLite implementation.
 * 
 * Boundary Rule: NEVER converts user notes into implicit cognitive memory.
 */

/**
 * Splits markdown/text content into structural blocks.
 */
function parseBlocks(content) {
    if (!content) return [];
    
    // Very simple block parser (split by double newline)
    const rawBlocks = content.split(/\n\s*\n/);
    return rawBlocks.filter(b => b.trim().length > 0).map((b, index) => {
        let type = 'paragraph';
        if (b.startsWith('#')) type = 'heading';
        else if (b.startsWith('- ') || b.startsWith('* ')) type = 'list';
        else if (b.startsWith('>')) type = 'quote';
        else if (b.startsWith('```')) type = 'code';

        return {
            type,
            content: b.trim(),
            order_index: index
        };
    });
}

/**
 * Fetch all notes for user (stored locally)
 */
async function getNotes(userId) {
    try {
        const db = mainDb.db;
        
        // Get all active notes
        const notes = db.prepare(`
            SELECT id, title, created_at, updated_at 
            FROM workspace_notes 
            WHERE user_id = ? AND deleted = 0
            ORDER BY updated_at DESC
        `).all(userId);

        // For each note, assemble the content from blocks to maintain UI compatibility
        for (const note of notes) {
            const blocks = db.prepare(`
                SELECT type, content, order_index 
                FROM workspace_blocks 
                WHERE note_id = ?
                ORDER BY order_index ASC
            `).all(note.id);
            
            note.content = blocks.map(b => b.content).join('\n\n');
            note.blocks = blocks; // Attach blocks for future block-level UI
        }

        return notes;
    } catch (e) {
        console.error("notesService: Failed to get notes:", e.message);
        return [];
    }
}

/**
 * Add a new note to the Knowledge Workspace
 */
async function addNote(userId, title, content, visibility = 'private', sharedWith = [], importanceScore = 5, impactScore = 5) {
    try {
        const db = mainDb.db;
        const noteId = mainDb.generateUUID();
        const now = Date.now();
        
        const insertNote = db.prepare(`
            INSERT INTO workspace_notes (id, user_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        const insertBlock = db.prepare(`
            INSERT INTO workspace_blocks (id, note_id, type, content, order_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        // Transaction for atomic write
        const transaction = db.transaction(() => {
            insertNote.run(noteId, userId, title, now, now);
            
            const blocks = parseBlocks(content);
            for (const block of blocks) {
                insertBlock.run(
                    mainDb.generateUUID(),
                    noteId,
                    block.type,
                    block.content,
                    block.order_index,
                    now,
                    now
                );
            }
        });

        transaction();
        
        return { success: true, noteId: noteId };
    } catch (e) {
        console.error("notesService: Failed to add note:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Update note and its blocks
 */
async function editNote(userId, noteId, title, content, visibility = 'private', sharedWith = [], importanceScore = 5, impactScore = 5) {
    try {
        const db = mainDb.db;
        const now = Date.now();
        
        const updateNote = db.prepare(`
            UPDATE workspace_notes 
            SET title = ?, updated_at = ?, synced = 0
            WHERE id = ? AND user_id = ?
        `);
        
        const insertRevision = db.prepare(`
            INSERT INTO workspace_revisions (id, note_id, content_snapshot, created_at)
            VALUES (?, ?, ?, ?)
        `);

        const clearBlocks = db.prepare(`
            DELETE FROM workspace_blocks WHERE note_id = ?
        `);
        
        const insertBlock = db.prepare(`
            INSERT INTO workspace_blocks (id, note_id, type, content, order_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction(() => {
            // Snapshot old content (for basic versioning)
            const oldBlocks = db.prepare("SELECT content FROM workspace_blocks WHERE note_id = ? ORDER BY order_index ASC").all(noteId);
            const oldContent = oldBlocks.map(b => b.content).join('\n\n');
            
            insertRevision.run(mainDb.generateUUID(), noteId, oldContent, now);
            
            // Update note metadata
            updateNote.run(title, now, noteId, userId);
            
            // Re-write blocks completely (simpler than syncing diffs for MVP)
            clearBlocks.run(noteId);
            
            const blocks = parseBlocks(content);
            for (const block of blocks) {
                insertBlock.run(
                    mainDb.generateUUID(),
                    noteId,
                    block.type,
                    block.content,
                    block.order_index,
                    now,
                    now
                );
            }
        });

        transaction();

        return { success: true };
    } catch (e) {
        console.error("notesService: Failed to edit note:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Soft delete a note
 */
async function deleteNote(noteId) {
    try {
        const db = mainDb.db;
        const deleteStmt = db.prepare(`
            UPDATE workspace_notes SET deleted = 1, synced = 0 WHERE id = ?
        `);
        
        deleteStmt.run(noteId);
        return { success: true };
    } catch (e) {
        console.error("notesService: Failed to delete note:", e.message);
        return { success: false, error: e.message };
    }
}

module.exports = {
    getNotes,
    addNote,
    editNote,
    deleteNote
};
