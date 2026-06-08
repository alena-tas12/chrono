const Database = require('better-sqlite3');
const db = new Database(':memory:');
const sql = `INSERT OR REPLACE INTO tasks (
  id, text, date, calendar, completed, start_time, duration_min,
  updated_at, device_id, synced, deleted, visibility, shared_with,
  importance_score, impact_score, goal_id, project_id, subject_id
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)`;
console.log('placeholders', (sql.match(/\?/g) || []).length);
try {
  const stmt = db.prepare(sql);
  stmt.run('i','t','d','c',0,null,60,Date.now(),'dev','vis','sw',5,5,null,null,null);
  console.log('success');
} catch (e) {
  console.error(e.toString());
}
