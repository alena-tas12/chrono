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
try {
    const { app } = require('electron');
    if (app) {
        const userDataPath = app.getPath('userData');
        if (userDataPath) {
            dbPath = path.join(userDataPath, 'chrono.db');
        }
    }
} catch (e) {
    console.warn("Could not load Electron app paths, falling back to local database path.");
}

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

let db;
try {
    // Open DB and check integrity
    db = new Database(dbPath);
    const check = db.prepare("PRAGMA integrity_check").get();
    if (check && check.integrity_check !== 'ok') {
        throw new Error("Integrity check returned: " + JSON.stringify(check));
    }
} catch (error) {
    console.error("🚨 SQLite Database Integrity Check Failed! Recreating database...", error);
    try {
        if (db) db.close();
    } catch (closeErr) {}
    if (fs.existsSync(dbPath)) {
        const corruptPath = path.join(dbDir, `chrono_corrupt_${Date.now()}.db`);
        fs.renameSync(dbPath, corruptPath);
    }
    db = new Database(dbPath);
}

// Create metadata table first
db.prepare(`
    CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT
    )
`).run();

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
    console.log("⚠️ Old INTEGER tasks table schema detected. Starting migration to UUID-based Offline-Sync schema...");
    
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
    console.log(`✅ Successfully migrated ${oldTasks.length} legacy tasks to offline-sync UUID model.`);
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
    db.prepare("ALTER TABLE tasks ADD COLUMN preservation_state TEXT DEFAULT 'Archive'").run();
} catch(e) {}
try {
    db.prepare("ALTER TABLE notes ADD COLUMN preservation_state TEXT DEFAULT 'Archive'").run();
} catch(e) {}

// Seed default templates if empty
const templateCount = db.prepare("SELECT COUNT(*) as count FROM relationship_templates").get();
if (templateCount && templateCount.count === 0) {
    console.log("🌱 Seeding default relationship templates...");
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
    console.log("✅ Seeding relationship templates completed.");
}

// Check environment to decide if we seed test peer relationships
let isDevOrTest = false;
try {
    const { app } = require('electron');
    isDevOrTest = app && !app.isPackaged;
} catch (e) {
    // Safe fallback for CLI test suites or if electron main process hasn't finished setup
    isDevOrTest = true;
}
if (process.env.NODE_ENV === 'test' || process.env.CHRONO_ENV === 'test' || process.env.CHRONO_SEED_TEST_PEERS === 'true') {
    isDevOrTest = true;
}

