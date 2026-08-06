-- Chrono Local Backup
-- Created: 2026-08-06T14:56:33.318Z
-- Label: startup_drill

CREATE TABLE sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT
    );

INSERT INTO sync_meta (key, value) VALUES ('device_id', 'dev_qg4x0wijc9a');
INSERT INTO sync_meta (key, value) VALUES ('auth_token', '');
INSERT INTO sync_meta (key, value) VALUES ('auth_user_id', '');
INSERT INTO sync_meta (key, value) VALUES ('google_provider_token', '');
INSERT INTO sync_meta (key, value) VALUES ('use_cloud', 'true');
INSERT INTO sync_meta (key, value) VALUES ('last_backup_time', '1786007705297');
INSERT INTO sync_meta (key, value) VALUES ('last_active_time', '1786021397781');
INSERT INTO sync_meta (key, value) VALUES ('app_theme', 'dark');
INSERT INTO sync_meta (key, value) VALUES ('app_accent', 'purple');
INSERT INTO sync_meta (key, value) VALUES ('app_name', 'ALENA CHRONO');
INSERT INTO sync_meta (key, value) VALUES ('user_name', 'Alena');
INSERT INTO sync_meta (key, value) VALUES ('user_email', 'barnes.vianalen@gmail.com');
INSERT INTO sync_meta (key, value) VALUES ('_telemetry_ping', '1786028183977');

CREATE TABLE tasks (
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
        , preservation_state TEXT DEFAULT 'Archive');

INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted, goal_id, project_id, subject_id, visibility, shared_with, importance_score, impact_score, preservation_state) VALUES ('e_mtwixp9q1zxuj1zbeo', 'hello', '2026-05-30', 'Personal', 1, NULL, 60, 1780261862132, 'dev_qg4x0wijc9a', 0, 0, NULL, NULL, NULL, 'private', '[]', 5, 5, 'Archive');

CREATE TABLE calendars (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT,
        layer_type TEXT DEFAULT 'personal',
        updated_at INTEGER NOT NULL,
        device_id TEXT,
        synced INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0
    );

CREATE TABLE calendar_members (
        calendar_id TEXT,
        user_id TEXT,
        role TEXT DEFAULT 'viewer',
        updated_at INTEGER NOT NULL,
        device_id TEXT,
        synced INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0,
        PRIMARY KEY (calendar_id, user_id)
    );

CREATE TABLE profiles (
        user_id TEXT PRIMARY KEY,
        display_name TEXT,
        cognitive_style TEXT DEFAULT 'adaptive',
        reassurance_needs TEXT DEFAULT 'moderate',
        updated_at INTEGER NOT NULL,
        synced INTEGER DEFAULT 0
    );

CREATE TABLE memory_chat (
        id TEXT PRIMARY KEY,
        user_input TEXT,
        ai_response TEXT,
        timestamp INTEGER,
        updated_at INTEGER NOT NULL,
        device_id TEXT,
        synced INTEGER DEFAULT 0
    );

CREATE TABLE memory_behavior (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        value TEXT,
        timestamp INTEGER
    );

INSERT INTO memory_behavior (id, type, value, timestamp) VALUES (167, 'active_profile', 'adaptive', 1781077809541);
INSERT INTO memory_behavior (id, type, value, timestamp) VALUES (760, 'continuity_state', 'Recovering', 1786028183953);

CREATE TABLE cognitive_memories (
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
    , preservation_state TEXT DEFAULT 'Archive');

CREATE TABLE cognitive_actions (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        source_engine TEXT NOT NULL,
        rationale TEXT,
        applied INTEGER DEFAULT 1,
        undo_data TEXT
    );

CREATE TABLE cognitive_profiles (
        user_id TEXT PRIMARY KEY,
        best_focus_time TEXT,
        low_energy_time TEXT,
        preferred_session_length INTEGER DEFAULT 45,
        stress_triggers TEXT DEFAULT '[]',
        weekly_completion_rates TEXT DEFAULT '{}',
        updated_at INTEGER NOT NULL
    );

CREATE TABLE goals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        target_date TEXT,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
    );

CREATE TABLE subjects (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE subject_mastery (
        subject_id TEXT PRIMARY KEY,
        mastery REAL DEFAULT 0.0,
        quiz_scores TEXT DEFAULT '[]',
        revision_frequency INTEGER DEFAULT 0,
        last_recalled INTEGER,
        FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

CREATE TABLE notes (
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
    , preservation_state TEXT DEFAULT 'Archive');

CREATE TABLE relationships (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        role TEXT,
        display_picture TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    , peer_user_id TEXT, peer_email TEXT);

CREATE TABLE shared_activities (
        id TEXT PRIMARY KEY,
        relationship_id TEXT NOT NULL,
        activity_type TEXT NOT NULL, -- 'event', 'goal', 'project', 'note', 'memory'
        target_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(relationship_id) REFERENCES relationships(id) ON DELETE CASCADE
    );

CREATE TABLE relationship_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
    );

INSERT INTO relationship_templates (id, name, description) VALUES ('tmpl_study_partner', 'Study Partner', 'Peer focused on academic collaboration and shared study goals.');
INSERT INTO relationship_templates (id, name, description) VALUES ('tmpl_project_partner', 'Project Partner', 'Partner for shared projects, tasks, and deliverables.');
INSERT INTO relationship_templates (id, name, description) VALUES ('tmpl_close_friend', 'Close Friend', 'Social contact for personal sharing and casual meetups.');
INSERT INTO relationship_templates (id, name, description) VALUES ('tmpl_mentor', 'Mentor', 'Advisor providing guidance, career help, and task reviews.');
INSERT INTO relationship_templates (id, name, description) VALUES ('tmpl_family', 'Family', 'Immediate family member with broad sharing visibility.');

CREATE TABLE cognitive_loops (
        topic TEXT PRIMARY KEY,
        revisited_count INTEGER DEFAULT 1,
        status TEXT DEFAULT 'no_new_development',
        resolution_action TEXT DEFAULT 'continue_reflection',
        updated_at INTEGER NOT NULL
    );

CREATE TABLE cognitive_front_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        active INTEGER DEFAULT 1
    );

INSERT INTO cognitive_front_categories (id, name, active) VALUES ('cat_academic', 'Academic', 1);
INSERT INTO cognitive_front_categories (id, name, active) VALUES ('cat_project', 'Project', 1);
INSERT INTO cognitive_front_categories (id, name, active) VALUES ('cat_relationship', 'Relationship', 1);
INSERT INTO cognitive_front_categories (id, name, active) VALUES ('cat_health', 'Health', 1);
INSERT INTO cognitive_front_categories (id, name, active) VALUES ('cat_personal', 'Personal', 1);
INSERT INTO cognitive_front_categories (id, name, active) VALUES ('cat_faith_values', 'Faith / Values', 1);
INSERT INTO cognitive_front_categories (id, name, active) VALUES ('cat_family', 'Family', 1);
INSERT INTO cognitive_front_categories (id, name, active) VALUES ('cat_community', 'Community', 1);
INSERT INTO cognitive_front_categories (id, name, active) VALUES ('cat_growth', 'Personal Growth', 1);

CREATE TABLE memory_summary (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            type TEXT,
            summary TEXT,
            timestamp INTEGER
        );

CREATE TABLE cognitive_beliefs (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, belief_key TEXT NOT NULL,
            proposition TEXT NOT NULL, evidence TEXT DEFAULT '[]', counter_evidence TEXT DEFAULT '[]',
            confidence REAL DEFAULT 0.5, status TEXT DEFAULT 'active', created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL, UNIQUE(user_id, belief_key)
        );

