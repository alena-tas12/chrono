# Archive

This directory holds files intentionally excluded from the active runtime.

- `corrupt-databases/` contains retained SQLite recovery artifacts. They are
  preserved for forensic recovery only and must never be opened as the active
  Chrono database.
