const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const cloudDb = require('./cloudDb');

let safeStorage = null;
try {
    const electron = require('electron');
    if (electron && electron.safeStorage) {
        safeStorage = electron.safeStorage;
    }
} catch (e) {
    // Expected to fail in non-Electron Node.js testing environments
}

let dbPath = 'chrono.db';
let activeUserId = 'local_user';
let userIndexPath = null;
try {
    const { app } = require('electron');
    if (app) {
        const userDataPath = app.getPath('userData');
        if (userDataPath) {
            userIndexPath = path.join(userDataPath, 'chrono_user.json');
            dbPath = path.join(userDataPath, 'chrono.db');
        }
    }
} catch (e) {
    console.warn("Could not load Electron app paths, falling back to local database path.");
}

if (!userIndexPath) {
    userIndexPath = path.join(process.cwd(), 'chrono_user.json');
}

function sanitizeUserId(userId) {
    if (!userId) return 'local_user';
    return String(userId)
        .replace(/[^a-z0-9_-]/gi, '_')
        .substring(0, 64) || 'local_user';
}

function getUserDbPath(userId) {
    const baseDir = userIndexPath ? path.dirname(userIndexPath) : process.cwd();
    const safeId = sanitizeUserId(userId || 'local_user');
    return path.join(baseDir, `chrono_${safeId}.db`);
}

function loadActiveUserId() {
    if (userIndexPath && fs.existsSync(userIndexPath)) {
        try {
            const saved = JSON.parse(fs.readFileSync(userIndexPath, 'utf-8'));
            if (saved && saved.activeUserId) {
                return saved.activeUserId;
            }
        } catch (err) {
            console.warn('Failed to read active user index:', err.message);
        }
    }
    // Legacy support: if the legacy chrono.db exists and contains an authenticated user id,
    // use that as the active DB identifier.
    if (userIndexPath) {
        const legacyPath = path.join(path.dirname(userIndexPath), 'chrono.db');
        if (fs.existsSync(legacyPath)) {
            try {
                const legacyDb = new Database(legacyPath, { readonly: true });
                const row = legacyDb.prepare("SELECT value FROM sync_meta WHERE key = 'auth_user_id'").get();
                legacyDb.close();
                if (row && row.value) {
                    return row.value;
                }
            } catch (err) {
                console.warn('Failed to read legacy sync_meta for auth_user_id:', err.message);
            }
        }
    }
    return 'local_user';
}

function persistActiveUserId(userId) {
    if (!userIndexPath) return;
    try {
        fs.writeFileSync(userIndexPath, JSON.stringify({ activeUserId: userId }), 'utf-8');
    } catch (err) {
        console.warn('Failed to persist active user index:', err.message);
    }
}

function copyLegacyDbTo(targetPath) {
    if (!userIndexPath) return;
    const legacyPath = path.join(path.dirname(userIndexPath), 'chrono.db');
    if (fs.existsSync(legacyPath) && !fs.existsSync(targetPath)) {
        try {
            fs.copyFileSync(legacyPath, targetPath);
        } catch (err) {
            console.warn('Failed to migrate legacy database file:', err.message);
        }
    }
}

// Internal DB reference (will be opened later) and stable proxy exported as `db`
let db = null;
const dbProxy = new Proxy({}, {
    get(target, prop) {
        if (!db) {
            throw new Error('Database not initialized yet');
        }
        const val = db[prop];
        if (typeof val === 'function') return val.bind(db);
        return val;
    },
    set(target, prop, value) {
        if (!db) {
            throw new Error('Database not initialized yet');
        }
        db[prop] = value;
        return true;
    }
});

function setCurrentUserId(userId) {
    activeUserId = userId || 'local_user';
    if (db && typeof db.function === 'function') {
        db.function('current_user_id', () => activeUserId || 'local_user');
    }
}

function openDatabaseAtPath(pathToOpen) {
    if (!fs.existsSync(path.dirname(pathToOpen))) {
        fs.mkdirSync(path.dirname(pathToOpen), { recursive: true });
    }
    let openedDb;
    try {
        openedDb = new Database(pathToOpen);
        const check = openedDb.prepare("PRAGMA integrity_check").get();
        if (check && check.integrity_check !== 'ok') {
            throw new Error("Integrity check returned: " + JSON.stringify(check));
        }
    } catch (error) {
        const nativeModuleMismatch =
            error && (
                error.code === 'ERR_DLOPEN_FAILED' ||
                String(error.message || '').includes('NODE_MODULE_VERSION')
            );
        if (nativeModuleMismatch) {
            console.error("SQLite native driver failed to load. Database file was not modified.", error.message);
            throw error;
        }
        console.error("⚠️ SQLite Database Integrity Check Failed! Recreating database...", error);
        try {
            if (openedDb) openedDb.close();
        } catch (closeErr) {}
        if (fs.existsSync(pathToOpen)) {
            const corruptPath = path.join(path.dirname(pathToOpen), `chrono_corrupt_${Date.now()}.db`);
            fs.renameSync(pathToOpen, corruptPath);
        }
        openedDb = new Database(pathToOpen);
    }
    if (typeof openedDb.function === 'function') {
        openedDb.function('current_user_id', () => activeUserId || 'local_user');
    }
    return openedDb;
}