CREATE TABLE cognitive_reflections (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, cycle_id TEXT, reflection_type TEXT NOT NULL,
            content TEXT NOT NULL, outcome TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );

INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_qj9t7y6174cay56hg6', 'local_user', 'e_6me2ruwhda2auw6n8p', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008611284, 1786008611284);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_k5f164z8ddlw53rjib', 'local_user', 'e_nz33ers1x94d18y1sq', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008613282, 1786008613282);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_8hc1mtb1h9i7gmgc9p', 'local_user', 'e_oybysz53hijntvgiuz', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008617259, 1786008617259);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_btp3jef8ngg9raj3uu', 'local_user', 'e_3x0a2tzavmxhm8shgv', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008634400, 1786008634400);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_mbxesp0oic82yts8f8', 'local_user', 'e_wnrkif7jw4y8z0it3x', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008640387, 1786008640387);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_2sjaecbv2wdvfx99dz', 'local_user', 'e_klx2u1rs7x8p69y87m', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008643284, 1786008643284);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_5l79uj6lri7no143yp', 'local_user', 'e_tdinjxqrg7oxkbhsg4', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008647265, 1786008647265);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_zvsj5ye9xe2wl4k26x', 'local_user', 'e_pxaftef3urfirk83sr', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008670375, 1786008670375);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_fj67qilxj7nwwosuh6', 'local_user', 'e_sid9a0g2ubyrbrk6wd', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008673288, 1786008673288);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_ukkucihi36n85r344e', 'local_user', 'e_em4gn0h6t95tmh81uo', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008677267, 1786008677267);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_2g8kft65emmtfddd6s', 'local_user', 'e_a5xyocfrc5eo0lkhff', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008700417, 1786008700417);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_o9dxnhxc4u1ak5iec5', 'local_user', 'e_5xh3ob5i5uyifwo762', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008703280, 1786008703280);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_ja98hs7p2n1ilr7ohx', 'local_user', 'e_dey7qegmi2ib46hbqt', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008707259, 1786008707259);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_wrfbwch6ur60g3ah3k', 'local_user', 'e_cs3bodl2gnxauzbcth', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008730376, 1786008730376);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_2e60hlw0mzhf6ltqtl', 'local_user', 'e_zpql9u56de4mt1c33j', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008733286, 1786008733286);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_luzs5q1jyopioa80em', 'local_user', 'e_97y0dpndhoa423sgup', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008737247, 1786008737247);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_brgayl7cloi9l4j4ry', 'local_user', 'e_or3hvfidk2qeqmak11', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008760376, 1786008760376);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_8ie3k7oghk6jhjwq2u', 'local_user', 'e_qiwbgo65dh12ohp6cs', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008763286, 1786008763286);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_si4zovjt5ajwnqdssr', 'local_user', 'e_44n4v7g75k26stkhr9', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008767261, 1786008767261);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_k9x9axxyu6ima54dfk', 'local_user', 'e_7hrm23op9jj90rhc35', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008790362, 1786008790362);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_2eqvvc3o53h8cge5ep', 'local_user', 'e_macuzrpnryjawe3hgx', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008793275, 1786008793275);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_1kqi4uhckosctax3ce', 'local_user', 'e_tzdz7d6a7wdd4ivxaz', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008797259, 1786008797259);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_9yzsyzc81luam5d54y', 'local_user', 'e_qfycttga1o90avkrkg', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008820377, 1786008820377);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_u034tsyyxdp7go5p2s', 'local_user', 'e_v39qn0qlqm7iigczbj', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008823297, 1786008823297);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_k2otbzlq3pymn034a9', 'local_user', 'e_yozy0a2nahbk9emg30', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786008827251, 1786008827251);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_ltp3e3znold7im5wwv', 'local_user', 'e_yzu4l9j2a7wpg5n3l5', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786009397907, 1786009397907);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_kmoiyb40wkvpgwnne3', 'local_user', 'e_3fk0mcw1sfwlrz8l1w', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786009403909, 1786009403909);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_roj4paycue0axdnypz', 'local_user', 'e_a2gt7kr66r7sj7bqnt', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786009433907, 1786009433907);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_pvn7sfcezhp35t2338', 'local_user', 'e_f72loe0fa017t457w9', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786009476785, 1786009476785);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_trdh3v5wywau6mscee', 'local_user', 'e_zvddgtitc2r4tkjmyd', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786009696161, 1786009696161);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_yh9c5x84yyznusrwae', 'local_user', 'e_bpyn95qrrb6isenwc9', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786009736059, 1786009736059);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_5l9aarfdvtznojdv9f', 'local_user', 'e_au2a5wj5d0w468ejrf', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786009840127, 1786009840127);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_mueli5xe80gvc8mvi3', 'local_user', 'e_3030holbhhkzu66lg6', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786009880307, 1786009880307);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_0a8ozyshika4skxu1e', 'local_user', 'e_2wudgq3pyswkqslh3u', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786010010209, 1786010010209);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_ly5h14z0e2cd5ekekd', 'local_user', 'e_y15dqr7w7u2ld0ek33', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786010726517, 1786010726517);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_ha21e0m0mtmq7btvr5', 'local_user', 'e_jx9elk4uvgukiy1e8s', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786010975178, 1786010975178);
INSERT INTO cognitive_reflections (id, user_id, cycle_id, reflection_type, content, outcome, created_at, updated_at) VALUES ('e_ce8huwoax5ltr862la', 'local_user', 'e_ii5axtl6v70d7rgqaf', 'cycle', '{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}', NULL, 1786011029918, 1786011029918);

CREATE TABLE world_entities (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, entity_key TEXT NOT NULL,
            entity_type TEXT NOT NULL, label TEXT NOT NULL, attributes TEXT DEFAULT '{}',
            confidence REAL DEFAULT 0.8, evidence_id TEXT, created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL, synced INTEGER DEFAULT 0, UNIQUE(user_id, entity_key)
        );

CREATE TABLE world_relationships (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, from_entity_id TEXT NOT NULL,
            relation_type TEXT NOT NULL, to_entity_id TEXT NOT NULL, evidence_id TEXT,
            confidence REAL DEFAULT 0.8, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
            synced INTEGER DEFAULT 0, UNIQUE(user_id, from_entity_id, relation_type, to_entity_id)
        );

CREATE TABLE shared_milestones (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, target_date TEXT,
            peer_id TEXT, project_id TEXT, goal_id TEXT, memory_id TEXT, status TEXT DEFAULT 'active',
            importance_score INTEGER DEFAULT 5, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
            synced INTEGER DEFAULT 0, deleted INTEGER DEFAULT 0
        );

CREATE TABLE relationship_interactions (
            id TEXT PRIMARY KEY, peer_id TEXT, interaction_type TEXT, timestamp INTEGER NOT NULL
        );

CREATE TABLE shared_memories (
            id TEXT PRIMARY KEY, peer_id TEXT, title TEXT, summary TEXT,
            importance INTEGER DEFAULT 5, created_at INTEGER NOT NULL
        );

CREATE TABLE continuity_metrics (
            peer_id TEXT PRIMARY KEY, continuity_score TEXT, trend TEXT,
            last_interaction INTEGER, shared_projects INTEGER DEFAULT 0,
            shared_milestones INTEGER DEFAULT 0, updated_at INTEGER NOT NULL
        );

CREATE TABLE cognitive_loop_adherence (
            id TEXT PRIMARY KEY, topic TEXT, action TEXT, date_resolved INTEGER,
            completed_review INTEGER DEFAULT 0
        );

