/**
 * 🧠 CHRONO COGNITIVE OS - CALENDAR MODULE (Phase 7)
 * 
 * Formal CognitiveModule for processing temporal events.
 * It does NOT own the CognitiveEvent definition (that lives in stateContracts).
 * It simply maps raw database events or API payloads into the standard CognitiveEvent format.
 */

const { buildCognitiveEvent } = require('./stateContracts');

class CalendarModule {
    constructor() {}

    /**
     * Parses a raw event (e.g. from Google Calendar sync) into a CognitiveEvent.
     */
    parseEvent(rawEvent) {
        // Derive intent and temporal constraints from the raw data.
        // For now, these are simulated heuristics.
        
        let type = 'Meeting';
        let objective = 'General collaboration';
        let failureCost = 'Low';
        let flexibility = true;
        let uncertainty = null;

        const lowerTitle = (rawEvent.title || rawEvent.summary || '').toLowerCase();

        if (lowerTitle.includes('lab') || lowerTitle.includes('class')) {
            type = 'Class';
            objective = 'Academic learning';
            failureCost = 'High';
            flexibility = false;
        } else if (lowerTitle.includes('lunch') || lowerTitle.includes('dinner')) {
            type = 'Social';
            objective = 'Relationship building';
            uncertainty = 'Around the scheduled time';
            flexibility = true;
        } else if (lowerTitle.includes('deadline')) {
            type = 'Deadline';
            failureCost = 'Critical';
            flexibility = false;
        }

        return buildCognitiveEvent({
            title: rawEvent.title || rawEvent.summary || 'Untitled Event',
            type,
            intent: {
                objective,
                importance: failureCost === 'Critical' || failureCost === 'High' ? 'High' : 'Medium',
                outcome: 'Complete scheduled block',
                failureCost,
                recovery: 'Reschedule or review notes'
            },
            participants: rawEvent.attendees || [],
            location: rawEvent.location || null,
            temporalConstraints: {
                earliest: rawEvent.start?.dateTime || rawEvent.start,
                latest: rawEvent.end?.dateTime || rawEvent.end,
                fixed: !flexibility,
                flexible: flexibility,
                uncertainty
            },
            dependencies: [], // Real system would map these to Goals/Projects
            preparation: [],
            followUp: []
        });
    }

    /**
     * Processes a batch of raw events.
     */
    processEvents(rawEvents) {
        if (!Array.isArray(rawEvents)) return [];
        return rawEvents.map(e => this.parseEvent(e));
    }
}

module.exports = { CalendarModule };