function setActiveUserId(newUserId) {
    const normalizedUserId = newUserId || 'local_user';
    const newDbPath = getUserDbPath(normalizedUserId);
    if (newDbPath === dbPath) {
        setCurrentUserId(normalizedUserId);
        persistActiveUserId(normalizedUserId);
        return;
    }
    if (db) {
        try {
            db.close();
        } catch (err) {
            console.warn('Failed to close previous database:', err.message);
        }
    }
    activeUserId = normalizedUserId;
    dbPath = newDbPath;
    db = openDatabaseAtPath(dbPath);
    ensureSchemaOnDb(db);
    setCurrentUserId(normalizedUserId);
    persistActiveUserId(activeUserId);
}

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// If the active user index file is present, use it; otherwise, migrate legacy base DB into local_user or the authenticated user's DB.
const chosenActiveUserId = loadActiveUserId();
activeUserId = chosenActiveUserId;
const chosenDbPath = getUserDbPath(activeUserId);
if (userIndexPath && !fs.existsSync(chosenDbPath) && fs.existsSync(path.join(path.dirname(userIndexPath), 'chrono.db'))) {
    copyLegacyDbTo(chosenDbPath);
}
dbPath = chosenDbPath;
function ensureSchemaOnDb(targetDb) {
    if (!targetDb) return;
    try {
        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS sync_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                date TEXT NOT NULL,
                calendar TEXT DEFAULT 'personal',
                completed INTEGER DEFAULT 0,
                start_time TEXT,
                duration_min INTEGER DEFAULT 60,
                updated_at INTEGER NOT NULL,
                device_id TEXT,
                synced INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0,
                goal_id TEXT,
                project_id TEXT,
                subject_id TEXT,
                visibility TEXT DEFAULT 'private',
                shared_with TEXT DEFAULT '[]',
                importance_score INTEGER DEFAULT 5,
                impact_score INTEGER DEFAULT 5
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS calendars (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                owner_id TEXT,
                layer_type TEXT DEFAULT 'personal',
                updated_at INTEGER NOT NULL,
                device_id TEXT,
                synced INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS calendar_events (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                title TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                category TEXT DEFAULT 'default',
                is_private INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS cognitive_memories (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                memory_type TEXT DEFAULT 'short_term',
                content TEXT,
                source_type TEXT DEFAULT 'user_explicit',
                evidence TEXT,
                confidence TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'active',
                importance_score INTEGER DEFAULT 5,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                device_id TEXT,
                synced INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0
            )
        `).run();

        try { targetDb.prepare("ALTER TABLE cognitive_memories ADD COLUMN source_type TEXT DEFAULT 'user_explicit'").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE cognitive_memories ADD COLUMN evidence TEXT").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE cognitive_memories ADD COLUMN confidence TEXT DEFAULT 'medium'").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE cognitive_memories ADD COLUMN status TEXT DEFAULT 'active'").run(); } catch(e) {}

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS workspace_conversation (
                id TEXT PRIMARY KEY,
                parent_id TEXT NULL,
                generation_group_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                semantic_metadata TEXT,
                created_at INTEGER,
                updated_at INTEGER NOT NULL,
                device_id TEXT,
                synced INTEGER DEFAULT 0
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS workspace_notes (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                parent_note_id TEXT,
                title TEXT NOT NULL,
                icon TEXT DEFAULT '📝',
                cover_url TEXT,
                is_pinned INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0,
                synced INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS workspace_blocks (
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                parent_block_id TEXT,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                depth_level INTEGER DEFAULT 0,
                order_index INTEGER DEFAULT 0,
                properties TEXT,
                source_provenance TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS workspace_links (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                target_type TEXT NOT NULL,
                relationship TEXT DEFAULT 'reference',
                created_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS flashcard_decks (
                id TEXT PRIMARY KEY,
                block_id TEXT,
                user_id TEXT NOT NULL,
                front_prompt TEXT NOT NULL,
                back_answer TEXT NOT NULL,
                repetition_level INTEGER DEFAULT 0,
                ease_factor REAL DEFAULT 2.5,
                interval_days INTEGER DEFAULT 1,
                next_review_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'active',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS peers (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                display_name TEXT NOT NULL,
                relationship_type TEXT DEFAULT 'peer',
                email TEXT,
                phone TEXT,
                public_key TEXT,
                trust_score INTEGER DEFAULT 5,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS chrono_call_history (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                caller_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                call_type TEXT DEFAULT 'AUDIO',
                status TEXT DEFAULT 'ENDED',
                duration_seconds INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS chrono_direct_messages (
                id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                recipient_id TEXT NOT NULL,
                content TEXT NOT NULL,
                media_url TEXT,
                origin TEXT DEFAULT 'CHRONO',
                read_status INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS workspace_attachments (
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                original_name TEXT NOT NULL,
                storage_path TEXT,
                mime_type TEXT,
                file_size INTEGER,
                created_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                name TEXT NOT NULL,
                role TEXT,
                phone TEXT,
                country TEXT,
                avatar_url TEXT,
                status TEXT DEFAULT 'active',
                peer_user_id TEXT,
                peer_email TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS shared_activities (
                id TEXT PRIMARY KEY,
                relationship_id TEXT NOT NULL,
                activity_type TEXT NOT NULL,
                activity_id TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS shared_milestones (
                id TEXT PRIMARY KEY,
                peer_id TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                importance_score INTEGER DEFAULT 5,
                completed INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER,
                completed_at INTEGER
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS relationship_interactions (
                id TEXT PRIMARY KEY,
                peer_id TEXT NOT NULL,
                interaction_type TEXT NOT NULL DEFAULT 'conversation',
                type TEXT DEFAULT 'conversation',
                notes TEXT,
                timestamp INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS continuity_metrics (
                peer_id TEXT PRIMARY KEY,
                continuity_score TEXT DEFAULT 'Medium',
                trend TEXT DEFAULT 'Stable',
                last_interaction INTEGER,
                shared_projects INTEGER DEFAULT 0,
                shared_milestones INTEGER DEFAULT 0,
                reciprocity TEXT DEFAULT 'Balanced',
                frequency INTEGER DEFAULT 0,
                calculated_at INTEGER,
                updated_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS chrono_spaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                icon TEXT DEFAULT '👥',
                owner_id TEXT,
                created_by TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                synced INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS chrono_space_members (
                space_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                display_name TEXT DEFAULT 'Member',
                role TEXT DEFAULT 'MEMBER',
                joined_at INTEGER NOT NULL,
                synced INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0,
                PRIMARY KEY(space_id, user_id)
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS chrono_space_resources (
                id TEXT PRIMARY KEY,
                space_id TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                title TEXT NOT NULL,
                permission_level TEXT DEFAULT 'VIEW',
                created_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS chrono_space_proposals (
                id TEXT PRIMARY KEY,
                space_id TEXT NOT NULL,
                proposer_id TEXT NOT NULL,
                proposer_name TEXT NOT NULL,
                proposal_type TEXT DEFAULT 'CALENDAR_EVENT',
                title TEXT,
                payload_json TEXT,
                event_data TEXT,
                status TEXT DEFAULT 'OPEN',
                conflict_status TEXT DEFAULT 'CLEAN',
                conflict_details TEXT,
                review_feedback TEXT,
                reviewer_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER,
                reviewed_at INTEGER
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                calendar_id TEXT DEFAULT 'personal',
                text TEXT NOT NULL,
                date TEXT NOT NULL,
                completed INTEGER DEFAULT 0,
                start_time TEXT,
                duration_min INTEGER DEFAULT 60,
                created_by TEXT,
                updated_at INTEGER NOT NULL,
                device_id TEXT,
                deleted INTEGER DEFAULT 0
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS workspace_revisions (
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                user_id TEXT,
                change_type TEXT DEFAULT 'edited',
                created_by TEXT DEFAULT 'user',
                content_snapshot TEXT,
                snapshot_content TEXT,
                change_summary TEXT,
                created_at INTEGER NOT NULL
            )
        `).run();

        targetDb.prepare(`
            CREATE TABLE IF NOT EXISTS user_interaction_profiles (
                user_id TEXT NOT NULL,
                pref_key TEXT NOT NULL,
                pref_value TEXT NOT NULL,
                pref_type TEXT NOT NULL DEFAULT 'inferred',
                confidence REAL NOT NULL DEFAULT 1.0,
                evidence_count INTEGER DEFAULT 1,
                metadata TEXT,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY(user_id, pref_key)
            )
        `).run();

        try { targetDb.prepare("ALTER TABLE tasks ADD COLUMN user_id TEXT").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE relationships ADD COLUMN phone TEXT").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE relationships ADD COLUMN country TEXT").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE relationships ADD COLUMN avatar_url TEXT").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE relationships ADD COLUMN status TEXT DEFAULT 'active'").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE relationship_interactions ADD COLUMN interaction_type TEXT DEFAULT 'conversation'").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE relationship_interactions ADD COLUMN notes TEXT").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE chrono_spaces ADD COLUMN icon TEXT DEFAULT '👥'").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE chrono_space_proposals ADD COLUMN proposal_type TEXT DEFAULT 'EVENT'").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE continuity_metrics ADD COLUMN trend TEXT DEFAULT 'Stable'").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE continuity_metrics ADD COLUMN last_interaction INTEGER").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE continuity_metrics ADD COLUMN shared_projects INTEGER DEFAULT 0").run(); } catch(e) {}
        try { targetDb.prepare("ALTER TABLE continuity_metrics ADD COLUMN shared_milestones INTEGER DEFAULT 0").run(); } catch(e) {}

        // High-Volume Scale Indexes for O(log N) branch traversal and rapid retrieval
        targetDb.prepare(`CREATE INDEX IF NOT EXISTS idx_ws_conv_parent ON workspace_conversation(parent_id)`).run();
        targetDb.prepare(`CREATE INDEX IF NOT EXISTS idx_ws_conv_gen_grp ON workspace_conversation(generation_group_id)`).run();
        targetDb.prepare(`CREATE INDEX IF NOT EXISTS idx_ws_conv_created ON workspace_conversation(created_at)`).run();
        targetDb.prepare(`CREATE INDEX IF NOT EXISTS idx_cog_mem_status_user ON cognitive_memories(user_id, status, deleted, updated_at)`).run();
        targetDb.prepare(`CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date, deleted)`).run();
        targetDb.prepare(`CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date, deleted)`).run();
        targetDb.prepare(`CREATE INDEX IF NOT EXISTS idx_cal_user_time ON calendar_events(user_id, start_time)`).run();
        targetDb.prepare(`CREATE INDEX IF NOT EXISTS idx_ws_blocks_note ON workspace_blocks(note_id, order_index)`).run();
        targetDb.prepare(`CREATE INDEX IF NOT EXISTS idx_ws_notes_user ON workspace_notes(user_id, deleted)`).run();
        targetDb.prepare(`CREATE INDEX IF NOT EXISTS idx_dir_msg_thread ON chrono_direct_messages(thread_id, created_at)`).run();
        targetDb.prepare(`CREATE INDEX IF NOT EXISTS idx_call_hist_user ON chrono_call_history(caller_id, receiver_id, created_at)`).run();
    } catch (e) {
        console.warn("ensureSchemaOnDb warning:", e.message);
    }
}

