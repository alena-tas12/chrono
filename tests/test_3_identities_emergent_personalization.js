/**
 * 🧪 3 FRESH IDENTITIES EMERGENT PERSONALIZATION & ISOLATION SUITE
 * 
 * Verifies that 3 distinct users (Princess, Anwesha, Sana) using the exact same
 * Chrono binary develop completely distinct:
 * - Adaptive Interaction Layer Calibrations (Concise vs Deep vs Fragmented Think-Aloud)
 * - Explicit vs. Inferred Preferences with Evidence and Confidence metrics
 * - Current-Session Overrides (Active turn overriding learned habits)
 * - Self-Correction Reflection ("A correction is evidence, not absolute truth")
 * - Knowledge Universes (Design vs Genetics vs Cloud Engineering)
 * - Memory & Namespace Isolation (Zero leakage across boundaries)
 * - Sharing & Permission Revocation (ACCESS DENIED post-revocation)
 */

const mainDb = require('../main/main_db');
const notesService = require('../main/notesService');
const timetableParser = require('../main/timetableParser');
const { ReasoningEngine } = require('../main/reasoningEngine');
const { PreferenceInference, InteractionPatternDetection, FeedbackInterpretation, SelfCorrectionLoop } = require('../main/interactionAdaptation');
const assert = require('assert');

