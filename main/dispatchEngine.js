/**
 * 🚀 CHRONO COGNITIVE OS - DISPATCH ENGINE
 * 
 * Owns retrieval planning. 
 * Formulates the World/User/Session states for reasoning without mutation.
 */

const { SemanticParser } = require('./semanticParser');
const episodicReplay = require('./episodicReplay');

class DispatchEngine {
    constructor({ stateManager, registry }) {
        this.stateManager = stateManager;
        this.registry = registry;
        this.semanticParser = new SemanticParser();
    }

    async planIntent({ input, session }) {
        // 1. True Semantic Parsing
        const parsedSemantics = await this.semanticParser.parse(input, session.history || []);
        
        let selectedModules = [];
        let intents = [];
        let activeContext = session.currentTopic || null;

        const func = parsedSemantics.function.value;
        const target = parsedSemantics.target.value;
        const domain = parsedSemantics.domain ? parsedSemantics.domain.value : null;

        // 2. Intent Classification based on pure semantic function
        if (func === 'explain' || func === 'explore') {
            intents.push('Explain');
            intents.push('Explore');
        } else if (func === 'plan') {
            intents.push('Plan');
            intents.push('Retrieve');
        } else if (func === 'self_exploration') {
            intents.push('Reflect');
            intents.push('Retrieve');
        } else if (func === 'social_inquiry' || func === 'casual_reaction') {
            intents.push('Social');
        } else {
            intents.push('Inform');
            intents.push('Retrieve');
        }

        // 3. Context-Aware Module Selection based on Semantics (Phase 4 Progressive Retrieval)
        const relation = parsedSemantics.relationToConversation.value;
        const lowerInput = input.toLowerCase();
        
        let intervention = { permitted: true };
        let context_retrieval = { permitted: true };
        let action = { permitted: true };
        let clarification_required = false;

        // 3a. Contract 13: Check if Cognitive Pace Engine can resolve trajectory/thread before flagging clarification
        const paceEngine = require('./cognitivePaceEngine').defaultPaceEngine;
        const paceAnalysis = paceEngine.trackThoughtTrajectory(input, session.history || []);
        if (paceAnalysis.isBacktrackQuery && (paceAnalysis.activeThread || paceAnalysis.threadStack.length > 0)) {
            clarification_required = false;
            intervention.permitted = true;
            context_retrieval.permitted = true;
            action.permitted = false;
        } else if (func === 'ambiguous') {
            clarification_required = true;
            intervention.permitted = false;
            context_retrieval.permitted = false;
            action.permitted = false;
            selectedModules = [];
        } 
        // 3b. Venting & Casual Talk -> ZERO intervention
        else if (func === 'venting' || func === 'casual_reaction' || func === 'social_inquiry') {
            intervention.permitted = false;
            context_retrieval.permitted = false;
            action.permitted = false;
            selectedModules = [];
        } 
        // 3c. Casual Observation -> Converse/Remember, but NO background fetching or action
        else if (func === 'casual_observation') {
            intervention.permitted = true; // Allowed to speak/save to memory
            context_retrieval.permitted = false;
            action.permitted = false;
            selectedModules = [];
        }
        // 3d. Correction -> Update Memory/Context vs Active Target Modification
        else if (func === 'correction') {
            const isActionModification = lowerInput.includes('put') || lowerInput.includes('schedule') || lowerInput.includes('move') || lowerInput.includes('change') || lowerInput.includes('set');
            intervention.permitted = true;
            context_retrieval.permitted = true;
            action.permitted = isActionModification && !lowerInput.includes("don't") && !lowerInput.includes("forget");
            selectedModules = ['Memory', 'KnowledgeBase']; 
            if (isActionModification) {
                selectedModules.push('Calendar');
                selectedModules.push('Tasks');
            }
        }
        // 3e. Explicit Action (Scheduling / Planning / Deletion) vs Queries
        else {
            const impliesScheduling = lowerInput.includes('tomorrow') || lowerInput.includes('today') || lowerInput.includes('organize') || lowerInput.includes('schedule') || lowerInput.includes('doing');
            const hasVagueTarget = lowerInput.includes('schedule it') || lowerInput.includes('put that on') || 
                                   lowerInput.includes('maybe we should') || lowerInput.includes('delete it') || 
                                   lowerInput.includes('remove it') || lowerInput.includes('cancel it') || 
                                   lowerInput.includes('delete that') || lowerInput.includes('remove that') || 
                                   lowerInput === 'delete' || lowerInput === 'remove' || lowerInput === 'cancel' || 
                                   (lowerInput.includes('schedule') && lowerInput.split(' ').length <= 4);

            const isScheduleQuery = lowerInput.includes('what do i have') || lowerInput.includes('what have i planned') || 
                                    lowerInput.includes("what's on my schedule") || lowerInput.includes("what is on my calendar") || 
                                    lowerInput.includes("review my week") || lowerInput.includes("what's planned");

            if ((func === 'schedule_action' || func === 'correction' || (intents.includes('Plan') && impliesScheduling))) {
                if (hasVagueTarget && !session.currentTopic) {
                    clarification_required = true;
                    action.permitted = false;
                    intervention.permitted = true;
                    context_retrieval.permitted = false;
                    selectedModules = [];
                } else {
                    selectedModules.push('Calendar');
                    selectedModules.push('Tasks');
                    action.permitted = !isScheduleQuery;
                }
            } else if (intents.includes('Plan')) {
                selectedModules.push('Projects');
                action.permitted = false;
            }

            if (lowerInput.includes('project')) {
                selectedModules.push('Projects');
            }

            if (func === 'self_exploration') {
                selectedModules.push('Sleep');
                selectedModules.push('Health');
                selectedModules.push('Memory');
                action.permitted = false;
            } 
            
            if ((target === 'user_data' && func !== 'schedule_action') || func === 'troubleshoot') {
                selectedModules.push('KnowledgeBase');
                if (impliesScheduling) selectedModules.push('Tasks');
                action.permitted = false;
            } else if (func === 'explain' || target === 'general_knowledge') {
                selectedModules.push('KnowledgeBase');
                action.permitted = false;
            } 
        }

        // 4. Determine if Simulation is needed (expensive execution mode)
        const requiresSimulation = func === 'troubleshoot' || input.toLowerCase().includes('what if');

        return {
            userInput: input,
            parsedSemantics, 
            intents,
            selectedModules,
            activeContext,
            requiresSimulation,
            retrievalContract: this._generateRetrievalContract(intents, selectedModules),
            
            // Phase 5 Behavioral Permissions
            intervention,
            context_retrieval,
            action,
            clarification_required
        };
    }

