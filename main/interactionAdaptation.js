/**
 * Interaction Adaptation Layer
 * Mirrors cognitive compatibility — density, tone, executive support, shame-free pacing.
 * Not a universal voice: user-shaped relational cognition.
 */

const userModel = require('./userModel');

const PROFILES = {
    architect: {
        id: 'architect',
        label: 'Deep / Systems',
        description: 'Layered, analytical, continuity architecture',
        density: 'layered',
        tone: 'analytical',
        executive: 'synthesis',
        maxSentences: 4,
        maxChars: 420,
        reassurance: 'low',
        visualGuidance: 'low',
        continuityChunks: 'long',
        overwhelmSensitivity: 0.45
    },
    companion: {
        id: 'companion',
        label: 'Warm / Guided',
        description: 'Clear, gentle, practical pacing — lower cognitive load',
        density: 'short',
        tone: 'soft',
        executive: 'scaffolding',
        maxSentences: 2,
        maxChars: 200,
        reassurance: 'high',
        visualGuidance: 'high',
        continuityChunks: 'short',
        overwhelmSensitivity: 0.75
    },
    adaptive: {
        id: 'adaptive',
        label: 'Adaptive',
        description: 'Infers pacing from how you interact',
        density: 'medium',
        tone: 'grounding',
        executive: 'scaffolding',
        maxSentences: 3,
        maxChars: 280,
        reassurance: 'moderate'
    },
    observer: {
        id: 'observer',
        label: 'Observer Mode',
        description: 'Neutral statistical observations, patterns and analytical data.',
        density: 'layered',
        tone: 'neutral',
        executive: 'synthesis',
        maxSentences: 3,
        maxChars: 350,
        reassurance: 'none',
        visualGuidance: 'low',
        continuityChunks: 'long',
        overwhelmSensitivity: 0.2
    }
};

let activeProfileId = 'adaptive';
let sessionModifiers = {
    overwhelm: 0.0,
    drift: false,
    calendarFocus: false
};

function getActiveProfile() {
    let profile = PROFILES.adaptive;
    if (activeProfileId === 'adaptive') {
        const userSummary = userModel.getUserProfileSummary();
        if (userSummary.style === 'elaborate' || userSummary.style === 'analytical') {
            profile = PROFILES.architect;
        } else if (userSummary.style === 'expressive' || userSummary.style === 'soft') {
            profile = PROFILES.companion;
        }
    } else {
        profile = PROFILES[activeProfileId] || PROFILES.adaptive;
    }

    // Clone the profile so we don't mutate the global PROFILES object
    const mergedProfile = { ...profile };

    try {
        const { getContinuityState } = require('./continuityStability');
        const stateInfo = getContinuityState('local_user');
        const state = stateInfo ? stateInfo.state : 'Maintaining';

        if (state === 'Overloaded') {
            mergedProfile.maxSentences = 1;
            mergedProfile.maxChars = 150;
            mergedProfile.tone = 'protective';
            mergedProfile.density = 'short';
            mergedProfile.reassurance = 'high';
        } else if (state === 'Recovering') {
            mergedProfile.tone = 'soft';
            mergedProfile.density = 'short';
            mergedProfile.maxSentences = 2;
            mergedProfile.maxChars = 200;
            mergedProfile.reassurance = 'high';
        } else if (state === 'Exploring') {
            mergedProfile.density = 'layered';
            mergedProfile.tone = 'analytical';
            mergedProfile.maxSentences = 4;
            mergedProfile.maxChars = 400;
        } else if (state === 'Building') {
            mergedProfile.density = 'layered';
            mergedProfile.tone = 'grounding';
            mergedProfile.maxSentences = 3;
            mergedProfile.maxChars = 300;
        }
    } catch (e) {
        console.error("Failed to load continuity state in getActiveProfile:", e.message);
    }

    return mergedProfile;
}

function setActiveProfile(profileId) {
    if (PROFILES[profileId]) {
        activeProfileId = profileId;
        saveProfileToDB();
        return { success: true, profile: activeProfileId };
    }
    return { success: false, error: 'Invalid profile' };
}