CREATE TABLE operation_log (
            op_id TEXT PRIMARY KEY,
            operation_type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            device_id TEXT,
            status TEXT DEFAULT 'pending',
            error TEXT,
            retry_count INTEGER DEFAULT 0,
            details TEXT,
            timestamp INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE backup_log (
                    id TEXT PRIMARY KEY,
                    operation TEXT,
                    backup_file TEXT,
                    status TEXT,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                );

INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786007715392', 'create', 'chrono_backup_2026-08-06T09-15-15-369Z_startup_drill.sql', 'success', 'Size: 12517 bytes', '2026-08-06 09:15:15');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786007715404', 'verify', 'chrono_backup_2026-08-06T09-15-15-369Z_startup_drill.sql', 'success', 'Tables: 31, Rows: 29', '2026-08-06 09:15:15');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786007715610', 'restore', 'chrono_backup_2026-08-06T09-15-15-369Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786007715408.db, 30 tables', '2026-08-06 09:15:15');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786007715616', 'drill', 'chrono_backup_2026-08-06T09-15-15-369Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:15:15');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786007903786', 'create', 'chrono_backup_2026-08-06T09-18-23-778Z_startup_drill.sql', 'success', 'Size: 13825 bytes', '2026-08-06 09:18:23');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786007903808', 'verify', 'chrono_backup_2026-08-06T09-18-23-778Z_startup_drill.sql', 'success', 'Tables: 32, Rows: 33', '2026-08-06 09:18:23');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786007904099', 'restore', 'chrono_backup_2026-08-06T09-18-23-778Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786007903812.db, 31 tables', '2026-08-06 09:18:24');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786007904107', 'drill', 'chrono_backup_2026-08-06T09-18-23-778Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:18:24');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008376325', 'create', 'chrono_backup_2026-08-06T09-26-16-307Z_startup_drill.sql', 'success', 'Size: 14839 bytes', '2026-08-06 09:26:16');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008376342', 'verify', 'chrono_backup_2026-08-06T09-26-16-307Z_startup_drill.sql', 'success', 'Tables: 32, Rows: 37', '2026-08-06 09:26:16');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008376664', 'restore', 'chrono_backup_2026-08-06T09-26-16-307Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786008376348.db, 31 tables', '2026-08-06 09:26:16');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008376672', 'drill', 'chrono_backup_2026-08-06T09-26-16-307Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:26:16');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008451647', 'create', 'chrono_backup_2026-08-06T09-27-31-632Z_startup_drill.sql', 'success', 'Size: 15853 bytes', '2026-08-06 09:27:31');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008451663', 'verify', 'chrono_backup_2026-08-06T09-27-31-632Z_startup_drill.sql', 'success', 'Tables: 32, Rows: 41', '2026-08-06 09:27:31');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008452016', 'restore', 'chrono_backup_2026-08-06T09-27-31-632Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786008451669.db, 31 tables', '2026-08-06 09:27:32');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008452025', 'drill', 'chrono_backup_2026-08-06T09-27-31-632Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:27:32');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008469630', 'create', 'chrono_backup_2026-08-06T09-27-49-620Z_startup_drill.sql', 'success', 'Size: 17056 bytes', '2026-08-06 09:27:49');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008469646', 'verify', 'chrono_backup_2026-08-06T09-27-49-620Z_startup_drill.sql', 'success', 'Tables: 33, Rows: 45', '2026-08-06 09:27:49');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008469982', 'restore', 'chrono_backup_2026-08-06T09-27-49-620Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786008469651.db, 32 tables', '2026-08-06 09:27:49');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008469988', 'drill', 'chrono_backup_2026-08-06T09-27-49-620Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:27:49');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008557330', 'create', 'chrono_backup_2026-08-06T09-29-17-316Z_startup_drill.sql', 'success', 'Size: 19652 bytes', '2026-08-06 09:29:17');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008557346', 'verify', 'chrono_backup_2026-08-06T09-29-17-316Z_startup_drill.sql', 'success', 'Tables: 35, Rows: 51', '2026-08-06 09:29:17');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008557782', 'restore', 'chrono_backup_2026-08-06T09-29-17-316Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786008557352.db, 34 tables', '2026-08-06 09:29:17');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008557789', 'drill', 'chrono_backup_2026-08-06T09-29-17-316Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:29:17');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008621294', 'create', 'chrono_backup_2026-08-06T09-30-21-275Z_startup_drill.sql', 'success', 'Size: 22223 bytes', '2026-08-06 09:30:21');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008621313', 'verify', 'chrono_backup_2026-08-06T09-30-21-275Z_startup_drill.sql', 'success', 'Tables: 36, Rows: 58', '2026-08-06 09:30:21');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008621791', 'restore', 'chrono_backup_2026-08-06T09-30-21-275Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786008621319.db, 35 tables', '2026-08-06 09:30:21');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008621798', 'drill', 'chrono_backup_2026-08-06T09-30-21-275Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:30:21');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008644403', 'create', 'chrono_backup_2026-08-06T09-30-44-390Z_startup_drill.sql', 'success', 'Size: 24422 bytes', '2026-08-06 09:30:44');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008644427', 'verify', 'chrono_backup_2026-08-06T09-30-44-390Z_startup_drill.sql', 'success', 'Tables: 36, Rows: 65', '2026-08-06 09:30:44');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008644882', 'restore', 'chrono_backup_2026-08-06T09-30-44-390Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786008644434.db, 35 tables', '2026-08-06 09:30:44');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786008644889', 'drill', 'chrono_backup_2026-08-06T09-30-44-390Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:30:44');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009257409', 'create', 'chrono_backup_2026-08-06T09-40-57-401Z_startup_drill.sql', 'success', 'Size: 32941 bytes', '2026-08-06 09:40:57');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009257424', 'verify', 'chrono_backup_2026-08-06T09-40-57-401Z_startup_drill.sql', 'success', 'Tables: 36, Rows: 88', '2026-08-06 09:40:57');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009257835', 'restore', 'chrono_backup_2026-08-06T09-40-57-401Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786009257430.db, 35 tables', '2026-08-06 09:40:57');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009257841', 'drill', 'chrono_backup_2026-08-06T09-40-57-401Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:40:57');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009407924', 'create', 'chrono_backup_2026-08-06T09-43-27-905Z_startup_drill.sql', 'success', 'Size: 34745 bytes', '2026-08-06 09:43:27');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009407942', 'verify', 'chrono_backup_2026-08-06T09-43-27-905Z_startup_drill.sql', 'success', 'Tables: 36, Rows: 94', '2026-08-06 09:43:27');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009408451', 'restore', 'chrono_backup_2026-08-06T09-43-27-905Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786009407949.db, 35 tables', '2026-08-06 09:43:28');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009408460', 'drill', 'chrono_backup_2026-08-06T09-43-27-905Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:43:28');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009486796', 'create', 'chrono_backup_2026-08-06T09-44-46-782Z_startup_drill.sql', 'success', 'Size: 38706 bytes', '2026-08-06 09:44:46');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009486817', 'verify', 'chrono_backup_2026-08-06T09-44-46-782Z_startup_drill.sql', 'success', 'Tables: 37, Rows: 102', '2026-08-06 09:44:46');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009487502', 'restore', 'chrono_backup_2026-08-06T09-44-46-782Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786009486823.db, 36 tables', '2026-08-06 09:44:47');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009487508', 'drill', 'chrono_backup_2026-08-06T09-44-46-782Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:44:47');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009746059', 'create', 'chrono_backup_2026-08-06T09-49-06-041Z_startup_drill.sql', 'success', 'Size: 44301 bytes', '2026-08-06 09:49:06');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009746079', 'verify', 'chrono_backup_2026-08-06T09-49-06-041Z_startup_drill.sql', 'success', 'Tables: 37, Rows: 112', '2026-08-06 09:49:06');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009746998', 'restore', 'chrono_backup_2026-08-06T09-49-06-041Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786009746084.db, 37 tables', '2026-08-06 09:49:07');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009747007', 'drill', 'chrono_backup_2026-08-06T09-49-06-041Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:49:07');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009763241', 'create', 'chrono_backup_2026-08-06T09-49-23-221Z_startup_drill.sql', 'success', 'Size: 45316 bytes', '2026-08-06 09:49:23');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009763265', 'verify', 'chrono_backup_2026-08-06T09-49-23-221Z_startup_drill.sql', 'success', 'Tables: 37, Rows: 116', '2026-08-06 09:49:23');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009763917', 'restore', 'chrono_backup_2026-08-06T09-49-23-221Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786009763272.db, 36 tables', '2026-08-06 09:49:23');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009763923', 'drill', 'chrono_backup_2026-08-06T09-49-23-221Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:49:23');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009850128', 'create', 'chrono_backup_2026-08-06T09-50-50-109Z_startup_drill.sql', 'success', 'Size: 48621 bytes', '2026-08-06 09:50:50');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009850146', 'verify', 'chrono_backup_2026-08-06T09-50-50-109Z_startup_drill.sql', 'success', 'Tables: 37, Rows: 123', '2026-08-06 09:50:50');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009851145', 'restore', 'chrono_backup_2026-08-06T09-50-50-109Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786009850152.db, 37 tables', '2026-08-06 09:50:51');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009851152', 'drill', 'chrono_backup_2026-08-06T09-50-50-109Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:50:51');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009890307', 'create', 'chrono_backup_2026-08-06T09-51-30-293Z_startup_drill.sql', 'success', 'Size: 51926 bytes', '2026-08-06 09:51:30');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009890329', 'verify', 'chrono_backup_2026-08-06T09-51-30-293Z_startup_drill.sql', 'success', 'Tables: 37, Rows: 130', '2026-08-06 09:51:30');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009891328', 'restore', 'chrono_backup_2026-08-06T09-51-30-293Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786009890335.db, 37 tables', '2026-08-06 09:51:31');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786009891336', 'drill', 'chrono_backup_2026-08-06T09-51-30-293Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:51:31');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010020229', 'create', 'chrono_backup_2026-08-06T09-53-40-202Z_startup_drill.sql', 'success', 'Size: 55231 bytes', '2026-08-06 09:53:40');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010020249', 'verify', 'chrono_backup_2026-08-06T09-53-40-202Z_startup_drill.sql', 'success', 'Tables: 37, Rows: 137', '2026-08-06 09:53:40');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010021242', 'restore', 'chrono_backup_2026-08-06T09-53-40-202Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786010020256.db, 37 tables', '2026-08-06 09:53:41');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010021249', 'drill', 'chrono_backup_2026-08-06T09-53-40-202Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:53:41');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010268867', 'create', 'chrono_backup_2026-08-06T09-57-48-713Z_startup_drill.sql', 'success', 'Size: 56246 bytes', '2026-08-06 09:57:48');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010268883', 'verify', 'chrono_backup_2026-08-06T09-57-48-713Z_startup_drill.sql', 'success', 'Tables: 37, Rows: 141', '2026-08-06 09:57:48');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010269502', 'restore', 'chrono_backup_2026-08-06T09-57-48-713Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786010268890.db, 36 tables', '2026-08-06 09:57:49');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010269509', 'drill', 'chrono_backup_2026-08-06T09-57-48-713Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 09:57:49');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010736538', 'create', 'chrono_backup_2026-08-06T10-05-36-513Z_startup_drill.sql', 'success', 'Size: 59551 bytes', '2026-08-06 10:05:36');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010736557', 'verify', 'chrono_backup_2026-08-06T10-05-36-513Z_startup_drill.sql', 'success', 'Tables: 37, Rows: 148', '2026-08-06 10:05:36');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010737602', 'restore', 'chrono_backup_2026-08-06T10-05-36-513Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786010736565.db, 37 tables', '2026-08-06 10:05:37');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010737608', 'drill', 'chrono_backup_2026-08-06T10-05-36-513Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 10:05:37');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010946659', 'create', 'chrono_backup_2026-08-06T10-09-06-648Z_startup_drill.sql', 'success', 'Size: 60647 bytes', '2026-08-06 10:09:06');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010946683', 'verify', 'chrono_backup_2026-08-06T10-09-06-648Z_startup_drill.sql', 'success', 'Tables: 37, Rows: 153', '2026-08-06 10:09:06');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010947515', 'restore', 'chrono_backup_2026-08-06T10-09-06-648Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786010946689.db, 36 tables', '2026-08-06 10:09:07');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010947522', 'drill', 'chrono_backup_2026-08-06T10-09-06-648Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 10:09:07');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010985206', 'create', 'chrono_backup_2026-08-06T10-09-45-179Z_startup_drill.sql', 'success', 'Size: 63952 bytes', '2026-08-06 10:09:45');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010985225', 'verify', 'chrono_backup_2026-08-06T10-09-45-179Z_startup_drill.sql', 'success', 'Tables: 37, Rows: 160', '2026-08-06 10:09:45');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010986350', 'restore', 'chrono_backup_2026-08-06T10-09-45-179Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786010985231.db, 37 tables', '2026-08-06 10:09:46');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786010986356', 'drill', 'chrono_backup_2026-08-06T10-09-45-179Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 10:09:46');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011039940', 'create', 'chrono_backup_2026-08-06T10-10-39-914Z_startup_drill.sql', 'success', 'Size: 67257 bytes', '2026-08-06 10:10:39');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011039961', 'verify', 'chrono_backup_2026-08-06T10-10-39-914Z_startup_drill.sql', 'success', 'Tables: 37, Rows: 167', '2026-08-06 10:10:39');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011041098', 'restore', 'chrono_backup_2026-08-06T10-10-39-914Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786011039969.db, 37 tables', '2026-08-06 10:10:41');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011041106', 'drill', 'chrono_backup_2026-08-06T10-10-39-914Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 10:10:41');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011541318', 'create', 'chrono_backup_2026-08-06T10-19-01-291Z_startup_drill.sql', 'success', 'Size: 69621 bytes', '2026-08-06 10:19:01');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011541340', 'verify', 'chrono_backup_2026-08-06T10-19-01-291Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 171', '2026-08-06 10:19:01');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011542243', 'restore', 'chrono_backup_2026-08-06T10-19-01-291Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786011541346.db, 40 tables', '2026-08-06 10:19:02');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011542251', 'drill', 'chrono_backup_2026-08-06T10-19-01-291Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 10:19:02');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011997734', 'create', 'chrono_backup_2026-08-06T10-26-37-715Z_startup_drill.sql', 'success', 'Size: 70636 bytes', '2026-08-06 10:26:37');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011997754', 'verify', 'chrono_backup_2026-08-06T10-26-37-715Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 175', '2026-08-06 10:26:37');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011998725', 'restore', 'chrono_backup_2026-08-06T10-26-37-715Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786011997760.db, 40 tables', '2026-08-06 10:26:38');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786011998734', 'drill', 'chrono_backup_2026-08-06T10-26-37-715Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 10:26:38');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013078238', 'create', 'chrono_backup_2026-08-06T10-44-38-226Z_startup_drill.sql', 'success', 'Size: 71651 bytes', '2026-08-06 10:44:38');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013078255', 'verify', 'chrono_backup_2026-08-06T10-44-38-226Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 179', '2026-08-06 10:44:38');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013079005', 'restore', 'chrono_backup_2026-08-06T10-44-38-226Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786013078263.db, 40 tables', '2026-08-06 10:44:39');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013079011', 'drill', 'chrono_backup_2026-08-06T10-44-38-226Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 10:44:39');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013183057', 'create', 'chrono_backup_2026-08-06T10-46-23-036Z_startup_drill.sql', 'success', 'Size: 72666 bytes', '2026-08-06 10:46:23');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013183079', 'verify', 'chrono_backup_2026-08-06T10-46-23-036Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 183', '2026-08-06 10:46:23');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013184439', 'restore', 'chrono_backup_2026-08-06T10-46-23-036Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786013183085.db, 41 tables', '2026-08-06 10:46:24');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013184446', 'drill', 'chrono_backup_2026-08-06T10-46-23-036Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 10:46:24');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013571865', 'create', 'chrono_backup_2026-08-06T10-52-51-849Z_startup_drill.sql', 'success', 'Size: 73681 bytes', '2026-08-06 10:52:51');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013571885', 'verify', 'chrono_backup_2026-08-06T10-52-51-849Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 187', '2026-08-06 10:52:51');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013573236', 'restore', 'chrono_backup_2026-08-06T10-52-51-849Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786013571891.db, 41 tables', '2026-08-06 10:52:53');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786013573246', 'drill', 'chrono_backup_2026-08-06T10-52-51-849Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 10:52:53');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014023166', 'create', 'chrono_backup_2026-08-06T11-00-23-138Z_startup_drill.sql', 'success', 'Size: 74696 bytes', '2026-08-06 11:00:23');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014023184', 'verify', 'chrono_backup_2026-08-06T11-00-23-138Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 191', '2026-08-06 11:00:23');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014024531', 'restore', 'chrono_backup_2026-08-06T11-00-23-138Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786014023191.db, 41 tables', '2026-08-06 11:00:24');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014024539', 'drill', 'chrono_backup_2026-08-06T11-00-23-138Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 11:00:24');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014058872', 'create', 'chrono_backup_2026-08-06T11-00-58-856Z_startup_drill.sql', 'success', 'Size: 75711 bytes', '2026-08-06 11:00:58');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014058893', 'verify', 'chrono_backup_2026-08-06T11-00-58-856Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 195', '2026-08-06 11:00:58');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014060328', 'restore', 'chrono_backup_2026-08-06T11-00-58-856Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786014058898.db, 41 tables', '2026-08-06 11:01:00');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014060337', 'drill', 'chrono_backup_2026-08-06T11-00-58-856Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 11:01:00');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014093509', 'create', 'chrono_backup_2026-08-06T11-01-33-482Z_startup_drill.sql', 'success', 'Size: 76726 bytes', '2026-08-06 11:01:33');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014093525', 'verify', 'chrono_backup_2026-08-06T11-01-33-482Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 199', '2026-08-06 11:01:33');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014094963', 'restore', 'chrono_backup_2026-08-06T11-01-33-482Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786014093530.db, 41 tables', '2026-08-06 11:01:34');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014094970', 'drill', 'chrono_backup_2026-08-06T11-01-33-482Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 11:01:34');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014592836', 'create', 'chrono_backup_2026-08-06T11-09-52-822Z_startup_drill.sql', 'success', 'Size: 77741 bytes', '2026-08-06 11:09:52');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014592863', 'verify', 'chrono_backup_2026-08-06T11-09-52-822Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 203', '2026-08-06 11:09:52');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014595548', 'restore', 'chrono_backup_2026-08-06T11-09-52-822Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786014592868.db, 41 tables', '2026-08-06 11:09:55');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786014595555', 'drill', 'chrono_backup_2026-08-06T11-09-52-822Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 11:09:55');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786018799783', 'create', 'chrono_backup_2026-08-06T12-19-59-762Z_startup_drill.sql', 'success', 'Size: 78756 bytes', '2026-08-06 12:19:59');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786018799809', 'verify', 'chrono_backup_2026-08-06T12-19-59-762Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 207', '2026-08-06 12:19:59');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786018803207', 'restore', 'chrono_backup_2026-08-06T12-19-59-762Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786018799814.db, 41 tables', '2026-08-06 12:20:03');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786018803217', 'drill', 'chrono_backup_2026-08-06T12-19-59-762Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 12:20:03');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786019094935', 'create', 'chrono_backup_2026-08-06T12-24-54-903Z_startup_drill.sql', 'success', 'Size: 79771 bytes', '2026-08-06 12:24:54');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786019094965', 'verify', 'chrono_backup_2026-08-06T12-24-54-903Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 211', '2026-08-06 12:24:54');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786019096762', 'restore', 'chrono_backup_2026-08-06T12-24-54-903Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786019094973.db, 41 tables', '2026-08-06 12:24:56');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786019096769', 'drill', 'chrono_backup_2026-08-06T12-24-54-903Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 12:24:56');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786019302529', 'create', 'chrono_backup_2026-08-06T12-28-22-510Z_startup_drill.sql', 'success', 'Size: 80786 bytes', '2026-08-06 12:28:22');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786019302548', 'verify', 'chrono_backup_2026-08-06T12-28-22-510Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 215', '2026-08-06 12:28:22');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786019304066', 'restore', 'chrono_backup_2026-08-06T12-28-22-510Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786019302554.db, 41 tables', '2026-08-06 12:28:24');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786019304073', 'drill', 'chrono_backup_2026-08-06T12-28-22-510Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 12:28:24');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020491528', 'create', 'chrono_backup_2026-08-06T12-48-11-507Z_startup_drill.sql', 'success', 'Size: 81801 bytes', '2026-08-06 12:48:11');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020491548', 'verify', 'chrono_backup_2026-08-06T12-48-11-507Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 219', '2026-08-06 12:48:11');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020492888', 'restore', 'chrono_backup_2026-08-06T12-48-11-507Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786020491554.db, 41 tables', '2026-08-06 12:48:12');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020492895', 'drill', 'chrono_backup_2026-08-06T12-48-11-507Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 12:48:12');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020504313', 'create', 'chrono_backup_2026-08-06T12-48-24-292Z_startup_drill.sql', 'success', 'Size: 82816 bytes', '2026-08-06 12:48:24');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020504332', 'verify', 'chrono_backup_2026-08-06T12-48-24-292Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 223', '2026-08-06 12:48:24');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020506178', 'restore', 'chrono_backup_2026-08-06T12-48-24-292Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786020504339.db, 41 tables', '2026-08-06 12:48:26');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020506187', 'drill', 'chrono_backup_2026-08-06T12-48-24-292Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 12:48:26');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020523137', 'create', 'chrono_backup_2026-08-06T12-48-43-110Z_startup_drill.sql', 'success', 'Size: 83831 bytes', '2026-08-06 12:48:43');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020523166', 'verify', 'chrono_backup_2026-08-06T12-48-43-110Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 227', '2026-08-06 12:48:43');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020524706', 'restore', 'chrono_backup_2026-08-06T12-48-43-110Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786020523173.db, 41 tables', '2026-08-06 12:48:44');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786020524713', 'drill', 'chrono_backup_2026-08-06T12-48-43-110Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 12:48:44');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021168397', 'create', 'chrono_backup_2026-08-06T12-59-28-366Z_startup_drill.sql', 'success', 'Size: 84846 bytes', '2026-08-06 12:59:28');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021168415', 'verify', 'chrono_backup_2026-08-06T12-59-28-366Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 231', '2026-08-06 12:59:28');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021170043', 'restore', 'chrono_backup_2026-08-06T12-59-28-366Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786021168422.db, 41 tables', '2026-08-06 12:59:30');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021170050', 'drill', 'chrono_backup_2026-08-06T12-59-28-366Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 12:59:30');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021241418', 'create', 'chrono_backup_2026-08-06T13-00-41-387Z_startup_drill.sql', 'success', 'Size: 85861 bytes', '2026-08-06 13:00:41');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021241433', 'verify', 'chrono_backup_2026-08-06T13-00-41-387Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 235', '2026-08-06 13:00:41');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021242730', 'restore', 'chrono_backup_2026-08-06T13-00-41-387Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786021241440.db, 40 tables', '2026-08-06 13:00:42');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021242738', 'drill', 'chrono_backup_2026-08-06T13-00-41-387Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 13:00:42');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021379308', 'create', 'chrono_backup_2026-08-06T13-02-59-285Z_startup_drill.sql', 'success', 'Size: 86876 bytes', '2026-08-06 13:02:59');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021379326', 'verify', 'chrono_backup_2026-08-06T13-02-59-285Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 239', '2026-08-06 13:02:59');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021380884', 'restore', 'chrono_backup_2026-08-06T13-02-59-285Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786021379332.db, 41 tables', '2026-08-06 13:03:00');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786021380891', 'drill', 'chrono_backup_2026-08-06T13-02-59-285Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 13:03:00');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786027415450', 'create', 'chrono_backup_2026-08-06T14-43-35-425Z_startup_drill.sql', 'success', 'Size: 87891 bytes', '2026-08-06 14:43:35');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786027415476', 'verify', 'chrono_backup_2026-08-06T14-43-35-425Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 243', '2026-08-06 14:43:35');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786027417735', 'restore', 'chrono_backup_2026-08-06T14-43-35-425Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786027415482.db, 41 tables', '2026-08-06 14:43:37');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786027417742', 'drill', 'chrono_backup_2026-08-06T14-43-35-425Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 14:43:37');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786028068346', 'create', 'chrono_backup_2026-08-06T14-54-28-316Z_startup_drill.sql', 'success', 'Size: 88906 bytes', '2026-08-06 14:54:28');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786028068364', 'verify', 'chrono_backup_2026-08-06T14-54-28-316Z_startup_drill.sql', 'success', 'Tables: 41, Rows: 247', '2026-08-06 14:54:28');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786028070018', 'restore', 'chrono_backup_2026-08-06T14-54-28-316Z_startup_drill.sql', 'success', 'Restored to backups\test_restore_1786028068370.db, 41 tables', '2026-08-06 14:54:30');
INSERT INTO backup_log (id, operation, backup_file, status, details, timestamp) VALUES ('backup_log_1786028070026', 'drill', 'chrono_backup_2026-08-06T14-54-28-316Z_startup_drill.sql', 'success', 'Full drill passed', '2026-08-06 14:54:30');

