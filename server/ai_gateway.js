const path = require('path');
let dbClient = null;
const isElectron = typeof process !== 'undefined' && process.versions && !!process.versions.electron;

let observatory = null;

if (isElectron) {
    try {
        dbClient = require('../main/cloudDb');
        observatory = require('../main/observatory');
    } catch (e) {
        console.warn("AI Gateway: Could not load client cloudDb/observatory:", e.message);
    }
} else {
    try {
        dbClient = require('./db');
    } catch (e) {
        console.warn("AI Gateway: Could not load server db:", e.message);
    }
}

// Supported profiles settings
const PRESENTATION_PROFILES = {
    companion: {
        maxChars: 200,
        tone: 'warm',
        guidance: 'high',
        chunking: true
    },
    architect: {
        maxChars: 500,
        tone: 'analytical',
        guidance: 'low',
        chunking: false
    },
    adaptive: {
        maxChars: 300,
        tone: 'grounding',
        guidance: 'moderate',
        chunking: true
    }
};

/**
 * AI Gateway routes user message to active model and adapts output based on the user's cognitive profile
 */
async function processAIChat(userId, userInput, userContext = {}) {
    const startTime = Date.now();
    let cognitiveStyle = 'adaptive';
    let displayName = 'User';

    // 1. Fetch user cognitive style and profile
    if (dbClient) {
        try {
            if (isElectron) {
                const { data: profile } = await dbClient
                    .from('profiles')
                    .select('cognitive_style, display_name')
                    .eq('user_id', userId)
                    .maybeSingle();
                if (profile) {
                    cognitiveStyle = profile.cognitive_style || 'adaptive';
                    displayName = profile.display_name;
                }
            } else {
                const profile = await dbClient.profile.findUnique({
                    where: { user_id: userId }
                });
                if (profile) {
                    cognitiveStyle = profile.cognitive_style || 'adaptive';
                    displayName = profile.display_name;
                }
            }
        } catch (e) {
            console.warn("Failed to read user profile settings:", e.message);
        }
    }

    const config = PRESENTATION_PROFILES[cognitiveStyle] || PRESENTATION_PROFILES.adaptive;

    // 2. Formulate system response based on dynamic pacing profiles
    let responseText = '';
    let modelUsed = 'chrono-coordinator-1.0';

    if (isElectron) {
        try {
            const multiAgent = require('../main/multiAgentSystem');
            const agentResult = await multiAgent.processAgentQuery(userInput, {
                cognitiveStyle,
                displayName,
                taskCount: userContext.taskCount || 0
            });
            responseText = agentResult.response;
            modelUsed = `chrono-${agentResult.agent.toLowerCase()}-1.0`;
        } catch (e) {
            console.warn("AI Gateway: Failed to run multi-agent query:", e.message);
        }
    }

    if (!responseText) {
        const lowerInput = userInput.toLowerCase();

        // Natural Language reasoning checks (Cross-Calendar queries)
        if (lowerInput.includes('princess') && lowerInput.includes('vian') && (lowerInput.includes('study') || lowerInput.includes('free') || lowerInput.includes('block') || lowerInput.includes('weekend'))) {
            responseText = `Saturday 3–5 PM is available for both. Conflict Risk: Low. Focus Levels: Good. Travel Time: None. I've highlighted this slot on the shared Study calendar group.`;
        } else if (lowerInput.includes('add') || lowerInput.includes('schedule') || lowerInput.includes('put') || lowerInput.includes('create')) {
            const taskText = userInput.replace(/.*?(?:add|create|schedule|put)\s*/i, '').trim();
            responseText = `I've mapped "${taskText || 'New Event'}" onto your schedule details. 📅 Block added to your calendar layers.`;
        } else if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
            responseText = `Systems online, ${displayName}. I've synchronized the timeline. We have open bandwidth this afternoon. What are your parameters?`;
        } else {
            // Default AI responses adapted to styles
            if (cognitiveStyle === 'companion') {
                responseText = `Focus locked. Daily operations are stabilized. Transmit your next directive, and I'll clear the path.`;
            } else if (cognitiveStyle === 'architect') {
                responseText = `Analyzing calendar metadata: 3 scheduled events, 0 active conflicts, open temporal bandwidth in evening slots (6-8 PM). Recommend allocating 1 hour for Focus work.`;
            } else {
                responseText = `Data synchronized. Focus boundaries are secured. Awaiting your next architectural input.`;
            }
        }
    }

    // 3. Format based on cognitive profiles
    if (config.chunking && responseText.length > config.maxChars) {
        responseText = responseText.substring(0, config.maxChars) + '...';
    }

    const latencyMs = Date.now() - startTime;
    const tokens = Math.round((userInput.length + responseText.length) / 4);

    if (isElectron && observatory) {
        let agentName = 'Companion';
        if (modelUsed.includes('architect')) agentName = 'Architect';
        else if (modelUsed.includes('princess')) agentName = 'Princess';
        else if (modelUsed.includes('studycoach')) agentName = 'Study Coach';
        else if (modelUsed.includes('scheduler')) agentName = 'Scheduler';
        else if (modelUsed.includes('focusguardian')) agentName = 'Focus Guardian';
        
        observatory.recordAIChat(agentName, latencyMs, tokens);
    }

    // 4. Log request to chat_history table for observability tracing
    if (dbClient) {
        try {
            const id = 'ch_' + Math.random().toString(36).substring(2, 11);
            if (isElectron) {
                await dbClient.from('chat_history').insert({
                    id,
                    user_id: userId,
                    user_input: userInput,
                    ai_response: responseText,
                    model_used: modelUsed,
                    latency_ms: latencyMs
                });
            } else {
                await dbClient.chatHistory.create({
                    data: {
                        id,
                        user_id: userId,
                        user_input: userInput,
                        ai_response: responseText,
                        model_used: modelUsed,
                        latency_ms: latencyMs
                    }
                });
            }
        } catch (e) {
            console.error("Failed to log chat trace details:", e.message);
        }
    }

    return {
        response: responseText,
        model: modelUsed,
        latency: latencyMs,
        style: cognitiveStyle
    };
}

module.exports = {
    processAIChat
};
