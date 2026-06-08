# Chrono OS: Version 1 Production Readiness (Phase 5B to Phase 9) Implementation Plan

This plan documents the design and execution steps for transforming Chrono into a production-ready **Cognitive Companion & Memory OS** for real-world peer deployment. We focus on continuity, memory, relationship, trust, and proactive continuity over months without introducing unnecessary cognitive engines.

## User Review Required

> [!IMPORTANT]
> **Data Privacy & Permission Guardrails**:
> We are introducing a visibility permission system (`private` vs `shared`) for tasks, calendars, and notes. By default, items are `private`. When marked `shared`, they can be synchronized via Supabase for collaborative view (e.g. Princess seeing shared study sessions or goals).

> [!WARNING]
> **Database Resilience & Corruption Recovery**:
> To secure trust, we will perform database integrity checks on startup. If SQLite detects corruption, the corrupt DB file will be archived as `chrono_corrupt_[timestamp].db` and a fresh DB created. If a Supabase account is synced, it will automatically pull user data down from the cloud.

## Open Questions

- *Are there any additional specific students or peer accounts besides Princess, Rayhaan, Sana, Tara, and Anwesha that we should seed?* (We will default to seeding these five).
- *Should shared events/notes be automatically visible to all people in the relationships list, or selectively shared with specific peers?* (We propose selective peer sharing via a dropdown).

---

## Proposed Changes

### 1. Database Schema Extensions (Electron Main Process)

#### [MODIFY] [main_db.js](file:///c:/chrono%20app/main/main_db.js)
- Extend database initialization to create:
  - `notes` table: `id` (TEXT PRIMARY KEY), `user_id` (TEXT), `title` (TEXT), `content` (TEXT), `created_at` (INTEGER), `updated_at` (INTEGER), `linked_goal_id` (TEXT), `linked_project_id` (TEXT), `linked_subject_id` (TEXT), `visibility` (TEXT DEFAULT 'private').
  - `relationships` table: `id` (TEXT PRIMARY KEY), `user_id` (TEXT), `name` (TEXT), `role` (TEXT), `display_picture` (TEXT), `created_at` (INTEGER), `updated_at` (INTEGER).
  - `shared_activities` table: `id` (TEXT PRIMARY KEY), `relationship_id` (TEXT), `activity_type` (TEXT), `target_id` (TEXT), `created_at` (INTEGER), `updated_at` (INTEGER).
- Seed the `relationships` and `shared_activities` tables with default peers:
  - **Princess**: Role: Study Peer, Shared Event: "Calculus Collaboration Session", Shared Goal: "Aces Exams together".
  - **Rayhaan**: Role: Projects Partner, Shared Project: "Hardware Microcontrollers Lab".
  - **Sana**, **Tara**, **Anwesha**: Peer Study Group members.
- Expose automated integrity checks (`PRAGMA integrity_check`). If the check fails, handle automated db recovery by renaming the corrupt file and recreating a clean instance.
- Add migration steps: alter `tasks` table to add a `visibility` column (`private` or `shared`).

---

### 2. Memory OS & Integration Notes (Phase 5B & 5C)

#### [NEW] [memoryOS.js](file:///c:/chrono%20app/main/memoryOS.js)
- Build a service dedicated to Memory Card compilation and search/linking queries:
  - `getMemoryCards(userId)`: Aggregates historical statistics grouped by year-month (e.g., hours studied, completed tasks, subjects mastered, created goals, and keywords from highly-rated chats).
  - `searchMemories(userId, queryText)`: Queries chats (`memory_chat`), notes (`notes`), and tasks (`tasks`) matching search tokens.
  - `getLinkedMemories(userId, noteText)`: Tokenizes input text to query related notes, goals, or tasks.
- Implement the "Thought -> Note -> Memory -> Goal -> Action" chain:
  - When saving notes, match keywords (e.g., *"Calculus"*, *"Physics"*) with goals, projects, subjects, or tasks. Automatically link them via foreign keys in SQLite.

---

### 3. Relationship OS (Phase 6)

#### [NEW] [relationshipOS.js](file:///c:/chrono%20app/main/relationshipOS.js)
- Manage relationship data and shared resources:
  - `getRelationships(userId)`: Returns peer profile cards (Princess, Rayhaan, etc.).
  - `getRelationshipDetails(userId, relationshipId)`: Aggregates shared activities (events, projects, notes, and milestones) from the `shared_activities` joint table.
  - `addSharedActivity(relationshipId, type, targetId)`: Creates a new shared association.
  - `scheduleJointSession(relationshipId, taskData)`: Schedules a joint study session in the calendar marked as `shared` visibility.

