const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "../chrono.db"));

db.prepare(`
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT
)
`).run();

function addTask(text) {
    return db.prepare("INSERT INTO tasks (text) VALUES (?)").run(text);
}

function getTasks() {
    return db.prepare("SELECT * FROM tasks").all();
}

module.exports = { addTask, getTasks };