/**
 * 💬 CHRONO EMOTION VOCABULARY
 *
 * A comprehensive vocabulary of human emotional language labels.
 *
 * DESIGN PRINCIPLE:
 *   These are LABELS, not fixed meanings.
 *   Recognition gives Chrono the vocabulary, not a behavioral prescription.
 *   The intent system determines what to do with recognized labels.
 *   Emotional content is a dimension of the interaction — not a separate mode.
 *
 * Usage:
 *   const ev = require('./emotionVocabulary');
 *   ev.detect("I'm so anxious but also kind of excited")
 *   // → { labels: ['anxious', 'excited'], intensity: 'moderate', combinations: [['anxious','excited']], raw: [...] }
 */

// ============================================================
// 📚 VOCABULARY REGISTRY
// ============================================================

/**
 * Core emotion labels — the six primary dimensions of human affect.
 */
const CORE = [
    'happiness', 'sadness', 'anger', 'fear', 'disgust', 'surprise'
];

/**
 * Positive / uplifting labels — specific positive affect words humans use.
 */
const POSITIVE = [
    'joy', 'joyful',
    'excitement', 'excited',
    'amusement', 'amused',
    'contentment', 'content',
    'satisfaction', 'satisfied',
    'relief', 'relieved',
    'pride', 'proud',
    'hope', 'hopeful',
    'gratitude', 'grateful',
    'love', 'loving',
    'affection', 'affectionate',
    'admiration', 'admiring',
    'attraction', 'attracted',
    'compassion', 'compassionate',
    'empathy', 'empathetic',
    'warmth', 'warm',
    'elation', 'elated',
    'euphoria', 'euphoric',
    'delight', 'delighted',
    'enthusiasm', 'enthusiastic',
    'optimism', 'optimistic',
    'serenity', 'serene',
    'bliss', 'blissful',
    'tenderness', 'tender',
    'playful', 'playfulness',
    'inspired', 'inspiration',
    'motivated', 'motivation'
];

/**
 * Negative / difficult labels — specific words for difficult emotional states.
 */
const NEGATIVE = [
    'sadness', 'sad',
    'grief', 'grieving',
    'loneliness', 'lonely',
    'despair', 'despairing',
    'hopelessness', 'hopeless',
    'anxiety', 'anxious',
    'fear', 'fearful', 'scared', 'afraid',
    'dread', 'dreading',
    'panic', 'panicking', 'panicked',
    'worry', 'worried', 'worrying',
    'frustration', 'frustrated',
    'irritation', 'irritated', 'irritable',
    'anger', 'angry',
    'rage', 'enraged',
    'resentment', 'resentful',
    'jealousy', 'jealous',
    'envy', 'envious',
    'guilt', 'guilty',
    'shame', 'ashamed',
    'embarrassment', 'embarrassed',
    'regret', 'regretful',
    'disappointment', 'disappointed',
    'hurt', 'hurting',
    'pain', 'painful',
    'distress', 'distressed',
    'suffering',
    'helplessness', 'helpless',
    'powerlessness', 'powerless',
    'defeat', 'defeated',
    'failure', 'failing',
    'worthlessness', 'worthless',
    'self-doubt', 'self-loathing',
    'bitterness', 'bitter',
    'hatred', 'hate',
    'disgust', 'disgusted',
    'contempt', 'contemptuous',
    'apathy', 'apathetic',
    'emptiness', 'empty',
    'numbness', 'numb',
    'depression', 'depressed',
    'melancholy', 'melancholic',
    'desolation', 'desolate'
];

/**
 * Social / relational labels — emotions arising from connection and relationship.
 */
const SOCIAL = [
    'trust', 'trusting',
    'distrust', 'distrustful',
    'belonging',
    'rejection', 'rejected',
    'acceptance', 'accepted',
    'connection', 'connected',
    'detachment', 'detached',
    'attachment', 'attached',
    'affection', 'affectionate',
    'love', 'loving',
    'care', 'caring',
    'longing',
    'yearning',
    'nostalgia', 'nostalgic',
    'betrayal', 'betrayed',
    'abandonment', 'abandoned',
    'insecurity', 'insecure',
    'vulnerability', 'vulnerable',
    'intimacy', 'intimate',
    'closeness', 'close',
    'alienation', 'alienated',
    'isolation', 'isolated',
    'misunderstood',
    'understood',
    'seen', 'invisible',
    'appreciated', 'unappreciated',
    'respected', 'disrespected',
    'valued', 'undervalued',
    'forgotten'
];