db = openDatabaseAtPath(dbPath);
ensureSchemaOnDb(db);
setCurrentUserId(activeUserId);

// Schema Migration for tasks table:
// If table exists but has INTEGER primary key, migrate it.
const tableInfo = db.prepare('PRAGMA table_info(tasks)').all();
let requiresMigration = false;
if (tableInfo.length > 0) {
    const idColumn = tableInfo.find(col => col.name === 'id');
    if (idColumn && idColumn.type.toUpperCase() === 'INTEGER') {
        requiresMigration = true;
    }
}

if (requiresMigration) {
    console.log("âš ï¸ Old INTEGER tasks table schema detected. Starting migration to UUID-based Offline-Sync schema...");
    
    // 1. Fetch old tasks
    const oldTasks = db.prepare('SELECT * FROM tasks').all();
    
    // 2. Drop old table
    db.prepare('DROP TABLE tasks').run();
    
    // 3. Create new table
    createNewTasksTable();
    
    // 4. Insert old tasks as UUIDs
    const insertStmt = db.prepare(`
        INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const migrateDeviceId = 'dev_migrated';
    for (const task of oldTasks) {
        const uuid = 'e_' + Math.random().toString(36).substring(2, 11) + '_' + task.id;
        const updatedAt = Date.now();
        insertStmt.run(
            uuid,
            task.text || 'Unlabeled Task',
            task.date || new Date().toISOString().split('T')[0],
            task.calendar || 'personal',
            task.completed || 0,
            task.start_time || null,
            task.duration_min || 60,
            updatedAt,
            migrateDeviceId,
            0, // Not synced yet
            0  // Not deleted
        );
    }
    console.log(`âœ… Successfully migrated ${oldTasks.length} legacy tasks to offline-sync UUID model.`);
} else {
    createNewTasksTable();
}

function createNewTasksTable() {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            date TEXT NOT NULL,
            calendar TEXT DEFAULT 'personal',
            completed INTEGER DEFAULT 0,
            start_time TEXT,
            duration_min INTEGER DEFAULT 60,
            updated_at INTEGER NOT NULL,
            device_id TEXT,
            synced INTEGER DEFAULT 0,
            deleted INTEGER DEFAULT 0,
            goal_id TEXT,
            project_id TEXT,
            subject_id TEXT,
            visibility TEXT DEFAULT 'private',
            shared_with TEXT DEFAULT '[]',
            importance_score INTEGER DEFAULT 5,
            impact_score INTEGER DEFAULT 5
        )
    `).run();

    try {
        db.prepare("ALTER TABLE tasks ADD COLUMN goal_id TEXT").run();
    } catch(e) {}
    try {
        db.prepare("ALTER TABLE tasks ADD COLUMN project_id TEXT").run();
    } catch(e) {}
    try {
        db.prepare("ALTER TABLE tasks ADD COLUMN subject_id TEXT").run();
    } catch(e) {}
}

// Create remaining tables for sync
db.prepare(`
    CREATE TABLE IF NOT EXISTS calendars (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT,
        layer_type TEXT DEFAULT 'personal',
        updated_at INTEGER NOT NULL,
        device_id TEXT,
        synced INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS calendar_members (
        calendar_id TEXT,
        user_id TEXT,
        role TEXT DEFAULT 'viewer',
        updated_at INTEGER NOT NULL,
        device_id TEXT,
        synced INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0,
        PRIMARY KEY (calendar_id, user_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        display_name TEXT,
        cognitive_style TEXT DEFAULT 'adaptive',
        reassurance_needs TEXT DEFAULT 'moderate',
        updated_at INTEGER NOT NULL,
        synced INTEGER DEFAULT 0
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS workspace_conversation (
        id TEXT PRIMARY KEY,
        parent_id TEXT NULL,
        generation_group_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        semantic_metadata TEXT,
        created_at INTEGER,
        updated_at INTEGER NOT NULL,
        device_id TEXT,
        synced INTEGER DEFAULT 0
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS memory_chat (
        id TEXT PRIMARY KEY,
        user_input TEXT,
        ai_response TEXT,
        timestamp INTEGER,
        updated_at INTEGER NOT NULL,
        device_id TEXT,
        synced INTEGER DEFAULT 0
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS memory_behavior (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        value TEXT,
        timestamp INTEGER
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS cognitive_memories (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        memory_type TEXT DEFAULT 'short_term',
        content TEXT,
        importance_score INTEGER DEFAULT 5,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        device_id TEXT,
        synced INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS cognitive_actions (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        source_engine TEXT NOT NULL,
        rationale TEXT,
        applied INTEGER DEFAULT 1,
        undo_data TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS chat_experience_turns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_input TEXT NOT NULL,
        ai_response TEXT,
        depth_level INTEGER DEFAULT 0,
        depth_label TEXT DEFAULT 'ordinary',
        familiarity_level TEXT DEFAULT 'new',
        mode TEXT DEFAULT 'practical',
        created_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS chat_questions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        parent_id TEXT,
        question_text TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        depth_level INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS chat_hypotheses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        hypothesis TEXT NOT NULL,
        category TEXT DEFAULT 'HYPOTHESIS',
        evidence TEXT DEFAULT '[]',
        counterevidence TEXT DEFAULT '[]',
        confidence REAL DEFAULT 0.5,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS chat_misunderstandings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        previous_belief TEXT,
        correction TEXT,
        missing_distinction TEXT,
        recurrence_count INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS cognitive_profiles (
        user_id TEXT PRIMARY KEY,
        best_focus_time TEXT,
        low_energy_time TEXT,
        preferred_session_length INTEGER DEFAULT 45,
        stress_triggers TEXT DEFAULT '[]',
        weekly_completion_rates TEXT DEFAULT '{}',
        updated_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        target_date TEXT,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS subject_mastery (
        subject_id TEXT PRIMARY KEY,
        mastery REAL DEFAULT 0.0,
        quiz_scores TEXT DEFAULT '[]',
        revision_frequency INTEGER DEFAULT 0,
        last_recalled INTEGER,
        FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    )
`).run();

// Create notes, relationships, and shared_activities tables
db.prepare(`
    CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL,
        content TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        linked_goal_id TEXT,
        linked_project_id TEXT,
        linked_subject_id TEXT,
        visibility TEXT DEFAULT 'private',
        shared_with TEXT DEFAULT '[]',
        importance_score INTEGER DEFAULT 5,
        impact_score INTEGER DEFAULT 5
    )
`).run();