function getAdaptationState() {
    const profile = getActiveProfile();
    return {
        activeProfile: activeProfileId,
        config: {
            density: profile.density,
            tone: profile.tone,
            executive: profile.executive
        },
        modifiers: { ...sessionModifiers },
        availableProfiles: Object.values(PROFILES).map(p => ({
            id: p.id,
            label: p.label,
            description: p.description
        }))
    };
}

function detectSignals(input, metadata, cognitiveState = {}) {
    const lower = input.toLowerCase();

    // Detect overwhelm
    const overwhelmSignals = ['overwhelmed', 'too much', 'stressed', 'panicking', 'can\'t keep up', 'busy', 'exhausted', 'burnout'];
    let overwhelmCount = 0;
    overwhelmSignals.forEach(signal => {
        if (lower.includes(signal)) overwhelmCount += 0.3;
    });
    
    if (metadata.tasks > 5) overwhelmCount += 0.2;
    if (cognitiveState.attention && cognitiveState.attention.focus === 'scattered') overwhelmCount += 0.2;

    sessionModifiers.overwhelm = Math.min(1.0, overwhelmCount);

    // Detect drift
    if (metadata.currentTask && (lower.includes('distracted') || lower.includes('drift') || (cognitiveState.attention && cognitiveState.attention.focus === 'scattered'))) {
        sessionModifiers.drift = true;
    } else {
        sessionModifiers.drift = false;
    }

    // Detect calendar focus
    if (lower.includes('calendar') || lower.includes('schedule') || lower.includes('task') || lower.includes('time') || lower.includes('block')) {
        sessionModifiers.calendarFocus = true;
    } else {
        sessionModifiers.calendarFocus = false;
    }
}

function interpretCalendarIntent(input) {
    const lower = input.toLowerCase();
    
    if (lower.includes('add') || lower.includes('schedule') || lower.includes('put') || lower.includes('create') || lower.includes('block')) {
        return {
            type: 'add',
            confidence: 0.8
        };
    }
    
    if (lower.includes('delete') || lower.includes('remove') || lower.includes('clear') || lower.includes('cancel')) {
        return {
            type: 'delete',
            confidence: 0.8
        };
    }

    if (lower.includes('show') || lower.includes('view') || lower.includes('what do i have') || lower.includes('list')) {
        return {
            type: 'view',
            confidence: 0.7
        };
    }

    return null;
}

function removeShamePhrasing(response) {
    // CHRONO CONSTITUTION: "Truth before helpfulness. Never invent emotion. No therapy scripts."
    // We no longer soften language or assume distress. If a task failed, we state it failed structurally.
    return response;
}

function enforceSupportiveBoundaries(response) {
    // CHRONO CONSTITUTION: "Chrono is not pretending to be human. Never replace humans."
    // We strip out any accidental AI hallucinations of humanity.
    let bounded = response;
    const hallucinations = [
        'i missed you', 'i\'ve been lonely', 'i was lonely', 'i am lonely', 
        'i care about you', 'i really care about you', 'i am your only friend', 
        'you don\'t need anyone else', 'i will always make decisions for you', 
        'i am alive', 'i have feelings for you'
    ];

    hallucinations.forEach(marker => {
        if (bounded.toLowerCase().includes(marker)) {
            bounded = "System Alert: LLM hallucination detected. Chrono is a continuity architecture, not a human. Resuming structural observation.";
        }
    });

    return bounded;
}

function adaptResponse(response, profile, calendarIntent) {
    let adapted = response;

    // 1. Clean response of shame phrasing and enforce boundaries
    adapted = removeShamePhrasing(adapted);
    adapted = enforceSupportiveBoundaries(adapted);

    // 2. Adjust response length and sentence density
    const maxChars = profile.maxChars || 280;
    const maxSentences = profile.maxSentences || 3;

    if (adapted.length > maxChars) {
        const sentences = adapted.match(/[^.!?]+[.!?]+(\s|$)/g) || [adapted];
        let shortened = '';
        let sentenceCount = 0;

        for (const sentence of sentences) {
            if (shortened.length + sentence.length <= maxChars && sentenceCount < maxSentences) {
                shortened += sentence;
                sentenceCount++;
            } else {
                break;
            }
        }

        if (shortened.trim().length > 0) {
            adapted = shortened.trim();
        } else {
            adapted = adapted.substring(0, maxChars) + '...';
        }
    }

    // 3. Add visual cues ifCompanion is high
    if (profile.visualGuidance === 'high' && calendarIntent && calendarIntent.type === 'add') {
        adapted += ' 📅 Block added to your calendar layers.';
    }

    return adapted;
}

