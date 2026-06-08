const mainDb = require('./main_db');
const calendarIntelligence = require('./calendarIntelligence');

/**
 * 🎯 INTENT ENGINE
 * Parses user input for stress, overload, or explicit schedule restructuring intents.
 * Outputs actionable change proposals.
 */

function parseIntent(input, dateKey) {
    const lower = input.toLowerCase();
    const db = mainDb.db;
    const today = dateKey || new Date().toISOString().split('T')[0];

    // Fetch active tasks for the target date
    let activeTasks = [];
    try {
        activeTasks = db.prepare("SELECT * FROM tasks WHERE date = ? AND completed = 0 AND deleted = 0").all(today);
    } catch (e) {
        console.error("IntentEngine: Failed to query tasks:", e.message);
    }

    // 1. Detect stress & overwhelm (e.g. "exhausted", "burnout", "too much")
    const isOverwhelmed = /\b(exhausted|stressed|burnout|too much|panic|tired|anxious|overload)\b/.test(lower);
    if (isOverwhelmed && activeTasks.length > 0) {
        // Construct shame-free restructuring proposal
        const actions = [];
        
        // Move high-density tasks (like Study/Work) to tomorrow, shrink others, add focus rest block
        const tomorrow = getRelativeDate(today, 1);
        
        // Propose to move up to 2 study or work tasks
        let movedCount = 0;
        activeTasks.forEach(task => {
            const cal = (task.calendar || '').toLowerCase();
            if ((cal === 'study' || cal === 'personal') && movedCount < 2) {
                actions.push({
                    type: 'move',
                    taskId: task.id,
                    text: task.text,
                    originalDate: task.date,
                    newDate: tomorrow
                });
                movedCount++;
            } else if (task.duration_min > 60) {
                // Shrink long tasks to reduce cognitive load
                actions.push({
                    type: 'shrink',
                    taskId: task.id,
                    text: task.text,
                    originalDuration: task.duration_min,
                    newDuration: Math.round(task.duration_min / 2)
                });
            }
        });

        // Add a protected Rest & Recovery focus block
        actions.push({
            type: 'add',
            text: 'Protected Rest & Recovery',
            date: today,
            calendar: 'focus',
            start_time: '19:00',
            duration_min: 90
        });

        return {
            hasProposal: true,
            proposal: {
                type: 'overwhelm_restructure',
                confidence: 0.95,
                reason: 'High task density coupled with explicit stress keywords in conversation history.',
                explanation: "It sounds like you've hit a limit, which is completely okay. Let's offload your calendar: I propose moving study blocks to tomorrow, shortening today's remaining tasks, and carving out a dedicated Rest & Recovery block tonight.",
                reasoning_bullets: [
                    "Detected verbal stress vocabulary or high cognitive load cues",
                    "Offloading demanding tasks to safeguard emotional stability",
                    "Carving out structured recovery time to counter fatigue"
                ],
                actions
            }
        };
    }

    // 2. Detect Spaced Repetition Exam Prep Requests
    // e.g. "physics exam on 2026-06-05" or "exam next week" or "exam on friday"
    const examMatch = lower.match(/\b([a-zA-Z0-9\s]+?)\s+(?:exam|test)\s+(?:on|for)\s+([0-9-]{10}|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (examMatch) {
        const subject = examMatch[1].trim();
        const dateStr = examMatch[2].trim();
        let targetDate = today;

        if (dateStr === 'tomorrow') {
            targetDate = getRelativeDate(today, 1);
        } else if (dateStr !== 'today') {
            targetDate = parseRelativeWeekday(dateStr, today);
        }

        const studyProposals = calendarIntelligence.generateSpacedStudyBlocks(subject, targetDate);
        return {
            hasProposal: true,
            proposal: {
                type: 'spaced_study_planning',
                confidence: 0.90,
                reason: 'Explicit exam prep scheduling command matching academic planning filters.',
                explanation: `I've mapped out a cognitive study timeline leading up to your ${subject} Exam on ${targetDate}. This spaces study sessions over several days to leverage active recall and protect you from last-minute burnout.`,
                reasoning_bullets: [
                    "Leveraging spaced repetition study structures",
                    "Prioritizing preparation buffers ahead of target exam dates",
                    "Ensuring study blocks are balanced to maintain focus stability"
                ],
                actions: studyProposals
            }
        };
    }

    // 3. Detect task shifts (e.g. "move study to evenings", "postpone chemistry")
    const shiftMatch = lower.match(/\b(move|shift|postpone|delay)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:to|until)\s+([a-zA-Z0-9\s:-]+))?$/i);
    if (shiftMatch) {
        const taskKeyword = shiftMatch[2].trim();
        const dest = shiftMatch[3] ? shiftMatch[3].trim().toLowerCase() : 'tomorrow';

        // Find matches in active tasks
        const matchingTask = activeTasks.find(t => t.text.toLowerCase().includes(taskKeyword));
        if (matchingTask) {
            let newDate = today;
            let newStartTime = matchingTask.start_time;

            if (dest.includes('tomorrow')) {
                newDate = getRelativeDate(today, 1);
            } else if (dest.includes('evening')) {
                newStartTime = '19:00';
            } else {
                newDate = parseRelativeWeekday(dest, today);
            }

            const actions = [{
                type: 'move',
                taskId: matchingTask.id,
                text: matchingTask.text,
                originalDate: matchingTask.date,
                newDate,
                newStartTime
            }];

            return {
                hasProposal: true,
                proposal: {
                    type: 'task_shift',
                    confidence: 0.85,
                    reason: 'Specific manual schedule adjustment command detected.',
                    explanation: `Let's adjust that block. I can postpone "${matchingTask.text}" to help free up your bandwidth right now.`,
                    reasoning_bullets: [
                        "User explicitly requested to shift or delay a task",
                        "Rearranging active queue to accommodate scheduling request"
                    ],
                    actions
                }
            };
        }
    }

    return { hasProposal: false, proposal: null };
}

function getRelativeDate(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function parseRelativeWeekday(dayName, baseDate) {
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetIdx = daysOfWeek.indexOf(dayName.toLowerCase());
    if (targetIdx === -1) {
        // If not a weekday, return tomorrow as fallback or match date string
        if (/^\d{4}-\d{2}-\d{2}$/.test(dayName)) return dayName;
        return getRelativeDate(baseDate, 1);
    }
    
    const current = new Date(baseDate);
    const currentIdx = current.getDay();
    let diff = targetIdx - currentIdx;
    if (diff <= 0) diff += 7; // Must be in future week

    current.setDate(current.getDate() + diff);
    return current.toISOString().split('T')[0];
}

module.exports = {
    parseIntent
};