async function run3IdentitiesTest() {
    console.log('==================================================================');
    console.log('👥 CHRONO: 3 IDENTITIES ADAPTIVE INTERACTION LAYER & ISOLATION');
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

    // ── 1. IDENTITY 1: PRINCESS (Direct / Concise Interaction Calibration) ─
    console.log('--- 1. Identity 1: Princess (Direct / Concise Calibration) ---');
    const notePrincess = await notesService.addNote(userPrincess, '🎨 UI Research & Inspiration', `# Wireframes\n- Glassmorphism dark mode :: Contrast ratio 4.5:1\n> Keep interactions minimal.`);
    check('Princess created Design Knowledge page', notePrincess.success);

    // Princess repeatedly sends concise requests
    for (let i = 0; i < 6; i++) {
        InteractionPatternDetection.analyzeInput(userPrincess, "just tell me the answer without explanation");
    }

    const princessDepthPref = PreferenceInference.getEffective(userPrincess, 'response_depth');
    check('Princess inferred preference: response_depth = CONCISE', princessDepthPref.value === 'CONCISE');
    check('Princess preference has confidence >= 0.70', princessDepthPref.confidence >= 0.70);
    check('Princess preference has evidence_count >= 6', princessDepthPref.evidence_count >= 6);

    // Neutral question defaults to CONCISE for Princess
    const pacePrincessNeutral = reasoningEngine._calculateResponseDepth("What is the difference between OSPF and RIP?", [], { userId: userPrincess });
    check('Princess neutral query inherits CONCISE pacing', pacePrincessNeutral === 'CONCISE');

    // Current-session override temporarily changes pacing without destroying long-term model
    const pacePrincessOverride = reasoningEngine._calculateResponseDepth("Actually go deep on this one", [], { userId: userPrincess });
    check('Princess current-session override yields DEEP pacing', pacePrincessOverride === 'DEEP');

    // ── 2. IDENTITY 2: ANWESHA (Deep / Explanatory Interaction Calibration) ─
    console.log('\n--- 2. Identity 2: Anwesha (Deep / Explanatory Calibration) ---');
    const noteAnwesha = await notesService.addNote(userAnwesha, '🧬 Biomedical Science & CRISPR', `# Gene Editing\n- Cas9 nuclease :: Target DNA cleavage\n## Protocol\n  - Guide RNA synthesis`);
    check('Anwesha created Genetics Knowledge page', noteAnwesha.success);

    for (let i = 0; i < 8; i++) {
        InteractionPatternDetection.analyzeInput(userAnwesha, "explain why this mechanism behaves this way in detail");
    }

    const anweshaDepthPref = PreferenceInference.getEffective(userAnwesha, 'response_depth');
    check('Anwesha inferred preference: response_depth = DEEP', anweshaDepthPref.value === 'DEEP');
    check('Anwesha preference has confidence >= 0.75', anweshaDepthPref.confidence >= 0.75);

    const paceAnweshaNeutral = reasoningEngine._calculateResponseDepth("How does mRNA translation occur?", [], { userId: userAnwesha });
    check('Anwesha neutral query inherits DEEP pacing', paceAnweshaNeutral === 'DEEP');

    // ── 3. IDENTITY 3: SANA (Fragmented Think-Aloud & Stream-of-Consciousness) 
    console.log('\n--- 3. Identity 3: Sana (Fragmented Think-Aloud Calibration) ---');
    const noteSana = await notesService.addNote(userSana, '☁️ GCP Architecture & Kubernetes', `# Cluster Setup\n- kubectl get pods :: List active pods\n> Use node pools for autoscaling.`);
    check('Sana created Cloud Engineering Knowledge page', noteSana.success);

    for (let i = 0; i < 5; i++) {
        InteractionPatternDetection.analyzeInput(userSana, "wait... actually... no, hold on... what i meant was Kubernetes pods");
    }

    const sanaTolerancePref = PreferenceInference.getEffective(userSana, 'externalization_tolerance');
    check('Sana inferred preference: externalization_tolerance = high', sanaTolerancePref.value === 'high');

    // ── 4. SELF-CORRECTION & EPISTEMIC HUMILITY ─────────────────────────
    console.log('\n--- 4. Self-Correction Loop ("Correction is Evidence, Not Truth") ---');
    const feedback = FeedbackInterpretation.interpret("No, that's not what I meant.");
    check('Feedback recognized as correction', feedback.type === 'correction');

    const correctionResult = SelfCorrectionLoop.process(userPrincess, feedback);
    check('Correction triggers reconsideration of context rather than blind fact rewriting', correctionResult.action === 'reconsider_context');

    // ── 5. CROSS-USER PRIVACY & ISOLATION ───────────────────────────────
    console.log('\n--- 5. Cross-User Privacy & Namespace Isolation ---');
    const notesP = await notesService.getNotes(userPrincess);
    const notesA = await notesService.getNotes(userAnwesha);
    const notesS = await notesService.getNotes(userSana);

    check('Princess notes contain only Design materials', notesP.length === 1 && notesP[0].title.includes('UI Research'));
    check('Anwesha notes contain only Genetics materials', notesA.length === 1 && notesA[0].title.includes('Biomedical'));
    check('Sana notes contain only Cloud materials', notesS.length === 1 && notesS[0].title.includes('GCP Architecture'));

    check('Princess cannot see Anwesha or Sana notes', !notesP.some(n => n.title.includes('Biomedical') || n.title.includes('GCP')));
    check('Anwesha cannot see Princess or Sana notes', !notesA.some(n => n.title.includes('UI Research') || n.title.includes('GCP')));
    check('Sana cannot see Princess or Anwesha notes', !notesS.some(n => n.title.includes('UI Research') || n.title.includes('Biomedical')));

    // Preferences are strictly isolated
    const prefsP = mainDb.getUserInteractionPrefs(userPrincess);
    const prefsA = mainDb.getUserInteractionPrefs(userAnwesha);
    check('Princess learned preferences are isolated from Anwesha', prefsP.response_depth.value === 'CONCISE' && prefsA.response_depth.value === 'DEEP');

    // ── 6. Resource Sharing & Permission Revocation Lifecycle ────────────
    console.log('\n--- 6. Resource Sharing & Revocation Lifecycle ---');
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
    console.log(`🎉 3 IDENTITIES ADAPTIVE INTERACTION SUITE: ${passed} / ${total} PASSED`);
    console.log('==================================================================\n');

    if (passed !== total) {
        process.exit(1);
    }
}

if (require.main === module) {
    run3IdentitiesTest().catch(err => {
        console.error("Test failed:", err);
        process.exit(1);
    });
}

module.exports = { run3IdentitiesTest };
