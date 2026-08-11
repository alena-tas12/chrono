/**
 * Standalone emotion vocabulary integration test.
 * Deliberately avoids any module that touches main_db / SQLite / Electron IPC.
 * Can be run with plain node.js since emotionVocabulary.js has zero native deps.
 */
const emotionVocabulary = require('../main/emotionVocabulary');

// Manually replicate detectInteractionMode's logic without the main_db require
// so we can test the emotion dimension in isolation.
function simulateIntent(input) {
    const lower = (input || '').toLowerCase().trim();
    const emotion = emotionVocabulary.detect(input);

    if (/\b(why is|not working|error|bug|fix|failed|crash|exception|traceback|issue)\b/i.test(lower)) {
        return { mode: 'troubleshooter', emotion };
    }
    if (/\b(build|code|implement|refactor|script|develop)\b/i.test(lower)) {
        return { mode: 'collaborator', emotion };
    }
    if (/\b(think through|explore|wonder|philosophy|meaning|why do|existential|yearning|attachment)\b/i.test(lower)) {
        return { mode: 'thinking_partner', emotion };
    }
    if (/\b(really struggling|having a bad time|feeling miserable|need help coping|grief|shattering)\b/i.test(lower)) {
        return { mode: 'supportive', emotion };
    }
    if (/\b(explain|what is|how does|teach me|define)\b/i.test(lower)) {
        return { mode: 'teacher', emotion };
    }
    if (/\b(just listen|let me vent|hear me out)\b/i.test(lower)) {
        return { mode: 'listener', emotion };
    }
    return { mode: 'conversational', emotion };
}

const cases = [
    // Pure emotional
    { label: "Basic anger",             input: "I'm angry" },
    { label: "Grief + gratitude",       input: "I feel grief but also grateful" },
    { label: "Excited + anxious",       input: "I'm so excited but also anxious about this" },
    { label: "Bittersweet nostalgic",   input: "feeling bittersweet and nostalgic" },
    { label: "Enraged (high)",          input: "I'm furious. Actually enraged." },
    { label: "Love + fear",             input: "love mixed with fear" },
    { label: "Ambivalent + overwhelmed",input: "ambivalent, kind of numb, overwhelmed" },
    { label: "Happy for her but...",    input: "I'm happy for her but not part of her life anymore — bittersweet" },

    // Cross-mode: emotional + technical
    { label: "Frustrated + bug",        input: "this bug is not working and I'm really frustrated" },
    { label: "Devastated + crash",      input: "I'm devastated — why is my code crashing" },

    // Cross-mode: emotional + philosophical
    { label: "Longing + philosophical", input: "I wonder why I feel this longing and attachment to things I've lost" },

    // Intensity gradient
    { label: "Low: annoyed",            input: "just annoyed" },
    { label: "High: enraged",           input: "I'm absolutely enraged" },
    { label: "Low: a bit nervous",      input: "a bit nervous" },
    { label: "High: terrified",         input: "terrified honestly" },
    { label: "Amplifier: deeply sad",   input: "deeply sad right now" },

    // No emotion baseline
    { label: "No emotion (calendar)",   input: "check my calendar for tomorrow" },
    { label: "No emotion (technical)",  input: "what's the difference between REST and GraphQL" },
];

console.log("=".repeat(65));
console.log("  CHRONO EMOTION VOCABULARY — FULL INTEGRATION TEST");
console.log("=".repeat(65));

let detected = 0;
let clean = 0;

for (const { label, input } of cases) {
    const intent = simulateIntent(input);
    const summary = emotionVocabulary.summarize(input);

    console.log(`\n[${label}]`);
    console.log(`  Input:   "${input}"`);
    console.log(`  Mode:    ${intent.mode}`);

    if (intent.emotion.hasEmotion) {
        detected++;
        console.log(`  Labels:  ${intent.emotion.labels.join(', ')}`);
        console.log(`  Intens:  ${intent.emotion.intensity || 'null'}`);
        if (intent.emotion.combinations.length > 0) {
            console.log(`  Combos:  ${intent.emotion.combinations.map(c => c.join(' + ')).join(' | ')}`);
        }
        console.log(`  → LLM:   "${summary}"`);
    } else {
        clean++;
        console.log(`  Emotion: (none — clean prompt)`);
    }
}

console.log("\n" + "=".repeat(65));
console.log(`  SUMMARY: ${detected} emotional | ${clean} clean | ${cases.length} total`);
console.log("=".repeat(65));
