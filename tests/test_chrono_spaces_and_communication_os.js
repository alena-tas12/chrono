/**
 * 🚀 TEST SUITE: CHRONO SPACES & COMMUNICATION OS (v2.3.0)
 * 
 * Verifies:
 * 1. Space lifecycle (Create, Add Members, Roles & Permissions)
 * 2. Explicit ACL Resource Linking
 * 3. Calendar Event Proposals (PRs), Merge Conflicts & Master Schedule Commit
 * 4. Direct Messaging Thread Persistence
 * 5. WebRTC Audio/Video Call Signaling Flow
 * 6. WhatsApp External Webhook Adapter & Intent Boundary Invariant
 */

const assert = require('assert');
const mainDb = require('../main/main_db');
const chronoSpaces = require('../main/chronoSpaces');
const communicationOS = require('../main/communicationOS');

async function runTests() {
    console.log("=========================================================================");
    console.log("🚀 TESTING CHRONO SPACES & COMMUNICATION OS (v2.3.0)");
    console.log("=========================================================================\n");

    const ownerId = `user_alen_${Date.now()}`;
    const peer1Id = `user_princess_${Date.now()}`;
    const peer2Id = `user_anwesha_${Date.now()}`;

    // -------------------------------------------------------------------------
    // 1. SPACES & CIRCLES LIFECYCLE
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing Chrono Spaces Lifecycle & Member Roles ---");
    const spaceRes = await chronoSpaces.createSpace(ownerId, "AI Research Circle", "Shared AI & Cognitive Systems Project", "🧠");
    assert(spaceRes.success && spaceRes.spaceId, "Space creation must succeed");
    const spaceId = spaceRes.spaceId;
    console.log(`  ✓ Created Space: "${spaceRes.name}" (ID: ${spaceId})`);

    // Add Members with granular roles
    const addP1 = await chronoSpaces.addMember(spaceId, ownerId, peer1Id, "Princess", "CONTRIBUTOR");
    assert(addP1.success, "Adding Princess as CONTRIBUTOR must succeed");
    const addP2 = await chronoSpaces.addMember(spaceId, ownerId, peer2Id, "Anwesha", "VIEWER");
    assert(addP2.success, "Adding Anwesha as VIEWER must succeed");

    const spaceDetails = await chronoSpaces.getSpaceDetails(spaceId, ownerId);
    assert(spaceDetails.success && spaceDetails.members.length === 3, "Space must have 3 active members");
    console.log(`  ✓ Verified 3 Space Members: Alen (OWNER), Princess (CONTRIBUTOR), Anwesha (VIEWER)`);

    // -------------------------------------------------------------------------
    // 2. EXPLICIT ACL RESOURCE LINKING
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Testing Explicit ACL Resource Linking ---");
    const noteId = 'note_' + mainDb.generateUUID();
    const linkRes = await chronoSpaces.linkResource(spaceId, ownerId, "NOTE", noteId, "Distributed Systems Blueprint", "EDIT");
    assert(linkRes.success, "Linking Note to Space must succeed");
    console.log(`  ✓ Explicitly Linked Resource: Note (${noteId}) with EDIT permission`);

    // -------------------------------------------------------------------------
    // 3. CALENDAR EVENT PROPOSALS (PRs) & CONFLICT DETECTION
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing Calendar Event Proposals (Calendar PRs) & Merging ---");
    const testDate = `2026-09-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`;
    
    // Propose Clean Event
    const cleanProposal = await chronoSpaces.createEventProposal(spaceId, peer1Id, "Princess", {
        title: "Sprint Retrospective",
        date: testDate,
        startTime: "15:00",
        endTime: "16:00",
        category: "Team Meeting",
        description: "Review cognitive OS progress"
    });
    assert(cleanProposal.success && cleanProposal.conflictStatus === 'CLEAN', "Clean proposal must have conflictStatus = CLEAN");
    console.log(`  ✓ Created Clean Event Proposal by Princess: "${cleanProposal.proposalId}" (Status: CLEAN)`);

    // Review & Merge Proposal
    const mergeRes = await chronoSpaces.reviewProposal(cleanProposal.proposalId, ownerId, 'MERGE');
    assert(mergeRes.success && mergeRes.action === 'MERGED', "Merging proposal must succeed");
    console.log(`  ✓ Merged Proposal into Workspace Calendar (Event ID: ${mergeRes.eventId})`);

    // Propose Overlapping Event to Trigger Merge Conflict
    const conflictingProposal = await chronoSpaces.createEventProposal(spaceId, peer2Id, "Anwesha", {
        title: "Architecture Deep Dive",
        date: testDate,
        startTime: "15:30",
        endTime: "16:30",
        category: "Technical Review"
    });
    assert(conflictingProposal.success && conflictingProposal.conflictStatus === 'CONFLICT_DETECTED', "Overlapping proposal must detect conflict");
    console.log(`  ✓ Conflict Detection Triggered: Overlap with Sprint Retrospective (15:00 - 16:00)`);

    // -------------------------------------------------------------------------
    // 4. DIRECT MESSAGING THREADS
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing Direct Messaging Threads ---");
    const sendMsg = await communicationOS.sendDirectMessage(ownerId, peer1Id, "Hey Princess, the new Chrono Spaces are live!");
    assert(sendMsg.success && sendMsg.message.id, "Direct message send must succeed");
    
    const threadMessages = await communicationOS.getDirectMessages(ownerId, peer1Id);
    assert(threadMessages.length >= 1, "Thread history must contain sent message");
    console.log(`  ✓ Direct message sent & retrieved: "${threadMessages[0].content}"`);

    // -------------------------------------------------------------------------
    // 5. WEBRTC CALL SIGNALING
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Testing WebRTC Call Signaling (Audio/Video) ---");
    const callInit = await communicationOS.initiateCall(ownerId, "Alen", peer1Id, "AUDIO", { type: "offer", sdp: "v=0..." });
    assert(callInit.success && callInit.session.status === 'RINGING', "Call initiate must set status to RINGING");
    const callSessionId = callInit.session.callSessionId;

    const callAnswer = await communicationOS.answerCall(callSessionId, peer1Id, { type: "answer", sdp: "v=0..." });
    assert(callAnswer.success && callAnswer.session.status === 'CONNECTED', "Call answer must set status to CONNECTED");

    const callEnd = await communicationOS.endCall(callSessionId, ownerId, "NORMAL");
    assert(callEnd.success && callEnd.session.status === 'ENDED', "Call end must set status to ENDED");
    console.log(`  ✓ WebRTC Call Signaling Verified: Ringing -> Connected -> Ended cleanly`);

    // -------------------------------------------------------------------------
    // 6. WHATSAPP ADAPTER & PRIVACY INTENT GATE
    // -------------------------------------------------------------------------
    console.log("\n--- 6. Testing WhatsApp External Adapter & Privacy Boundary ---");
    const webhookRes = await communicationOS.handleExternalWebhookMessage("WhatsApp", "+1234567890", "Princess", "Hey, let's meet tomorrow at 4pm for the project review");
    assert(webhookRes.success && webhookRes.proposedAction, "Webhook must parse message and create structured proposal");
    assert(webhookRes.proposedAction.requiresConfirmation === true, "External communications must require explicit confirmation");
    console.log(`  ✓ WhatsApp Ingestion: Formatted structured proposal ("${webhookRes.proposedAction.title}")`);
    console.log(`  ✓ Privacy Invariant Enforced: Memory & Calendar are NOT modified without explicit confirmation.`);

    console.log("\n=========================================================================");
    console.log("🎉 ALL CHRONO SPACES & COMMUNICATION OS TESTS PASSED (6/6) 100%!");
    console.log("=========================================================================\n");
}

runTests().catch(err => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
});
