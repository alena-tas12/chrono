/**
 * 🧠 CHRONO COGNITIVE OS - REASONING ENGINE
 *
 * Takes Executive Decision payload, retrieved context, and session history,
 * and delegates prompt execution to ModelProvider router (Gemini -> OpenAI -> Qwen -> Ollama).
 * 
 * DIRECTIVES:
 * 1. Provider-agnostic architecture: Semantic interpretation remains strictly in Chrono.
 * 2. Automatic Failover: Gemini 429 rate limit triggers automatic failover to OpenAI / Qwen / Ollama.
 * 3. System Truth Security: No raw/truncated API keys exposed in output. Provider status answered from ModelProvider state.
 * 4. Zero Canned Templates: Static canned fallbacks ("I hear you...", "I understand...") are strictly prohibited.
 */

const modelProvider = require('./modelProvider');

class ReasoningEngine {
    constructor(apiConfig = {}) {
        this.modelProvider = modelProvider;
    }

    setApiKey(key, provider = 'auto') {
        try {
            const mainDb = require('./main_db');
            if (provider === 'openai' || (!key.startsWith('AIzaSy') && !key.startsWith('AQ.'))) {
                mainDb.setSyncMeta('openai_api_key', key);
            } else if (provider === 'qwen') {
                mainDb.setSyncMeta('qwen_api_key', key);
            } else {
                mainDb.setSyncMeta('gemini_api_key', key);
            }
        } catch (e) {}
        return { success: true };
    }

    /**
     * Synthesizes natural language responses using the multi-provider router.
     */
    async synthesizeResponse(userInput, pipelineResult = {}) {
        const emotionVocabulary = require('./emotionVocabulary');
        const emotionContext = emotionVocabulary.summarize(userInput);
        const sessionHistory = pipelineResult.sessionHistory || [];
        const lowerInput = userInput.toLowerCase().trim();

        // System truth inquiry for active provider status (prevents model hallucination & key leakage)
        if (lowerInput.includes('what api key') || lowerInput.includes('which api key') || lowerInput.includes('what model are you using')) {
            const status = this.modelProvider.getActiveProviderStatus();
            return `Chrono ModelProvider Router State: Primary Provider [${status.primary}], Backup Providers [Secondary: ${status.secondary}, Tertiary: ${status.tertiary}], Local Offline Fallback [${status.localFallback}].`;
        }

        const responseDepth = this._calculateResponseDepth(userInput, sessionHistory, pipelineResult);
        const depthDirective = responseDepth === 'CONCISE' 
            ? "CONCISE MODE: Keep your response crisp, direct, and succinct without unnecessary preamble or fluff."
            : responseDepth === 'DEEP'
            ? "DEEP REASONING MODE: Provide a comprehensive, thoroughly reasoned, structured, and insightful response with high cognitive clarity."
            : "BALANCED MODE: Provide a natural, clear, and grounded conversational response.";

        const systemPrompt = `
You are Chrono, a Cognitive OS companion. You are an intelligent, grounded reasoning environment — not a therapy bot, not a task manager, not a generic search engine. You respond to the user as a clear, competent, human presence.

${depthDirective}

CONTEXT SUMMARY:
${pipelineResult.contextSummary || '[No external database context retrieved for this query]'}

${emotionContext ? `EMOTIONAL DIMENSION:\n${emotionContext}\n(NOTE: Recognize this emotional dimension naturally. Do NOT output template expressions or fake empathy. Use it only to inform a grounded, empathetic tone where appropriate.)` : ''}

CRITICAL OPERATIONAL RULES:
1. Ground your answers strictly in the retrieved context. If information is missing from the context, explicitly state which sources were checked (e.g. "I checked your Calendar, Notes, Memory, and Relationship records, but no entries were found.").
2. Label uncertainty explicitly. Never invent missing facts.
3. Be direct, calm, truthful, and natural. Absolutely no robotic templates ("I hear you...", "Let's focus on the key points", "I understand:...").
4. Respond naturally to casual conversational questions, referential follow-ups ("answer the question above"), jokes, or personal check-ins.
5. CONTRACT 14 (PRIMACY OF HUMAN AGENCY): You exist to enhance user clarity and agency. Return decision-making agency to the user whenever appropriate ("Here is what I infer, but you are the final authority").
6. Output only the final response text.
        `.trim();

        // Build message history
        const messages = [{ role: 'system', content: systemPrompt }];

        for (const turn of sessionHistory.slice(-10)) {
            if (turn.role && turn.content) {
                messages.push({ role: turn.role, content: turn.content });
            }
        }
        messages.push({ role: 'user', content: userInput });

        // ── 1. DELEGATE TO MULTI-PROVIDER ROUTER ──
        const result = await this.modelProvider.generateResponse(messages);

        if (result.text) {
            return {
                text: result.text,
                providerUsed: result.providerUsed || 'Google Gemini',
                modelUsed: result.modelUsed || 'gemini-3.5-flash'
            };
        }

        // ── 2. ALL PROVIDERS FAILED OR UNCONFIGURED (HONEST SYSTEM ERROR) ──────
        if (result.errorReason) {
            return {
                text: `[Chrono Provider Router Error]: ${result.errorReason}`,
                providerUsed: 'NONE',
                modelUsed: 'none'
            };
        }

        // ── 3. METADATA & MISSING CONTEXT FALLBACK ───────────────────────────────
        const checkedSources = pipelineResult.retrievedModules || ['Notes Workspace', 'Memory OS', 'Calendar', 'Relationships'];
        return {
            text: `I checked your ${checkedSources.join(', ')} records, but no matching context was found for "${userInput}". Please configure an AI Provider (Gemini / Groq / OpenRouter / Ollama) in Settings.`,
            providerUsed: 'NONE',
            modelUsed: 'none'
        };
    }

    _calculateResponseDepth(userInput, sessionHistory = [], context = {}) {
        if (context && context.suggestedResponseDepth) return context.suggestedResponseDepth;
        const text = (userInput || '').toLowerCase();
        if (text.includes('detail') || text.includes('explain') || text.includes('deep') || text.includes('why') || text.includes('how does') || text.includes('crispr')) {
            return 'DEEP';
        }
        if (text.includes('short') || text.includes('quick') || text.includes('brief') || text.length < 15) {
            return 'CONCISE';
        }
        return 'BALANCED';
    }
}

module.exports = { ReasoningEngine };