    _generateRetrievalContract(intents, modules) {
        let contract = {
            requiredFields: [],
            minimumConfidence: 0.7,
            maxIterations: 3
        };

        if (intents.includes('Plan')) {
            contract.requiredFields.push('calendar', 'tasks');
            contract.minimumConfidence = 0.9;
        }
        if (intents.includes('Reflect')) {
            contract.requiredFields.push('sleep', 'memory');
        }
        if (intents.includes('Explore')) {
            contract.requiredFields.push('knowledge');
        }

        return contract;
    }

    async retrieve(plan) {
        let compiledState = {};
        let iterations = 0;
        let satisfied = false;
        let currentModules = [...plan.selectedModules];

        // Iterative Retrieval Loop
        while (!satisfied && iterations < plan.retrievalContract.maxIterations) {
            iterations++;
            
            // 1. Fetch current chunk of state
            const stateChunk = this.stateManager.queryState(currentModules, { 
                iteration: iterations,
                userInput: plan.userInput 
            });
            compiledState = { ...compiledState, ...stateChunk };

            // 2. Evaluate against the Retrieval Contract
            const evaluation = this._evaluateContract(compiledState, plan.retrievalContract);
            
            if (evaluation.satisfied) {
                satisfied = true;
                compiledState._retrievalMeta = { iterations, satisfied: true };
            } else {
                // Not enough information. Determine what to fetch next.
                // In a mature system, this might use an LLM or heuristic to expand the search radius.
                currentModules = this._expandSearchRadius(evaluation.missingFields, currentModules);
                if (currentModules.length === 0) break; // Exhausted available modules
            }
        }

        if (!satisfied) {
            compiledState._retrievalMeta = { iterations, satisfied: false, warning: 'Retrieval contract not fully met.' };
        }
        
        compiledState._retrievalValidation = this.validateRetrieval(plan, compiledState);

        // Episodic Replay Pillar — always injected so the LLM knows what was recently completed
        try {
            compiledState.episodicReplay = episodicReplay.getEpisodeSummary(8);
        } catch (e) {
            compiledState.episodicReplay = [];
        }

        return compiledState;
    }

