import sqlite3, os
p = r'C:\Users\Alena B\AppData\Roaming\chrono\chrono.db'
print('exists', os.path.exists(p))
conn = sqlite3.connect(p)
try:
    cur = conn.execute("PRAGMA table_info(tasks)")
    cols = cur.fetchall()
    print('table_info tasks', cols)
    cur = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'")
    print('create sql', cur.fetchone())
finally:
    conn.close()
