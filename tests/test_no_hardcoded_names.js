/**
 * ✅ TEST: No Hardcoded Personal Names in Runtime Files
 *
 * Greps all runtime source files for hardcoded personal names
 * that must not exist in the production codebase.
 *
 * Run via: node tests/test_no_hardcoded_names.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Files to scan (runtime files only — not tests, not this script)
const FILES_TO_SCAN = [
    'main/multiAgentSystem.js',
    'main/cognitiveOrchestrator.js',
    'main/reasoningEngine.js',
    'main/dispatchEngine.js',
    'main/memoryEngine.js',
    'main/contextCompression.js',
    'main/jarvisLayer.js',
    'main/continuityStability.js',
    'main/relationshipOS.js',
    'server/ai_gateway.js',
    'ui/index.html',
    'ui/app.js'
];

// Names that must NOT appear in runtime code as hardcoded strings
// (they are allowed to appear in DB query results — not source)
const BANNED_PATTERNS = [
    { name: 'Princess (hardcoded name)', pattern: /['"`]Princess['"`]|>Princess<|placeholder.*Princess|onclick.*Princess/i },
    { name: 'Vian (hardcoded routing)', pattern: /lowerInput\.includes\(['"`]vian['"`]\)/i },
    { name: 'Rayhaan (hardcoded routing)', pattern: /lowerInput\.includes\(['"`]rayhaan['"`]\)/i },
    { name: 'Anwesha (hardcoded routing)', pattern: /lowerInput\.includes\(['"`]anwesha['"`]\)/i },
    { name: 'Trisha (hardcoded routing)', pattern: /lowerInput\.includes\(['"`]trisha['"`]\)/i },
];

let passed = 0;
let failed = 0;

console.log('\n🔍 TEST: No Hardcoded Personal Names\n');

for (const relPath of FILES_TO_SCAN) {
    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) {
        console.log(`  ⚠️  SKIP: ${relPath} (file not found)`);
        continue;
    }

    const content = fs.readFileSync(absPath, 'utf-8');

    for (const { name, pattern } of BANNED_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
            console.error(`  ❌ FAIL: ${relPath} → found "${name}" → "${matches[0].substring(0, 80)}"`);
            failed++;
        } else {
            console.log(`  ✅ ${relPath} — clean of "${name}"`);
            passed++;
        }
    }
}

console.log(`\n📊 Result: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