---

### 4. JARVIS Proactive Suggestion Engine (Phase 7)

#### [NEW] [jarvisLayer.js](file:///c:/chrono%20app/main/jarvisLayer.js)
- Monitors user data patterns to surface proactive suggestions:
  - **Focus Hours**: Computes completions to detect peak times (e.g., "You usually focus best from 9-11").
  - **Retention Gaps**: Identifies subjects not studied in 5+ days (e.g., "You haven't touched Physics for 8 days").
  - **Contextual Links**: Connects new notes to historic projects (e.g., "This note relates to a project started 3 months ago").
  - **Social Prompts**: Triggers peer check-ins (e.g., "You haven't studied with Princess in 6 days").
- Expose a `get-jarvis-suggestions` IPC handle. Integrate suggestions directly into the multi-agent response loop inside `cognitiveOrchestrator.js` as metadata.

---

### 5. Deployment, Onboarding & Error Protection (Phase 8 & 9)

#### [MODIFY] [main.js](file:///c:/chrono%20app/main/main.js)
- Wire new IPC handlers:
  - Notes: `get-notes`, `add-note`, `edit-note`, `delete-note`, `save-note`.
  - Relationships: `get-relationships`, `get-relationship-details`, `add-shared-activity`, `schedule-joint-session`.
  - Memory: `get-memory-cards`, `search-memories`, `get-linked-memories`, `get-life-continuity`.
  - JARVIS: `get-jarvis-suggestions`.
- Enhance the onboarding handler to capture full preferences and sync login parameters.

#### [MODIFY] [cognitiveOrchestrator.js](file:///c:/chrono%20app/main/cognitiveOrchestrator.js)
- Enrich orchestrated outputs by calling `jarvisLayer.getProactiveSuggestions()` to seamlessly inject suggestions when relevant.

---

### 6. User Interface Upgrades (UI Process)

#### [MODIFY] [index.html](file:///c:/chrono%20app/ui/index.html)
- Rebrand the "Reflection" tab to **"Memory"** (`data-tab="reflection"`):
  - Expand to include a Monthly Memory Cards view, a Search input for memories, and the **Life Continuity Dashboard** answering:
    - *What mattered?* (High importance memory logs)
    - *What changed?* (Weekly delta stats)
    - *What am I forgetting?* (Slipped tasks & study gaps)
    - *What progress have I made?* (Learning mastery progress curves)
    - *Who matters?* (Friend interactions count)
- Revamp the **"Notes"** tab (`data-tab="notes"`):
  - Add notes list, a "New Note" editor, visibility toggle (`private`/`shared`), and an "Auto-linked Elements" chip panel.
- Add a new **"People"** tab (`data-tab="people"`):
  - Renders cards for Princess, Rayhaan, Sana, Tara, Anwesha. Clicking a card opens their profile showing shared goals, projects, sessions, and a "Schedule Study Session" quick-button.
- Add an **Offline Status Badge** to the Observatory and top calendar actions area.

#### [MODIFY] [app.js](file:///c:/chrono%20app/ui/app.js)
- Wire event listeners for:
  - Notes creation, updating, and keyword auto-linking rendering.
  - Memory cards aggregation rendering and search input queries.
  - Relationships listing, profile card toggles, and shared session creation.
  - Offline listener (`window.addEventListener('online'/'offline')`) to update the connection state.
  - Life Continuity six-question dashboard population.
  - JARVIS alert cards in the chat window.

---

## Verification Plan

### Automated Tests
- Create `scratch/test_phase5_memory_relationships.js` that tests:
  - Database schema migrations and seeding of relationships.
  - Note creation, editing, and keyword auto-linking.
  - Memory cards compilation from dummy calendar study records.
  - JARVIS proactive suggestion triggers (focus time, study gap, and project age).
  - DB corruption simulation and recovery handler.

### Manual Verification
- Open the app via `npx electron main/main.js`.
- Go to the **Notes** tab -> Write: *"Need to study dynamic programming tonight"* -> Verify that it links the "Dynamic Programming" subject under active goals.
- Check the **Memory** tab -> Verify the monthly memory cards show accumulated study hours. Try the search box.
- Check the **People** tab -> Click on **Princess** -> Verify the shared activities list and click "Schedule Study Session" to create a joint event.
- Go offline (disconnect internet) -> Verify the top bar changes to a red "Offline Mode" indicator.
