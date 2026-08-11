/**
 * 🧠 CHRONO COGNITIVE OS - REASONING ENGINE
 * 
 * Takes the Executive Decision payload and synthesized state,
 * and calls the LLM (OpenAI/Anthropic/Local) to generate the final structural response.
 * It strictly adheres to the invariants (no state mutation, obeys executive directives).
 */

class ReasoningEngine {
    constructor(apiConfig = {}) {
        this.apiKey = apiConfig.apiKey || process.env.OPENAI_API_KEY || null;
        this.model = apiConfig.model || 'gpt-4o';
    }

    /**
     * Synthesizes the natural language response using the LLM.
     * @param {string} userInput - The original user query.
     * @param {Object} pipelineResult - The payload from the ExecutiveLayer pipeline.
     */
    async synthesizeResponse(userInput, pipelineResult) {
        // Detect emotional vocabulary in user input — label, not behavioral prescription
        const emotionVocabulary = require('./emotionVocabulary');
        const emotionContext = emotionVocabulary.summarize(userInput);

        const systemPrompt = `
You are Chrono, a Cognitive OS. You are an external reasoning environment, not a conversational chatbot.

${pipelineResult.contextSummary}
${emotionContext ? `\n${emotionContext}\n(NOTE: Recognize this emotional dimension. Do NOT switch interaction modes or apply prescribed responses. Use it to modulate tone only where contextually natural.)` : ''}

CRITICAL RULES:
1. State facts from retrieved data.
2. Clearly label inferences (e.g., "I assume...", "It is likely that...").
3. Clearly label uncertainty.
4. Never invent missing information.
5. Be direct, calm, objective, and truthful. ABSOLUTELY NO FAKE EMPATHY OR THERAPY-BOT BEHAVIOR. 
6. Output only the final natural language response to the user.
        `.trim();

        // ------------------------------------------------------------------
        // STUB IMPLEMENTATION
        // ------------------------------------------------------------------
        
        console.log(`[ReasoningEngine] System Prompt Prepared:\n${systemPrompt}\n`);
        
        if (!this.apiKey) {
            return this._generateStubResponse(userInput, pipelineResult);
        }

        // Real API Call (Mocked for safety if no key)
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            return this._generateStubResponse(userInput, pipelineResult);
        } catch (error) {
            return `System Error: Reasoning Engine failed to contact LLM provider. (${error.message})`;
        }
    }

    _generateStubResponse(userInput, pipelineResult) {
        if (pipelineResult.executiveDirective.includes('hallucinate')) {
            return "I don't have enough information in my current state to answer that.";
        }
        if (pipelineResult.executiveDirective.includes('Contradiction')) {
            return `I found conflicting information regarding your request. ${pipelineResult.contradictions.map(c => c.description).join(' ')}`;
        }
        if (pipelineResult.recommendations && pipelineResult.recommendations.length > 0) {
            return `Based on the retrieved state, here is a recommendation: ${pipelineResult.recommendations[0].reason}. Would you like to proceed with: ${pipelineResult.recommendations[0].alternatives.join(' or ')}?`;
        }
        
        const stateKeys = Object.keys(pipelineResult.retrievedState).filter(k => k !== '_systemHealth');
        return `Based on the retrieved ${stateKeys.join(' and ')}, I have processed your request to ${pipelineResult.intents[0].toLowerCase()}.`;
    }
}

module.exports = { ReasoningEngine };