    _evaluateContract(state, contract) {
        let missing = [];
        
        for (const field of contract.requiredFields) {
            if (!state[field] || (Array.isArray(state[field]) && state[field].length === 0)) {
                missing.push(field);
            }
        }

        // We can add confidence checks here (e.g. state[field].provenance.confidence < minConfidence)
        return {
            satisfied: missing.length === 0,
            missingFields: missing
        };
    }

    _expandSearchRadius(missingFields, currentModules) {
        let nextModules = [];
        // If we are missing memory context, maybe query KnowledgeBase instead, or vice versa
        if (missingFields.includes('memory') && !currentModules.includes('KnowledgeBase')) {
            nextModules.push('KnowledgeBase');
        }
        if (missingFields.includes('calendar') && !currentModules.includes('Projects')) {
            nextModules.push('Projects');
        }
        return nextModules;
    }

    validateRetrieval(intentPlan, retrievedState) {
        let missing = [];
        
        if (intentPlan.intents.includes('Plan')) {
            if (!retrievedState.calendar || retrievedState.calendar.length === 0) {
                missing.push({ field: "calendar", reason: "NO_CALENDAR_EVENTS_FOUND" });
            }
            if (!retrievedState.tasks || retrievedState.tasks.length === 0) {
                missing.push({ field: "tasks", reason: "NO_TASKS_FOUND" });
            }
            if (!retrievedState.projects || retrievedState.projects.length === 0) {
                missing.push({ field: "projects", reason: "NO_ACTIVE_PROJECTS" });
            }
        }
        
        return {
            isSufficient: missing.length === 0,
            missing: missing
        };
    }

    detectContradictions(retrievedData) {
        let conflicts = [];

        // Example Contradiction Detection with Severity and Confidence
        if (retrievedData.userInput && retrievedData.calendar) {
            const userSaysHome = retrievedData.userInput.toLowerCase().includes('at home') || retrievedData.userInput.toLowerCase().includes('staying in');
            const hasMeeting = retrievedData.calendar.some(c => c.value && c.value.title && c.value.title.toLowerCase().includes('lab'));

            if (userSaysHome && hasMeeting) {
                conflicts.push({
                    type: 'LocationTemporalConflict',
                    description: 'User observed at home, but Calendar expects presence at Lab.',
                    severity: 'High', // Imported from EventSeverity.HIGH conceptually
                    confidence: 0.82 // "Likely missed event" - not absolute certainty
                });
            }
        }
        return conflicts;
    }

    detectOpportunities(retrievedData) {
        let opportunities = [];
        
        // Example Opportunity Detection
        if (retrievedData.calendar && retrievedData.projects) {
            const hasFreeFriday = true; // Stub: Analyze calendar for gaps
            const hasHighPriorityProject = retrievedData.projects.some(p => p.importance > 0.8);

            if (hasFreeFriday && hasHighPriorityProject) {
                opportunities.push({
                    type: 'ScheduleOptimization',
                    description: 'Friday is completely free. Excellent opportunity for deep work on high-priority project.',
                    confidence: 0.9
                });
            }
        }
        
        return opportunities;
    }

    formulateResponse(retrievedData) {
        // Epistemic Humility Check
        const hasData = Object.keys(retrievedData).length > 0 && 
                        Object.values(retrievedData).some(v => Array.isArray(v) ? v.length > 0 : !!v);

        if (!hasData) {
            return "I don't have enough information.";
        }
        return "Data retrieved successfully.";
    }
}

module.exports = { DispatchEngine };
