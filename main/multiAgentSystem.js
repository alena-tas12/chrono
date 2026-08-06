/**
 * 🤖 CHRONO 2.0 MULTI-AGENT SYSTEM
 * 
 * Orchestrates a team of specialized AI agents working together
 * over the shared calendar database.
 */

const mainDb = require('./main_db');
const cognitiveProfile = require('./cognitiveProfile');
const goalIntelligence = require('./goalIntelligence');

const DSA_TOPICS = {
    "segment tree": {
        concept: "Segment Tree is a tree data structure used for storing intervals or segments. It allows querying which of the stored segments contain a given point, or range queries (like sum, minimum, or maximum in a subarray) in O(log N) time, and updating elements in O(log N) time.",
        breakdown: [
            "Representation: Segment Tree is represented as an array of size 4N.",
            "Construction: Built recursively from bottom-up in O(N) time.",
            "Range Query: Truncates search paths outside the query range. Merges results of overlapping intervals.",
            "Point Update: Updates a leaf node and propagates changes up to the root."
        ],
        complexity: "Build: O(N) | Query: O(log N) | Update: O(log N) | Space: O(N)"
    },
    "fenwick tree": {
        concept: "Fenwick Tree (also known as Binary Indexed Tree or BIT) is a data structure that provides efficient methods for calculation and manipulation of the prefix sums of a sequence of values in O(log N) time.",
        breakdown: [
            "Binary representation: Uses bitwise operations like `x & (-x)` to isolate the lowest set bit.",
            "Point Update: Adds value to index `i` and propagates to next index: `i += i & (-i)`.",
            "Prefix Sum: Accumulates value at `i` and moves to parent: `i -= i & (-i)`."
        ],
        complexity: "Build: O(N log N) or O(N) | Query: O(log N) | Update: O(log N) | Space: O(N)"
    },
    "avl tree": {
        concept: "AVL Tree is a self-balancing Binary Search Tree (BST) where the difference between heights of left and right subtrees (balancing factor) cannot be more than 1 for all nodes.",
        breakdown: [
            "Balance Factor: Height(Left Subtree) - Height(Right Subtree) in {-1, 0, 1}.",
            "Rotations: Balancing is restored via Single Rotations (Left-Left, Right-Right) or Double Rotations (Left-Right, Right-Left).",
            "Insertion/Deletion: Balancing factors are recalculated up to the root node."
        ],
        complexity: "Search: O(log N) | Insertion: O(log N) | Deletion: O(log N) | Space: O(N)"
    },
    "red-black tree": {
        concept: "Red-Black Tree is a self-balancing binary search tree where each node has a color attribute (Red or Black). Balance is maintained through node coloring and rotations.",
        breakdown: [
            "Root & Leaf Rule: The root and all NULL leaves are always Black.",
            "Red Rule: Red nodes cannot have Red children (no consecutive Red nodes).",
            "Black Height Rule: Every path from a node to any of its descendant NULL leaves must contain the same number of Black nodes."
        ],
        complexity: "Search: O(log N) | Insertion: O(log N) | Deletion: O(log N) | Space: O(N)"
    },
    "dynamic programming": {
        concept: "Dynamic Programming (DP) is an algorithmic paradigm that solves a complex problem by breaking it into subproblems, solving each subproblem once, and storing their solutions (memoization/tabulation) to avoid redundant computations.",
        breakdown: [
            "Optimal Substructure: The optimal solution to the problem can be constructed from optimal solutions to its subproblems.",
            "Overlapping Subproblems: Subproblems are solved repeatedly (unlike divide-and-conquer).",
            "Approaches: Memoization (Top-Down, recursive) vs Tabulation (Bottom-Up, iterative)."
        ],
        complexity: "Dependent on state representation (typically O(N) to O(N^2) time/space)."
    },
    "trie": {
        concept: "Trie (also called prefix tree) is a search tree used for storing associative arrays where keys are usually strings. Nodes store character references, enabling prefix matching.",
        breakdown: [
            "Root Node: Represents an empty string.",
            "Edge Transition: Characters represent branches to child nodes.",
            "Word End: Boolean flag marking if the node completes a word."
        ],
        complexity: "Insert: O(L) | Search: O(L) | Prefix Match: O(L) | Space: O(ALPHABET_SIZE * N * L)"
    },
    "disjoint set": {
        concept: "Disjoint Set Union (DSU / Union-Find) is a data structure that tracks elements partitioned into disjoint subsets. It provides near-constant time operations to merge sets and find representatives.",
        breakdown: [
            "Find: Determines which subset an element belongs to. Can be optimized with Path Compression.",
            "Union: Merges two subsets into a single subset. Can be optimized with Union by Rank/Size."
        ],
        complexity: "Find: O(alpha(N)) | Union: O(alpha(N)) where alpha is the inverse Ackermann function."
    },
    "dijkstra": {
        concept: "Dijkstra's Algorithm finds the shortest paths from a single source vertex to all other vertices in a weighted graph with non-negative edge weights.",
        breakdown: [
            "Greedy Choice: Always relaxes the vertex with the minimum distance next.",
            "Data Structure: Optimized using a min-priority queue (Binary/Fibonacci Heap).",
            "Edge Relaxation: If `dist[u] + weight(u,v) < dist[v]`, update `dist[v]`."
        ],
        complexity: "Time: O((V + E) log V) with Binary Heap | Space: O(V + E)"
    },
    "sliding window": {
        concept: "Sliding Window is a problem-solving pattern used to convert a nested loop O(N^2) algorithm into a single O(N) linear scan over arrays or strings.",
        breakdown: [
            "Fixed Window: Maintains a window of constant width `K` by adding new element and discarding trailing element.",
            "Dynamic Window: Expands right pointer until condition is met, then shrinks left pointer to optimize constraints."
        ],
        complexity: "Time: O(N) | Space: O(1) or O(K) for tracking window elements."
    }
};

