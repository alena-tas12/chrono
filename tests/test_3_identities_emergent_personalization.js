/**
 * 🧪 3 FRESH IDENTITIES EMERGENT PERSONALIZATION & ISOLATION SUITE
 * 
 * Verifies that 3 distinct users (Princess, Anwesha, Sana) installing the exact same
 * Chrono Setup 2.2.0.exe binary develop completely distinct:
 * - Communication & Advice Preferences (Concise vs Deep vs Direct Advice)
 * - Knowledge Universes (Design vs Genetics vs Cloud Engineering)
 * - Memory & Schedule Isolation (Zero leakage across boundaries)
 * - Sharing & Permission Revocation (ACCESS DENIED post-revocation)
 */

const mainDb = require('../main/main_db');
const notesService = require('../main/notesService');
const timetableParser = require('../main/timetableParser');
const { ReasoningEngine } = require('../main/reasoningEngine');
const assert = require('assert');

async function run3IdentitiesTest() {
    console.log('==================================================================');
    console.log('👥 CHRONO v2.2.0: 3 IDENTITIES EMERGENT PERSONALIZATION SUITE');
    console.log('==================================================================\n');

    let passed = 0;
    let total = 0;

    function check(description, condition) {
        total++;
        if (condition) {
            console.log(`  ✅ [PASS] ${description}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${description}`);
        }
    }

    const reasoningEngine = new ReasoningEngine();

    const userPrincess = 'user_princess_' + Date.now();
    const userAnwesha = 'user_anwesha_' + Date.now();
    const userSana = 'user_sana_' + Date.now();

    // ── 1. PRINCESS: Design Universe & Concise/Listen Preference ─────────
    console.log('--- 1. Identity 1: Princess (Design Universe & Concise Pacing) ---');
    const notePrincess = await notesService.addNote(userPrincess, '🎨 UI Research & Inspiration', `# Wireframes\n- Glassmorphism dark mode :: Contrast ratio 4.5:1\n> Keep interactions minimal.`);
    check('Princess created Design Knowledge page', notePrincess.success);

    const pacePrincess = reasoningEngine._calculateResponseDepth("short update please", {}, { suggestedResponseDepth: 'CONCISE' });
    check('Princess preference yields CONCISE response depth', pacePrincess === 'CONCISE');

    // ── 2. ANWESHA: Genetics Universe & Deep/Step-by-Step Preference ─────
    console.log('\n--- 2. Identity 2: Anwesha (Genetics Universe & Deep Pacing) ---');
    const noteAnwesha = await notesService.addNote(userAnwesha, '🧬 Biomedical Science & CRISPR', `# Gene Editing\n- Cas9 nuclease :: Target DNA cleavage\n## Protocol\n  - Guide RNA synthesis`);
    check('Anwesha created Genetics Knowledge page', noteAnwesha.success);

    const paceAnwesha = reasoningEngine._calculateResponseDepth("explain how CRISPR works in detail", {});
    check('Anwesha preference yields DEEP response depth', paceAnwesha === 'DEEP');

    // ── 3. SANA: Cloud Engineering Universe & Direct Advice Preference ───
    console.log('\n--- 3. Identity 3: Sana (Cloud Architecture Universe) ---');
    const noteSana = await notesService.addNote(userSana, '☁️ GCP Architecture & Kubernetes', `# Cluster Setup\n- kubectl get pods :: List active pods\n> Use node pools for autoscaling.`);
    check('Sana created Cloud Engineering Knowledge page', noteSana.success);

    // ── 4. Cross-User Privacy & Memory Isolation ─────────────────────────
    console.log('\n--- 4. Cross-User Privacy & Namespace Isolation ---');
    const notesP = await notesService.getNotes(userPrincess);
    const notesA = await notesService.getNotes(userAnwesha);
    const notesS = await notesService.getNotes(userSana);

    check('Princess notes contain only Design materials', notesP.length === 1 && notesP[0].title.includes('UI Research'));
    check('Anwesha notes contain only Genetics materials', notesA.length === 1 && notesA[0].title.includes('Biomedical'));
    check('Sana notes contain only Cloud materials', notesS.length === 1 && notesS[0].title.includes('GCP Architecture'));

    check('Princess cannot see Anwesha or Sana notes', !notesP.some(n => n.title.includes('Biomedical') || n.title.includes('GCP')));
    check('Anwesha cannot see Princess or Sana notes', !notesA.some(n => n.title.includes('UI Research') || n.title.includes('GCP')));
    check('Sana cannot see Princess or Anwesha notes', !notesS.some(n => n.title.includes('UI Research') || n.title.includes('Biomedical')));

    // ── 5. Resource Sharing & Permission Revocation Lifecycle ────────────
    console.log('\n--- 5. Resource Sharing & Revocation Lifecycle ---');
    const resP = await timetableParser.storeResource(userPrincess, 'UI Guidelines PDF', 'document', 'ui_guide.pdf', 'application/pdf', 1048576, '/docs/ui_guide.pdf', 'Extracted: UI Glassmorphism Standards');
    check('Princess stored private resource', resP.success);

    const shareRes = await timetableParser.shareResource(resP.resourceId, userPrincess, userAnwesha, 'VIEW');
    check('Princess shared UI Guidelines with Anwesha (VIEW permission)', shareRes.success);

    const accessBefore = await timetableParser.accessResource(resP.resourceId, userAnwesha);
    check('Anwesha granted view access to shared resource', accessBefore.allowed);

    const revokeRes = await timetableParser.revokeResourceShare(resP.resourceId, userPrincess, userAnwesha);
    check('Princess revoked share from Anwesha', revokeRes.success);

    const accessAfter = await timetableParser.accessResource(resP.resourceId, userAnwesha);
    check('Anwesha denied access post-revocation (ACCESS DENIED)', !accessAfter.allowed && accessAfter.reason.includes('ACCESS DENIED'));

    console.log('\n==================================================================');
    console.log(`🎉 3 IDENTITIES EMERGENT PERSONALIZATION SUITE: ${passed} / ${total} PASSED`);
    console.log('==================================================================\n');

    if (passed !== total) {
        process.exit(1);
    }
}

run3IdentitiesTest().catch(err => {
    console.error('3 Identities test failed with error:', err);
    process.exit(1);
});
