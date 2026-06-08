const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

console.log("⚙️ Loading Cognitive Action Test Environment...");

const mainDb = require('../main/main_db');
const db = mainDb.db;

const intentEngine = require('../main/intentEngine');
const calendarIntelligence = require('../main/calendarIntelligence');
const executiveFunction = require('../main/executiveFunction');
const reflectionEngine = require('../main/reflectionEngine');
const orchestrator = require('../main/cognitiveOrchestrator');
const multiAgent = require('../main/multiAgentSystem');

async function runTests() {
    console.log("\n🚀 Starting Chrono OS Cognitive Action Layer Integration Tests...");

    // Helper date keys
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const targetExamDate = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0]; // 5 days from now

    // Clean test tasks in DB
    db.prepare("DELETE FROM tasks WHERE text LIKE '%Test%' OR text LIKE '%Study%' OR text LIKE '%Exam%' OR text LIKE '%Undo%'").run();
    db.prepare("DELETE FROM cognitive_memories WHERE memory_type = 'daily_reflection'").run();
    db.prepare("DELETE FROM memory_chat WHERE id = 'test_chat_123'").run();
    db.prepare("DELETE FROM cognitive_actions WHERE rationale LIKE '%User%'").run();

    try {
        // ========================================
        // TEST 1: Calendar Intelligence (Spaced Blocks)
        // ========================================
        console.log("\n1. Testing Calendar Intelligence Engine (Spaced Repetition)...");
        const spacedBlocks = calendarIntelligence.generateSpacedStudyBlocks("Test DSA", targetExamDate);
        console.log(`Generated ${spacedBlocks.length} spaced study/exam tasks.`);
        
        const hasExam = spacedBlocks.some(b => b.text === "Exam: Test DSA" && b.date === targetExamDate);
        const hasCore = spacedBlocks.some(b => b.text === "Study Core: Test DSA");
        const hasPractice = spacedBlocks.some(b => b.text === "Active Practice: Test DSA");
        const hasReview = spacedBlocks.some(b => b.text === "Final Review: Test DSA");
        const hasRest = spacedBlocks.some(b => b.text === "Post-Exam Rest & Recharge" && b.date === targetExamDate);

        if (!hasExam || !hasCore || !hasPractice || !hasReview || !hasRest) {
            throw new Error("Calendar Intelligence failed to correctly structure spaced study blocks!");
        }
        console.log("✅ Calendar Intelligence test passed.");

        // ========================================
        // TEST 2: Executive Function (Task Slippage)
        // ========================================
        console.log("\n2. Testing Executive Function Engine (ADHD Slippage Re-anchoring)...");
        
        // Add a task yesterday (incomplete)
        const slippedTaskId = 'test_slipped_123';
        const deviceId = mainDb.getDeviceId();
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
            VALUES (?, 'Test Slipped Task', ?, 'study', 0, '10:00', 60, ?, ?, 0, 0)
        `).run(slippedTaskId, yesterday, Date.now(), deviceId);

        const slippageResult = executiveFunction.getSlippedTasks(today);
        console.log(`Slipped Check: hasSlipped=${slippageResult.hasSlipped}, taskCount=${slippageResult.slippedTasks.length}`);
        
        if (!slippageResult.hasSlipped || slippageResult.slippedTasks.length === 0) {
            throw new Error("Executive Function failed to detect overdue task!");
        }

        const moveAction = slippageResult.proposal.actions.find(a => a.taskId === slippedTaskId && a.type === 'move');
        if (!moveAction || moveAction.newDate !== today) {
            throw new Error("Executive Function failed to generate correct move proposal!");
        }
        console.log("✅ Executive Function test passed.");

        // ========================================
        // TEST 3: Intent Engine & Overwhelm Proposals
        // ========================================
        console.log("\n3. Testing Intent Engine (Semantic Stress Interception)...");
        
        // Add an active task today to trigger move/shrink on stress
        const activeTaskId = 'test_active_123';
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
            VALUES (?, 'Test DSA Homework', ?, 'work', 0, '14:00', 120, ?, ?, 0, 0)
        `).run(activeTaskId, today, Date.now(), deviceId);

        const intentResult = intentEngine.parseIntent("I am so stressed and exhausted right now", today);
        console.log("Intent Result detected:", intentResult.hasProposal);
        
        if (!intentResult.hasProposal || intentResult.proposal.type !== 'overwhelm_restructure') {
            throw new Error("Intent Engine failed to detect stress overwhelm!");
        }

        const shrinkAction = intentResult.proposal.actions.find(a => a.taskId === activeTaskId && a.type === 'shrink');
        const restAction = intentResult.proposal.actions.find(a => a.type === 'add' && a.text === 'Protected Rest & Recovery');

        if (!shrinkAction || shrinkAction.newDuration !== 60 || !restAction) {
            throw new Error("Intent Engine generated incorrect overwhelm actions!");
        }
        console.log("✅ Intent Engine overwhelm test passed.");

        // ========================================
        // TEST 4: Reflection Engine (Daily timeline summary)
        // ========================================
        console.log("\n4. Testing Reflection Engine (Daily timeline synthesis)...");
        
        // Complete one task
        db.prepare("UPDATE tasks SET completed = 1 WHERE id = ?").run(slippedTaskId);
        
        // Save chat in local history
        db.prepare(`
            INSERT INTO memory_chat (id, user_input, ai_response, timestamp, updated_at, device_id, synced)
            VALUES (?, 'Test Input Hello', 'Test AI response', ?, ?, ?, 0)
        `).run('test_chat_123', Date.now(), Date.now(), deviceId);

        const userId = 'test_user_uuid';
        const reflection = reflectionEngine.generateDailyReflection(userId, today);
        
        console.log("Synthesized Narrative:", reflection.narrative);
        console.log("Timeline nodes count:", reflection.timeline.length);
        
        if (reflection.timeline.length < 2 || !reflection.timeline.some(n => n.type === 'chat')) {
            throw new Error("Reflection timeline was not generated correctly!");
        }

        // Get daily reflections
        const reflectionsList = reflectionEngine.getDailyReflections(userId);
        if (reflectionsList.length === 0 || reflectionsList[0].narrative !== reflection.narrative) {
            throw new Error("Reflection Engine failed to retrieve daily summary!");
        }
        console.log("✅ Reflection Engine test passed.");

        // ========================================
        // TEST 5: Conflict Arbitration Assertions
        // ========================================
        console.log("\n5. Testing Conflict Arbitration (Stress Overrides Study/Slippage)...");

        // Set up overwhelm and slipped proposals
        const mockOverwhelmProposal = {
            hasProposal: true,
            proposal: {
                type: 'overwhelm_restructure',
                confidence: 0.95,
                reason: 'Stress keyword test',
                explanation: 'Overwhelm proposal takes precedence',
                actions: [{ type: 'add', text: 'Protected Rest & Recovery', date: today, calendar: 'focus', duration_min: 90 }]
            }
        };

        const mockSlippedProposal = {
            hasSlipped: true,
            proposal: {
                type: 'slippage_reschedule',
                confidence: 0.85,
                reason: 'Slipped task rescheduling',
                explanation: 'Move slipped task forward',
                actions: [{ type: 'move', taskId: 'test_slipped_123', newDate: today }]
            }
        };

        // Assert that Overwhelm overrides Slipped rescheduling
        const arbitratedStress = orchestrator.arbitrateProposals(mockOverwhelmProposal, mockSlippedProposal, today);
        console.log("Arbitration outcome (Stress active):", arbitratedStress.type);
        if (arbitratedStress.type !== 'overwhelm_restructure') {
            throw new Error("Conflict resolver did not prioritize overwhelm restructure over slipped rescheduling!");
        }

        // Set up study proposal + slipped proposal colliding (total > 4 hours)
        const mockStudyProposal = {
            hasProposal: true,
            proposal: {
                type: 'spaced_study_planning',
                confidence: 0.90,
                reason: 'Study request',
                explanation: 'Revision blocks',
                actions: [{ type: 'add', text: 'Study DSA', date: today, calendar: 'study', duration_min: 200 }] // 3.3 hours
            }
        };

        const arbitratedWorkload = orchestrator.arbitrateProposals(mockStudyProposal, mockSlippedProposal, today);
        console.log("Arbitration outcome (High workload):", arbitratedWorkload.type);
        if (arbitratedWorkload.type !== 'coordinated_planning' || arbitratedWorkload.confidence !== 0.90) {
            throw new Error("Conflict resolver did not correctly coordinate high study + slippage workload!");
        }

        const slippedMoveAction = arbitratedWorkload.actions.find(a => a.taskId === 'test_slipped_123');
        const expectedTomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0];
        console.log("Slipped task deferred to date:", slippedMoveAction.newDate);
        if (slippedMoveAction.newDate !== expectedTomorrow) {
            throw new Error("Conflict resolver failed to defer slipped tasks to tomorrow under high study density!");
        }
        console.log("✅ Conflict Arbitration tests passed.");

        // ========================================
        // TEST 6: Batch Undo Reversibility Assertions
        // ========================================
        console.log("\n6. Testing Batch Undo Reversibility...");

        // Insert a dummy task to shrink
        const undoTaskId = 'test_undo_task_123';
        db.prepare(`
            INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
            VALUES (?, 'Undo Target Study Block', ?, 'study', 0, '15:00', 120, ?, ?, 0, 0)
        `).run(undoTaskId, today, Date.now(), deviceId);

        // Perform proposal actions: shrink the target, and add a new rest block
        const testActions = [
            {
                type: 'shrink',
                taskId: undoTaskId,
                newDuration: 60
            },
            {
                type: 'add',
                id: 'undo_added_task_123',
                text: 'Protected Study Rest Buffer',
                date: today,
                calendar: 'focus',
                start_time: '17:00',
                duration_min: 30
            }
        ];

        // Apply proposals transactionally
        const applyResult = orchestrator.applyIntentProposals(testActions);
        console.log(`Applied adjustments, group ID: ${applyResult.actionId}`);
        if (!applyResult.success || !applyResult.actionId) {
            throw new Error("Failed to apply intent proposals transactionally!");
        }

        // Verify task state is updated in DB
        const shrunkTask = db.prepare("SELECT duration_min FROM tasks WHERE id = ?").get(undoTaskId);
        const addedTask = db.prepare("SELECT * FROM tasks WHERE id = 'undo_added_task_123'").get();
        const actionRow = db.prepare("SELECT applied FROM cognitive_actions WHERE id = ?").get(applyResult.actionId);

        if (shrunkTask.duration_min !== 60 || !addedTask || actionRow.applied !== 1) {
            throw new Error("State after applying proposals is incorrect in database!");
        }

        // Execute batch undo
        const undoResult = orchestrator.undoCognitiveAction(applyResult.actionId);
        console.log(`Undone adjustments, group ID: ${undoResult.actionId}`);
        if (!undoResult.success) {
            throw new Error("Undo transaction failed to execute!");
        }

        // Assert database rollback
        const restoredTask = db.prepare("SELECT duration_min FROM tasks WHERE id = ?").get(undoTaskId);
        const deletedAddedTask = db.prepare("SELECT * FROM tasks WHERE id = 'undo_added_task_123'").get();
        const undoneActionRow = db.prepare("SELECT applied FROM cognitive_actions WHERE id = ?").get(applyResult.actionId);

        console.log(`Restored duration: ${restoredTask ? restoredTask.duration_min : 'null'}`);
        console.log(`Added task exists post-undo: ${!!deletedAddedTask}`);
        console.log(`Cognitive Action Applied flag: ${undoneActionRow.applied}`);

        if (restoredTask.duration_min !== 120 || deletedAddedTask || undoneActionRow.applied !== 0) {
            throw new Error("Batch undo failed to fully restore tasks to original state!");
        }
        console.log("✅ Batch Undo Reversibility test passed.");

        // ========================================
        // TEST 7: Coordinated Team Response (Dialogue Arbiter) Assertions
        // ========================================
        console.log("\n7. Testing Coordinated Team Response (Dialogue Arbiter)...");

        const compoundQuery = "I am extremely stressed and exhausted and I also need to study for my dsa exam today";
        const queryResult = await multiAgent.processAgentQuery(compoundQuery, { displayName: 'Alena' });

        console.log("Coordinated Agent:", queryResult.agent);
        console.log("Coordinated Tone:", queryResult.tone);
        console.log("Coordinated Response Preview:", queryResult.response.substring(0, 150) + "...");

        if (queryResult.agent !== 'Multi-Agent Team') {
            throw new Error("Multi-agent system did not trigger collaborative team coordination for compound stress + study query!");
        }

        if (!queryResult.response.includes("compromise") || !queryResult.response.includes("Focus Guardian") || !queryResult.response.includes("Study Coach")) {
            throw new Error("Collaborative Team response does not contain an arbitrated compromise statement!");
        }
        console.log("✅ Coordinated Team Response (Dialogue Arbiter) test passed.");

        console.log("\n🌟 ALL COGNITIVE ACTION ENGINE TESTS PASSED! 🌟");
        process.exit(0);

    } catch (e) {
        console.error("\n❌ Cognitive Action Test suite failed:", e.message || e);
        process.exit(1);
    }
}

runTests();