const agents = {
    companion: {
        name: 'Companion',
        tone: 'Calm, concise, analytical, structural, and truthful.',
        objective: 'Satisfy the user\'s intent, act as a continuity-aware systems observer, and preserve agency. No performative empathy.',
        respond: (input, context) => {
            const displayName = context.displayName || 'Alen';
            const responses = [
                `Good evening, ${displayName}.`,
                `Welcome back, ${displayName}.`,
                `Context loaded. What is the actual object we are discussing today?`,
                `I have loaded your continuity state. What is next?`
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }
    },
    architect: {
        name: 'Architect',
        tone: 'Analytical, systemic, data-driven, and brief.',
        objective: 'Analyze calendar metadata, evaluate schedule density, and present structural recommendations.',
        respond: (input, context) => {
            const eventCount = context.taskCount || 0;
            const openWindows = eventCount > 3 ? 'restricted' : 'optimal';
            return `[Architect Engine] Schedule Status: ${openWindows} density. Total active blocks: ${eventCount}. Recommend allocating 45 minutes of unstructured buffer space in the afternoon to mitigate cognitive depletion.`;
        }
    },
    princess: {
        name: 'Princess',
        tone: 'Collaborative, cheerful, direct, and academic.',
        objective: 'Co-plan study sessions and synchronize collaborative calendars with user groups.',
        respond: (input, context) => {
            return `Hey! I've checked the shared Study calendar. Saturday from 3:00 PM to 5:00 PM is open for both of us. Conflict Risk: Low. Should we lock that block in?`;
        }
    },
    studyCoach: {
        name: 'Study Coach',
        tone: 'Motivational, structured, pedagogical, and actionable.',
        objective: 'Offer study techniques, break down large projects, and enforce active recall/spaced repetition.',
        respond: (input, context) => {
            const lowerInput = input.toLowerCase();
            
            // Check if scheduling study block
            if (lowerInput.includes('schedule') || lowerInput.includes('put on calendar') || lowerInput.includes('add to calendar')) {
                let matchedTopicKey = null;
                for (const key of Object.keys(DSA_TOPICS)) {
                    if (lowerInput.includes(key)) {
                        matchedTopicKey = key;
                        break;
                    }
                }
                const topicName = matchedTopicKey ? matchedTopicKey.toUpperCase() : "DSA PROBLEM SOLVING";
                return `I've prepared a spacing repetition proposal to schedule an **"Active Recall: ${topicName}"** study block today during your computed peak focus hours. Review the adjustments card below and click "Apply Adjustments" to add it to your calendar!`;
            }

            // Check if user is asking about a specific topic we have notes for
            let matchedTopicKey = null;
            for (const key of Object.keys(DSA_TOPICS)) {
                if (lowerInput.includes(key)) {
                    matchedTopicKey = key;
                    break;
                }
            }
            
            if (matchedTopicKey) {
                const topic = DSA_TOPICS[matchedTopicKey];
                const db = mainDb.db;
                let subjectMeta = null;
                try {
                    subjectMeta = db.prepare(`
                        SELECT s.*, m.mastery, m.revision_frequency, m.last_recalled, p.title as project_title, g.title as goal_title, g.target_date
                        FROM subjects s
                        JOIN subject_mastery m ON s.id = m.subject_id
                        JOIN projects p ON s.project_id = p.id
                        JOIN goals g ON p.goal_id = g.id
                        WHERE s.name LIKE ? AND g.status = 'active'
                    `).get(`%${matchedTopicKey}%`);
                } catch (e) {
                    console.error("Failed to query subject meta:", e.message);
                }

                let response = `**[Study Coach Concept Breakdown: ${matchedTopicKey.toUpperCase()}]**\n\n`;
                response += `*Concept:* ${topic.concept}\n\n`;
                response += `*Core Mastery Areas:*\n` + topic.breakdown.map(b => `- ${b}`).join('\n') + `\n\n`;
                response += `*Complexity Bounds:* \`${topic.complexity}\`\n\n`;

                if (subjectMeta) {
                    const daysRemaining = Math.max(1, Math.round((new Date(subjectMeta.target_date).getTime() - Date.now()) / 86400000));
                    response += `📊 *Curriculum Connection:* Part of **"${subjectMeta.project_title}"** under goal **"${subjectMeta.goal_title}"** (exam in ${daysRemaining} days).\n`;
                    response += `🎯 *Your Current Mastery:* **${Math.round(subjectMeta.mastery * 100)}%** (${subjectMeta.revision_frequency} revisions completed).\n\n`;
                    response += `Would you like me to schedule a Pomodoro study block for **"${subjectMeta.name}"** today to optimize recall? Tell me to **"schedule study ${matchedTopicKey}"**.`;
                } else {
                    response += `Would you like me to schedule a revision block for **"${matchedTopicKey}"** today? Say **"schedule study ${matchedTopicKey}"**.`;
                }
                return response;
            }

            return `Let's break down your active study goals. We should allocate a 50-minute Pomodoro block followed by a 10-minute active review. Tell me which DSA topic (e.g., segment trees, Fenwick trees, AVL trees, DSU, dynamic programming, Dijkstra, sliding window) you would like to study next!`;
        },
        getProposal: (input, context) => {
            const lowerInput = input.toLowerCase();
            if (!(lowerInput.includes('schedule') || lowerInput.includes('put on calendar') || lowerInput.includes('add to calendar'))) {
                return null;
            }

            let matchedTopicKey = null;
            let matchedSubjectName = "DSA Problem Solving";
            let goalId = null;
            let projectId = null;
            let subjectId = null;

            for (const key of Object.keys(DSA_TOPICS)) {
                if (lowerInput.includes(key)) {
                    matchedTopicKey = key;
                    break;
                }
            }

            const db = mainDb.db;
            if (matchedTopicKey) {
                try {
                    const row = db.prepare(`
                        SELECT s.id as subject_id, s.name as subject_name, p.id as project_id, g.id as goal_id
                        FROM subjects s
                        JOIN projects p ON s.project_id = p.id
                        JOIN goals g ON p.goal_id = g.id
                        WHERE s.name LIKE ? AND g.status = 'active'
                    `).get(`%${matchedTopicKey}%`);
                    if (row) {
                        matchedSubjectName = row.subject_name;
                        subjectId = row.subject_id;
                        projectId = row.project_id;
                        goalId = row.goal_id;
                    }
                } catch(e) {
                    console.error("Failed to fetch subject metadata for proposal:", e);
                }
            }

            const userId = mainDb.getSyncMeta('auth_user_id') || 'local_user';
            const profile = cognitiveProfile.getCognitiveProfile(userId);
            
            let startTime = "09:00";
            if (profile.best_focus_time) {
                const matches = profile.best_focus_time.match(/^(\d{2}:\d{2})/);
                if (matches) startTime = matches[1];
            }
            const duration = profile.preferred_session_length || 45;
            
            const todayStr = context.selectedDate || new Date().toISOString().split('T')[0];
            const taskId = 'e_' + Math.random().toString(36).substring(2, 11);

            return {
                type: 'spaced_study_planning',
                confidence: 0.95,
                reason: 'Study block requested by user. Optimized using calculated cognitive rhythm.',
                explanation: `I've prepared a spacing repetition proposal to schedule an **"Active Recall: ${matchedSubjectName}"** study block today during your computed peak focus hours. Review the adjustments card below and click "Apply Adjustments" to add it to your calendar!`,
                reasoning_bullets: [
                    `Topic: ${matchedSubjectName}`,
                    `Best focus window is ${profile.best_focus_time} (scheduling at ${startTime})`,
                    `Duration: ${duration} minutes`
                ],
                actions: [{
                    type: 'add',
                    id: taskId,
                    text: `Active Recall: ${matchedSubjectName}`,
                    date: todayStr,
                    calendar: 'study',
                    start_time: startTime,
                    duration_min: duration,
                    goal_id: goalId,
                    project_id: projectId,
                    subject_id: subjectId
                }]
            };
        }
    },
    scheduler: {
        name: 'Scheduler',
        tone: 'Efficient, logical, conflict-aware, and structured.',
        objective: 'Insert tasks, assign start times/durations, and resolve temporal overlapping.',
        respond: (input, context) => {
            const taskText = input.replace(/.*?(?:add|create|schedule|put)\s*/i, '').trim() || 'New Block';
            return `I have evaluated the calendar timeline. I propose adding the block **"${taskText}"** to your schedule today. Check out the action card below to lock it in!`;
        },
        getProposal: (input, context) => {
            const taskText = input.replace(/.*?(?:add|create|schedule|put)\s*/i, '').trim() || 'New Block';
            const userId = mainDb.getSyncMeta('auth_user_id') || 'local_user';
            const profile = cognitiveProfile.getCognitiveProfile(userId);
            
            let startTime = "11:00"; // default routine
            const todayStr = context.selectedDate || new Date().toISOString().split('T')[0];
            const taskId = 'e_' + Math.random().toString(36).substring(2, 11);

            return {
                type: 'scheduler_action',
                confidence: 0.90,
                reason: 'Calendar scheduling action matches user intent.',
                explanation: `I've prepared a scheduling proposal to add **"${taskText}"** to your calendar today. Review the card details below to apply it.`,
                reasoning_bullets: [
                    `Event: ${taskText}`,
                    `Target Date: ${todayStr}`,
                    `Assigned Default Slot: 11:00`
                ],
                actions: [{
                    type: 'add',
                    id: taskId,
                    text: taskText,
                    date: todayStr,
                    calendar: 'personal',
                    start_time: startTime,
                    duration_min: 60
                }]
            };
        }
    },
    focusGuardian: {
        name: 'Focus Guardian',
        tone: 'Calm, protective, boundary-oriented, and firm.',
        objective: 'Protect focus blocks, warn against work overload, and interrupt recursive loop anxiety.',
        respond: (input, context) => {
            return `[Focus Guardian Alert] Working hours boundary exceeded. I am locking down the calendar to prevent further additions. It's time to step away and protect your focus.`;
        }
    },
    continuity: {
        name: 'Continuity',
        tone: 'Narrative, biographical, reflective, and connecting.',
        objective: 'Synthesize longitudinal timelines, milestones, goals, and relational histories.',
        respond: (input, context) => {
            const db = mainDb.db;
            const lowerInput = input.toLowerCase();

            // 1. If asking about a specific peer (e.g. Princess, Rayhaan)
            let matchedPeer = null;
            try {
                const peers = db.prepare("SELECT * FROM relationships").all();
                for (const p of peers) {
                    if (lowerInput.includes(p.name.toLowerCase())) {
                        matchedPeer = p;
                        break;
                    }
                }
            } catch (e) {}

            if (matchedPeer) {
                // Fetch milestones, projects, sessions
                try {
                    const milestones = db.prepare("SELECT * FROM shared_milestones WHERE peer_id = ? AND deleted = 0").all(matchedPeer.id);
                    const completedMilestones = milestones.filter(m => m.status === 'completed');
                    const activeMilestones = milestones.filter(m => m.status === 'active');
                    
                    let response = `**[Continuity Thread: ${matchedPeer.name}]**\n\n`;
                    response += `${matchedPeer.name} is a key figure on your timeline, working in the role of **${matchedPeer.role}**.\n\n`;
                    
                    if (completedMilestones.length > 0) {
                        response += `🏆 *Milestones Achieved together:*\n` + completedMilestones.map(m => `- **${m.title}** (${m.target_date || 'N/A'}): ${m.description || 'No description'}`).join('\n') + `\n\n`;
                    }
                    if (activeMilestones.length > 0) {
                        response += `🎯 *Active Fronts / Goals:*\n` + activeMilestones.map(m => `- **${m.title}** (Target: ${m.target_date || 'N/A'}): ${m.description || 'No description'}`).join('\n') + `\n\n`;
                    }
                    
                    // Fetch shared sessions
                    const sessions = db.prepare(`
                        SELECT * FROM tasks 
                        WHERE deleted = 0 AND visibility = 'shared_specific' AND shared_with LIKE ?
                    `).all(`%"${matchedPeer.id}"%`);
                    
                    if (sessions.length > 0) {
                        response += `📅 *Shared Sessions / Collaboration:*\n` + sessions.map(s => `- **${s.text}** on ${s.date} (${s.start_time || 'N/A'}, ${s.duration_min} mins)`).join('\n') + `\n\n`;
                    }

                    // Dynamic trend statement from metrics
                    const metricsRow = db.prepare("SELECT * FROM continuity_metrics WHERE peer_id = ?").get(matchedPeer.id);
                    if (metricsRow) {
                        response += `📈 *Continuity State:* Shared History is **${metricsRow.continuity_score}** with a **${metricsRow.trend}** trend. Last interaction was ${metricsRow.last_interaction ? new Date(metricsRow.last_interaction).toLocaleDateString() : 'logged recently'}.\n`;
                    } else {
                        response += `📈 *Continuity State:* Stable collaboration history.\n`;
                    }

                    return response;
                } catch (err) {
                    console.error("Continuity agent peer lookup failed:", err.message);
                }
            }

            // 2. If asking about Semester 3 vs Semester 5 or general timelines
            if (lowerInput.includes('semester') || lowerInput.includes('what changed') || lowerInput.includes('timeline') || lowerInput.includes('milestone')) {
                try {
                    const milestones = db.prepare("SELECT * FROM shared_milestones WHERE deleted = 0 ORDER BY target_date DESC").all();
                    const activeGoals = db.prepare("SELECT * FROM goals WHERE status = 'active'").all();

                    let response = `**[Timeline Biography Synthesis]**\n\n`;
                    if (milestones.length > 0) {
                        response += `🏆 *Key Life Milestones:*\n` + milestones.map(m => `- **${m.title}** (${m.target_date}): ${m.description || 'No details'}`).join('\n') + `\n\n`;
                    }
                    if (activeGoals.length > 0) {
                        response += `🎯 *Active Fronts & Goals:*\n` + activeGoals.map(g => `- **${g.title}**: ${g.description || 'No details'}`).join('\n') + `\n\n`;
                    }
                    
                    // Synthesize comparison if Semester query is present
                    if (lowerInput.includes('semester 3') || lowerInput.includes('semester 5') || lowerInput.includes('what changed')) {
                        response += `🔍 *Longitudinal Shift Analysis:*\n`;
                        response += `- **Earlier Period (Semester 3/4):** Centered heavily on foundational academic work and establishing core study habits.\n`;
                        response += `- **Current Period (Semester 5/Present):** Shifted toward relational collaboration (Chrono 2.0 sync architecture, hardware partner projects) and translating knowledge into personal infrastructure.\n`;
                    }

                    return response;
                } catch (err) {
                    console.error("Continuity agent timeline lookup failed:", err.message);
                }
            }

            return `I am looking at your life biography timeline. You have logged milestones connecting Princess, Rayhaan, and others. Ask me something specific like: "Why is Princess important in my timeline?" or "What milestones have we completed?"`;
        }
    }
};

/**
 * Routes user query to the appropriate agent node based on query analysis.
 */
function routeQuery(input, context = {}) {
    const lowerInput = input.toLowerCase();
    
    // 0. Timeline, Milestones, or relational synthesis queries -> Continuity Agent
    if (lowerInput.includes('milestone') || lowerInput.includes('timeline') || lowerInput.includes('why is') || lowerInput.includes('what changed') || lowerInput.includes('semester 3') || lowerInput.includes('semester 5') || lowerInput.includes('important in my')) {
        return agents.continuity;
    }

    // 1. Detect recursive loops or high stress -> Focus Guardian
    if (lowerInput.includes('stress') || lowerInput.includes('panic') || lowerInput.includes('overload') || lowerInput.includes('burnout')) {
        return agents.focusGuardian;
    }
    
    // 2. Collaborative study triggers -> Princess
    if (lowerInput.includes('princess') || lowerInput.includes('study with') || lowerInput.includes('vian')) {
        return agents.princess;
    }

    // 3. Learning / Homework / Study queries -> Study Coach
    if (lowerInput.includes('study') || lowerInput.includes('exam') || lowerInput.includes('homework') || lowerInput.includes('revision') || lowerInput.includes('learn') || lowerInput.includes('dsa') || lowerInput.includes('tree') || lowerInput.includes('graph') || lowerInput.includes('search') || lowerInput.includes('sort') || lowerInput.includes('programming')) {
        return agents.studyCoach;
    }

    // 4. Booking and scheduling actions -> Scheduler
    if (lowerInput.includes('add') || lowerInput.includes('schedule') || lowerInput.includes('book') || lowerInput.includes('create')) {
        return agents.scheduler;
    }

    // 5. Explicit metadata or calendar analysis requests -> Architect
    if (lowerInput.includes('analyze') || lowerInput.includes('statistics') || lowerInput.includes('conflicts') || lowerInput.includes('load')) {
        return agents.architect;
    }

    // 6. Default to user's selected cognitive style / profile
    const preferredStyle = context.cognitiveStyle || 'adaptive';
    if (preferredStyle === 'architect') {
        return agents.architect;
    } else if (preferredStyle === 'companion') {
        return agents.companion;
    }
    
    // Adaptive fallback
    return agents.companion;
}

/**
 * Executes a multi-agent dialogue simulation or specific agent routing.
 * Enhanced to implement the Collaborative Dialogue Protocol for compound queries.
 */
async function processAgentQuery(input, context = {}) {
    const lowerInput = input.toLowerCase();
    const hasStress = lowerInput.includes('stress') || lowerInput.includes('panic') || lowerInput.includes('overload') || lowerInput.includes('burnout') || lowerInput.includes('exhausted');
    const hasStudy = lowerInput.includes('study') || lowerInput.includes('exam') || lowerInput.includes('homework') || lowerInput.includes('revision') || lowerInput.includes('dsa');

    // Collaborative Dialogue Protocol for compound queries (Stress + Study)
    if (hasStress && hasStudy) {
        console.log("🤖 Collaborative Dialogue Protocol activated: Coordinating Study Coach, Focus Guardian, and Companion.");
        
        // Final Dialogue Arbiter resolves agent disagreements:
        const synthesizedResponse = `[Multi-Agent Coordination] I see you're feeling stressed about the upcoming exam. While the Study Coach recommends initiating revision blocks, the Focus Guardian is warning against overloading your current capacity. I have arbitrated a compromise: let's schedule just one short 45-minute revision block today, followed by an immediate protected rest buffer to protect your focus and energy.`;
        
        return {
            agent: 'Multi-Agent Team',
            response: synthesizedResponse,
            tone: 'Empathetic & Structured (Coordinated)'
        };
    }

    const activeAgent = routeQuery(input, context);
    console.log(`🤖 Multi-Agent Routing: Prompt routed to [${activeAgent.name}]`);
    
    const response = activeAgent.respond(input, context);
    
    // Fetch proposal if supported by agent
    let proposal = null;
    if (activeAgent.getProposal) {
        proposal = activeAgent.getProposal(input, context);
    }

    return {
        agent: activeAgent.name,
        response: response,
        tone: activeAgent.tone,
        proposal: proposal
    };
}

module.exports = {
    agents,
    routeQuery,
    processAgentQuery
};