CREATE TABLE cognitive_events (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, event_type TEXT NOT NULL,
            payload TEXT NOT NULL, created_at INTEGER NOT NULL
        , source TEXT DEFAULT 'system', occurred_at INTEGER DEFAULT 0, synced INTEGER DEFAULT 0);

INSERT INTO cognitive_events (id, user_id, event_type, payload, created_at, source, occurred_at, synced) VALUES ('e_xu7ndmaj3tof3i3qcu', 'local_user', 'cognitive.cycle.completed', '{"id":"e_f72loe0fa017t457w9","userId":"local_user","observedAt":1786009476785,"pipeline":["observe","perceive","attend","retrieve","revise_beliefs","predict","curiosity","goal_graph","simulate","arbitrate","recommend","confirm","execute","reflect","learn","world_model_update"],"attention":[],"beliefs":[],"hypotheses":[],"episodicReplay":null,"goalGraph":[],"temporal":{"immediate":[],"today":0,"week":0,"longTermGoals":0},"needs":{"attention":0,"priority":0,"uncertainty":0,"importance":0},"recommendation":null,"predictions":[],"predictionEvaluation":{"resolvedPredictions":0,"brierScore":null},"simulations":[],"arbitration":{"chosen":null,"tradeoffs":["No high-confidence wellbeing conflict is visible from current records."],"constraints":["No hard conflict is evidenced by the current calendar and task data."],"alternatives":[],"rationale":["No open tasks require arbitration."]},"curiosity":[],"metacognition":{"certainty":0.2,"missingInformation":null,"decisionBoundary":"Chrono recommends only. User confirmation required for calendar mutations."},"reflection":{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}}', 1786009476809, 'cognitiveKernel', 1786009476785, 0);
INSERT INTO cognitive_events (id, user_id, event_type, payload, created_at, source, occurred_at, synced) VALUES ('e_2u2vmjgo6qm26jjp74', 'local_user', 'cognitive.cycle.completed', '{"id":"e_zvddgtitc2r4tkjmyd","userId":"local_user","observedAt":1786009696161,"pipeline":["observe","perceive","attend","retrieve","revise_beliefs","predict","curiosity","goal_graph","simulate","arbitrate","recommend","confirm","execute","reflect","learn","world_model_update"],"attention":[],"beliefs":[],"hypotheses":[],"episodicReplay":null,"goalGraph":[],"temporal":{"immediate":[],"today":0,"week":0,"longTermGoals":0},"needs":{"attention":0,"priority":0,"uncertainty":0,"importance":0},"recommendation":null,"predictions":[],"predictionEvaluation":{"resolvedPredictions":0,"brierScore":null},"simulations":[],"arbitration":{"chosen":null,"tradeoffs":["No high-confidence wellbeing conflict is visible from current records."],"constraints":["No hard conflict is evidenced by the current calendar and task data."],"alternatives":[],"rationale":["No open tasks require arbitration."]},"curiosity":[],"metacognition":{"certainty":0.2,"missingInformation":null,"decisionBoundary":"Chrono recommends only. User confirmation required for calendar mutations."},"reflection":{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}}', 1786009696180, 'cognitiveKernel', 1786009696161, 0);
INSERT INTO cognitive_events (id, user_id, event_type, payload, created_at, source, occurred_at, synced) VALUES ('e_2dsrblxd37achv2hi0', 'local_user', 'cognitive.cycle.completed', '{"id":"e_bpyn95qrrb6isenwc9","userId":"local_user","observedAt":1786009736059,"pipeline":["observe","perceive","attend","retrieve","revise_beliefs","predict","curiosity","goal_graph","simulate","arbitrate","recommend","confirm","execute","reflect","learn","world_model_update"],"attention":[],"beliefs":[],"hypotheses":[],"episodicReplay":null,"goalGraph":[],"temporal":{"immediate":[],"today":0,"week":0,"longTermGoals":0},"needs":{"attention":0,"priority":0,"uncertainty":0,"importance":0},"recommendation":null,"predictions":[],"predictionEvaluation":{"resolvedPredictions":0,"brierScore":null},"simulations":[],"arbitration":{"chosen":null,"tradeoffs":["No high-confidence wellbeing conflict is visible from current records."],"constraints":["No hard conflict is evidenced by the current calendar and task data."],"alternatives":[],"rationale":["No open tasks require arbitration."]},"curiosity":[],"metacognition":{"certainty":0.2,"missingInformation":null,"decisionBoundary":"Chrono recommends only. User confirmation required for calendar mutations."},"reflection":{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}}', 1786009736077, 'cognitiveKernel', 1786009736059, 0);
INSERT INTO cognitive_events (id, user_id, event_type, payload, created_at, source, occurred_at, synced) VALUES ('e_u35et7rbqv9sqp6509', 'local_user', 'cognitive.cycle.completed', '{"id":"e_au2a5wj5d0w468ejrf","userId":"local_user","observedAt":1786009840127,"pipeline":["observe","perceive","attend","retrieve","revise_beliefs","predict","curiosity","goal_graph","simulate","arbitrate","recommend","confirm","execute","reflect","learn","world_model_update"],"attention":[],"beliefs":[],"hypotheses":[],"episodicReplay":null,"goalGraph":[],"temporal":{"immediate":[],"today":0,"week":0,"longTermGoals":0},"needs":{"attention":0,"priority":0,"uncertainty":0,"importance":0},"recommendation":null,"predictions":[],"predictionEvaluation":{"resolvedPredictions":0,"brierScore":null},"simulations":[],"arbitration":{"chosen":null,"tradeoffs":["No high-confidence wellbeing conflict is visible from current records."],"constraints":["No hard conflict is evidenced by the current calendar and task data."],"alternatives":[],"rationale":["No open tasks require arbitration."]},"curiosity":[],"metacognition":{"certainty":0.2,"missingInformation":null,"decisionBoundary":"Chrono recommends only. User confirmation required for calendar mutations."},"reflection":{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}}', 1786009840144, 'cognitiveKernel', 1786009840127, 0);
INSERT INTO cognitive_events (id, user_id, event_type, payload, created_at, source, occurred_at, synced) VALUES ('e_fmy724lnbv0cwdb9a4', 'local_user', 'cognitive.cycle.completed', '{"id":"e_3030holbhhkzu66lg6","userId":"local_user","observedAt":1786009880307,"pipeline":["observe","perceive","attend","retrieve","revise_beliefs","predict","curiosity","goal_graph","simulate","arbitrate","recommend","confirm","execute","reflect","learn","world_model_update"],"attention":[],"beliefs":[],"hypotheses":[],"episodicReplay":null,"goalGraph":[],"temporal":{"immediate":[],"today":0,"week":0,"longTermGoals":0},"needs":{"attention":0,"priority":0,"uncertainty":0,"importance":0},"recommendation":null,"predictions":[],"predictionEvaluation":{"resolvedPredictions":0,"brierScore":null},"simulations":[],"arbitration":{"chosen":null,"tradeoffs":["No high-confidence wellbeing conflict is visible from current records."],"constraints":["No hard conflict is evidenced by the current calendar and task data."],"alternatives":[],"rationale":["No open tasks require arbitration."]},"curiosity":[],"metacognition":{"certainty":0.2,"missingInformation":null,"decisionBoundary":"Chrono recommends only. User confirmation required for calendar mutations."},"reflection":{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}}', 1786009880324, 'cognitiveKernel', 1786009880307, 0);
INSERT INTO cognitive_events (id, user_id, event_type, payload, created_at, source, occurred_at, synced) VALUES ('e_lnz3tbu9athicw40nc', 'local_user', 'cognitive.cycle.completed', '{"id":"e_2wudgq3pyswkqslh3u","userId":"local_user","observedAt":1786010010209,"pipeline":["observe","perceive","attend","retrieve","revise_beliefs","predict","curiosity","goal_graph","simulate","arbitrate","recommend","confirm","execute","reflect","learn","world_model_update"],"attention":[],"beliefs":[],"hypotheses":[],"episodicReplay":null,"goalGraph":[],"temporal":{"immediate":[],"today":0,"week":0,"longTermGoals":0},"needs":{"attention":0,"priority":0,"uncertainty":0,"importance":0},"recommendation":null,"predictions":[],"predictionEvaluation":{"resolvedPredictions":0,"brierScore":null},"simulations":[],"arbitration":{"chosen":null,"tradeoffs":["No high-confidence wellbeing conflict is visible from current records."],"constraints":["No hard conflict is evidenced by the current calendar and task data."],"alternatives":[],"rationale":["No open tasks require arbitration."]},"curiosity":[],"metacognition":{"certainty":0.2,"missingInformation":null,"decisionBoundary":"Chrono recommends only. User confirmation required for calendar mutations."},"reflection":{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}}', 1786010010229, 'cognitiveKernel', 1786010010209, 0);
INSERT INTO cognitive_events (id, user_id, event_type, payload, created_at, source, occurred_at, synced) VALUES ('e_0tma2tzmnwsqb6ur06', 'local_user', 'cognitive.cycle.completed', '{"id":"e_y15dqr7w7u2ld0ek33","userId":"local_user","observedAt":1786010726517,"pipeline":["observe","perceive","attend","retrieve","revise_beliefs","predict","curiosity","goal_graph","simulate","arbitrate","recommend","confirm","execute","reflect","learn","world_model_update"],"attention":[],"beliefs":[],"hypotheses":[],"episodicReplay":null,"goalGraph":[],"temporal":{"immediate":[],"today":0,"week":0,"longTermGoals":0},"needs":{"attention":0,"priority":0,"uncertainty":0,"importance":0},"recommendation":null,"predictions":[],"predictionEvaluation":{"resolvedPredictions":0,"brierScore":null},"simulations":[],"arbitration":{"chosen":null,"tradeoffs":["No high-confidence wellbeing conflict is visible from current records."],"constraints":["No hard conflict is evidenced by the current calendar and task data."],"alternatives":[],"rationale":["No open tasks require arbitration."]},"curiosity":[],"metacognition":{"certainty":0.2,"missingInformation":null,"decisionBoundary":"Chrono recommends only. User confirmation required for calendar mutations."},"reflection":{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}}', 1786010726536, 'cognitiveKernel', 1786010726517, 0);
INSERT INTO cognitive_events (id, user_id, event_type, payload, created_at, source, occurred_at, synced) VALUES ('e_xg9pey83xjq05gi1do', 'local_user', 'cognitive.cycle.completed', '{"id":"e_jx9elk4uvgukiy1e8s","userId":"local_user","observedAt":1786010975178,"pipeline":["observe","perceive","attend","retrieve","revise_beliefs","predict","curiosity","goal_graph","simulate","arbitrate","recommend","confirm","execute","reflect","learn","world_model_update"],"attention":[],"beliefs":[],"hypotheses":[],"episodicReplay":null,"goalGraph":[],"temporal":{"immediate":[],"today":0,"week":0,"longTermGoals":0},"needs":{"attention":0,"priority":0,"uncertainty":0,"importance":0},"recommendation":null,"predictions":[],"predictionEvaluation":{"resolvedPredictions":0,"brierScore":null},"simulations":[],"arbitration":{"chosen":null,"tradeoffs":["No high-confidence wellbeing conflict is visible from current records."],"constraints":["No hard conflict is evidenced by the current calendar and task data."],"alternatives":[],"rationale":["No open tasks require arbitration."]},"curiosity":[],"metacognition":{"certainty":0.2,"missingInformation":null,"decisionBoundary":"Chrono recommends only. User confirmation required for calendar mutations."},"reflection":{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}}', 1786010975195, 'cognitiveKernel', 1786010975178, 0);
INSERT INTO cognitive_events (id, user_id, event_type, payload, created_at, source, occurred_at, synced) VALUES ('e_t8x0dx16f2xo262xs0', 'local_user', 'cognitive.cycle.completed', '{"id":"e_ii5axtl6v70d7rgqaf","userId":"local_user","observedAt":1786011029918,"pipeline":["observe","perceive","attend","retrieve","revise_beliefs","predict","curiosity","goal_graph","simulate","arbitrate","recommend","confirm","execute","reflect","learn","world_model_update"],"attention":[],"beliefs":[],"hypotheses":[],"episodicReplay":null,"goalGraph":[],"temporal":{"immediate":[],"today":0,"week":0,"longTermGoals":0},"needs":{"attention":0,"priority":0,"uncertainty":0,"importance":0},"recommendation":null,"predictions":[],"predictionEvaluation":{"resolvedPredictions":0,"brierScore":null},"simulations":[],"arbitration":{"chosen":null,"tradeoffs":["No high-confidence wellbeing conflict is visible from current records."],"constraints":["No hard conflict is evidenced by the current calendar and task data."],"alternatives":[],"rationale":["No open tasks require arbitration."]},"curiosity":[],"metacognition":{"certainty":0.2,"missingInformation":null,"decisionBoundary":"Chrono recommends only. User confirmation required for calendar mutations."},"reflection":{"completedToday":0,"predictionCount":0,"unresolvedBeliefs":0,"hypothesesCount":0,"lesson":"No completion evidence yet; avoid treating a plan as an outcome."}}', 1786011029936, 'cognitiveKernel', 1786011029918, 0);

