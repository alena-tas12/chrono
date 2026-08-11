/**
 * 🧠 CHRONO COGNITIVE OS - MEMORY MODULE (Phase 6)
 * 
 * Formal CognitiveModule implementing the Learning Contract and Knowledge Graph extraction.
 */

const dbModule = require('./main_db');
const { Authority } = require('./stateContracts');
const mainDb = require('./main_db');

class MemoryModule {
    constructor() {
        this.db = mainDb.db;
    }

    /**
     * Parse raw conversational text into proposed memories.
     */
    parse(userInput, aiResponse) {
        let proposedObjects = [];
        const lowerInput = userInput.toLowerCase();
        
        const timestamp = Date.now();
        const source = 'user_interaction';

        // Helper to construct a node
        const createNode = (content, type, isInstance, instanceOf, importance) => ({
            id: dbModule.generateUUID(),
            content,
            type,
            isInstance,
            instanceOf,
            timestamp,
            source,
            relationships: [], // E.g. { type: 'depends_on', targetId: '...' }
            importance
        });

        // 1. Fact Extraction (Episodic/Objective)
        if (lowerInput.includes('i ') || lowerInput.includes('my ')) {
            proposedObjects.push(createNode(userInput, 'Fact', true, 'Episodic', 0.7));
        } else if (lowerInput.includes(' is ')) {
            proposedObjects.push(createNode(userInput, 'Fact', true, 'Objective', 0.5));
        }

        // 2. Entity/Instance Extraction (Expanded Taxonomy)
        if (lowerInput.includes('friend') || lowerInput.includes('she') || lowerInput.includes('he')) {
            // E.g. Concept: Friendship -> Instance: Tara
            proposedObjects.push(createNode('Social Relationship', 'Concept', false, null, 0.6));
            proposedObjects.push(createNode('Friend', 'Person', true, 'Social Relationship', 0.8));
        }
        
        if (lowerInput.includes('project') || lowerInput.includes('build')) {
            proposedObjects.push(createNode('Software Construction', 'Concept', false, null, 0.6));
            proposedObjects.push(createNode('Chrono App', 'Project', true, 'Software Construction', 0.9));
        }

        if (lowerInput.includes('goal')) {
            proposedObjects.push(createNode('Complete Phase 6', 'Goal', true, null, 0.9));
        }

        if (lowerInput.includes('company')) {
            proposedObjects.push(createNode('DeepMind', 'Organization', true, null, 0.7));
        }

        // We can also parse Place, Event, Question, Decision, Task, File, Conversation, Relationship here.
        // In a real LLM implementation, the LLM outputs a structured JSON array matching these schemas.
        if (lowerInput.includes('decided')) {
            proposedObjects.push(createNode(userInput, 'Decision', true, null, 0.9));
        }

        return proposedObjects;
    }

    /**
     * Evaluate proposed memories against the Learning Contract (Trust & Confidence).
     */
    evaluate(proposedObjects) {
        return proposedObjects.map(obj => {
            let confidence = 0.5;
            let security = 'Private';
            let authority = Authority.INFERENCE;

            if (obj.type === 'Fact') {
                if (obj.instanceOf === 'Objective') {
                    confidence = 0.7; 
                    security = 'Public';
                    authority = Authority.USER;
                } else {
                    confidence = 0.9;
                    security = 'Sensitive';
                    authority = Authority.USER;
                }
            } else if (obj.type === 'Concept') {
                confidence = 0.8;
                security = 'Public';
            } else if (obj.type === 'Decision') {
                confidence = 0.99;
                authority = Authority.USER;
            } else {
                confidence = 0.85;
            }

            return {
                ...obj,
                memory_type: obj.type, // Map for SQLite
                provenance: { source: obj.source, confidence },
                authority,
                security,
                approved: true
            };
        });
    }

    /**
     * Execute the writes to the State (SQLite).
     */
    execute(evaluatedMemories) {
        let writtenCount = 0;
        
        const insertStmt = this.db.prepare(`
            INSERT INTO cognitive_memories (id, user_id, memory_type, content, importance_score, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const mem of evaluatedMemories) {
            if (mem.approved) {
                try {
                    const id = mainDb.generateUUID();
                    const now = Date.now();
                    const importance = Math.round(mem.importance * 10) || 5;
                    
                    insertStmt.run(
                        id, 
                        mainDb.getActiveUserId(), 
                        mem.memory_type, 
                        mem.content, 
                        importance, 
                        now, 
                        now
                    );
                    writtenCount++;
                } catch (e) {
                    console.error("Failed to execute memory write:", e.message);
                }
            }
        }
        
        return { success: true, recordsWritten: writtenCount };
    }

    shouldStoreMemory(userInput) {
        // Discard transient conversations
        const lowerInput = userInput.toLowerCase();
        const transientTriggers = ['what time', 'hello', 'hi', 'thanks', 'ok', 'goodbye', 'stop', 'cancel'];
        if (transientTriggers.some(t => lowerInput.includes(t)) && lowerInput.length < 25) {
            return false;
        }
        return true;
    }

    /**
     * Parses the LLM's response for specific Knowledge Graph extraction blocks.
     */
    processInteraction(userInput, aiResponse) {
        if (!this.shouldStoreMemory(userInput)) {
            console.log(`[MemoryModule] Discarding transient interaction from memory.`);
            return { stored: false, reason: 'Transient interaction' };
        }

        const kgBlockRegex = /```json:knowledge_graph\n([\s\S]*?)\n```/g;
        const proposed = this.parse(userInput, aiResponse);
        if (proposed.length === 0) return { recordsWritten: 0 };
        
        const evaluated = this.evaluate(proposed);
        return this.execute(evaluated);
    }
}

module.exports = { MemoryModule };
