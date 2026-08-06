# Original Chrono Architecture Clarity Document

**Completed:** 2026-06-10  
**Purpose:** Single-page architectural overview for decision-making and debugging  
**Audience:** Founder, original design, reliability validation  

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHRONO 2.0 ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────┘

LOCAL (Electron Desktop)
├─ Renderer Process (UI)
│  └─ Calendar, Tasks, Chat, Memory interfaces
├─ Main Process (Node.js Core)
│  ├─ Local SQLite (chrono.db) via better-sqlite3
│  ├─ Sync Engine (offline-first, bidirectional)
│  ├─ Cognitive Orchestrator (local AI)
│  ├─ Observatory (telemetry, no content)
│  └─ IPC Boundary (secure communication)
│
CLOUD (Supabase)
├─ Auth Service
│  └─ JWT token generation and validation
├─ PostgREST API Gateway
│  └─ REST interface to PostgreSQL
├─ Realtime WebSocket Service
│  └─ Publish/subscribe for collaborative sync
├─ PostgreSQL Database
│  ├─ Row-Level Security (RLS) policies
│  └─ User data tables (tasks, notes, chat, events)
│
AI SERVICES
├─ Remote LLMs (Gemini, Claude, OpenAI)
└─ Edge Functions (gateway and routing)
```

---

## Data Ownership Model

**Local SQLite → Source of Truth**
- Tasks, notes, calendar events written locally first
- Device ID tagged for sync attribution
- Offline operations queue for later sync

**Supabase Cloud → Sync Backbone**
- Replicated copy of local data
- Row-Level Security ensures user isolation
- Realtime broadcasts changes to other devices
- Backup and archive location

**Local Cache → Quick Reads**
- All user data cached in SQLite
- Instant UI responsiveness
- Survives network outages

---

## Critical Data Flows

### 1. Login Flow (User Authentication)

```
User enters email/password
  ↓
Electron sends credentials to Supabase Auth
  ↓
Supabase validates credentials (bcrypt hashing)
  ↓
Supabase generates JWT access token + refresh token
  ↓
Electron stores tokens in main_db.setSyncMeta('auth_token', ...)
  ↓
Tokens added to all future Supabase API requests in Authorization header
  ↓
PostgREST verifies JWT, checks RLS policies
  ↓
User can now read/write their data

FAILURE POINTS:
- No ADMIN_DASHBOARD_TOKEN set → Auth disabled in production
- Token storage corrupted → User loses access
- Supabase Auth service down → No login possible
- JWT refresh fails → Silent logout on token expiry
```

**Current Status:** ✓ Implemented (Supabase Auth)  
**Risk Level:** MEDIUM (token refresh not validated)

---

### 2. Data Creation Flow (Task → Local → Cloud → Other Devices)

```
User adds task in UI
  ↓
Renderer process sends task data to Main process (IPC)
  ↓
Main process generates UUID (e_<random>_<timestamp>)
  ↓
Task written to LOCAL SQLite immediately (offline-first)
  - id (UUID)
  - text
  - date
  - calendar (personal/work/focus)
  - completed (0/1)
  - device_id (e.g., 'device_laptop_001')
  - synced (0/1) → initially 0
  - deleted (0/1) → initially 0
  - updated_at (timestamp)
  ↓
UI updates immediately (no network latency)
  ↓
Sync engine detects new local task with synced=0
  ↓
Sync engine sends POST to Supabase via PostgREST
  ↓
Supabase validates JWT + RLS policy (user owns task)
  ↓
Task inserted into cloud PostgreSQL
  ↓
Realtime service broadcasts task creation to all subscribed devices
  ↓
Other devices receive realtime notification
  ↓
Other devices merge task into their local SQLite
  ↓
All users see task appear in real-time

FAILURE POINTS:
- Local write fails → Task lost (CRITICAL: needs logging)
- Sync stalls → Synced=0 forever (needs observer)
- RLS policy denies access → Silent failure (needs error handling)
- Realtime broadcast fails → Other devices don't see update
- Other device sync merge fails → Divergent state
```

**Current Status:** ⚠️ Partially implemented  
**Risk Level:** HIGH (no transaction boundaries, missing error handling)

---

### 3. Sync Engine (Bidirectional Reconciliation)

**Algorithm:**
```
Every 30 seconds (configurable):
  1. Check local tasks with synced=0
  2. For each unsync'd task:
     a. POST to Supabase
     b. On success: mark synced=1
     c. On failure: retry next interval (add to retry queue)
  3. Fetch cloud data updated since last sync time
  4. For each cloud update:
     a. Check if exists locally
     b. If doesn't exist: insert
     c. If exists: compare updated_at timestamps
        - Newer from cloud? Update local
        - Newer from local? Push local again
        - Same timestamp? Use device_id as tiebreaker
  5. Update sync_meta table with last_sync_time
