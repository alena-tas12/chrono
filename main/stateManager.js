/**
 * 🧠 CHRONO COGNITIVE OS - STATE MANAGER (Schema v1)
 * 
 * Owns freshness, updates, invalidation, synchronization, caching, and provenance.
 * Dispatch never edits the state; it only asks questions of it.
 */

const { EventBus } = require('./eventBus');
const { 
    LifecycleStatus, 
    Authority, 
    DependencyType, 
    FreshnessState, 
    buildStateEnvelope 
} = require('./stateContracts');
const { CalendarModule } = require('./calendarModule');

/**
 * StateTransaction encapsulates a set of state mutations.
 * Allows validation and atomic commit with event emission.
 */
class StateTransaction {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.mutations = [];
        this.eventsToEmit = [];
    }

    // Propose a change. Target is a callback or reference to update logic.
    propose(target, payload, eventName) {
        this.mutations.push({ target, payload });
        if (eventName) {
            this.eventsToEmit.push({ name: eventName, payload });
        }
    }

    validate() {
        // Evaluate dependencies and cascading revalidations
        // (In a complete implementation, this checks for locked states or conflict resolution)
        return true; 
    }

    commit() {
        if (!this.validate()) throw new Error("Transaction Validation Failed");
        
        // Execute mutations
        for (const mut of this.mutations) {
            mut.target(mut.payload);
        }
        
        // Emit events
        for (const evt of this.eventsToEmit) {
            EventBus.emit(evt.name, evt.payload);
        }
    }
}

class SystemHealth {
    constructor() {
        this.status = {
            stateManager: 'Healthy',
            dispatch: 'Healthy',
            memoryGraph: 'Healthy',
            calendarSync: 'Healthy',
            llm: 'Unavailable'
        };
    }
    
    getOverallHealth() {
        return Object.values(this.status).some(s => s !== 'Healthy') ? 'Degraded' : 'Healthy';
    }
}

class StateManager {
    constructor() {
        this.worldState = new WorldState();
        this.userState = new UserState();
        this.sessionState = new SessionState();
        this.knowledgeBase = new KnowledgeBase();
        this.memoryGraph = new MemoryGraph();
        this.goalSubsystem = new GoalSubsystem();
        this.taskSubsystem = new TaskSubsystem();
        this.health = new SystemHealth();
        
        // Listen to EventBus for updates
        EventBus.on('calendar_updated', this.handleCalendarUpdate.bind(this));
        EventBus.on('sleep_imported', this.handleSleepUpdate.bind(this));
    }

    beginTransaction() {
        return new StateTransaction(this);
    }

    handleCalendarUpdate(event) {
        const tx = this.beginTransaction();
        tx.propose(
            (payload) => this.worldState.updateCalendar(payload),
            event.payload,
            'state_calendar_committed'
        );
        // Calendar changing might require Goal revalidation
        tx.propose(
            () => this.goalSubsystem.flagNeedsRevalidation(),
            null,
            null
        );
        tx.commit();
    }

    handleSleepUpdate(event) {
        const tx = this.beginTransaction();
        tx.propose(
            (payload) => this.userState.updateSleep(payload),
            event.payload,
            'state_sleep_committed'
        );
        tx.commit();
    }

    // Dispatch calls this to retrieve read-only state chunks
    queryState(modules, parameters) {
        let compiledState = {};
        
        // Expose system health implicitly to Dispatch
        compiledState._systemHealth = this.health.status;

        if (modules.includes('Calendar')) {
            compiledState.calendar = this.worldState.getCalendar(parameters);
        }
        if (modules.includes('Sleep')) {
            compiledState.sleep = this.userState.getSleep();
        }
        if (modules.includes('Health')) {
            compiledState.health = this.userState.getHealth();
        }
        if (modules.includes('Projects')) {
            compiledState.projects = this.memoryGraph.queryNodes('Project', parameters);
        }
        if (modules.includes('Memory')) {
            compiledState.memory = this.memoryGraph.queryNodes('Memory', parameters);
        }
        if (modules.includes('KnowledgeBase')) {
            compiledState.knowledge = this.knowledgeBase.queryFacts(parameters);
        }
        if (modules.includes('Tasks')) {
            compiledState.tasks = this.taskSubsystem.getPendingTasks();
        }

        return compiledState;
    }
}

class WorldState {
    constructor() {
        this.calendarEvents = []; // Array of StateEnvelopes wrapping CognitiveEvents
        this.calendarModule = new CalendarModule();
    }
    
    updateCalendar(events) {
        const cognitiveEvents = this.calendarModule.processEvents(events);

        this.calendarEvents = cognitiveEvents.map(e => buildStateEnvelope({
            value: e,
            lifecycle: LifecycleStatus.ACTIVE,
            freshnessPolicy: 'hourly',
            authority: Authority.OFFICIAL,
            confidence: 1.0,
            observations: [{
                timestamp: Date.now(),
                value: 'Sync',
                source: 'calendar_sync',
                reason: 'Background Calendar Sync'
            }]
        }));
    }

