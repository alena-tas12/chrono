/**
 * 🧠 CHRONO COGNITIVE OS - BEHAVIORAL BENCHMARK
 * Tests the core pipeline (Dispatch -> Executive -> ContextBuilder) without hitting the LLM.
 */

const { DispatchEngine } = require('./main/dispatchEngine');
const { ExecutiveLayer } = require('./main/executiveLayer');
const { StateManager } = require('./main/stateManager');
const { MemoryModule } = require('./main/memoryModule');
const { EventBus } = require('./main/eventBus');

async function runBenchmark() {
    console.log("Starting Chrono AI Behavioral Benchmark...\n");
    
    // Minimal mock setups
    const mockDb = { generateUUID: () => 'uuid' };
    const stateManager = new StateManager();
    
    // Stub some data
    stateManager.worldState.calendarEvents = [
        { 
            value: { title: "Networking Lab", location: "Lab" }, 
            dependencies: [],
            observations: [{ timestamp: Date.now() }],
            freshness: {}
        }
    ];
    stateManager.worldState.activeProjects = []; // Empty, to trigger missing validation

    const dispatchEngine = new DispatchEngine({ stateManager });
    const executiveLayer = new ExecutiveLayer();
    
    const questions = [
        "What do I have tomorrow?",
        "Continue the current project.",
        "What changed since yesterday?",
        "Why are these two events conflicting?",
        "What information are you missing to answer this?"
    ];

    let passed = 0;
    
    for (const q of questions) {
        console.log(`[Query]: "${q}"`);
        
        // 1. Dispatch
        const plan = await dispatchEngine.planIntent({ input: q, session: {} });
        const retrieved = await dispatchEngine.retrieve(plan);
        const contradictions = dispatchEngine.detectContradictions({ userInput: q, ...retrieved });
        const opportunities = dispatchEngine.detectOpportunities(retrieved);
        
        // 2. Executive
        const pipelineResult = executiveLayer.executePipeline(plan, retrieved, contradictions, opportunities);
        
        // 3. Output Context Built
        console.log("--- Context Sent to LLM ---");
        console.log(pipelineResult.contextSummary);
        console.log("---------------------------\n");
        passed++;
    }

    console.log(`\nBenchmark complete. Passed: ${passed}/${questions.length}`);
}

runBenchmark().catch(console.error);