```

**Conflict Resolution:**
- Last-write-wins using `updated_at` timestamp
- Device ID breaks ties (lexicographic order)
- No explicit user prompt for conflicts (automatic resolution)

**Offline Behavior:**
- Tasks queue in local SQLite
- Realtime subscription paused
- On reconnect: sync queue processes
- Conflicts resolved by algorithm above

**Current Status:** ⚠️ Partially implemented  
**Risk Level:** HIGH (conflicts not tested at scale, no conflict logging)

---

### 4. Backup Flow (Data Preservation)

```
Server: Backup creation (daily, admin-triggered)
  ↓
Backup endpoint called (requires ADMIN_SECRET)
  ↓
pg_dump executed on PostgreSQL
  ↓
SQL dump saved to disk: backups/backup_<timestamp>.sql
  ↓
Backup metadata written to audit_log table
  ↓
Backup size and integrity logged

Server: Restore from backup
  ↓
Admin requests restore (requires emergency confirmation phrase)
  ↓
Pre-restore snapshot taken (backup of current state)
  ↓
pg_restore executed from backup file
  ↓
All data reverted to backup timestamp
  ↓
Restore logged in audit_log

Local: Emergency recovery
  ↓
User loses local SQLite
  ↓
App detects missing database
  ↓
Prompts to log in again
  ↓
Sync engine fetches all cloud data
  ↓
Rebuilds local SQLite from cloud source
```

**Failure Points:**
- Backup never created → No restore available (CRITICAL)
- Backup corrupted → Restore fails
- Backup process interrupted → Partial backup
- Restore process interrupted → Incomplete restore
- Local recovery stops → Manual intervention needed

**Current Status:** ⚠️ Partially implemented  
**Risk Level:** CRITICAL (backup validation missing, no restore drills)

---

### 5. Founder Observability (No Content Access)

```
Observatory telemetry (no user data):
  ├─ Sync metrics
  │  ├─ sync_pulls (count)
  │  ├─ sync_pushes (count)
  │  ├─ conflicts_resolved (count)
  │  ├─ avg_sync_latency (ms)
  │  ├─ last_sync_time (timestamp)
  │  └─ sync_status (online/offline)
  │
  ├─ AI activity (aggregated)
  │  ├─ messages_processed (count)
  │  ├─ avg_latency (ms)
  │  ├─ total_tokens (count)
  │  └─ active_agents (list, no content)
  │
  ├─ Calendar throughput
  │  ├─ events_created (count)
  │  ├─ events_completed (count)
  │  ├─ task_completion_rate (%)
  │  └─ focus_hours (total)
  │
  ├─ Error tracking
  │  ├─ failed_syncs (count, no details)
  │  ├─ auth_failures (count)
  │  ├─ database_errors (count)
  │  └─ last_error (timestamp, no content)
  │
  └─ System health
     ├─ database_online (bool)
     ├─ realtime_connected (bool)
     ├─ auth_service_online (bool)
     └─ last_health_check (timestamp)

Admin Dashboard:
  └─ Displays all above telemetry
     └─ No user chat, notes, or personal data visible
