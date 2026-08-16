/**
 * 🧠 COGNITIVE PACE & THOUGHT TRAJECTORY ENGINE (Contract 13 Deep Implementation)
 * 
 * Contract 13: Primacy of Cognitive Pace
 * Chrono follows the user's natural cognitive and conversational pace. It adapts
 * its interpretation, questioning, response depth, and interaction rhythm to how
 * the user is currently externalizing thought, without requiring the user to
 * restructure their thinking into machine-readable commands.
 * 
 * SITS BEFORE INTENT CLASSIFICATION:
 * Analyzes semantic trajectory, active thread stack, self-corrections, and implicit references
 * before any command intent classification or module action trigger is evaluated.
 */

class CognitivePaceEngine {
    constructor() {
        this.activeThread = null;
        this.threadStack = [];
        this.unfinishedThreads = [];
        this.topicHistory = [];
    }

    /**
     * Resets trajectory state for a fresh session or test isolation
     */
    reset() {
        this.activeThread = null;
        this.threadStack = [];
        this.unfinishedThreads = [];
        this.topicHistory = [];
    }

    /**
     * Analyzes input trajectory, updates active thread stack, and produces pacing strategy
     */
    trackThoughtTrajectory(userInput, sessionHistory = []) {
        const raw = (userInput || '').trim();
        const lower = raw.toLowerCase();
        const wordCount = raw.split(/\s+/).filter(Boolean).length;

        // 1. Detect Trajectory Jump Markers
        const jumpMatches = lower.match(/\b(wait|actually|oh and|because that|anyway|speaking of|realized|forget that|no wait|on second thought|connected to)\b/gi) || [];
        const jumpRate = jumpMatches.length;

        // 2. Detect Self-Correction Markers
        const correctionMatches = lower.match(/\b(forget|never mind|scratch that|actually no|not that|i mean|or rather|cancel that)\b/gi) || [];
        const isCorrection = correctionMatches.length > 0;

        // 3. Detect Backtracking & Implicit Trajectory Queries ("what was I saying?", "you know what I mean")
        const isBacktrackQuery = /^(what was i saying|what were we talking about|where was i|what was i talking about|what did i just say)/i.test(lower);
        const isImplicitReference = /\b(you know what i mean|that thing|the other thing|what we said earlier|as i was saying)\b/i.test(lower);

        // 4. Extract Key Semantic Concepts from Turn
        const extractedConcepts = this._extractConcepts(userInput);

        // 5. Update Semantic Thread Stack
        if (isCorrection) {
            // User corrected / abandoned previous thought -> Pop or update thread
            if (this.threadStack.length > 0) {
                const abandoned = this.activeThread;
                this.activeThread = this.threadStack.length > 1 ? this.threadStack[this.threadStack.length - 2] : null;
            }
        } else if (extractedConcepts.length > 0) {
            const newTopic = extractedConcepts.join(' ');
            if (this.activeThread && this.activeThread !== newTopic && jumpRate > 0) {
                // Trajectory jump: push current to thread stack and set new active thread
                this.threadStack.push(this.activeThread);
                this.unfinishedThreads.push(this.activeThread);
            }
            this.activeThread = newTopic;
            this.topicHistory.push({ topic: newTopic, timestamp: Date.now() });
        }

        // 6. Determine Externalization Pacing & Interpretation
        let externalizationStyle = 'STANDARD_DELIBERATE';
        let recommendedPacing = 'MATCH_USER_PACE';
        let suggestedResponseDepth = 'BALANCED';

        if (isBacktrackQuery) {
            externalizationStyle = 'TRAJECTORY_BACKTRACK_QUERY';
            recommendedPacing = 'RECALL_ACTIVE_THREAD';
            suggestedResponseDepth = 'CONCISE';
        } else if (isCorrection) {
            externalizationStyle = 'THREAD_CORRECTION';
            recommendedPacing = 'PIVOT_THREAD';
            suggestedResponseDepth = 'CONCISE';
        } else if (jumpRate >= 2 || (wordCount > 35 && jumpRate >= 1)) {
            externalizationStyle = 'RAPID_STREAM_OF_CONSCIOUSNESS';
            recommendedPacing = 'FOLLOW_TRAJECTORY';
            suggestedResponseDepth = wordCount > 80 ? 'CONCISE_SYNTHESIS' : 'BALANCED';
        } else if (wordCount < 10 && !lower.includes('?')) {
            externalizationStyle = 'SHORT_TERSE_BURST';
            recommendedPacing = 'UNOBTRUSIVE_COMPANION';
            suggestedResponseDepth = 'CONCISE';
        }

        return {
            wordCount,
            jumpRate,
            isCorrection,
            isBacktrackQuery,
            isImplicitReference,
            activeThread: this.activeThread,
            threadStack: [...this.threadStack],
            unfinishedThreads: [...this.unfinishedThreads],
            externalizationStyle,
            recommendedPacing,
            suggestedResponseDepth,
            extractedConcepts
        };
    }

    /**
     * Synthesizes thread context for natural response generation without demanding command syntax
     */
    resolveThreadContext(userInput, paceAnalysis, sessionHistory = []) {
        if (paceAnalysis.isBacktrackQuery) {
            const lastThread = paceAnalysis.activeThread || (paceAnalysis.threadStack.length > 0 ? paceAnalysis.threadStack[paceAnalysis.threadStack.length - 1] : null);
            if (lastThread) {
                return `You were discussing ${lastThread}. We can return to that or follow where your thought is going now.`;
            }
            // Search session history for previous user topic
            for (let i = sessionHistory.length - 1; i >= 0; i--) {
                const turn = sessionHistory[i];
                if (turn.role === 'user' && turn.content !== userInput) {
                    return `You were talking about "${turn.content}".`;
                }
            }
            return "You were sharing your thoughts on the active workspace topic.";
        }

        if (paceAnalysis.externalizationStyle === 'RAPID_STREAM_OF_CONSCIOUSNESS') {
            return `I follow the trajectory of your thought on ${paceAnalysis.activeThread || 'these connected ideas'}. We can explore these connections naturally together without needing to pause or reformat your request.`;
        }

        if (paceAnalysis.isCorrection) {
            return `Understood. Pivoting away from that and focusing on ${paceAnalysis.activeThread || 'your current thought'}.`;
        }

        return null;
    }

    _extractConcepts(text) {
        const lower = text.toLowerCase();
        const concepts = [];
        if (lower.includes('ospf') || lower.includes('network')) concepts.push('OSPF Network Architecture');
        if (lower.includes('timetable') || lower.includes('schedule') || lower.includes('planner')) concepts.push('Timetable & Schedule');
        if (lower.includes('knowledge') || lower.includes('notes') || lower.includes('remnote') || lower.includes('outliner')) concepts.push('Knowledge Workspace');
        if (lower.includes('chrono') || lower.includes('architecture') || lower.includes('cognitive')) concepts.push('Chrono Cognitive OS Architecture');
        if (lower.includes('study') || lower.includes('exam')) concepts.push('Study Sessions');
        return concepts;
    }
}

const defaultPaceEngine = new CognitivePaceEngine();

module.exports = {
    CognitivePaceEngine,
    analyzeCognitivePace: (input, history) => defaultPaceEngine.trackThoughtTrajectory(input, history),
    defaultPaceEngine
};