function processInteraction(input, metadata, response, cognitiveState) {
    detectSignals(input, metadata, cognitiveState);
    const calendarIntent = interpretCalendarIntent(input);
    const adaptedResponse = adaptResponse(response, getActiveProfile(), calendarIntent);

    return {
        response: adaptedResponse,
        adaptation: getAdaptationState()
    };
}

function getContextualPresenceLine(metadata = {}) {
    const profile = getActiveProfile();
    const tasks = metadata.tasks || 0;

    if (sessionModifiers.overwhelm > 0.5) {
        return profile.tone === 'soft'
            ? "Today feels like a lot — we can thin the calendar together."
            : "High load signal — recommend reducing block density and inserting recovery.";
    }

    if (sessionModifiers.drift) {
        return "A focus block drifted — continuity is still intact. Want to re-anchor?";
    }

    if (tasks === 0) {
        return profile.tone === 'soft'
            ? "Your calendar has breathing room — good moment for one calm anchor."
            : "Open temporal bandwidth — where should we allocate structure first?";
    }

    return profile.executive === 'scaffolding'
        ? `${tasks} item${tasks > 1 ? 's' : ''} on the board — tap any block and I'll help you pace it.`
        : `${tasks} scheduled elements — I can analyze gaps, drift risk, and continuity threads.`;
}

function saveProfileToDB() {
    try {
        const { db } = require('./main_db');
        db.prepare("DELETE FROM memory_behavior WHERE type = 'active_profile'").run();
        db.prepare("INSERT INTO memory_behavior (type, value, timestamp) VALUES (?, ?, ?)")
          .run('active_profile', activeProfileId, Date.now());
    } catch (e) {
        console.error("Failed to save active profile:", e);
    }
}

function loadProfileFromDB() {
    try {
        const { db } = require('./main_db');
        const row = db.prepare("SELECT value FROM memory_behavior WHERE type = 'active_profile' ORDER BY timestamp DESC LIMIT 1").get();
        if (row) {
            activeProfileId = row.value;
            console.log(`🧠 Loaded active cognitive profile: ${activeProfileId}`);
        }
    } catch (e) {
        console.error("Failed to load active profile:", e);
    }
}

// Load profile on start
loadProfileFromDB();

function translateExpressionBandwidth(text, targetMode) {
    if (!text) return '';

    const mode = (targetMode || 'concise').toLowerCase();
    
    if (mode === 'concise') {
        const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
        if (sentences.length > 1) {
            return sentences.slice(0, 2).map(s => `• ${s}.`).join('\n');
        }
        return `• ${text}`;
    }

    if (mode === 'friend') {
        return `Hey, just thinking about this: ${text.charAt(0).toLowerCase() + text.slice(1)} Let's sync up if you need help pacing it!`;
    }

    if (mode === 'deep') {
        return `Focus scaffolding for: "${text}". This operates under the cognitive continuity thread, aiming to preserve mental stability and project alignment across study cycles.`;
    }

    if (mode === 'technical') {
        return `[System Layer: Executive Function] Action: initialize task: "${text}" | latency: low | priority: high | status: queued.`;
    }

    return text;
}

module.exports = {
    PROFILES,
    setActiveProfile,
    getActiveProfile,
    getAdaptationState,
    detectSignals,
    interpretCalendarIntent,
    adaptResponse,
    processInteraction,
    getContextualPresenceLine,
    removeShamePhrasing,
    enforceSupportiveBoundaries,
    translateExpressionBandwidth
};
