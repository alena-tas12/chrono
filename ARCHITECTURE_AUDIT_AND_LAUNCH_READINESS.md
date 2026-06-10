# Chrono Architecture Audit and Launch Readiness

Last updated: 2026-06-08

## Architecture Layers

Chrono now has an explicit architectural split:

- Original Chrono / Founder Layer: continuity, companionship, memory, presence, Core and Inner Circle context, diagnostics, experiments, stress testing.
- Public Chrono / Product Layer: safer calendar, tasks, notes, basic relationships, sync, recoverability, observability, and simple usage metrics.

Set `CHRONO_LAYER=product` for public builds. Founder-only diagnostics and stress tools return a disabled response in product mode.

## Keep

- `main/main.js`: Electron entry point and IPC boundary.
- `main/main_db.js`: canonical local SQLite database.
- `main/cognitiveOrchestrator.js`: canonical local AI orchestration path.
- `main/syncEngine.js`, `main/realtimeSync.js`, `main/cloudSyncService.js`: sync path, still needs production load testing.
- `server/server.js`: public/backend API, admin dashboard API, synthetic-user runner, backup/restore, health checks.
- `server/ai_gateway.js`: server chat path.

## Founder-Only

- Complete diagnostics
- Observatory telemetry
- Local stress tests
- Emergency safety triggers
- Deep continuity dashboards
- Core and Inner Circle reference context

These are not product features. They preserve the original design vision and help the founder maintain the system.

## Product-Safe

- Registration and login
- Calendar and event CRUD
- User-owned chat history
- User profile
- Offline-first sync
- Account disable enforcement
- Founder observability without raw chat content

## Removed Legacy Subsystems

- `main/event.js`: queried an unused `events` table from local SQLite.
- `main/taskEngine.js`: created a separate legacy `chrono.db`.
- `main/taskMachine.js`: created another standalone legacy database and duplicate tables.
- `main/aiEngine.js`: unused response engine replaced by the cognitive orchestrator.

## Hardening Added

- Founder Architecture Directive
- Runtime layer policy
- Admin token gate
- Emergency confirmation phrase
- Admin rate limiting
- Auth rate limiting
- Health endpoint
- Backup creation
- Backup restore with pre-restore snapshot
- Hash-chained audit entries
- Synthetic-user generator
- Concurrent database load test runner
- Admin tables in Prisma and Supabase migrations
- Hardcoded cloud fallback removal
- Broken fake auto-update disabled

## Remaining Before Wider Public Beta

- Replace token-only admin access with real MFA or a private identity provider.
- Add signed, tested auto-update feed before re-enabling automatic updates.
- Run restore drills on a copied database, not only code validation.
- Run Supabase advisors and policy review after applying migrations.
- Add slow-query indexes after observing real load-test results.
- Add production crash reporting and uptime monitoring.
- Add terms/privacy language before onboarding non-friends.
- Add a clear public-mode onboarding path that does not expose founder-context language.
- Run 5-10 trusted human users for at least 2-3 weeks before judging value.

## Rule For Future Work

Do not merge Founder Layer and Product Layer just because code reuse is convenient. Product Chrono can inherit principles from Original Chrono, but it must stay simpler, safer, and more explainable for public users.