CREATE TABLE chrono_objects (
            id TEXT NOT NULL, user_id TEXT NOT NULL, object_type TEXT NOT NULL,
            properties TEXT DEFAULT '{}', permissions TEXT DEFAULT '{}',
            timeline TEXT DEFAULT '[]', metadata TEXT DEFAULT '{}',
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
            deleted INTEGER DEFAULT 0, PRIMARY KEY (user_id, id)
        );

INSERT INTO chrono_objects (id, user_id, object_type, properties, permissions, timeline, metadata, created_at, updated_at, deleted) VALUES ('human:local_user', 'local_user', 'human', '{"userId":"local_user"}', '{"collaboration":"explicit_opt_in"}', '[]', '{"primary":true}', 1786008547312, 1786011029906, 0);
INSERT INTO chrono_objects (id, user_id, object_type, properties, permissions, timeline, metadata, created_at, updated_at, deleted) VALUES ('e_mtwixp9q1zxuj1zbeo', 'local_user', 'task', '{"text":"hello","date":"2026-05-30","completed":true,"calendar":"Personal"}', '{"visibility":"private"}', '[]', '{"source":"tasks"}', 1786008547319, 1786011029912, 0);

CREATE TABLE chrono_object_edges (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, from_object_id TEXT NOT NULL,
            relation_type TEXT NOT NULL, to_object_id TEXT NOT NULL,
            properties TEXT DEFAULT '{}', evidence_id TEXT,
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
            deleted INTEGER DEFAULT 0, UNIQUE(user_id, from_object_id, relation_type, to_object_id)
        );

