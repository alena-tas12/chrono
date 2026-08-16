/**
 * ⏱️ CHRONO TIME ENGINE
 *
 * Tracks elapsed focus session time and exposes task utilities.
 * Uses main_db.addTask for correct schema-safe task insertion.
 */

const mainDb = require('./main_db');

let startTime = null;

/**
 * Starts a focus session timer.
 */
function startTimer() {
    startTime = Date.now();
}

/**
 * Stops the focus session timer and returns elapsed seconds.
 * @returns {number} Duration in seconds, or 0 if no session was started.
 */
function stopTimer() {
    if (!startTime) return 0;
    const duration = (Date.now() - startTime) / 1000;
    startTime = null;
    return duration;
}

/**
 * Adds a task via the canonical main_db path (correct schema, UUID generation, sync flags).
 * @param {string|Object} task - Task text or full task object.
 */
function addTask(task) {
    return mainDb.addTask(task);
}

/**
 * Fetches today's tasks via the canonical main_db path.
 * @param {string} [date] - Optional ISO date string. Defaults to today.
 */
function getTasks(date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return mainDb.fetchTasks(targetDate);
}

module.exports = {
    startTimer,
    stopTimer,
    addTask,
    getTasks
};