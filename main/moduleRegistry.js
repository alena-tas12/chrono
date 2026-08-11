/**
 * 📦 CHRONO COGNITIVE OS - MODULE REGISTRY
 * 
 * Replaces the old 'multiAgentSystem.js'.
 * Modules advertise capabilities. Dispatch queries capabilities.
 */

const Modules = {
    Calendar: {
        name: 'Calendar',
        capabilities: ['retrieve_events', 'create_event', 'modify_event']
    },
    Tasks: {
        name: 'Tasks',
        capabilities: ['retrieve_tasks', 'complete_task', 'delete_task']
    },
    Goals: {
        name: 'Goals',
        capabilities: ['retrieve_goals', 'update_progress']
    },
    MemoryModule: {
        name: 'MemoryModule',
        capabilities: ['query_nodes', 'write_memory', 'evaluate_trust']
    },
    Sleep: {
        name: 'Sleep',
        capabilities: ['retrieve_sleep']
    },
    Health: {
        name: 'Health',
        capabilities: ['retrieve_energy_estimate']
    },
    Email: {
        name: 'Email',
        capabilities: ['read_inbox']
    },
    Files: {
        name: 'Files',
        capabilities: ['search_documents']
    },
    Projects: {
        name: 'Projects',
        capabilities: ['retrieve_project_status']
    }
};

class ModuleRegistry {
    getModulesByCapability(capability) {
        const matches = [];
        for (const [key, mod] of Object.entries(Modules)) {
            if (mod.capabilities.includes(capability)) {
                matches.push(mod);
            }
        }
        return matches;
    }

    getAllModules() {
        return Object.keys(Modules);
    }
}

module.exports = { ModuleRegistry, Modules };
