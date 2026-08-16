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
/**
 * Splits markdown/text content into structural outliner blocks supporting 12 block types,
 * outliner depth levels, and inline :: flashcards syntax.
 */
function parseBlocks(content) {
    if (!content) return [];
    
    const lines = content.split('\n');
    const blocks = [];
    let currentIndex = 0;

    for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Calculate outliner depth level (tabs or leading spaces)
        const leadingSpaces = line.search(/\S|$/);
        const depthLevel = Math.floor(leadingSpaces / 2);

        let type = 'paragraph';
        let cleanContent = trimmed;

        if (trimmed.startsWith('# ')) { type = 'h1'; cleanContent = trimmed.slice(2); }
        else if (trimmed.startsWith('## ')) { type = 'h2'; cleanContent = trimmed.slice(3); }
        else if (trimmed.startsWith('### ')) { type = 'h3'; cleanContent = trimmed.slice(4); }
        else if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ')) { type = 'todo'; cleanContent = trimmed; }
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) { type = 'bullet'; cleanContent = trimmed.slice(2); }
        else if (trimmed.startsWith('> ')) { type = 'callout'; cleanContent = trimmed.slice(2); }
        else if (trimmed.startsWith('```')) { type = 'code'; cleanContent = trimmed.replace(/```/g, ''); }
        else if (trimmed.includes('::')) { type = 'flashcard'; cleanContent = trimmed; }

        blocks.push({
            type,
            content: cleanContent,
            depth_level: depthLevel,
            order_index: currentIndex++
        });
    }

    return blocks;
}

/**
 * Fetch all notes for user (stored locally)
 */
async function getNotes(userId) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        
        const notes = db.prepare(`
            SELECT id, user_id, parent_note_id, title, icon, cover_url, is_pinned, created_at, updated_at 
            FROM workspace_notes 
            WHERE (user_id = ? OR user_id IS NULL) AND deleted = 0
            ORDER BY is_pinned DESC, updated_at DESC
        `).all(userId);

        for (const note of notes) {
            const blocks = db.prepare(`
                SELECT id, parent_block_id, type, content, depth_level, order_index, properties, source_provenance 
                FROM workspace_blocks 
                WHERE note_id = ?
                ORDER BY order_index ASC
            `).all(note.id);
            
            note.content = blocks.map(b => b.content).join('\n');
            note.blocks = blocks;

            // Fetch attachments
            note.attachments = db.prepare(`
                SELECT id, original_name, storage_path, mime_type, file_size, created_at
                FROM workspace_attachments
                WHERE note_id = ?
            `).all(note.id);
        }

        return notes;
    } catch (e) {
        console.error("notesService: Failed to get notes:", e.message);
        return [];
    }
}

/**
 * Add a new note page to the Knowledge Workspace
 */
async function addNote(userId, title, content, parentNoteId = null, icon = '📝', coverUrl = null, isPinned = 0) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        const noteId = mainDb.generateUUID();
        const now = Date.now();
        
        const insertNote = db.prepare(`
            INSERT INTO workspace_notes (id, user_id, parent_note_id, title, icon, cover_url, is_pinned, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const insertBlock = db.prepare(`
            INSERT INTO workspace_blocks (id, note_id, parent_block_id, type, content, depth_level, order_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertLink = db.prepare(`
            INSERT INTO workspace_links (id, source_id, target_id, target_type, relationship, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const insertFlashcard = db.prepare(`
            INSERT INTO flashcard_decks (id, block_id, user_id, front_prompt, back_answer, repetition_level, ease_factor, interval_days, next_review_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction(() => {
            insertNote.run(noteId, userId, parentNoteId, title, icon, coverUrl, isPinned, now, now);
            
            const blocks = parseBlocks(content);
            for (const block of blocks) {
                const blockId = mainDb.generateUUID();
                insertBlock.run(
                    blockId,
                    noteId,
                    null,
                    block.type,
                    block.content,
                    block.depth_level,
                    block.order_index,
                    now,
                    now
                );

                // Auto-create Flashcard if block contains ::
                if (block.content.includes('::')) {
                    const parts = block.content.split('::');
                    const front = parts[0].replace(/^[\s🎴•\-\*]+/, '').trim();
                    const back = parts.slice(1).join('::').trim();
                    if (front && back) {
                        insertFlashcard.run(mainDb.generateUUID(), blockId, userId, front, back, 0, 2.5, 1, now, now, now);
                    }
                }

                // Extract [[Concept Links]]
                const linkRegex = /\[\[(.*?)\]\]/g;
                let match;
                while ((match = linkRegex.exec(block.content)) !== null) {
                    const targetTitle = match[1];
                    const targetNote = db.prepare(`SELECT id FROM workspace_notes WHERE title = ? COLLATE NOCASE`).get(targetTitle);
                    if (targetNote) {
                        insertLink.run(mainDb.generateUUID(), blockId, targetNote.id, 'note', 'reference', now);
                    }
                }
            }
        });

        transaction();
        return { success: true, noteId };
    } catch (e) {
        console.error("notesService: Failed to add note:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Edit note page & blocks with versioned revision snapshot
 */
async function editNote(userId, noteId, title, content, parentNoteId = null, icon = '📝', coverUrl = null, isPinned = 0) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        const now = Date.now();
        
        const updateNote = db.prepare(`
            UPDATE workspace_notes 
            SET title = ?, parent_note_id = ?, icon = ?, cover_url = ?, is_pinned = ?, updated_at = ?, synced = 0
            WHERE id = ? AND (user_id = ? OR user_id IS NULL)
        `);
        
        const insertRevision = db.prepare(`
            INSERT INTO workspace_revisions (id, note_id, user_id, change_type, created_by, content_snapshot, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const clearBlocks = db.prepare(`DELETE FROM workspace_blocks WHERE note_id = ?`);
        const insertBlock = db.prepare(`
            INSERT INTO workspace_blocks (id, note_id, parent_block_id, type, content, depth_level, order_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertLink = db.prepare(`
            INSERT INTO workspace_links (id, source_id, target_id, target_type, relationship, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const insertFlashcard = db.prepare(`
            INSERT INTO flashcard_decks (id, block_id, user_id, front_prompt, back_answer, repetition_level, ease_factor, interval_days, next_review_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction(() => {
            // Snapshot old content for versioned revision audit
            const oldBlocks = db.prepare("SELECT content FROM workspace_blocks WHERE note_id = ? ORDER BY order_index ASC").all(noteId);
            const oldContent = oldBlocks.map(b => b.content).join('\n');
            if (oldContent.trim().length > 0) {
                insertRevision.run(mainDb.generateUUID(), noteId, userId || 'local_user', 'edited', 'user', oldContent, now);
            }
            
            updateNote.run(title, parentNoteId, icon, coverUrl, isPinned, now, noteId, userId);
            
            clearBlocks.run(noteId);
            const blocks = parseBlocks(content);
            for (const block of blocks) {
                const blockId = mainDb.generateUUID();
                insertBlock.run(
                    blockId,
                    noteId,
                    null,
                    block.type,
                    block.content,
                    block.depth_level,
                    block.order_index,
                    now,
                    now
                );

                if (block.content.includes('::')) {
                    const parts = block.content.split('::');
                    const front = parts[0].trim();
                    const back = parts.slice(1).join('::').trim();
                    if (front && back) {
                        insertFlashcard.run(mainDb.generateUUID(), blockId, userId, front, back, 0, 2.5, 1, now, now, now);
                    }
                }

                const linkRegex = /\[\[(.*?)\]\]/g;
                let match;
                while ((match = linkRegex.exec(block.content)) !== null) {
                    const targetTitle = match[1];
                    const targetNote = db.prepare(`SELECT id FROM workspace_notes WHERE title = ? COLLATE NOCASE`).get(targetTitle);
                    if (targetNote) {
                        insertLink.run(mainDb.generateUUID(), blockId, targetNote.id, 'note', 'reference', now);
                    }
                }
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
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        db.prepare(`UPDATE workspace_notes SET deleted = 1, synced = 0 WHERE id = ?`).run(noteId);
        return { success: true };
    } catch (e) {
        console.error("notesService: Failed to delete note:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Get note revisions
 */
async function getNoteRevisions(noteId) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        return db.prepare(`
            SELECT id, user_id, change_type, created_by, content_snapshot, created_at 
            FROM workspace_revisions 
            WHERE note_id = ? 
            ORDER BY created_at DESC
        `).all(noteId);
    } catch (e) {
        console.error("notesService: Failed to get note revisions:", e.message);
        return [];
    }
}

/**
 * Restore a specific revision of a note
 */
async function restoreNoteRevision(userId, noteId, revisionId) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        const revision = db.prepare(`SELECT content_snapshot FROM workspace_revisions WHERE id = ? AND note_id = ?`).get(revisionId, noteId);
        if (!revision) return { success: false, error: 'Revision not found' };
        
        const note = db.prepare(`SELECT title FROM workspace_notes WHERE id = ?`).get(noteId);
        if (!note) return { success: false, error: 'Note not found' };

        return await editNote(userId, noteId, note.title, revision.content_snapshot);
    } catch (e) {
        console.error("notesService: Failed to restore note revision:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Spaced-Repetition Flashcard Deck Operations
 */
async function getFlashcards(userId) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        return db.prepare(`
            SELECT f.id, f.block_id, f.front_prompt, f.back_answer, f.repetition_level, f.ease_factor, f.next_review_at, n.title as note_title
            FROM flashcard_decks f
            JOIN workspace_blocks b ON f.block_id = b.id
            JOIN workspace_notes n ON b.note_id = n.id
            WHERE (f.user_id = ? OR f.user_id IS NULL)
            ORDER BY f.next_review_at ASC
        `).all(userId);
    } catch (e) {
        console.error("notesService: Failed to get flashcards:", e.message);
        return [];
    }
}

async function reviewFlashcard(flashcardId, score) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        const card = db.prepare(`SELECT repetition_level, ease_factor, interval_days FROM flashcard_decks WHERE id = ?`).get(flashcardId);
        if (!card) return { success: false, error: 'Flashcard not found' };

        let { repetition_level, ease_factor, interval_days } = card;
        if (score >= 3) {
            repetition_level += 1;
            interval_days = repetition_level === 1 ? 1 : Math.round(interval_days * ease_factor);
        } else {
            repetition_level = 0;
            interval_days = 1;
        }

        const nextReviewAt = Date.now() + (interval_days * 86400000);
        db.prepare(`
            UPDATE flashcard_decks 
            SET repetition_level = ?, interval_days = ?, next_review_at = ?
            WHERE id = ?
        `).run(repetition_level, interval_days, nextReviewAt, flashcardId);

        return { success: true, nextReviewAt };
    } catch (e) {
        console.error("notesService: Failed to review flashcard:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Fetch all soft-deleted notes in Trash
 */
async function getTrashNotes(userId) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        const notes = db.prepare(`
            SELECT id, user_id, parent_note_id, title, icon, cover_url, is_pinned, created_at, updated_at 
            FROM workspace_notes 
            WHERE (user_id = ? OR user_id IS NULL) AND deleted = 1
            ORDER BY updated_at DESC
        `).all(userId);

        for (const note of notes) {
            const blocks = db.prepare(`
                SELECT content FROM workspace_blocks WHERE note_id = ? ORDER BY order_index ASC
            `).all(note.id);
            note.content = blocks.map(b => b.content).join('\n');
        }
        return notes;
    } catch (e) {
        console.error("notesService: Failed to get trash notes:", e.message);
        return [];
    }
}

/**
 * Restore a soft-deleted note from Trash
 */
async function restoreNote(noteId) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        db.prepare(`UPDATE workspace_notes SET deleted = 0, updated_at = ?, synced = 0 WHERE id = ?`).run(Date.now(), noteId);
        return { success: true };
    } catch (e) {
        console.error("notesService: Failed to restore note:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Permanently delete a note and all its associated blocks, flashcards, links, and revisions
 */
async function permanentDeleteNote(noteId) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        const transaction = db.transaction(() => {
            db.prepare(`DELETE FROM flashcard_decks WHERE block_id IN (SELECT id FROM workspace_blocks WHERE note_id = ?)`).run(noteId);
            db.prepare(`DELETE FROM workspace_links WHERE source_id IN (SELECT id FROM workspace_blocks WHERE note_id = ?) OR target_id = ?`).run(noteId, noteId);
            db.prepare(`DELETE FROM workspace_blocks WHERE note_id = ?`).run(noteId);
            db.prepare(`DELETE FROM workspace_revisions WHERE note_id = ?`).run(noteId);
            db.prepare(`DELETE FROM workspace_notes WHERE id = ?`).run(noteId);
        });
        transaction();
        return { success: true };
    } catch (e) {
        console.error("notesService: Failed to permanently delete note:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Duplicate an existing note with all its blocks
 */
async function duplicateNote(userId, noteId) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        const original = db.prepare(`SELECT * FROM workspace_notes WHERE id = ?`).get(noteId);
        if (!original) return { success: false, error: 'Original note not found' };

        const blocks = db.prepare(`SELECT * FROM workspace_blocks WHERE note_id = ? ORDER BY order_index ASC`).all(noteId);
        const content = blocks.map(b => b.content).join('\n');
        const newTitle = `${original.title} (Copy)`;

        return await addNote(userId, newTitle, content, original.parent_note_id, original.icon, original.cover_url, 0);
    } catch (e) {
        console.error("notesService: Failed to duplicate note:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Pin or Unpin a note
 */
async function pinNote(noteId, isPinned) {
    try {
        const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
        db.prepare(`UPDATE workspace_notes SET is_pinned = ?, updated_at = ?, synced = 0 WHERE id = ?`).run(isPinned ? 1 : 0, Date.now(), noteId);
        return { success: true };
    } catch (e) {
        console.error("notesService: Failed to pin note:", e.message);
        return { success: false, error: e.message };
    }
}

module.exports = {
    parseBlocks,
    getNotes,
    addNote,
    editNote,
    deleteNote,
    getTrashNotes,
    restoreNote,
    permanentDeleteNote,
    duplicateNote,
    pinNote,
    getNoteRevisions,
    restoreNoteRevision,
    getFlashcards,
    reviewFlashcard
};
