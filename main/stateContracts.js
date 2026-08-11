/**
 * 🧠 CHRONO COGNITIVE OS - STATE CONTRACTS
 * 
 * Defines the strict operating semantics for the Cognitive OS.
 * State is a living representation of reality. It has lifecycles, authorities, and freshness.
 */

const mainDb = require('./main_db');

const LifecycleStatus = {
    CREATED: 'Created',
    ACTIVE: 'Active',
    UPDATED: 'Updated',
    STALE: 'Stale',
    ARCHIVED: 'Archived',
    DELETED: 'Deleted'
};

const Authority = {
    OFFICIAL: 'Official',           // e.g. from Google Calendar API
    USER: 'User',                   // Explicit user statement ("I cancelled it")
    INFERENCE: 'Inference',         // Deduced by Chrono
    SENSOR: 'Sensor',               // e.g. GPS, HealthKit
    IMPORTED: 'Imported',           // Bulk import
    EXTERNAL_API: 'External API'    // Third party
};

const DependencyType = {
    DEPENDS_ON: 'depends_on',
    DERIVED_FROM: 'derived_from',
    BLOCKS: 'blocks',
    REFERENCES: 'references',
    SUPERSEDES: 'supersedes',
    CAUSED_BY: 'caused_by',
    CREATED_FROM: 'created_from'
};

const FreshnessState = {
    FRESH: 'Fresh',
    DEGRADED: 'Degraded',
    STALE: 'Stale',
    UNKNOWN: 'Unknown'
};

const EventSeverity = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical'
};

const ExecutionMode = {
    OBSERVE: 'Observe',
    UNDERSTAND: 'Understand',
    REASON: 'Reason',
    SIMULATE: 'Simulate',
    RECOMMEND: 'Recommend',
    ACT: 'Act'
};

/**
 * Helper to build a StateEnvelope compliant object.
 * (Acts as a structural contract enforcer in JavaScript).
 */
function buildStateEnvelope({
    value,
    lifecycle = LifecycleStatus.ACTIVE,
    authority = Authority.INFERENCE,
    source = 'System',
    dependencies = [],
    metadata = {}
}) {
    // A State Envelope structurally separates Reality, State, and Belief.
    return {
        _isStateEnvelope: true,
        version: 1,
        id: mainDb.generateUUID(),
        value,
        lifecycle,
        updatedAt: Date.now(),
        authority,
        source,
        needsRevalidation: false,
        dependencies, // Array of { type: DependencyType, targetId: string }
        metadata
    };
}

/**
 * Helper to build a CognitiveEvent.
 * Not owned by the Calendar—used globally for Reminders, Tasks, Habits, Deadlines, etc.
 */
function buildCognitiveEvent({
    title,
    type, // e.g. Meeting, Deadline, Habit
    intent = {}, // { objective, importance, outcome, failureCost, recovery }
    participants = [],
    location = null,
    temporalConstraints = {}, // { earliest, latest, fixed: boolean, flexible: boolean, uncertainty: string }
    dependencies = [],
    preparation = [],
    followUp = [],
    linkedGoals = [],
    linkedProjects = [],
    linkedFiles = []
}) {
    return {
        _isCognitiveEvent: true,
        id: mainDb.generateUUID(),
        title,
        type,
        intent,
        participants,
        location,
        temporalConstraints,
        dependencies,
        preparation,
        followUp,
        linkedGoals,
        linkedProjects,
        linkedFiles
    };
}

module.exports = {
    LifecycleStatus,
    Authority,
    DependencyType,
    FreshnessState,
    EventSeverity,
    ExecutionMode,
    buildStateEnvelope,
    buildCognitiveEvent
};