// ========================================
// 🧠 KNOWLEDGE WORKSPACE SCHEMA
// ========================================

// ========================================
// 🧠 KNOWLEDGE WORKSPACE SCHEMA (Notion + RemNote Subsystem)
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS workspace_notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        parent_note_id TEXT,
        title TEXT NOT NULL,
        icon TEXT DEFAULT '📝',
        cover_url TEXT,
        is_pinned INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER DEFAULT 0,
        synced INTEGER DEFAULT 0
    )
`).run();

// Migration: add columns if table already existed
try { db.prepare(`ALTER TABLE workspace_notes ADD COLUMN parent_note_id TEXT`).run(); } catch(e) {}
try { db.prepare(`ALTER TABLE workspace_notes ADD COLUMN icon TEXT DEFAULT '📝'`).run(); } catch(e) {}
try { db.prepare(`ALTER TABLE workspace_notes ADD COLUMN cover_url TEXT`).run(); } catch(e) {}
try { db.prepare(`ALTER TABLE workspace_notes ADD COLUMN is_pinned INTEGER DEFAULT 0`).run(); } catch(e) {}

db.prepare(`
    CREATE TABLE IF NOT EXISTS workspace_blocks (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        parent_block_id TEXT,
        type TEXT DEFAULT 'paragraph',
        content TEXT,
        depth_level INTEGER DEFAULT 0,
        order_index INTEGER DEFAULT 0,
        properties TEXT,
        source_provenance TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(note_id) REFERENCES workspace_notes(id) ON DELETE CASCADE
    )
