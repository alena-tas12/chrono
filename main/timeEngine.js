const { db } = require('./main_db');

function addTask(name) {
    if (!name) return;
    db.prepare("INSERT INTO tasks (name, created_at) VALUES (?, ?)")
    .run(name, Date.now());
}

function getTasks() {
  return db.prepare("SELECT * FROM tasks").all();
}

module.exports = { addTask, getTasks };

let startTime = null;

function startTimer() {
    startTime = Date.now();
}

function stopTimer() {
    if (!startTime) return 0;
    const duration = (Date.now() - startTime) / 1000;
    startTime = null;
    return duration;
}

module.exports = {
    startTimer,
    stopTimer
};