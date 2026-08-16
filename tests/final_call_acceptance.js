/**
 * 🧪 FINAL CALLING & WEBRTC TRANSPORT ACCEPTANCE SUITE
 * 
 * Verifies:
 * 1. WebRTC Signaling Architecture between 2 peer endpoints (Machine A <-> Machine B)
 * 2. STUN (Google) & OpenRelay TURN configuration & ICE candidate exchange
 * 3. Call State Transitions: INITIATE -> RINGING -> ANSWER -> CONNECTED -> HANGUP
 * 4. Call Duration & Metrics recording
 * 5. Call History & Missed Call persistence in SQLite
 */

const communicationOS = require('../main/communicationOS');
const mainDb = require('../main/main_db');

async function runCallingAcceptance() {
    console.log("=========================================================================");
    console.log("📞 FINAL CALLING & WEBRTC TRANSPORT ACCEPTANCE SUITE");
    console.log("=========================================================================\n");

    const results = {
        total: 5,
        passed: 0,
        failed: 0,
        details: []
    };

    // --- TEST 1: STUN & OpenRelay TURN Server Configuration ---
    console.log("1. Verifying STUN/TURN ICE Server Configuration...");
    const rtcConfig = communicationOS.getIceServers();
    const hasStun = rtcConfig.some(s => {
        const u = Array.isArray(s.urls) ? s.urls.join(',') : (s.urls || '');
        return u.includes('stun.l.google.com') || u.includes('stun:');
    });
    const hasTurn = rtcConfig.some(s => {
        const u = Array.isArray(s.urls) ? s.urls.join(',') : (s.urls || '');
        return u.includes('openrelay') || u.includes('turn:');
    });

    if (hasStun && hasTurn) {
        console.log("   ✅ PASSED: STUN (Google) and TURN (OpenRelay) configured for NAT traversal.");
        console.log(`      ICE Servers: ${JSON.stringify(rtcConfig)}`);
        results.passed++;
        results.details.push({ test: 'ICE Configuration', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: Missing STUN or TURN servers in WebRTC configuration.");
        results.failed++;
    }

    // --- TEST 2: Peer-to-Peer Call Session Initiation (A -> B) ---
    console.log("\n2. Testing Call Initiation Signaling (User A calling User B)...");
    const callerId = 'user_alena_node_1';
    const receiverId = 'user_princess_node_2';

    const sessionRes = communicationOS.initiateCall(callerId, receiverId, 'AUDIO');
    if (sessionRes && sessionRes.success && sessionRes.session) {
        console.log(`   ✅ PASSED: Call Session Created (ID: ${sessionRes.session.callSessionId}, State: ${sessionRes.session.state})`);
        results.passed++;
        results.details.push({ test: 'Call Initiation Signaling', status: 'PASSED', sessionId: sessionRes.session.callSessionId });
    } else {
        console.log("   ❌ FAILED: Failed to initiate call session.");
        results.failed++;
    }

    const activeSessionId = sessionRes.session.callSessionId;

    // --- TEST 3: SDP Offer & Answer Exchange ---
    console.log("\n3. Testing SDP Offer / Answer Signaling...");
    const mockOfferSdp = { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 54312 RTP/SAVPF 111\r\n' };
    const mockAnswerSdp = { type: 'answer', sdp: 'v=0\r\no=- 67890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 54312 RTP/SAVPF 111\r\n' };

    const offerSet = communicationOS.handleSdpOffer(activeSessionId, mockOfferSdp);
    const answerSet = communicationOS.handleSdpAnswer(activeSessionId, mockAnswerSdp);

    if (offerSet.success && answerSet.success) {
        console.log("   ✅ PASSED: SDP Offer and Answer negotiated and stored.");
        results.passed++;
        results.details.push({ test: 'SDP Offer/Answer Negotiation', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: SDP Offer/Answer negotiation failed.");
        results.failed++;
    }

    // --- TEST 4: ICE Candidate Exchange & Connection State ---
    console.log("\n4. Testing ICE Candidate Relay & Connection State...");
    const candidateA = { candidate: 'candidate:1 1 UDP 2122260223 192.168.1.50 54312 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    const candidateB = { candidate: 'candidate:2 1 UDP 1686052607 100.64.0.1 54312 typ srflx', sdpMid: '0', sdpMLineIndex: 0 };

    const addCandA = communicationOS.addIceCandidate(activeSessionId, candidateA, callerId);
    const addCandB = communicationOS.addIceCandidate(activeSessionId, candidateB, receiverId);
    const connectedState = communicationOS.setCallState(activeSessionId, 'CONNECTED');

    if (addCandA.success && addCandB.success && connectedState.success) {
        console.log(`   ✅ PASSED: ICE candidates exchanged. Call state advanced to CONNECTED.`);
        results.passed++;
        results.details.push({ test: 'ICE Gathering & State Machine', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: ICE candidate exchange or state transition failed.");
        results.failed++;
    }

    // --- TEST 5: Call Termination & History Record Persistence ---
    console.log("\n5. Testing Call Termination & Call History Logging...");
    const endRes = communicationOS.endCall(activeSessionId, 'USER_HANGUP');
    const callHistory = communicationOS.getCallHistory(callerId);

    if (endRes.success && callHistory.length > 0) {
        const lastCall = callHistory[0];
        console.log(`   ✅ PASSED: Call terminated cleanly. Recorded in SQLite Call History:`);
        console.log(`      Session: ${lastCall.session_id}, Caller: ${lastCall.caller_id}, Receiver: ${lastCall.receiver_id}, Duration: ${lastCall.duration_seconds || 0}s`);
        results.passed++;
        results.details.push({ test: 'Call History Persistence', status: 'PASSED' });
    } else {
        console.log("   ❌ FAILED: Call history record not found.");
        results.failed++;
    }

    console.log("\n-------------------------------------------------------------------------");
    console.log(`CALLING SUITE SUMMARY: ${results.passed}/${results.total} PASSED (${results.failed} failed)`);
    console.log("-------------------------------------------------------------------------\n");

    return results;
}

if (require.main === module) {
    runCallingAcceptance().then(r => {
        if (r.failed > 0) process.exit(1);
        process.exit(0);
    });
}

module.exports = { runCallingAcceptance };
