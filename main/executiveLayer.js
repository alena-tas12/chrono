/**
 * 🧠 CHRONO COGNITIVE OS - EXECUTIVE LAYER
 * 
 * Manages the Execution Pipeline: Observe -> Understand -> Reason -> Simulate -> Recommend -> Act.
 * Hosts the Simulation Engine for deep, immutable hypothetical branching.
 */

const { ExecutionMode, buildStateEnvelope } = require('./stateContracts');
const mainDb = require('./main_db');

class SimulationEngine {
    constructor() {
        this.simulations = [];
    }

    /**
     * Forks the state immutably to run a hypothesis.
     */
    simulateBranch({ hypothesis, state, maxDepth = 3 }) {
        const simId = mainDb.generateUUID();
        
        // Deep clone the state chunk to ensure immutability
        const simState = JSON.parse(JSON.stringify(state));
        
        let cost = { energy: 0, time: 0, relationships: 0 };
        let consequences = [];

        // Example Hypothesis Processing
        if (hypothesis.action === 'move_event') {
            cost.time += 30; // 30 mins travel
            cost.energy += 1;
            consequences.push(`Moving ${hypothesis.target} causes a downstream conflict with Project Deadline.`);
        }

        // Limit depth recursion natively
        const reachedMaxDepth = maxDepth <= 1;

        const simulation = {
            id: simId,
            timestamp: Date.now(),
            parentState: state._retrievalMeta || 'unknown',
            hypothesis,
            changes: [hypothesis.action],
            cost,
            consequences,
            discarded: true, // Always discarded unless explicitly committed later
            depth: maxDepth,
            reachedMaxDepth
        };

        this.simulations.push(simulation);
        return simulation;
    }
}

class ExecutiveLayer {
    constructor() {
        this.simulationEngine = new SimulationEngine();
    }

    /**
     * Executes the cognitive pipeline.
     */
    executePipeline(intentPlan, retrievedState, contradictions, opportunities) {
        let executionTrace = [];
        let recommendations = [];

        // 1. OBSERVE
        executionTrace.push(`[${ExecutionMode.OBSERVE}] Retrieved State.`);

        // 2. UNDERSTAND (Context synthesis before reasoning)
        let contextUnderstanding = 'System is stable.';
        if (contradictions.length > 0) {
            contextUnderstanding = `Detected ${contradictions.length} contradiction(s).`;
        }
        if (opportunities.length > 0) {
            contextUnderstanding += ` Detected ${opportunities.length} opportunitie(s).`;
        }
        executionTrace.push(`[${ExecutionMode.UNDERSTAND}] ${contextUnderstanding}`);

        // 3. REASON
        let decisionCategory = intentPlan.intents.includes('Plan') ? 'Planning' : 'Information';
        executionTrace.push(`[${ExecutionMode.REASON}] Classified intent as ${decisionCategory}.`);

        // 4. SIMULATE (Only if Dispatch flagged it)
        let simulationResult = null;
        if (intentPlan.requiresSimulation) {
            executionTrace.push(`[${ExecutionMode.SIMULATE}] Simulation requested by Dispatch.`);
            simulationResult = this.simulationEngine.simulateBranch({
                hypothesis: { action: 'move_event', target: 'Meeting' }, // Stub hypothesis based on intent
                state: retrievedState,
                maxDepth: 3
            });
            executionTrace.push(`[${ExecutionMode.SIMULATE}] Simulation ${simulationResult.id} complete. Cost: Time=${simulationResult.cost.time}.`);
        }

        // 5. RECOMMEND
        if (simulationResult && simulationResult.consequences.length > 0) {
            recommendations.push({
                reason: simulationResult.consequences[0],
                alternatives: ['Keep current time', 'Delegate'],
                confidence: 0.8
            });
            executionTrace.push(`[${ExecutionMode.RECOMMEND}] Generated 1 recommendation.`);
        } else if (opportunities.length > 0) {
            recommendations.push({
                reason: opportunities[0].description,
                alternatives: [],
                confidence: opportunities[0].confidence
            });
            executionTrace.push(`[${ExecutionMode.RECOMMEND}] Recommended opportunity.`);
        }

        // 6. ACT (Determine Directive)
        let executiveDirective = '';
        if (contradictions.some(c => c.severity === 'High' || c.severity === 'Critical')) {
            executiveDirective = 'CRITICAL INVARIANT: High severity contradiction found. Highlight to user immediately. Do not silently merge.';
        } else if (recommendations.length > 0) {
            executiveDirective = 'Present the generated recommendation and ask for user confirmation.';
        } else {
            executiveDirective = 'Process retrieved state and respond according to intent.';
        }
        executionTrace.push(`[${ExecutionMode.ACT}] Issued directive: ${executiveDirective}`);

        // 7. Context Builder (Clean output for LLM)
        const contextSummary = this._buildContext(intentPlan, retrievedState, contradictions, executiveDirective);

        return {
            decisionCategory,
            executiveDirective,
            executionTrace,
            recommendations,
            simulationResult,
            intents: intentPlan.intents,
            retrievedState,
            contradictions,
            opportunities,
            contextSummary
        };
    }

    _buildContext(intentPlan, retrievedState, contradictions, executiveDirective) {
        let facts = [];
        let missing = [];

        if (retrievedState._retrievalValidation && retrievedState._retrievalValidation.missing.length > 0) {
            missing = retrievedState._retrievalValidation.missing.map(m => `${m.field}: ${m.reason}`);
        }

        const stateKeys = Object.keys(retrievedState).filter(k => k !== '_systemHealth' && k !== '_retrievalValidation' && k !== '_retrievalMeta');
        for (const key of stateKeys) {
            const data = retrievedState[key];
            if (Array.isArray(data)) {
                if (key === 'knowledge' && data.length > 0) {
                    facts.push(`Explicit Knowledge Workspace Blocks:\n    ` + data.map(d => `- ${d.fact} (Source: ${d.provenance.source})`).join('\n    '));
                } else if (data.length > 0) {
                    const sample = data[0];
                    let metaStr = ``;
                    if (sample.source) metaStr += ` (Source: ${sample.source})`;
                    if (sample.updatedAt) metaStr += ` (Updated: ${new Date(sample.updatedAt).toISOString()})`;
                    facts.push(`${key}: Found ${data.length} items.${metaStr}`);
                } else {
                    facts.push(`${key}: Empty array.`);
                }
            } else if (data) {
                let metaStr = ``;
                if (data.source) metaStr += ` (Source: ${data.source})`;
                if (data.updatedAt) metaStr += ` (Updated: ${new Date(data.updatedAt).toISOString()})`;
                facts.push(`${key}: Found valid data.${metaStr}`);
            }
        }

        if (facts.length === 0) facts.push('No state data retrieved.');
        if (missing.length === 0) missing.push('None identified.');

        let contradictionList = contradictions.length > 0 
            ? contradictions.map(c => c.description) 
            : ['None'];

        return `
Objective:
  ${intentPlan.intents.join(', ')}

Facts:
  - ${facts.join('\n  - ')}

Contradictions:
  - ${contradictionList.join('\n  - ')}

Missing:
  - ${missing.join('\n  - ')}

Decision:
  ${executiveDirective}
        `.trim();
    }
}

module.exports = { ExecutiveLayer, SimulationEngine };