    getCalendar(parameters) {
        // Enforce freshness rules dynamically at read-time
        return this.calendarEvents.map(evt => {
            // E.g., if older than 1 hour, flag as stale
            if (Date.now() - evt.observations[evt.observations.length - 1].timestamp > 3600000) {
                evt.freshness.state = FreshnessState.STALE;
            }
            return evt;
        });
    }
}

class UserState {
    constructor() {
        this.sleepData = null;
        this.energyEstimate = 'Unknown';
    }

    updateSleep(data) {
        this.sleepData = buildStateEnvelope({
            value: data,
            lifecycle: LifecycleStatus.ACTIVE,
            freshnessPolicy: 'daily',
            authority: Authority.SENSOR,
            confidence: 0.95,
            observations: [{
                timestamp: Date.now(),
                value: data.hours,
                source: 'health_import',
                reason: 'Device Sync'
            }]
        });
        
        // Interpretation separated from fact (Belief vs State):
        this.energyEstimate = buildStateEnvelope({
            value: data.hours < 5 ? 'Low' : 'Optimal',
            authority: Authority.INFERENCE,
            confidence: 0.8,
            dependencies: [{ type: DependencyType.DERIVED_FROM, targetId: this.sleepData.id }]
        });
    }

    getSleep() {
        return this.sleepData;
    }

    getHealth() {
        return { energy: this.energyEstimate, security: 'Derived' };
    }
}

class SessionState {
    constructor() {
        this.currentTopic = null;
        this.history = [];
    }

    updateTopic(topic) {
        this.currentTopic = topic;
    }

    getTopic() {
        return this.currentTopic;
    }
}

// Explicit User-Authored Knowledge (Notes/Workspace)
class KnowledgeBase {
    constructor() {
        this.knowledgeRetrieval = require('./knowledgeRetrieval');
    }

    queryFacts(parameters) {
        try {
            const userInput = parameters.userInput || "";
            if (!userInput) return [];

            const retrievedBlocks = this.knowledgeRetrieval.retrieveExplicitKnowledge(userInput, 5);
            
            return retrievedBlocks.map(b => ({
                fact: `Note: ${b.note_title} | Block: ${b.block_content}`,
                provenance: { 
                    source: 'user_authored_note', 
                    noteId: b.note_id,
                    confidence: 1.0 
                },
                security: 'Private'
            }));
        } catch (e) {
            console.warn("KnowledgeBase query failed:", e.message);
            return [];
        }
    }
}

// User-Specific Continuity (e.g. "User visited Paris")
class MemoryGraph {
    constructor() {
        this.dbModule = require('./main_db');
    }

    queryNodes(type, parameters) {
        try {
            if (type === 'Project') {
                const projects = this.dbModule.db.prepare(`
                    SELECT title, description, status FROM projects 
                    WHERE status = 'active'
                `).all();
                
                return projects.map(p => ({
                    ...p,
                    provenance: { source: 'memory_graph', confidence: 1.0 },
                    security: 'Private'
                }));
            } 
            
            if (type === 'Memory') {
                const memories = this.dbModule.db.prepare(`
                    SELECT content, importance_score FROM cognitive_memories 
                    WHERE deleted = 0 AND memory_type != 'knowledge'
                    ORDER BY importance_score DESC, updated_at DESC LIMIT 20
                `).all();
                
                return memories.map(m => ({
                    content: m.content,
                    importance: m.importance_score,
                    provenance: { source: 'memory_graph', confidence: 0.90 },
                    security: 'Private'
                }));
            }
            
            return [];
        } catch (e) {
            console.warn("MemoryGraph query failed:", e.message);
            return [];
        }
    }
}

class GoalSubsystem {
    constructor() {
        this.dbModule = require('./main_db');
        this.needsRevalidation = false;
    }

    flagNeedsRevalidation() {
        this.needsRevalidation = true;
    }
    
    getGoals() {
        try {
            const goals = this.dbModule.db.prepare(`
                SELECT title, status FROM goals WHERE status = 'active'
            `).all();
            
            return goals.map(g => buildStateEnvelope({
                value: g,
                authority: Authority.USER,
                confidence: 0.9,
                needsRevalidation: this.needsRevalidation,
                dependencies: [] // Would link to project IDs
            }));
        } catch(e) {
            return [];
        }
    }
}

class TaskSubsystem {
    constructor() {
        this.dbModule = require('./main_db');
    }

    getPendingTasks() {
        try {
            // Get uncompleted tasks 
            const tasks = this.dbModule.db.prepare(`
                SELECT text, date, calendar FROM tasks 
                WHERE completed = 0 AND deleted = 0
                ORDER BY date ASC
                LIMIT 15
            `).all();
            
            return tasks.map(t => ({
                text: t.text,
                date: t.date,
                calendar: t.calendar,
                provenance: { source: 'task_db', confidence: 1.0 }
            }));
        } catch (e) {
            console.warn("TaskSubsystem query failed:", e.message);
            return [];
        }
    }
}

module.exports = {
    StateManager,
    WorldState,
    UserState,
    SessionState,
    KnowledgeBase,
    MemoryGraph,
    GoalSubsystem,
    TaskSubsystem,
    SystemHealth
};

