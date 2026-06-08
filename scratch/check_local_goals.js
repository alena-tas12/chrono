const Database = require('better-sqlite3');
const db = new Database('chrono.db');
const count = db.prepare("SELECT COUNT(*) as count FROM goals WHERE user_id = 'local_user'").get().count;
console.log(`Local goals count: ${count}`);
process.exit(0);
