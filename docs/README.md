# Chrono Documentation

This directory separates active design material from historical delivery
records. The governing documents remain at the repository root so that they
are discoverable by people and tooling:

- `../ARCHITECTURE_BIBLE.md` — the system model and invariants.
- `../CHRONO_FOUNDER_ARCHITECTURE_DIRECTIVE.md` — founder-level constraints.
- `../CHRONO_OS_1.0_FREEZE.md` — frozen core contracts and review policy.
- `../CHRONO_PRINCIPLES.md` — product decision principles.
- `../BACKEND_STRATEGY.md` — local-first and optional-sync deployment policy.

## Working material

- `contracts/` — frozen v1 runtime contracts and extension boundaries.

- `architecture/` — designs, pipeline descriptions, and architecture audits.
- `planning/` — implementation planning.
- `guides/` — operational and integration walkthroughs.

## Historical material

- `reports/` — completed-phase and investigation reports.
- `release/` — delivery manifests, launch checklists, and release records.
- `legacy/` — retained historical indexes; these describe earlier layouts and
  may mention paths that no longer exist at the repository root.
- `logs/` — captured command output, not product documentation.

Manual integration checks are in `../quality/tests/integration/`. Corrupt database
recovery artifacts are quarantined in `../archive/corrupt-databases/` and are
not part of the application runtime.
