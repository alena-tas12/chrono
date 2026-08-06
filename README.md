# Chrono

Chrono is a local-first, human-centric cognitive environment. The core runtime,
architecture principles, and backend strategy are available at the repository
root:

- `ARCHITECTURE_BIBLE.md`
- `CHRONO_OS_1.0_FREEZE.md`
- `CHRONO_PRINCIPLES.md`
- `BACKEND_STRATEGY.md`

Historical reports, delivery material, guides, and test utilities are organized
under [`docs/`](docs/README.md), `quality/`, and `archive/`.

## Repository map

| Location | Responsibility |
| --- | --- |
| `backend/desktop/main/` | Electron main-process runtime and frozen cognitive contracts. |
| `frontend/` | Electron renderer interface. |
| `backend/api/` | Optional cloud, synchronization, collaboration, and founder observability runtime. |
| `databases/prisma/`, `databases/supabase/` | Optional remote-data schemas, migrations, and CLI configuration. |
| `quality/tests/` | Supported manual integration checks. |
| `quality/scratch/` | Categorized diagnostics and experiments; not production code. |
| `docs/` | Architecture, planning, guides, reports, releases, logs, and legacy records. |
| `archive/` | Recovery-only artifacts excluded from the runtime. |
| `assets/branding/` | Packaged-app assets. |
| `.github/` | Continuous-integration workflow definitions. |
| `dist/`, `output/`, `node_modules/` | Generated build output, local reports, and installed dependencies. |

The root contains only application configuration, package entry points, and the
governing architecture documents. Generated and dependency folders retain their
tool-required locations and are not treated as source folders.

The complete folder tree, runtime graph, and new-file placement rules are in
[`docs/architecture/REPOSITORY_STRUCTURE.md`](docs/architecture/REPOSITORY_STRUCTURE.md).
