const Database = require('better-sqlite3');
const db = new Database('chrono.db');

console.log("⚙️ Initializing Professional DSA Database Population...");

const userId = 'local_user'; // Matches default in main.js / app.js
const today = new Date();
const targetDate = new Date();
targetDate.setDate(today.getDate() + 30); // 30 days from now
const targetDateStr = targetDate.toISOString().split('T')[0];

const now = Date.now();

// Clear existing to avoid duplicate keys during rerun
db.prepare("DELETE FROM goals").run();
db.prepare("DELETE FROM projects").run();
db.prepare("DELETE FROM subjects").run();
db.prepare("DELETE FROM subject_mastery").run();

// Helper to generate IDs similar to the CRUD engines
function generateId(prefix) {
    return prefix + '_' + Math.random().toString(36).substring(2, 11);
}

const goalId = generateId('g');
db.prepare(`
    INSERT INTO goals (id, user_id, title, description, target_date, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
`).run(goalId, userId, "Master Professional Data Structures & Algorithms (DSA)", "Complete a comprehensive curriculum of data structures, search/sort algorithms, complex paradigms, and LeetCode interview patterns.", targetDateStr, now, now);

console.log(`🎯 Goal added: ${goalId}`);

const curriculum = [
    {
        title: "Core Data Structures",
        description: "Linear data structures, hashing, and trees",
        subjects: [
            "Arrays & Dynamic Arrays",
            "Singly, Doubly, and Circular Linked Lists",
            "Stacks & Queues (including Deque)",
            "Hash Tables & Collision Resolution Strategies",
            "Binary Trees, BSTs, & DFS/BFS Traversals",
            "N-ary Trees & Trie Data Structures"
        ]
    },
    {
        title: "Advanced Data Structures",
        description: "Self-balancing trees, heaps, disjoint sets, and advanced trees",
        subjects: [
            "Self-Balancing BSTs (AVL Trees, Red-Black Trees)",
            "Heaps & Priority Queues (Binary, Binomial, Fibonacci Heaps)",
            "Disjoint Set Union (Union-Find) with Path Compression",
            "Graph Representation (Adjacency Matrix, Adjacency List)",
            "Segment Trees & Range Query Structures",
            "Fenwick Trees (Binary Indexed Trees)"
        ]
    },
    {
        title: "Algorithms & Problem Solving Techniques",
        description: "Searching, sorting, recursion, greedy, dynamic programming, and graph algorithms",
        subjects: [
            "Sorting & Searching Algorithms (QuickSort, MergeSort, Binary Search)",
            "Recursion, Backtracking & Exhaustive Search",
            "Greedy Strategy & Interval Scheduling",
            "Dynamic Programming (1D/2D, Knapsack, LIS, LCS)",
            "Graph Traversal (BFS, DFS, Topological Sorting)",
            "Shortest Paths (Dijkstra, Bellman-Ford, Floyd-Warshall)",
            "Minimum Spanning Trees (Kruskal, Prim)"
        ]
    },
    {
        title: "Systematic LeetCode Patterns",
        description: "High-frequency LeetCode interview patterns and complexity analysis",
        subjects: [
            "Sliding Window & Two Pointer Patterns",
            "Fast & Slow Pointers & Floyd's Cycle Detection",
            "Monotonic Stacks & Queues",
            "K-way Merge & Top 'K' Elements Patterns",
            "Bit Manipulation Tricks & Algorithms",
            "Asymptotic Complexity (Big-O, Big-Omega, Theta Analysis)"
        ]
    }
];

curriculum.forEach(p => {
    const projectId = generateId('p');
    db.prepare(`
        INSERT INTO projects (id, goal_id, title, description, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(projectId, goalId, p.title, p.description, now, now);
    
    console.log(`  📂 Project added: ${p.title} (${projectId})`);
    
    p.subjects.forEach(sName => {
        const subjectId = generateId('s');
        db.prepare(`
            INSERT INTO subjects (id, project_id, name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(subjectId, projectId, sName, now, now);
        
        // Initialize mastery with 10% (0.1) as standard
        db.prepare(`
            INSERT INTO subject_mastery (subject_id, mastery, quiz_scores, revision_frequency, last_recalled)
            VALUES (?, 0.10, '[]', 0, 0)
        `).run(subjectId);
        
        console.log(`    📚 Subject initialized: ${sName}`);
    });
});

console.log("\n✅ Database populated with full Professional DSA roadmap successfully!");
process.exit(0);