CREATE TABLE cognitive_predictions (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject_type TEXT NOT NULL,
            subject_id TEXT, prediction_type TEXT NOT NULL, probability REAL DEFAULT 0.5,
            rationale TEXT, due_at INTEGER, outcome TEXT, resolved_at INTEGER,
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );

CREATE TABLE executive_decisions (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, cycle_id TEXT,
            chosen_task_id TEXT, alternatives TEXT, tradeoffs TEXT,
            constraints TEXT, rationale TEXT, created_at INTEGER NOT NULL
        );

INSERT INTO executive_decisions (id, user_id, cycle_id, chosen_task_id, alternatives, tradeoffs, constraints, rationale, created_at) VALUES ('e_phpjmnky66ocoie42c', 'local_user', 'e_f72loe0fa017t457w9', NULL, '[]', '["No high-confidence wellbeing conflict is visible from current records."]', '["No hard conflict is evidenced by the current calendar and task data."]', '["No open tasks require arbitration."]', 1786009476785);
INSERT INTO executive_decisions (id, user_id, cycle_id, chosen_task_id, alternatives, tradeoffs, constraints, rationale, created_at) VALUES ('e_o5to6kij2xkcqysj1v', 'local_user', 'e_zvddgtitc2r4tkjmyd', NULL, '[]', '["No high-confidence wellbeing conflict is visible from current records."]', '["No hard conflict is evidenced by the current calendar and task data."]', '["No open tasks require arbitration."]', 1786009696161);
INSERT INTO executive_decisions (id, user_id, cycle_id, chosen_task_id, alternatives, tradeoffs, constraints, rationale, created_at) VALUES ('e_btu9rwagwtow8id5me', 'local_user', 'e_bpyn95qrrb6isenwc9', NULL, '[]', '["No high-confidence wellbeing conflict is visible from current records."]', '["No hard conflict is evidenced by the current calendar and task data."]', '["No open tasks require arbitration."]', 1786009736059);
INSERT INTO executive_decisions (id, user_id, cycle_id, chosen_task_id, alternatives, tradeoffs, constraints, rationale, created_at) VALUES ('e_vpjz6maffjlinktdr0', 'local_user', 'e_au2a5wj5d0w468ejrf', NULL, '[]', '["No high-confidence wellbeing conflict is visible from current records."]', '["No hard conflict is evidenced by the current calendar and task data."]', '["No open tasks require arbitration."]', 1786009840127);
INSERT INTO executive_decisions (id, user_id, cycle_id, chosen_task_id, alternatives, tradeoffs, constraints, rationale, created_at) VALUES ('e_a32tc8kbnuukv19jaf', 'local_user', 'e_3030holbhhkzu66lg6', NULL, '[]', '["No high-confidence wellbeing conflict is visible from current records."]', '["No hard conflict is evidenced by the current calendar and task data."]', '["No open tasks require arbitration."]', 1786009880307);
INSERT INTO executive_decisions (id, user_id, cycle_id, chosen_task_id, alternatives, tradeoffs, constraints, rationale, created_at) VALUES ('e_foqlpvge9ip7msu9di', 'local_user', 'e_2wudgq3pyswkqslh3u', NULL, '[]', '["No high-confidence wellbeing conflict is visible from current records."]', '["No hard conflict is evidenced by the current calendar and task data."]', '["No open tasks require arbitration."]', 1786010010209);
INSERT INTO executive_decisions (id, user_id, cycle_id, chosen_task_id, alternatives, tradeoffs, constraints, rationale, created_at) VALUES ('e_aocxtlheprvzb99m0k', 'local_user', 'e_y15dqr7w7u2ld0ek33', NULL, '[]', '["No high-confidence wellbeing conflict is visible from current records."]', '["No hard conflict is evidenced by the current calendar and task data."]', '["No open tasks require arbitration."]', 1786010726517);
INSERT INTO executive_decisions (id, user_id, cycle_id, chosen_task_id, alternatives, tradeoffs, constraints, rationale, created_at) VALUES ('e_ttzw0y4ps9970ovbnj', 'local_user', 'e_jx9elk4uvgukiy1e8s', NULL, '[]', '["No high-confidence wellbeing conflict is visible from current records."]', '["No hard conflict is evidenced by the current calendar and task data."]', '["No open tasks require arbitration."]', 1786010975178);
INSERT INTO executive_decisions (id, user_id, cycle_id, chosen_task_id, alternatives, tradeoffs, constraints, rationale, created_at) VALUES ('e_nkmy2k3an1x2fgjc3l', 'local_user', 'e_ii5axtl6v70d7rgqaf', NULL, '[]', '["No high-confidence wellbeing conflict is visible from current records."]', '["No hard conflict is evidenced by the current calendar and task data."]', '["No open tasks require arbitration."]', 1786011029918);

CREATE TABLE chat_experience_turns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_input TEXT NOT NULL,
        ai_response TEXT,
        depth_level INTEGER DEFAULT 0,
        depth_label TEXT DEFAULT 'ordinary',
        familiarity_level TEXT DEFAULT 'new',
        mode TEXT DEFAULT 'practical',
        created_at INTEGER NOT NULL
    );

CREATE TABLE chat_questions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        parent_id TEXT,
        question_text TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        depth_level INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

CREATE TABLE chat_hypotheses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        hypothesis TEXT NOT NULL,
        evidence TEXT DEFAULT '[]',
        counterevidence TEXT DEFAULT '[]',
        confidence REAL DEFAULT 0.5,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

CREATE TABLE chat_misunderstandings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        previous_belief TEXT,
        correction TEXT,
        missing_distinction TEXT,
        recurrence_count INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