// Seed default peer profiles if relationships is empty AND we are in test/dev mode
const relationshipCount = db.prepare("SELECT COUNT(*) as count FROM relationships").get();
if (relationshipCount && relationshipCount.count === 0 && isDevOrTest) {
    console.log("🌱 Seeding default relationships for Princess and friends...");
    const seedTime = Date.now();
    const defaultPeers = [
        { id: 'rel_princess', name: 'Princess', role: 'Study Partner', pic: '👑' },
        { id: 'rel_rayhaan', name: 'Rayhaan', role: 'Project Partner', pic: '🚀' },
        { id: 'rel_sana', name: 'Sana', role: 'Study Partner', pic: '✨' },
        { id: 'rel_tara', name: 'Tara', role: 'Study Partner', pic: '🌸' },
        { id: 'rel_anwesha', name: 'Anwesha', role: 'Study Partner', pic: '💫' }
    ];

    const insertPeer = db.prepare(`
        INSERT INTO relationships (id, user_id, name, role, display_picture, created_at, updated_at)
        VALUES (?, 'local_user', ?, ?, ?, ?, ?)
    `);

    for (const peer of defaultPeers) {
        insertPeer.run(peer.id, peer.name, peer.role, peer.pic, seedTime, seedTime);
    }

    // Add some default shared activities to illustrate the feature
    const firstGoal = db.prepare("SELECT id FROM goals WHERE user_id = 'local_user' LIMIT 1").get();
    if (firstGoal) {
        db.prepare(`
            INSERT INTO shared_activities (id, relationship_id, activity_type, target_id, created_at, updated_at)
            VALUES (?, 'rel_princess', 'goal', ?, ?, ?)
        `).run('sha_goal_1', firstGoal.id, seedTime, seedTime);
    }

    // Create a default shared study session task
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const taskUuid = 'e_shared_study_princess';
    db.prepare(`
        INSERT OR REPLACE INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted, visibility, shared_with)
        VALUES (?, 'Calculus Peer Study with Princess', ?, 'study', 0, '15:00', 90, ?, 'server', 0, 0, 'shared_specific', '["rel_princess"]')
    `).run(taskUuid, tomorrowStr, seedTime);

    db.prepare(`
        INSERT INTO shared_activities (id, relationship_id, activity_type, target_id, created_at, updated_at)
        VALUES (?, 'rel_princess', 'event', ?, ?, ?)
    `).run('sha_event_1', taskUuid, seedTime, seedTime);

    // Seed default shared milestones for Princess and Rayhaan
    const milestoneInsert = db.prepare(`
        INSERT OR REPLACE INTO shared_milestones (id, title, description, target_date, peer_id, status, importance_score, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Princess Milestones
    milestoneInsert.run('ms_cal_midterm', 'Passed Calculus Midterm', 'Aced the midterm exam with solid grades through collective focus.', '2026-04-15', 'rel_princess', 'completed', 9, seedTime, seedTime);
    milestoneInsert.run('ms_chrono_cal', 'Launched Chrono OS Collaborative Calendar', 'Shipped the first joint calendar layers for multiplayer study sync.', '2026-05-20', 'rel_princess', 'completed', 8, seedTime, seedTime);
    milestoneInsert.run('ms_semester_end', 'Finish Semester 4 Exams', 'Goal to graduate the semester with high distinction.', '2026-06-25', 'rel_princess', 'active', 8, seedTime, seedTime);

    // Rayhaan Milestones
    milestoneInsert.run('ms_micro_kickoff', 'Hardware Microcontrollers Lab Kickoff', 'Formed project partnership and initialized hardware repository.', '2026-05-02', 'rel_rayhaan', 'completed', 7, seedTime, seedTime);
    milestoneInsert.run('ms_micro_demo', 'Completed Microcontroller Demo', 'Successful breadboard prototype with real-time sensor logging.', '2026-05-28', 'rel_rayhaan', 'completed', 8, seedTime, seedTime);

    // Seed relationship interactions for metrics & trend calculation
    const interactionInsert = db.prepare(`
        INSERT OR REPLACE INTO relationship_interactions (id, peer_id, interaction_type, timestamp)
        VALUES (?, ?, ?, ?)
    `);

    // Princess Interactions: 6 in last 30 days, 2 in previous 30 days -> Growing/Stable
    const nowMs = Date.now();
    const dayMs = 86400000;
    interactionInsert.run('int_pr_1', 'rel_princess', 'study', nowMs - 2 * dayMs);
    interactionInsert.run('int_pr_2', 'rel_princess', 'conversation', nowMs - 5 * dayMs);
    interactionInsert.run('int_pr_3', 'rel_princess', 'meeting', nowMs - 9 * dayMs);
    interactionInsert.run('int_pr_4', 'rel_princess', 'study', nowMs - 12 * dayMs);
    interactionInsert.run('int_pr_5', 'rel_princess', 'project', nowMs - 19 * dayMs);
    interactionInsert.run('int_pr_6', 'rel_princess', 'study', nowMs - 25 * dayMs);
    interactionInsert.run('int_pr_7', 'rel_princess', 'conversation', nowMs - 35 * dayMs);
    interactionInsert.run('int_pr_8', 'rel_princess', 'meeting', nowMs - 45 * dayMs);

    // Rayhaan Interactions: 2 in last 30 days, 4 in previous 30 days -> Drifting / Declining
    interactionInsert.run('int_ray_1', 'rel_rayhaan', 'project', nowMs - 4 * dayMs);
    interactionInsert.run('int_ray_2', 'rel_rayhaan', 'meeting', nowMs - 15 * dayMs);
    interactionInsert.run('int_ray_3', 'rel_rayhaan', 'project', nowMs - 33 * dayMs);
    interactionInsert.run('int_ray_4', 'rel_rayhaan', 'study', nowMs - 38 * dayMs);
    interactionInsert.run('int_ray_5', 'rel_rayhaan', 'meeting', nowMs - 48 * dayMs);
    interactionInsert.run('int_ray_6', 'rel_rayhaan', 'conversation', nowMs - 55 * dayMs);

    // Sana Interactions: 3 in last 30 days -> Stable
    interactionInsert.run('int_sa_1', 'rel_sana', 'study', nowMs - 3 * dayMs);
    interactionInsert.run('int_sa_2', 'rel_sana', 'study', nowMs - 11 * dayMs);
    interactionInsert.run('int_sa_3', 'rel_sana', 'conversation', nowMs - 22 * dayMs);

    // Seed shared memories
    const memoryInsert = db.prepare(`
        INSERT OR REPLACE INTO shared_memories (id, peer_id, title, summary, importance, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    memoryInsert.run('sm_pr_1', 'rel_princess', 'Calculus Cram Session', 'Studied derivatives and limits for 4 hours. Ordered pizza and passed the exam.', 8, nowMs - 35 * dayMs);
    memoryInsert.run('sm_pr_2', 'rel_princess', 'Chrono Sync Testing', 'Completed websocket testing on Supabase and verified offline synchronization caches.', 9, nowMs - 12 * dayMs);
    memoryInsert.run('sm_ray_1', 'rel_rayhaan', 'Late Night Lab Session', 'Debugged the SPI communication logic on the microcontroller board till 2 AM.', 8, nowMs - 15 * dayMs);

    console.log("✅ Finished seeding peer profiles and shared study session.");
}




// ========================================
// 🛠️ DATABASE UTILITY METHODS
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
            return;
        } catch (err) {
            console.error(`Encryption failed for key ${key}:`, err.message);
        }
    }
    db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)").run(key, String(value));
}

module.exports = {
    db,
    dbPath,
    generateUUID,
    getDeviceId,
    addTask,
    fetchTasks,
    fetchTasksInRange,
    completeTask,
    uncompleteTask,
    deleteTask,
    getSyncMeta,
    setSyncMeta
};
