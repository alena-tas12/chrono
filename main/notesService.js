const mainDb = require('./main_db');
const db = mainDb.db;
const cloudDb = require('./cloudDb');

/**
 * Scan active goals, projects, and subjects to auto-link notes locally
 */
function autoLinkNoteLocal(title, content) {
    const textToSearch = `${title} ${content || ''}`.toLowerCase();
    let linkedGoalId = null;
    let linkedProjectId = null;
    let linkedSubjectId = null;

    try {
        // 1. Scan active goals
        const goals = db.prepare("SELECT id, title FROM goals WHERE status = 'active'").all();
        for (const goal of goals) {
            const goalTitle = goal.title.toLowerCase();
            if (textToSearch.includes(goalTitle) || goalTitle.split(/\s+/).some(word => word.length > 3 && textToSearch.includes(word))) {
                linkedGoalId = goal.id;
                break;
            }
        }

        // 2. Scan active projects
        const projects = db.prepare("SELECT id, title, goal_id FROM projects WHERE status = 'active'").all();
        for (const proj of projects) {
            const projTitle = proj.title.toLowerCase();
            if (textToSearch.includes(projTitle) || projTitle.split(/\s+/).some(word => word.length > 3 && textToSearch.includes(word))) {
                linkedProjectId = proj.id;
                if (!linkedGoalId) {
                    linkedGoalId = proj.goal_id;
                }
                break;
            }
        }

        // 3. Scan study subjects
        const subjects = db.prepare("SELECT s.id, s.name, s.project_id, p.goal_id FROM subjects s JOIN projects p ON s.project_id = p.id").all();
        for (const subj of subjects) {
            const subjName = subj.name.toLowerCase();
            if (textToSearch.includes(subjName) || subjName.split(/\s+/).some(word => word.length > 3 && textToSearch.includes(word))) {
                linkedSubjectId = subj.id;
                if (!linkedProjectId) {
                    linkedProjectId = subj.project_id;
                }
                if (!linkedGoalId) {
                    linkedGoalId = subj.goal_id;
                }
                break;
            }
        }
    } catch (e) {
        console.error("notesService: Failed to auto-link note locally:", e.message);
    }

    return { linkedGoalId, linkedProjectId, linkedSubjectId };
}

/**
 * Fetch all notes for user (stored in remote cognitive_memories)
 */
async function getNotes(userId) {
    try {
        if (!cloudDb) {
            console.error("notesService: cloudDb is not initialized");
            return [];
        }

        const { data, error } = await cloudDb
            .from('cognitive_memories')
            .select('*')
            .eq('memory_type', 'note');

        if (error) {
            console.error("notesService: Failed to fetch notes from Supabase:", error.message);
            return [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        const notes = [];
        for (const row of data) {
            try {
                let noteObj = JSON.parse(row.content);
                
                noteObj.id = row.id;
                noteObj.user_id = row.user_id;
                noteObj.importance_score = row.importance_score || 5;
                noteObj.created_at = new Date(row.created_at).getTime();
                noteObj.updated_at = new Date(row.created_at).getTime();
                
                // Resolve linked names from local SQLite
                if (noteObj.linked_goal_id) {
                    const goal = db.prepare("SELECT title FROM goals WHERE id = ?").get(noteObj.linked_goal_id);
                    noteObj.goal_title = goal ? goal.title : null;
                } else {
                    noteObj.goal_title = null;
                }

                if (noteObj.linked_project_id) {
                    const project = db.prepare("SELECT title FROM projects WHERE id = ?").get(noteObj.linked_project_id);
                    noteObj.project_title = project ? project.title : null;
                } else {
                    noteObj.project_title = null;
                }

                if (noteObj.linked_subject_id) {
                    const subject = db.prepare("SELECT name FROM subjects WHERE id = ?").get(noteObj.linked_subject_id);
                    noteObj.subject_name = subject ? subject.name : null;
                } else {
                    noteObj.subject_name = null;
                }

                notes.push(noteObj);
            } catch (parseErr) {
                console.error("notesService: Failed to parse note content JSON:", parseErr.message);
            }
        }

        // Sort descending
        notes.sort((a, b) => b.created_at - a.created_at);
        return notes;
    } catch (e) {
        console.error("notesService: Failed to get notes:", e.message);
        return [];
    }
}

/**
 * Add a new note directly to remote cognitive_memories
 */
async function addNote(userId, title, content, visibility = 'private', sharedWith = [], importanceScore = 5, impactScore = 5) {
    const id = mainDb.generateUUID();
    const now = Date.now();
    const sharedWithArr = Array.isArray(sharedWith) ? sharedWith : [];
    
    // Get local link ids
    const links = autoLinkNoteLocal(title, content);

    const noteData = {
        title,
        content,
        visibility,
        shared_with: sharedWithArr,
        impact_score: impactScore,
        linked_goal_id: links.linkedGoalId,
        linked_project_id: links.linkedProjectId,
        linked_subject_id: links.linkedSubjectId
    };

    try {
        if (!cloudDb) {
            throw new Error("cloudDb is not initialized");
        }

        const { error } = await cloudDb
            .from('cognitive_memories')
            .insert({
                id: id,
                user_id: userId,
                memory_type: 'note',
                content: JSON.stringify(noteData),
                importance_score: importanceScore,
                created_at: new Date(now).toISOString()
            });

        if (error) {
            console.error("notesService: Failed to add note to Supabase:", error.message);
            return { success: false, error: error.message };
        }

        return { success: true, noteId: id };
    } catch (e) {
        console.error("notesService: Failed to add note:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Update note in remote cognitive_memories
 */
async function editNote(userId, noteId, title, content, visibility = 'private', sharedWith = [], importanceScore = 5, impactScore = 5) {
    const sharedWithArr = Array.isArray(sharedWith) ? sharedWith : [];
    
    const links = autoLinkNoteLocal(title, content);

    const noteData = {
        title,
        content,
        visibility,
        shared_with: sharedWithArr,
        impact_score: impactScore,
        linked_goal_id: links.linkedGoalId,
        linked_project_id: links.linkedProjectId,
        linked_subject_id: links.linkedSubjectId
    };

    try {
        if (!cloudDb) {
            throw new Error("cloudDb is not initialized");
        }

        const { error } = await cloudDb
            .from('cognitive_memories')
            .update({
                content: JSON.stringify(noteData),
                importance_score: importanceScore
            })
            .eq('id', noteId);

        if (error) {
            console.error("notesService: Failed to edit note in Supabase:", error.message);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e) {
        console.error("notesService: Failed to edit note:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Delete a note from remote cognitive_memories
 */
async function deleteNote(noteId) {
    try {
        if (!cloudDb) {
            throw new Error("cloudDb is not initialized");
        }

        const { error } = await cloudDb
            .from('cognitive_memories')
            .delete()
            .eq('id', noteId);

        if (error) {
            console.error("notesService: Failed to delete note from Supabase:", error.message);
            return { success: false, error: error.message };
        }
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
