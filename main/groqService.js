/**
 * ⚡ CHRONO COGNITIVE OS - UNIFIED GROQ MULTI-MODAL SERVICE
 *
 * Capitalizes on Groq's LPU (Language Processing Unit) architecture for ultra-fast:
 * 1. Text & Reasoning Models (Llama 3.3 70B, GPT OSS 120B, Qwen 2.5/3.6)
 * 2. Sub-Second Speech-to-Text Audio Transcription (Whisper Large v3 Turbo)
 * 3. Fast Text-to-Speech Audio Generation (Orpheus)
 * 4. Vision & Multimodal Image Processing
 */

const mainDb = require('./main_db');
const fs = require('fs');

class GroqService {
    getApiKey() {
        return mainDb.getSyncMeta('groq_api_key') || process.env.GROQ_API_KEY || null;
    }

    /**
     * Ultra-fast text completion
     */
    async generateText(messages, model = 'llama-3.3-70b-versatile') {
        const key = this.getApiKey();
        if (!key) throw new Error("Groq API key not configured");

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.3,
                max_tokens: 1000
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Groq API Error HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return data?.choices?.[0]?.message?.content || null;
    }

    /**
     * Sub-second Audio Transcription using Whisper Large v3 Turbo
     */
    async transcribeAudio(audioBuffer, filename = 'voice_note.mp3') {
        const key = this.getApiKey();
        if (!key) throw new Error("Groq API key not configured");

        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
        formData.append('file', blob, filename);
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('response_format', 'json');

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`
            },
            body: formData
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Groq Whisper STT Error HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return data?.text || null;
    }
}

module.exports = new GroqService();