/**
 * Mixed / nuanced labels — complex or compound emotional states.
 */
const NUANCED = [
    'bittersweet',
    'ambivalence', 'ambivalent',
    'confusion', 'confused',
    'conflict', 'conflicted',
    'emotional exhaustion', 'emotionally exhausted',
    'overwhelm', 'overwhelmed',
    'restlessness', 'restless',
    'anticipation', 'anticipating',
    'relief', 'relieved',
    'awe', 'awed',
    'wonder',
    'curiosity', 'curious',
    'indifference', 'indifferent',
    'numbness', 'numb',
    'uncertainty', 'uncertain',
    'unease', 'uneasy',
    'discomfort', 'uncomfortable',
    'resignation', 'resigned',
    'acceptance', 'accepting',
    'peace', 'peaceful',
    'stillness', 'still',
    'readiness', 'ready',
    'hesitation', 'hesitant',
    'reluctance', 'reluctant',
    'dread', 'dreading',
    'excitement', 'excited',
    'wistfulness', 'wistful',
    'tenderness', 'tender',
    'fondness', 'fond',
    'sentimental', 'sentimentality'
];

/**
 * Intensity scale — ordered from low to high arousal.
 * Used to detect intensity gradients from user language.
 */
const INTENSITY_SCALE = {
    anger: [
        { label: 'annoyed',    level: 1 },
        { label: 'irritated',  level: 2 },
        { label: 'frustrated', level: 3 },
        { label: 'angry',      level: 4 },
        { label: 'furious',    level: 5 },
        { label: 'enraged',    level: 6 }
    ],
    sadness: [
        { label: 'blue',       level: 1 },
        { label: 'down',       level: 1 },
        { label: 'sad',        level: 2 },
        { label: 'unhappy',    level: 2 },
        { label: 'sorrowful',  level: 3 },
        { label: 'grieving',   level: 4 },
        { label: 'despairing', level: 5 },
        { label: 'devastated', level: 6 }
    ],
    fear: [
        { label: 'nervous',    level: 1 },
        { label: 'uneasy',     level: 1 },
        { label: 'worried',    level: 2 },
        { label: 'anxious',    level: 3 },
        { label: 'fearful',    level: 4 },
        { label: 'scared',     level: 4 },
        { label: 'terrified',  level: 5 },
        { label: 'panicking',  level: 6 }
    ],
    joy: [
        { label: 'content',    level: 1 },
        { label: 'pleased',    level: 2 },
        { label: 'happy',      level: 3 },
        { label: 'joyful',     level: 4 },
        { label: 'elated',     level: 5 },
        { label: 'euphoric',   level: 6 },
        { label: 'blissful',   level: 6 }
    ]
};

/**
 * Common emotional combination patterns humans express.
 * Recognized as meaningful mixed states.
 */
const KNOWN_COMBINATIONS = [
    ['happy', 'nervous'],
    ['happy', 'sad'],
    ['angry', 'hurt'],
    ['love', 'fear'],
    ['excitement', 'anxiety'],
    ['grief', 'gratitude'],
    ['relief', 'sadness'],
    ['jealousy', 'insecurity'],
    ['nostalgia', 'happiness'],
    ['anger', 'disappointment'],
    ['love', 'longing'],
    ['pride', 'anxiety'],
    ['hope', 'fear'],
    ['joy', 'guilt'],
    ['bittersweet', 'nostalgia'],
    ['care', 'frustration'],
    ['love', 'resentment'],
    ['excitement', 'dread'],
    ['gratitude', 'sadness'],
    ['ambivalence', 'confusion']
];

// Build a flat lookup set for O(1) detection
const ALL_LABELS = new Set([
    ...CORE,
    ...POSITIVE,
    ...NEGATIVE,
    ...SOCIAL,
    ...NUANCED
].map(l => l.toLowerCase()));

// Build intensity map: label → { dimension, level }
const INTENSITY_MAP = new Map();
for (const [dimension, scale] of Object.entries(INTENSITY_SCALE)) {
    for (const entry of scale) {
        INTENSITY_MAP.set(entry.label, { dimension, level: entry.level });
    }
}

// ============================================================
// 🔍 DETECTION API
// ============================================================