```

**Current Status:** ✓ Partially implemented  
**Risk Level:** LOW (observability framework exists, needs expansion)

---

## Blind Spots (Unknown/Untested)

### 1. Transaction Boundaries
- **Question:** Are writes atomic?
- **Current:** No transaction handling visible
- **Risk:** Partial writes on crash
- **Impact:** Data corruption or loss

### 2. Silent Failures
- **Question:** How do we detect when a write succeeded but user thinks it failed?
- **Current:** No error logging
- **Risk:** User loses data without knowing
- **Impact:** Trust destruction

### 3. Conflict Resolution at Scale
- **Question:** What happens with 100+ simultaneous edits?
- **Current:** Algorithm defined, not tested
- **Risk:** Merge failures, data loss
- **Impact:** Sync becomes unreliable

### 4. Sync Restart Reliability
- **Question:** If sync crashes mid-operation, what's the state?
- **Current:** Unclear
- **Risk:** Partial syncs, duplicate data
- **Impact:** Data duplication or loss

### 5. Offline→Online Transition
- **Question:** Does every device reconnect correctly?
- **Current:** Not stress-tested
- **Risk:** Devices stuck offline, missed updates
- **Impact:** Divergent state across devices

### 6. Auth Token Expiry
- **Question:** What happens when JWT expires?
- **Current:** Auto-refresh enabled, but not validated
- **Risk:** Silent logout mid-operation
- **Impact:** Data loss on unsaved operations

### 7. Backup Integrity
- **Question:** Can we restore from a backup successfully?
- **Current:** Procedure documented, never tested
- **Risk:** Backup unreadable when needed
- **Impact:** Unrecoverable data loss

### 8. RLS Policy Enforcement
- **Question:** Are RLS policies actually blocking unauthorized access?
- **Current:** Not audited
- **Risk:** Data leakage between users
- **Impact:** Privacy breach

---

## Dependencies

**Critical Path:**
- Supabase Auth must work (login/token refresh)
- Supabase PostgREST must be accessible (API calls)
- JWT token in Authorization header must validate
- RLS policies must enforce user isolation
- Local SQLite must remain uncorrupted

**Nice to Have:**
- Realtime WebSocket (queued sync as fallback)
- Observatory telemetry (diagnostics only)
- Backup automation (manual backup available)

---

## Validation Checklist (30-Day Inner Circle Test)

- [ ] **Week 1:** No data disappears during normal use
- [ ] **Week 1:** Multi-device sync works without conflicts
- [ ] **Week 1:** Offline→online transitions seamless
- [ ] **Week 2:** Auth doesn't need founder intervention
- [ ] **Week 2:** No silent failures (all ops have visible outcomes)
- [ ] **Week 3:** Weekly backup succeeds and is verified
- [ ] **Week 3:** Restore drill passes (backup→restore→success)
- [ ] **Week 4:** System handles Princess/Anwesha/Rayhaan usage patterns
- [ ] **Week 4:** Founder can diagnose any issue from observatory

---

## Next Implementations (Priority Order)

### Phase 1: Understand (DONE - This Document)

### Phase 2: Stress Test
1. Load test: 1000 tasks in local SQLite
2. Offline/online toggle: 100 transitions
3. Concurrent edits: 2+ devices simultaneously
4. Network failure simulation: Drop/restore connection
5. Token expiry: Simulate JWT expiration
6. Backup creation: Trigger and verify

### Phase 3: Trust Killer #1 (Data Disappears)
1. Add transaction boundaries to all writes
2. Implement operation logging (no content, just success/failure)
3. Add silent failure detection
4. Test backup/restore end-to-end

### Phase 4: Trust Killer #2 (Sync Unpredictability)
1. Document sync algorithm formally
2. Test conflict resolution with real scenario
3. Add conflict logging
4. Validate offline→online transitions

### Phase 5: Trust Killer #3 (Auth Issues)
1. Test token refresh during app crash
2. Implement session recovery
3. Add auth error handling
4. Test multi-device logout consistency

### Phase 6: Trust Killer #4 (Silent Failures)
1. Add result code to every operation
2. Implement UI for operation status
3. Add retry logic with backoff
4. Create operation audit trail for founder

### Phase 7: UX Polish
1. Hide Founder Layer on first login
2. Show Tasks/Calendar/Memory/Chat only
3. Remove technical language from UI
4. Create simple onboarding flow

### Phase 8: Inner Circle Launch
1. Create runbook for Princess/Anwesha/Rayhaan
2. Deploy to inner circle
3. Monitor observatory for issues
4. Support as needed for 30 days

---

## Supabase Assessment

**Current Status:** ✓ Appropriate for inner circle use

**Why Supabase is NOT the bottleneck:**
- Auth service is proven (handles thousands)
- PostgREST API is standard and well-tested
- RLS policies are mature
- Realtime is low-latency (<100ms)

**Why system reliability appears uncertain:**
- Transaction boundaries not enforced in application code
- Error handling is sparse
- Silent failures not detected
- Conflicts not validated at scale
- Backup procedure untested

**Conclusion:** Supabase is solid. The limitation is application architecture clarity and error handling, not database platform.

---

## Decision Matrix

When unsure whether to refactor, ask:

1. **Is this a Supabase issue?** No → Focus on application code
2. **Is this a transaction issue?** Yes → Add transaction boundaries
3. **Is this a silent failure?** Yes → Add error logging
4. **Is this a conflict issue?** Yes → Test and document resolution
5. **Is this a backup issue?** Yes → Run restore drill
6. **Is this a performance issue?** Test first, optimize second

---

## Success Metrics (Original Chrono Ready for Inner Circle)

✅ **Zero unplanned data loss** over 30 days  
✅ **No sync conflicts unresolved** (automatic resolution succeeds)  
✅ **Auth requires <0.1% founder intervention** (self-healing)  
✅ **All operations visible** (no silent failures)  
✅ **Weekly backup validates successfully** (restore drill passes)  
✅ **Founder can diagnose issues** (from observatory, without reading private data)  
✅ **Inner circle uses daily** (adoption successful)  

---

**Document Status:** DRAFT - Ready for implementation  
**Next Review:** After Phase 2 stress testing  
**Maintainer:** Founder (Alena)  
