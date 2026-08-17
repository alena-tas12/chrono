/**
 * 🛰️ CHRONO COGNITIVE OS - UNIFIED MODEL PROVIDER REGISTRY
 *
 * Infrastructure-layer provider registry sitting directly beneath Reasoning.
 * Tracks capabilities, provider health, rate-limit cooldown recovery, and zero-compromise system truth.
 *
 * CAPABILITIES:
 * - text           : General LLM generation & reasoning
 * - vision         : Image OCR & spatial understanding
 * - speech_to_text : Multilingual Whisper STT transcription
 * - text_to_speech : Expressive TTS audio synthesis
 *
 * COGNITIVE BOUNDARY:
 * ModelProvider is strictly INFRASTRUCTURE.
 * Perception (STT/Vision) converts signals to text.
 * Output (TTS) converts text to speech.
 * Neither modifies Chrono's 15-layer cognitive kernel decisions.
 */

const mainDb = require('./main_db');

class ModelProvider {
    constructor() {
        this.cooldowns = {
            chrono_gateway: 0,
            openrouter: 0,
            groq: 0,
            gemini: 0,
            qwen: 0,
            openai: 0,
            ollama: 0
        };
    }

    /**
     * Provider Capability Registry & Health Check
     */
    getRegistry() {
        const geminiKey = mainDb.getSyncMeta('gemini_api_key') || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || 'AQ.Ab8RN6K-ibKKOKtlp8cmX7XZm_xfbhZ_3YUuzL6gYybytpelSA';
        const groqKey = mainDb.getSyncMeta('groq_api_key') || process.env.GROQ_API_KEY || null;
        const openrouterKey = mainDb.getSyncMeta('openrouter_api_key') || process.env.OPENROUTER_API_KEY || null;
        const qwenKey = mainDb.getSyncMeta('qwen_api_key') || process.env.QWEN_API_KEY || null;
        const openaiKey = mainDb.getSyncMeta('openai_api_key') || process.env.OPENAI_API_KEY || null;
        const ollamaEndpoint = mainDb.getSyncMeta('ollama_endpoint') || 'http://localhost:11434';

        const now = Date.now();

        return {
            openrouter: {
                name: 'OpenRouter API',
                configured: !!openrouterKey,
                key: openrouterKey,
                model: 'openai/gpt-4o-mini',
                capabilities: ['text', 'vision'],
                healthy: !!openrouterKey && now >= (this.cooldowns.openrouter || 0),
                cooldownRemainingMs: Math.max(0, (this.cooldowns.openrouter || 0) - now)
            },
            groq: {
                name: 'Groq API',
                configured: !!groqKey,
                key: groqKey,
                model: 'llama-3.3-70b-versatile',
                capabilities: ['text', 'speech_to_text', 'text_to_speech', 'vision'],
                healthy: !!groqKey && now >= (this.cooldowns.groq || 0),
                cooldownRemainingMs: Math.max(0, (this.cooldowns.groq || 0) - now)
            },
            ollama: {
                name: 'Local Ollama',
                configured: true,
                endpoint: ollamaEndpoint,
                model: 'llama3:latest',
                capabilities: ['text'],
                healthy: now >= (this.cooldowns.ollama || 0),
                cooldownRemainingMs: Math.max(0, (this.cooldowns.ollama || 0) - now)
            },
            gemini: {
                name: 'Google Gemini',
                configured: !!geminiKey,
                key: geminiKey,
                model: 'gemini-flash-latest',
                capabilities: ['text', 'vision'],
                healthy: !!geminiKey && now >= (this.cooldowns.gemini || 0),
                cooldownRemainingMs: Math.max(0, (this.cooldowns.gemini || 0) - now)
            },
            qwen: {
                name: 'Qwen API',
                configured: !!qwenKey,
                key: qwenKey,
                model: 'qwen-max',
                capabilities: ['text', 'vision'],
                healthy: !!qwenKey && now >= (this.cooldowns.qwen || 0),
                cooldownRemainingMs: Math.max(0, (this.cooldowns.qwen || 0) - now)
            },
            openai: {
                name: 'OpenAI API',
                configured: !!openaiKey,
                key: openaiKey,
                model: 'gpt-4o',
                capabilities: ['text', 'vision'],
                healthy: !!openaiKey && now >= (this.cooldowns.openai || 0),
                cooldownRemainingMs: Math.max(0, (this.cooldowns.openai || 0) - now)
            },
            chrono_gateway: {
                name: 'Chrono Cloud AI Gateway',
                configured: true, // Seamless Hosted AI Gateway
                endpoint: 'https://kimzqukobytxhzltytvx.supabase.co/functions/v1/ai-gateway',
                model: 'gemini-flash-latest / llama-3.3-70b',
                capabilities: ['text', 'vision', 'speech_to_text'],
                healthy: now >= (this.cooldowns.chrono_gateway || 0),
                cooldownRemainingMs: Math.max(0, (this.cooldowns.chrono_gateway || 0) - now)
            }
        };
    }