/**
 * Detects emotional labels present in a text input.
 *
 * Returns:
 *   labels       — Array of recognized emotion label strings found in input
 *   intensity    — Rough descriptor: 'low' | 'moderate' | 'high' | null
 *   intensityMap — { label → { dimension, level } } for matched intensity labels
 *   combinations — Any recognized label pairs that match KNOWN_COMBINATIONS
 *   raw          — The matched token strings as found in the text
 *   hasEmotion   — Boolean shortcut: true if any label was detected
 *
 * @param {string} input
 * @returns {Object}
 */
function detect(input) {
    if (!input || typeof input !== 'string') {
        return { labels: [], intensity: null, intensityMap: {}, combinations: [], raw: [], hasEmotion: false };
    }

    const lower = input.toLowerCase();
    const foundLabels = new Set();
    const foundRaw = [];
    const foundIntensity = {};

    // Tokenize — split on word boundaries, preserve multi-word phrases
    // First check multi-word phrases, then single tokens
    const multiWordPhrases = ['emotional exhaustion', 'emotionally exhausted', 'self-doubt', 'self-loathing'];
    for (const phrase of multiWordPhrases) {
        if (lower.includes(phrase)) {
            foundLabels.add(phrase);
            foundRaw.push(phrase);
        }
    }

    // Single-word token scan
    const tokens = lower.match(/\b[a-z][\w'-]*\b/g) || [];
    for (const token of tokens) {
        if (ALL_LABELS.has(token)) {
            // Normalize aliases to canonical form
            const canonical = _canonicalize(token);
            foundLabels.add(canonical);
            foundRaw.push(token);
        }
        // Check intensity scale
        if (INTENSITY_MAP.has(token)) {
            const meta = INTENSITY_MAP.get(token);
            foundIntensity[token] = meta;
            foundLabels.add(token);
        }
    }

    const labelsArray = [...foundLabels];

    // Detect combinations
    const combinations = _detectCombinations(labelsArray);

    // Determine overall intensity descriptor
    const intensity = _resolveIntensity(foundIntensity, lower);

    return {
        labels: labelsArray,
        intensity,
        intensityMap: foundIntensity,
        combinations,
        raw: [...new Set(foundRaw)],
        hasEmotion: labelsArray.length > 0
    };
}

/**
 * Returns whether input contains any recognized emotional vocabulary.
 * Lightweight boolean check.
 * @param {string} input
 * @returns {boolean}
 */
function hasEmotionalContent(input) {
    return detect(input).hasEmotion;
}

/**
 * Returns a compact string descriptor of the emotional context
 * suitable for injection into an LLM system prompt.
 *
 * Example: "Emotional context: grief + gratitude (high intensity)"
 *
 * @param {string} input
 * @returns {string|null}
 */
function summarize(input) {
    const result = detect(input);
    if (!result.hasEmotion) return null;

    const parts = [];

    if (result.combinations.length > 0) {
        parts.push(result.combinations.map(c => c.join(' + ')).join('; '));
    } else {
        parts.push(result.labels.slice(0, 4).join(', '));
    }

    if (result.intensity) {
        parts[parts.length - 1] += ` (${result.intensity} intensity)`;
    }

    return `Emotional context: ${parts.join(' | ')}`;
}

/**
 * Returns the full vocabulary registry for introspection / debugging.
 */
function getVocabulary() {
    return {
        core: CORE,
        positive: POSITIVE,
        negative: NEGATIVE,
        social: SOCIAL,
        nuanced: NUANCED,
        intensityScale: INTENSITY_SCALE,
        knownCombinations: KNOWN_COMBINATIONS,
        totalLabels: ALL_LABELS.size
    };
}

// ============================================================
// 🔧 INTERNAL HELPERS
// ============================================================

/**
 * Normalize variant forms to a canonical label.
 * E.g. "joyful" → "joy", "anxious" → "anxiety"
 */
const CANONICAL_MAP = {
    joyful: 'joy',
    excited: 'excitement',
    amused: 'amusement',
    satisfied: 'satisfaction',
    relieved: 'relief',
    proud: 'pride',
    hopeful: 'hope',
    grateful: 'gratitude',
    loving: 'love',
    affectionate: 'affection',
    admiring: 'admiration',
    attracted: 'attraction',
    compassionate: 'compassion',
    empathetic: 'empathy',
    elated: 'elation',
    euphoric: 'euphoria',
    delighted: 'delight',
    enthusiastic: 'enthusiasm',
    optimistic: 'optimism',
    serene: 'serenity',
    blissful: 'bliss',
    inspired: 'inspiration',
    motivated: 'motivation',
    fearful: 'fear',
    scared: 'fear',
    afraid: 'fear',
    panicking: 'panic',
    panicked: 'panic',
    worried: 'worry',
    worrying: 'worry',
    frustrated: 'frustration',
    irritated: 'irritation',
    angry: 'anger',
    enraged: 'rage',
    resentful: 'resentment',
    jealous: 'jealousy',
    envious: 'envy',
    guilty: 'guilt',
    ashamed: 'shame',
    embarrassed: 'embarrassment',
    regretful: 'regret',
    disappointed: 'disappointment',
    grieving: 'grief',
    lonely: 'loneliness',
    despairing: 'despair',
    hopeless: 'hopelessness',
    anxious: 'anxiety',
    dreading: 'dread',
    helpless: 'helplessness',
    powerless: 'powerlessness',
    defeated: 'defeat',
    worthless: 'worthlessness',
    bitter: 'bitterness',
    disgusted: 'disgust',
    contemptuous: 'contempt',
    apathetic: 'apathy',
    depressed: 'depression',
    melancholic: 'melancholy',
    desolate: 'desolation',
    trusting: 'trust',
    distrustful: 'distrust',
    rejected: 'rejection',
    accepted: 'acceptance',
    connected: 'connection',
    detached: 'detachment',
    attached: 'attachment',
    caring: 'care',
    nostalgic: 'nostalgia',
    betrayed: 'betrayal',
    abandoned: 'abandonment',
    insecure: 'insecurity',
    vulnerable: 'vulnerability',
    ambivalent: 'ambivalence',
    confused: 'confusion',
    conflicted: 'conflict',
    overwhelmed: 'overwhelm',
    restless: 'restlessness',
    anticipating: 'anticipation',
    awed: 'awe',
    curious: 'curiosity',
    indifferent: 'indifference',
    numb: 'numbness',
    uncertain: 'uncertainty',
    uneasy: 'unease',
    uncomfortable: 'discomfort',
    resigned: 'resignation',
    accepting: 'acceptance',
    peaceful: 'peace',
    hesitant: 'hesitation',
    reluctant: 'reluctance',
    wistful: 'wistfulness',
    tender: 'tenderness',
    fond: 'fondness',
    sentimental: 'sentimentality',
    warm: 'warmth',
    playful: 'playfulness'
};

function _canonicalize(token) {
    return CANONICAL_MAP[token] || token;
}

/**
 * Find any label pairs in detected labels that match KNOWN_COMBINATIONS.
 */
function _detectCombinations(labels) {
    const labelSet = new Set(labels);
    const found = [];
    for (const combo of KNOWN_COMBINATIONS) {
        // Normalize combo against canonical labels
        const a = _canonicalize(combo[0]);
        const b = _canonicalize(combo[1]);
        if ((labelSet.has(a) || labelSet.has(combo[0])) &&
            (labelSet.has(b) || labelSet.has(combo[1]))) {
            found.push([a, b]);
        }
    }
    return found;
}

/**
 * Resolve a human-readable intensity descriptor from detected tokens.
 * Uses intensity scale levels + linguistic amplifiers/downtoners.
 */
function _resolveIntensity(foundIntensity, lower) {
    const levels = Object.values(foundIntensity).map(m => m.level);
    if (levels.length === 0) {
        // Fallback: look for amplifier/downtoner words
        if (/\b(so|really|extremely|incredibly|deeply|absolutely|completely|utterly|overwhelmingly)\b/.test(lower)) {
            return 'high';
        }
        if (/\b(a bit|slightly|kind of|kinda|somewhat|a little|mildly)\b/.test(lower)) {
            return 'low';
        }
        return null;
    }

    const maxLevel = Math.max(...levels);
    if (maxLevel >= 5) return 'high';
    if (maxLevel >= 3) return 'moderate';
    return 'low';
}

// ============================================================
// 📤 EXPORTS
// ============================================================

module.exports = {
    detect,
    hasEmotionalContent,
    summarize,
    getVocabulary,
    // Named vocabulary sets for external consumers
    CORE,
    POSITIVE,
    NEGATIVE,
    SOCIAL,
    NUANCED,
    INTENSITY_SCALE,
    KNOWN_COMBINATIONS
};