`).run();

try { db.prepare(`ALTER TABLE workspace_blocks ADD COLUMN parent_block_id TEXT`).run(); } catch(e) {}
try { db.prepare(`ALTER TABLE workspace_blocks ADD COLUMN depth_level INTEGER DEFAULT 0`).run(); } catch(e) {}
try { db.prepare(`ALTER TABLE workspace_blocks ADD COLUMN properties TEXT`).run(); } catch(e) {}
try { db.prepare(`ALTER TABLE workspace_blocks ADD COLUMN source_provenance TEXT`).run(); } catch(e) {}

db.prepare(`
    CREATE TABLE IF NOT EXISTS workspace_attachments (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        ocr_text TEXT,
        thumbnail_path TEXT,
        source_provenance TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(note_id) REFERENCES workspace_notes(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS workspace_revisions (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        user_id TEXT DEFAULT 'local_user',
        change_type TEXT DEFAULT 'edited',
        created_by TEXT DEFAULT 'user',
        content_snapshot TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(note_id) REFERENCES workspace_notes(id) ON DELETE CASCADE
    )
`).run();

try { db.prepare(`ALTER TABLE workspace_revisions ADD COLUMN user_id TEXT DEFAULT 'local_user'`).run(); } catch(e) {}
try { db.prepare(`ALTER TABLE workspace_revisions ADD COLUMN change_type TEXT DEFAULT 'edited'`).run(); } catch(e) {}
try { db.prepare(`ALTER TABLE workspace_revisions ADD COLUMN created_by TEXT DEFAULT 'user'`).run(); } catch(e) {}

db.prepare(`
    CREATE TABLE IF NOT EXISTS flashcard_decks (
        id TEXT PRIMARY KEY,
        block_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        front_prompt TEXT NOT NULL,
        back_answer TEXT NOT NULL,
        repetition_level INTEGER DEFAULT 0,
        ease_factor REAL DEFAULT 2.5,
        interval_days INTEGER DEFAULT 1,
        next_review_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(block_id) REFERENCES workspace_blocks(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS workspace_links (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        relationship TEXT DEFAULT 'reference',
        created_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS workspace_resources (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT DEFAULT 'document',
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        storage_path TEXT,
        ocr_text TEXT,
        parsed_metadata TEXT,
        status TEXT DEFAULT 'processed',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS resource_shares (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        shared_with_user_id TEXT NOT NULL,
        permission_level TEXT DEFAULT 'VIEW',
        revoked INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(resource_id) REFERENCES workspace_resources(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        role TEXT,
        display_picture TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS shared_activities (
        id TEXT PRIMARY KEY,
        relationship_id TEXT NOT NULL,
        activity_type TEXT NOT NULL, -- 'event', 'goal', 'project', 'note', 'memory'
        target_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(relationship_id) REFERENCES relationships(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS shared_milestones (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        target_date TEXT,
        peer_id TEXT,
        project_id TEXT,
        goal_id TEXT,
        memory_id TEXT,
        status TEXT DEFAULT 'active',
        importance_score INTEGER DEFAULT 5,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        synced INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS relationship_interactions (
        id TEXT PRIMARY KEY,
        peer_id TEXT,
        interaction_type TEXT,
        timestamp INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS shared_memories (
        id TEXT PRIMARY KEY,
        peer_id TEXT,
        title TEXT,
        summary TEXT,
        importance INTEGER DEFAULT 5,
        created_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS continuity_metrics (
        peer_id TEXT PRIMARY KEY,
        continuity_score TEXT,
        trend TEXT,
        last_interaction INTEGER,
        shared_projects INTEGER DEFAULT 0,
        shared_milestones INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS chrono_spaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT DEFAULT '🚀',
        owner_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        synced INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS chrono_space_members (
        space_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT,
        role TEXT DEFAULT 'CONTRIBUTOR',
        joined_at INTEGER NOT NULL,
        synced INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0,
        PRIMARY KEY (space_id, user_id),
        FOREIGN KEY(space_id) REFERENCES chrono_spaces(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS chrono_space_resources (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        title TEXT,
        permission_level TEXT DEFAULT 'VIEW',
        created_at INTEGER NOT NULL,
        FOREIGN KEY(space_id) REFERENCES chrono_spaces(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS chrono_space_proposals (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        proposer_id TEXT NOT NULL,
        proposer_name TEXT,
        proposal_type TEXT DEFAULT 'CALENDAR_EVENT',
        title TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT DEFAULT 'OPEN',
        conflict_status TEXT DEFAULT 'CLEAN',
        conflict_details TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(space_id) REFERENCES chrono_spaces(id) ON DELETE CASCADE
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS chrono_direct_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        content TEXT NOT NULL,
        media_url TEXT,
        origin TEXT DEFAULT 'CHRONO',
        read_status INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
    )
`).run();


// Alter tables for migrations (e.g. visibility column on tasks)
try {
    db.prepare("ALTER TABLE tasks ADD COLUMN visibility TEXT DEFAULT 'private'").run();
} catch(e) {}
try {
    db.prepare("ALTER TABLE tasks ADD COLUMN synced INTEGER DEFAULT 0").run();
} catch(e) {}
try {
    db.prepare("ALTER TABLE tasks ADD COLUMN deleted INTEGER DEFAULT 0").run();
} catch(e) {}
try {
    db.prepare("ALTER TABLE tasks ADD COLUMN shared_with TEXT DEFAULT '[]'").run();
} catch(e) {}
try {
    db.prepare("ALTER TABLE tasks ADD COLUMN importance_score INTEGER DEFAULT 5").run();
} catch(e) {}
try {
    db.prepare("ALTER TABLE tasks ADD COLUMN impact_score INTEGER DEFAULT 5").run();
} catch(e) {}

try {
    db.prepare("ALTER TABLE notes ADD COLUMN shared_with TEXT DEFAULT '[]'").run();
} catch(e) {}
try {
    db.prepare("ALTER TABLE notes ADD COLUMN importance_score INTEGER DEFAULT 5").run();
} catch(e) {}
try {
    db.prepare("ALTER TABLE notes ADD COLUMN impact_score INTEGER DEFAULT 5").run();
} catch(e) {}

try {
    db.prepare("ALTER TABLE chat_hypotheses ADD COLUMN category TEXT DEFAULT 'HYPOTHESIS'").run();
} catch(e) {}

try {
    db.prepare("ALTER TABLE relationships ADD COLUMN peer_user_id TEXT").run();
} catch(e) {}
try {
    db.prepare("ALTER TABLE relationships ADD COLUMN peer_email TEXT").run();
} catch(e) {}

// Create relationship templates table
db.prepare(`
    CREATE TABLE IF NOT EXISTS relationship_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
    )
`).run();

// Create cognitive loops table
db.prepare(`
    CREATE TABLE IF NOT EXISTS cognitive_loops (
        topic TEXT PRIMARY KEY,
        revisited_count INTEGER DEFAULT 1,
        status TEXT DEFAULT 'no_new_development',
        resolution_action TEXT DEFAULT 'continue_reflection',
        updated_at INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS cognitive_loop_adherence (
        id TEXT PRIMARY KEY,
        topic TEXT,
        action TEXT,
        date_resolved INTEGER,
        completed_review INTEGER DEFAULT 0
    )
`).run();

// Create cognitive front categories table
db.prepare(`
    CREATE TABLE IF NOT EXISTS cognitive_front_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        active INTEGER DEFAULT 1
    )
`).run();

// Seed default front categories if empty
try {
    const catCount = db.prepare("SELECT COUNT(*) as count FROM cognitive_front_categories").get();
    if (catCount && catCount.count === 0) {
        const insertCat = db.prepare("INSERT INTO cognitive_front_categories (id, name, active) VALUES (?, ?, 1)");
        const defaults = [
            ['cat_academic', 'Academic'],
            ['cat_project', 'Project'],
            ['cat_relationship', 'Relationship'],
            ['cat_health', 'Health'],
            ['cat_personal', 'Personal'],
            ['cat_faith_values', 'Faith / Values'],
            ['cat_family', 'Family'],
            ['cat_community', 'Community'],
            ['cat_growth', 'Personal Growth']
        ];
        for (const c of defaults) {
            insertCat.run(c[0], c[1]);
        }
    }
} catch (e) {
    console.error("Failed to seed front categories:", e.message);
}

// Alter tables to add memory preservation state columns
try {
    db.prepare("ALTER TABLE cognitive_memories ADD COLUMN preservation_state TEXT DEFAULT 'Archive'").run();
} catch(e) {}

try {
    // Phase 4 Provenance Migrations
    db.prepare("ALTER TABLE cognitive_memories ADD COLUMN source_type TEXT DEFAULT 'system_observation'").run();
    db.prepare("ALTER TABLE cognitive_memories ADD COLUMN evidence TEXT").run();
    db.prepare("ALTER TABLE cognitive_memories ADD COLUMN confidence TEXT DEFAULT 'medium'").run();
    db.prepare("ALTER TABLE cognitive_memories ADD COLUMN status TEXT DEFAULT 'active'").run();
} catch(e) {}
try {
    db.prepare("ALTER TABLE tasks ADD COLUMN preservation_state TEXT DEFAULT 'Archive'").run();
} catch(e) {}
try {
    db.prepare("ALTER TABLE notes ADD COLUMN preservation_state TEXT DEFAULT 'Archive'").run();
} catch(e) {}

// Seed default templates if empty
const templateCount = db.prepare("SELECT COUNT(*) as count FROM relationship_templates").get();
if (templateCount && templateCount.count === 0) {
    console.log("ðŸŒ± Seeding default relationship templates...");
    const insertTemplate = db.prepare(`
        INSERT INTO relationship_templates (id, name, description)
        VALUES (?, ?, ?)
    `);
    const defaultTemplates = [
        { id: 'tmpl_study_partner', name: 'Study Partner', description: 'Peer focused on academic collaboration and shared study goals.' },
        { id: 'tmpl_project_partner', name: 'Project Partner', description: 'Partner for shared projects, tasks, and deliverables.' },
        { id: 'tmpl_close_friend', name: 'Close Friend', description: 'Social contact for personal sharing and casual meetups.' },
        { id: 'tmpl_mentor', name: 'Mentor', description: 'Advisor providing guidance, career help, and task reviews.' },
        { id: 'tmpl_family', name: 'Family', description: 'Immediate family member with broad sharing visibility.' }
    ];
    for (const tmpl of defaultTemplates) {
        insertTemplate.run(tmpl.id, tmpl.name, tmpl.description);
    }
    console.log("âœ… Seeding relationship templates completed.");
}

// Demo peer seeding removed: people must be added by the user.




const DEMO_PEER_IDS = ['rel_princess', 'rel_rayhaan', 'rel_sana', 'rel_tara', 'rel_anwesha'];
if (process.env.CHRONO_SEED_TEST_PEERS !== 'true') {
    try {
        const placeholders = DEMO_PEER_IDS.map(() => '?').join(', ');
        const cleanupDemoPeers = db.transaction(() => {
            db.prepare(`DELETE FROM shared_activities WHERE relationship_id IN (${placeholders})`).run(...DEMO_PEER_IDS);
            db.prepare(`DELETE FROM shared_milestones WHERE peer_id IN (${placeholders})`).run(...DEMO_PEER_IDS);
            db.prepare(`DELETE FROM relationship_interactions WHERE peer_id IN (${placeholders})`).run(...DEMO_PEER_IDS);
            db.prepare(`DELETE FROM shared_memories WHERE peer_id IN (${placeholders})`).run(...DEMO_PEER_IDS);
            db.prepare(`DELETE FROM continuity_metrics WHERE peer_id IN (${placeholders})`).run(...DEMO_PEER_IDS);
            db.prepare("DELETE FROM tasks WHERE id = 'e_shared_study_princess'").run();
            db.prepare(`DELETE FROM relationships WHERE id IN (${placeholders})`).run(...DEMO_PEER_IDS);
        });
        cleanupDemoPeers();
    } catch (e) {
        console.error("Failed to clean up demo peer profiles:", e.message);
    }
}

// ========================================
// ðŸ› ï¸ DATABASE UTILITY METHODS
// ========================================

function generateUUID() {
    return 'e_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
}

function getDeviceId() {
    const row = db.prepare("SELECT value FROM sync_meta WHERE key = 'device_id'").get();
    if (row) return row.value;
    const newId = 'dev_' + Math.random().toString(36).substring(2, 15);
    db.prepare("INSERT INTO sync_meta (key, value) VALUES ('device_id', ?)").run(newId);
    return newId;
}

function addTask(task) {
    const id = (typeof task === 'object' && task.id) ? task.id : generateUUID();
    const taskText = typeof task === 'object' ? task.text : task;
    const taskDate = (typeof task === 'object' && task.date) ? task.date : new Date().toISOString().split('T')[0];
    const calendar = (typeof task === 'object' && task.calendar) ? task.calendar : 'personal';
    const startTime = (typeof task === 'object' && task.start_time) ? task.start_time : null;
    const durationMin = (typeof task === 'object' && task.duration_min) ? task.duration_min : 60;
    const visibility = (typeof task === 'object' && task.visibility) ? task.visibility : 'private';
    const sharedWith = (typeof task === 'object' && task.shared_with) ? (typeof task.shared_with === 'string' ? task.shared_with : JSON.stringify(task.shared_with)) : '[]';
    const importance = (typeof task === 'object' && task.importance_score) ? task.importance_score : 5;
    const impact = (typeof task === 'object' && task.impact_score) ? task.impact_score : 5;
    const goalId = (typeof task === 'object' && task.goal_id) ? task.goal_id : null;
    const projectId = (typeof task === 'object' && task.project_id) ? task.project_id : null;
    const subjectId = (typeof task === 'object' && task.subject_id) ? task.subject_id : null;
    
    const deviceId = getDeviceId();
    const updatedAt = Date.now();

    // If a Supabase cloud client and an authenticated user exists, write to cloud first
    try {
        const authUserId = getSyncMeta('auth_user_id');
        const authToken = getSyncMeta('auth_token');
        const useCloud = getSyncMeta('use_cloud') !== 'false';
        if (cloudDb && authUserId && authToken && useCloud) {
            // Attempt cloud insert (non-blocking for local flow)
            (async () => {
                try {
                    await cloudDb
                        .from('events')
                        .insert([{ 
                            id, 
                            text: taskText, 
                            date: taskDate, 
                            calendar_id: calendar, 
                            completed: 0, 
                            start_time: startTime, 
                            duration_min: durationMin, 
                            updated_at: updatedAt, 
                            device_id: deviceId, 
                            synced: 1, 
                            deleted: 0, 
                            visibility, 
                            shared_with: sharedWith, 
                            importance_score: importance, 
                            impact_score: impact, 
                            goal_id: goalId, 
                            project_id: projectId, 
                            subject_id: subjectId, 
                            created_by: authUserId 
                        }]);
                } catch (cloudErr) {
                    console.warn('Cloud insert failed, will keep local copy:', cloudErr.message || cloudErr);
                }
            })();
        }

        // Always keep a local copy for offline usage
        db.prepare(`
            INSERT OR REPLACE INTO tasks (
                id, text, date, calendar, completed, start_time, duration_min, 
                updated_at, device_id, synced, deleted, visibility, shared_with, 
                importance_score, impact_score, goal_id, project_id, subject_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            taskText,
            taskDate,
            calendar,
            0,
            startTime,
            durationMin,
            updatedAt,
            deviceId,
            visibility,
            sharedWith,
            importance,
            impact,
            goalId,
            projectId,
            subjectId
        );
    } catch (error) {
        console.error('main_db.addTask failed:', error.message);
        throw error;
    }
}

async function fetchTasks(date) {
    const authUserId = getSyncMeta('auth_user_id');
    const authToken = getSyncMeta('auth_token');
    const useCloud = getSyncMeta('use_cloud') !== 'false';
    if (cloudDb && authUserId && authToken && useCloud) {
        try {
            const { data, error } = await cloudDb
                .from('events')
                .select('*')
                .eq('date', date)
                .eq('deleted', 0)
                .order('updated_at', { ascending: false });
            if (error) throw error;
            return (data || []).map(e => ({
                ...e,
                calendar: e.calendar_id
            }));
        } catch (e) {
            console.warn('Cloud fetchTasks failed, falling back to local:', e.message);
        }
    }
    return db.prepare('SELECT * FROM tasks WHERE date = ? AND deleted = 0').all(date);
}

async function fetchTasksInRange(startDate, endDate) {
    const authUserId = getSyncMeta('auth_user_id');
    const authToken = getSyncMeta('auth_token');
    const useCloud = getSyncMeta('use_cloud') !== 'false';
    if (cloudDb && authUserId && authToken && useCloud) {
        try {
            const { data, error } = await cloudDb
                .from('events')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate)
                .eq('deleted', 0)
                .order('date', { ascending: true })
                .order('updated_at', { ascending: true });
            if (error) throw error;
            return (data || []).map(e => ({
                ...e,
                calendar: e.calendar_id
            }));
        } catch (e) {
            console.warn('Cloud fetchTasksInRange failed, falling back to local:', e.message);
        }
    }
    return db.prepare(
        'SELECT * FROM tasks WHERE date >= ? AND date <= ? AND deleted = 0 ORDER BY date, updated_at'
    ).all(startDate, endDate);
}

async function completeTask(text) {
    const deviceId = getDeviceId();
    const updatedAt = Date.now();
    const authUserId = getSyncMeta('auth_user_id');
    const authToken = getSyncMeta('auth_token');
    const useCloud = getSyncMeta('use_cloud') !== 'false';
    // Update cloud if possible
    if (cloudDb && authUserId && authToken && useCloud) {
        try {
            // If text is an id, update by id; otherwise update by text
            if (text && text.startsWith('e_')) {
                await cloudDb.from('events').update({ completed: 1, updated_at: updatedAt, device_id: deviceId }).eq('id', text);
            } else {
                await cloudDb.from('events').update({ completed: 1, updated_at: updatedAt, device_id: deviceId }).eq('text', text);
            }
        } catch (e) {
            console.warn('Cloud completeTask failed, will mark local copy instead:', e.message);
        }
    }

    // Always update the local copy
    if (text && text.startsWith('e_')) {
        db.prepare(`
            UPDATE tasks 
            SET completed = 1, updated_at = ?, device_id = ?, synced = 0 
            WHERE id = ? AND deleted = 0
        `).run(updatedAt, deviceId, text);
    } else {
        db.prepare(`
            UPDATE tasks 
            SET completed = 1, updated_at = ?, device_id = ?, synced = 0 
            WHERE text = ? AND deleted = 0
        `).run(updatedAt, deviceId, text);
    }

    try {
        let taskText = '';
        if (text && text.startsWith('e_')) {
            const row = db.prepare("SELECT text FROM tasks WHERE id = ?").get(text);
            if (row) taskText = row.text;
        } else {
            taskText = text;
        }

        if (taskText && taskText.startsWith('Review Repeating Topic: ')) {
            const topic = taskText.replace('Review Repeating Topic: ', '');
            db.prepare("UPDATE cognitive_loop_adherence SET completed_review = 1 WHERE topic = ?").run(topic);
        }
    } catch (err) {
        console.error('Failed to update loop adherence in completeTask:', err.message);
    }
}

async function uncompleteTask(idOrText) {
    const deviceId = getDeviceId();
    const updatedAt = Date.now();
    const authUserId = getSyncMeta('auth_user_id');
    const authToken = getSyncMeta('auth_token');
    const useCloud = getSyncMeta('use_cloud') !== 'false';
    // Update cloud if possible
    if (cloudDb && authUserId && authToken && useCloud) {
        try {
            if (idOrText && idOrText.startsWith('e_')) {
                await cloudDb.from('events').update({ completed: 0, updated_at: updatedAt, device_id: deviceId }).eq('id', idOrText);
            } else {
                await cloudDb.from('events').update({ completed: 0, updated_at: updatedAt, device_id: deviceId }).eq('text', idOrText);
            }
        } catch (e) {
            console.warn('Cloud uncompleteTask failed, will mark local copy instead:', e.message);
        }
    }

    // Always update the local copy
    if (idOrText && idOrText.startsWith('e_')) {
        db.prepare(`
            UPDATE tasks 
            SET completed = 0, updated_at = ?, device_id = ?, synced = 0 
            WHERE id = ? AND deleted = 0
        `).run(updatedAt, deviceId, idOrText);
    } else {
        db.prepare(`
            UPDATE tasks 
            SET completed = 0, updated_at = ?, device_id = ?, synced = 0 
            WHERE text = ? AND deleted = 0
        `).run(updatedAt, deviceId, idOrText);
    }

    try {
        let taskText = '';
        if (idOrText && idOrText.startsWith('e_')) {
            const row = db.prepare("SELECT text FROM tasks WHERE id = ?").get(idOrText);
            if (row) taskText = row.text;
        } else {
            taskText = idOrText;
        }

        if (taskText && taskText.startsWith('Review Repeating Topic: ')) {
            const topic = taskText.replace('Review Repeating Topic: ', '');
            db.prepare("UPDATE cognitive_loop_adherence SET completed_review = 0 WHERE topic = ?").run(topic);
        }
    } catch (err) {
        console.error('Failed to revert loop adherence in uncompleteTask:', err.message);
    }
}

async function deleteTask(idOrText) {
    const deviceId = getDeviceId();
    const updatedAt = Date.now();
    const authUserId = getSyncMeta('auth_user_id');
    const authToken = getSyncMeta('auth_token');
    const useCloud = getSyncMeta('use_cloud') !== 'false';

    // 1. If cloud is active, soft-delete on Supabase
    if (cloudDb && authUserId && authToken && useCloud) {
        try {
            if (idOrText && idOrText.startsWith('e_')) {
                await cloudDb.from('events').update({ deleted: 1, updated_at: updatedAt, device_id: deviceId }).eq('id', idOrText);
            } else {
                await cloudDb.from('events').update({ deleted: 1, updated_at: updatedAt, device_id: deviceId }).eq('text', idOrText);
            }
        } catch (e) {
            console.warn('Cloud deleteTask failed, will mark local copy instead:', e.message);
        }
    }

    // 2. Mark as deleted in local SQLite database
    if (idOrText && idOrText.startsWith('e_')) {
        db.prepare(`
            UPDATE tasks 
            SET deleted = 1, updated_at = ?, device_id = ?, synced = 0 
            WHERE id = ?
        `).run(updatedAt, deviceId, idOrText);
    } else {
        db.prepare(`
            UPDATE tasks 
            SET deleted = 1, updated_at = ?, device_id = ?, synced = 0 
            WHERE text = ?
        `).run(updatedAt, deviceId, idOrText);
    }
    return { success: true };
}

async function editTaskText(idOrText, newText) {
    const deviceId = getDeviceId();
    const updatedAt = Date.now();
    const authUserId = getSyncMeta('auth_user_id');
    const authToken = getSyncMeta('auth_token');
    const useCloud = getSyncMeta('use_cloud') !== 'false';

    if (cloudDb && authUserId && authToken && useCloud) {
        try {
            await cloudDb.from('events').update({ text: newText, updated_at: updatedAt, device_id: deviceId }).or(`id.eq.${idOrText},text.eq.${idOrText}`);
        } catch (e) {
            console.warn('Cloud editTaskText failed, updating local copy:', e.message);
        }
    }

    // Try updating by ID first
    const res = db.prepare(`
        UPDATE tasks 
        SET text = ?, updated_at = ?, device_id = ?, synced = 0 
        WHERE id = ?
    `).run(newText, updatedAt, deviceId, idOrText);

    // If no row updated by ID, fallback to updating by text
    if (res.changes === 0) {
        db.prepare(`
            UPDATE tasks 
            SET text = ?, updated_at = ?, device_id = ?, synced = 0 
            WHERE text = ?
        `).run(newText, updatedAt, deviceId, idOrText);
    }
    return { success: true };
}

function getSyncMeta(key) {
    const row = db.prepare("SELECT value FROM sync_meta WHERE key = ?").get(key);
    if (!row) return null;
    const value = row.value;
    
    // Encrypted keys: auth_token, google_provider_token, refresh_token
    if ((key === 'auth_token' || key === 'google_provider_token' || key === 'refresh_token') && safeStorage && safeStorage.isEncryptionAvailable()) {
        try {
            if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
                const encryptedBuffer = Buffer.from(value, 'hex');
                return safeStorage.decryptString(encryptedBuffer);
            }
        } catch (err) {
            console.warn(`Decryption failed for key ${key}, treating as plaintext:`, err.message);
        }
    }
    return value;
}

function setSyncMeta(key, value) {
    if ((key === 'auth_token' || key === 'google_provider_token' || key === 'refresh_token') && safeStorage && safeStorage.isEncryptionAvailable()) {
        try {
            const encryptedBuffer = safeStorage.encryptString(String(value));
            const hexString = encryptedBuffer.toString('hex');
            db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)").run(key, hexString);
            if (key === 'auth_user_id') {
                setActiveUserId(value || 'local_user');
            }
            return;
        } catch (err) {
            console.error(`Encryption failed for key ${key}:`, err.message);
        }
    }
    if (key === 'auth_user_id') {
        setActiveUserId(value || 'local_user');
    }
    db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)").run(key, String(value));
}

// ðŸ›¡ï¸ TRUST KILLER PREVENTION TABLES (Original Chrono Framework)
// Operation logging for data integrity & silent failure detection
db.prepare(`
    CREATE TABLE IF NOT EXISTS operation_log (
        op_id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        device_id TEXT,
        status TEXT DEFAULT 'pending',
        error TEXT,
        retry_count INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL
    )
`).run();

// Backup verification log for restore drills
db.prepare(`
    CREATE TABLE IF NOT EXISTS backup_log (
        id TEXT PRIMARY KEY,
        operation TEXT,
        backup_file TEXT,
        status TEXT DEFAULT 'pending',
        details TEXT,
        created_at INTEGER NOT NULL,
        verified_at INTEGER
    )
`).run();

// ==========================================
// CONVERSATION TREE (WORKSPACE)
// ==========================================

function addWorkspaceMessage(arg1, parentId, content, role, metadata) {
    let msg;
    if (typeof arg1 === 'object' && arg1 !== null) {
        msg = { ...arg1 };
    } else {
        msg = {
            id: arg1 || generateUUID(),
            parent_id: parentId || null,
            content: content || '',
            role: role || 'user',
            semantic_metadata: metadata || null
        };
    }
    if (!msg.id) msg.id = generateUUID();
    const now = Date.now();
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    const stmt = activeDb.prepare(`
        INSERT INTO workspace_conversation (id, parent_id, generation_group_id, role, content, semantic_metadata, created_at, updated_at, device_id, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);
    stmt.run(
        msg.id,
        msg.parent_id !== undefined ? msg.parent_id : (msg.parentId || null),
        msg.generation_group_id || msg.generationGroupId || msg.id,
        msg.role,
        msg.content,
        msg.semantic_metadata ? (typeof msg.semantic_metadata === 'string' ? msg.semantic_metadata : JSON.stringify(msg.semantic_metadata)) : null,
        msg.created_at || now,
        now,
        getDeviceId()
    );
    return msg;
}

function getWorkspaceMessage(id) {
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    const stmt = activeDb.prepare("SELECT * FROM workspace_conversation WHERE id = ?");
    const msg = stmt.get(id);
    if (msg && msg.semantic_metadata) {
        try { msg.semantic_metadata = JSON.parse(msg.semantic_metadata); } catch(e){}
    }
    return msg;
}

function getWorkspaceBranch(leafId) {
    if (!leafId) return [];
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    try {
        const rows = activeDb.prepare(`
            WITH RECURSIVE branch_cte AS (
                SELECT id, parent_id, generation_group_id, role, content, semantic_metadata, created_at, updated_at, device_id, synced, 0 as depth
                FROM workspace_conversation
                WHERE id = ?
                
                UNION ALL
                
                SELECT w.id, w.parent_id, w.generation_group_id, w.role, w.content, w.semantic_metadata, w.created_at, w.updated_at, w.device_id, w.synced, b.depth + 1
                FROM workspace_conversation w
                JOIN branch_cte b ON w.id = b.parent_id
            )
            SELECT * FROM branch_cte ORDER BY depth DESC
        `).all(leafId);

        for (const row of rows) {
            if (row.semantic_metadata) {
                try { row.semantic_metadata = JSON.parse(row.semantic_metadata); } catch(e){}
            }
        }
        return rows;
    } catch(e) {
        // Resilient fallback to iterative traversal
        const branch = [];
        let currentId = leafId;
        while (currentId) {
            const msg = getWorkspaceMessage(currentId);
            if (!msg) break;
            branch.unshift(msg);
            currentId = msg.parent_id;
        }
        return branch;
    }
}

function getWorkspaceConversationLeaves() {
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    const stmt = activeDb.prepare(`
        SELECT * FROM workspace_conversation w1
        WHERE NOT EXISTS (
            SELECT 1 FROM workspace_conversation w2 WHERE w2.parent_id = w1.id
        )
        ORDER BY created_at DESC
    `);
    return stmt.all();
}

function getWorkspaceMessageSiblings(parentId) {
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    const stmt = parentId 
        ? activeDb.prepare("SELECT * FROM workspace_conversation WHERE parent_id = ? ORDER BY created_at ASC")
        : activeDb.prepare("SELECT * FROM workspace_conversation WHERE parent_id IS NULL ORDER BY created_at ASC");
    return parentId ? stmt.all(parentId) : stmt.all();
}

function deleteWorkspaceMessage(id) {
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    activeDb.prepare("DELETE FROM workspace_conversation WHERE id = ?").run(id);
}

function getActiveLeafId() {
    return getSyncMeta('active_leaf_id') || null;
}

function setActiveLeafId(id) {
    setSyncMeta('active_leaf_id', id);
}

/**
 * Writes a shared memory record to the shared_memories table.
 * @param {string} userId - The active user ID (for future user-scoping if schema expands).
 * @param {string} peerId - The relationship ID (foreign key to relationships.id).
 * @param {string} title - Short label for the shared memory.
 * @param {string} summary - Full content/description of the shared memory.
 * @param {number} [importance=5] - Importance score (1–10).
 * @returns {string|null} The new record ID or null on failure.
 */
function addSharedMemory(userId, peerId, title, summary, importance = 5) {
    try {
        const id = generateUUID();
        const now = Date.now();
        dbProxy.prepare(`
            INSERT INTO shared_memories (id, peer_id, title, summary, importance, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, peerId, title, summary, importance, now);
        console.log(`[SharedMemory] Created shared memory ${id} for peer ${peerId}.`);
        return id;
    } catch (e) {
        console.error('[SharedMemory] addSharedMemory failed:', e.message);
        return null;
    }
}

function getAllWorkspaceMessages() {
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    const rows = activeDb.prepare("SELECT * FROM workspace_conversation ORDER BY created_at ASC").all();
    for (const row of rows) {
        if (row.semantic_metadata) {
            try { row.semantic_metadata = JSON.parse(row.semantic_metadata); } catch(e){}
        }
    }
    return rows;
}

function resetWorkspaceConversation() {
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    activeDb.prepare("DELETE FROM workspace_conversation").run();
    setSyncMeta('active_leaf_id', null);
    return { success: true };
}

function restoreWorkspaceConversation(messages, activeLeafId = null) {
    if (!Array.isArray(messages)) return { success: false, error: 'Invalid messages array' };
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    
    const insertTx = activeDb.transaction((msgs) => {
        activeDb.prepare("DELETE FROM workspace_conversation").run();
        const stmt = activeDb.prepare(`
            INSERT INTO workspace_conversation (id, parent_id, generation_group_id, role, content, semantic_metadata, created_at, updated_at, device_id, synced)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const m of msgs) {
            stmt.run(
                m.id || generateUUID(),
                m.parent_id || m.parentId || null,
                m.generation_group_id || m.generationGroupId || m.id,
                m.role || 'user',
                m.content || '',
                m.semantic_metadata ? (typeof m.semantic_metadata === 'string' ? m.semantic_metadata : JSON.stringify(m.semantic_metadata)) : null,
                m.created_at || Date.now(),
                m.updated_at || Date.now(),
                m.device_id || getDeviceId(),
                0
            );
        }
    });

    insertTx(messages);
    if (activeLeafId) {
        setSyncMeta('active_leaf_id', activeLeafId);
    } else if (messages.length > 0) {
        setSyncMeta('active_leaf_id', messages[messages.length - 1].id);
    } else {
        setSyncMeta('active_leaf_id', null);
    }
    return { success: true, count: messages.length };
}

function setUserInteractionPref(userId, prefKey, prefValue, prefType = 'inferred', confidence = 0.8, evidenceCount = 1, metadata = {}) {
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    const uId = userId || activeUserId || 'local_user';
    const now = Date.now();
    const metaStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {});

    activeDb.prepare(`
        INSERT INTO user_interaction_profiles (user_id, pref_key, pref_value, pref_type, confidence, evidence_count, metadata, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, pref_key) DO UPDATE SET
            pref_value = excluded.pref_value,
            pref_type = excluded.pref_type,
            confidence = excluded.confidence,
            evidence_count = user_interaction_profiles.evidence_count + excluded.evidence_count,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at
    `).run(uId, prefKey, String(prefValue), prefType, confidence, evidenceCount, metaStr, now);

    return { success: true };
}

function getUserInteractionPrefs(userId) {
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    const uId = userId || activeUserId || 'local_user';
    const rows = activeDb.prepare("SELECT * FROM user_interaction_profiles WHERE user_id = ?").all(uId);
    const prefs = {};
    for (const r of rows) {
        let meta = {};
        try { meta = JSON.parse(r.metadata || '{}'); } catch(e) {}
        prefs[r.pref_key] = {
            value: r.pref_value,
            type: r.pref_type,
            confidence: r.confidence,
            evidence_count: r.evidence_count,
            metadata: meta,
            updated_at: r.updated_at
        };
    }
    return prefs;
}

function getUserInteractionPref(userId, prefKey) {
    const activeDb = (typeof getDb === 'function' ? getDb() : db);
    const uId = userId || activeUserId || 'local_user';
    const row = activeDb.prepare("SELECT * FROM user_interaction_profiles WHERE user_id = ? AND pref_key = ?").get(uId, prefKey);
    if (!row) return null;
    let meta = {};
    try { meta = JSON.parse(row.metadata || '{}'); } catch(e) {}
    return {
        value: row.pref_value,
        type: row.pref_type,
        confidence: row.confidence,
        evidence_count: row.evidence_count,
        metadata: meta,
        updated_at: row.updated_at
    };
}

module.exports = {
    db: dbProxy,
    getDb: () => db,
    // `dbPath` can change when switching users; provide a dynamic getter below
    getDbPath: () => dbPath,
    getActiveUserId: () => activeUserId,
    setActiveUserId,
    getUserDbPath,
    generateUUID,
    getDeviceId,
    addTask,
    fetchTasks,
    fetchTasksInRange,
    completeTask,
    uncompleteTask,
    deleteTask,
    editTaskText,
    getSyncMeta,
    setSyncMeta,
    addWorkspaceMessage,
    getWorkspaceMessage,
    getWorkspaceBranch,
    getWorkspaceConversationLeaves,
    getWorkspaceMessageSiblings,
    deleteWorkspaceMessage,
    getAllWorkspaceMessages,
    resetWorkspaceConversation,
    restoreWorkspaceConversation,
    getActiveLeafId,
    setActiveLeafId,
    setUserInteractionPref,
    getUserInteractionPrefs,
    getUserInteractionPref,
    addSharedMemory
};

// Backwards-compat: allow `require('./main_db').dbPath` to reflect current path
Object.defineProperty(module.exports, 'dbPath', {
    get() { return dbPath; }
});