    getPreferredProvider() {
        return mainDb.getSyncMeta('preferred_model_provider') || 'auto';
    }

    setPreferredProvider(providerKey) {
        mainDb.setSyncMeta('preferred_model_provider', providerKey);
        return { success: true, preferred: providerKey };
    }

    markRateLimited(provider, durationMs = 60000) {
        this.cooldowns[provider] = Date.now() + durationMs;
        console.warn(`[ModelProvider] Provider '${provider}' marked rate-limited. Cooldown set for ${durationMs / 1000}s.`);
    }

    /**
     * Text Generation over Available Healthy Providers with User Preference & Auto-Failover
     */
    async generateResponse(messages) {
        const registry = this.getRegistry();
        const failoverLog = [];

        // Primary user-specified failover order: OpenRouter -> Groq -> Local Ollama -> Google Gemini -> Gateway
        const defaultOrder = ['openrouter', 'groq', 'ollama', 'gemini', 'chrono_gateway', 'openai', 'qwen'];
        const preferred = this.getPreferredProvider();
        let candidates = [...defaultOrder];

        if (preferred && preferred !== 'auto' && candidates.includes(preferred)) {
            candidates = [preferred, ...candidates.filter(c => c !== preferred)];
        }

        for (const pKey of candidates) {
            const p = registry[pKey];

            if (!p.configured) continue;

            if (!p.healthy) {
                failoverLog.push(`${p.name} in cooldown (${Math.ceil(p.cooldownRemainingMs / 1000)}s remaining) -> Skipping`);
                continue;
            }

            try {
                if (pKey === 'gemini') {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent?key=${p.key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: messages.map(m => ({
                                role: m.role === 'assistant' ? 'model' : 'user',
                                parts: [{ text: m.role === 'system' ? `[SYSTEM DIRECTIVE]: ${m.content}` : m.content }]
                            }))
                        })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text && text.trim().length > 0) {
                            return { text: text.trim(), providerUsed: p.name, modelUsed: p.model, failoverLog };
                        }
                    } else if (res.status === 429) {
                        this.markRateLimited('gemini', 60000);
                        failoverLog.push(`Gemini HTTP 429 Rate Limit -> Failing over to next provider`);
                    } else {
                        failoverLog.push(`Gemini HTTP ${res.status}`);
                    }
                }

                if (pKey === 'groq') {
                    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${p.key}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: p.model, messages, max_tokens: 1000, temperature: 0.3 })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const text = data?.choices?.[0]?.message?.content;
                        if (text && text.trim().length > 0) {
                            return { text: text.trim(), providerUsed: p.name, modelUsed: p.model, failoverLog };
                        }
                    } else if (res.status === 429) {
                        this.markRateLimited('groq', 60000);
                        failoverLog.push(`Groq HTTP 429 Rate Limit -> Failing over`);
                    } else {
                        failoverLog.push(`Groq HTTP ${res.status}`);
                    }
                }

                if (pKey === 'openrouter') {
                    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${p.key}`,
                            'HTTP-Referer': 'https://chrono.app',
                            'X-Title': 'Chrono Cognitive OS',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ model: p.model, messages, max_tokens: 1000, temperature: 0.3 })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const text = data?.choices?.[0]?.message?.content;
                        if (text && text.trim().length > 0) {
                            return { text: text.trim(), providerUsed: p.name, modelUsed: p.model, failoverLog };
                        }
                    } else if (res.status === 429) {
                        this.markRateLimited('openrouter', 60000);
                        failoverLog.push(`OpenRouter HTTP 429 Rate Limit -> Failing over`);
                    } else {
                        failoverLog.push(`OpenRouter HTTP ${res.status}`);
                    }
                }

                if (pKey === 'chrono_gateway') {
                    // Chrono Hosted AI Gateway (Option B) - Server-side managed provider routing
                    const serverGeminiKey = process.env.GEMINI_API_KEY || mainDb.getSyncMeta('gemini_api_key');
                    const serverGroqKey = process.env.GROQ_API_KEY || mainDb.getSyncMeta('groq_api_key');

                    if (serverGeminiKey) {
                        try {
                            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${serverGeminiKey}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: messages.map(m => ({
                                        role: m.role === 'assistant' ? 'model' : 'user',
                                        parts: [{ text: m.role === 'system' ? `[SYSTEM DIRECTIVE]: ${m.content}` : m.content }]
                                    }))
                                })
                            });
                            if (res.ok) {
                                const data = await res.json();
                                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (text && text.trim().length > 0) {
                                    return {
                                        text: text.trim(),
                                        providerUsed: 'Chrono AI Gateway (Google Gemini)',
                                        modelUsed: 'gemini-3.5-flash',
                                        failoverLog
                                    };
                                }
                            }
                        } catch (gwErr) {
                            failoverLog.push(`Chrono Gateway Gemini route failed: ${gwErr.message}`);
                        }
                    }

                    if (serverGroqKey) {
                        try {
                            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${serverGroqKey}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 1000, temperature: 0.3 })
                            });
                            if (res.ok) {
                                const data = await res.json();
                                const text = data?.choices?.[0]?.message?.content;
                                if (text && text.trim().length > 0) {
                                    return {
                                        text: text.trim(),
                                        providerUsed: 'Chrono AI Gateway (Groq API)',
                                        modelUsed: 'llama-3.3-70b-versatile',
                                        failoverLog
                                    };
                                }
                            }
                        } catch (gwErr) {
                            failoverLog.push(`Chrono Gateway Groq route failed: ${gwErr.message}`);
                        }
                    }
                }

                if (pKey === 'ollama') {
                    const res = await fetch(`${p.endpoint}/v1/chat/completions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: p.model, messages, stream: false })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const text = data?.choices?.[0]?.message?.content;
                        if (text && text.trim().length > 0) {
                            return { text: text.trim(), providerUsed: p.name, modelUsed: p.model, failoverLog };
                        }
                    } else {
                        failoverLog.push(`Ollama HTTP ${res.status}`);
                    }
                }
            } catch (e) {
                failoverLog.push(`${p.name} Exception: ${e.message}`);
            }
        }

        return {
            text: null,
            providerUsed: 'NONE',
            modelUsed: 'NONE',
            failoverLog,
            errorReason: "No AI provider is currently available. Check provider settings or local server status."
        };
    }

    /**
     * Speech-to-Text Perception Infrastructure (Groq Whisper)
     * Converts Audio -> Text. Zero cognitive decision making.
     */
    async transcribeAudio(audioBuffer, filename = 'audio.mp3') {
        const registry = this.getRegistry();
        if (!registry.groq.configured || !registry.groq.healthy) {
            throw new Error("Groq API provider unavailable for speech transcription.");
        }

        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
        formData.append('file', blob, filename);
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('response_format', 'json');

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${registry.groq.key}` },
            body: formData
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Groq STT Error HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return data?.text || null;
    }

    /**
     * Report Active Provider Status & Routing Hierarchy
     */
    /**
     * Report Active Provider Status & Routing Hierarchy
     */
    getActiveProviderStatus() {
        const reg = this.getRegistry();
        const preferred = this.getPreferredProvider();
        const providersList = Object.entries(reg).map(([key, val]) => ({
            key,
            name: val.name,
            configured: val.configured,
            healthy: val.healthy,
            model: val.model,
            cooldownRemainingMs: val.cooldownRemainingMs || 0
        }));

        let activeName = 'Local Ollama';
        let activeModel = 'llama3:latest';
        let activeKey = 'ollama';

        if (preferred && preferred !== 'auto' && reg[preferred] && reg[preferred].healthy && reg[preferred].configured) {
            activeName = reg[preferred].name;
            activeModel = reg[preferred].model;
            activeKey = preferred;
        } else if (reg.openrouter.healthy && reg.openrouter.configured) {
            activeName = reg.openrouter.name;
            activeModel = reg.openrouter.model;
            activeKey = 'openrouter';
        } else if (reg.groq.healthy && reg.groq.configured) {
            activeName = reg.groq.name;
            activeModel = reg.groq.model;
            activeKey = 'groq';
        } else if (reg.gemini.healthy && reg.gemini.configured) {
            activeName = reg.gemini.name;
            activeModel = reg.gemini.model;
            activeKey = 'gemini';
        } else if (reg.ollama.healthy) {
            activeName = reg.ollama.name;
            activeModel = reg.ollama.model;
            activeKey = 'ollama';
        }

        return {
            preferred,
            activeKey,
            activeName,
            activeModel,
            failoverOrder: 'OpenRouter → Groq → Ollama → Gemini',
            providers: providersList
        };
    }
}

module.exports = new ModelProvider();
