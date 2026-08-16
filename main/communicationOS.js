/**
 * 📡 CHRONO COMMUNICATION OS: DIRECT MESSAGING, WEBRTC CALLING & EXTERNAL ADAPTERS
 */

const mainDb = require('./main_db');

function getDb() {
    const db = (typeof mainDb.getDb === 'function' ? mainDb.getDb() : mainDb.db);
    try {
        db.prepare(`
            CREATE TABLE IF NOT EXISTS chrono_call_history (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                caller_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                call_type TEXT DEFAULT 'AUDIO',
                status TEXT DEFAULT 'ENDED',
                duration_seconds INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )
        `).run();
        db.prepare(`
            CREATE TABLE IF NOT EXISTS chrono_direct_messages (
                id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                recipient_id TEXT NOT NULL,
                content TEXT NOT NULL,
                media_url TEXT,
                origin TEXT DEFAULT 'CHRONO',
                read_status INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )
        `).run();
    } catch(e) {}
    return db;
}

class CommunicationOS {
    constructor() {
        this.activeCalls = new Map();
    }

    async sendDirectMessage(senderId, recipientId, content, mediaUrl = null, origin = 'CHRONO') {
        const db = getDb();
        try {
            const msgId = 'msg_' + mainDb.generateUUID();
            const threadId = [senderId, recipientId].sort().join('_');
            const now = Date.now();

            db.prepare(`
                INSERT INTO chrono_direct_messages (id, thread_id, sender_id, recipient_id, content, media_url, origin, read_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
            `).run(msgId, threadId, senderId, recipientId, content, mediaUrl, origin, now);

            return {
                success: true,
                message: {
                    id: msgId,
                    threadId,
                    senderId,
                    recipientId,
                    content,
                    mediaUrl,
                    origin,
                    createdAt: now
                }
            };
        } catch (e) {
            console.error("CommunicationOS: Failed to send direct message:", e.message);
            return { success: false, error: e.message };
        }
    }

    async getDirectMessages(userId, peerId, limit = 50) {
        const db = getDb();
        try {
            const threadId = [userId, peerId].sort().join('_');
            const messages = db.prepare(`
                SELECT * FROM chrono_direct_messages 
                WHERE thread_id = ? 
                ORDER BY created_at ASC 
                LIMIT ?
            `).all(threadId, limit);

            return messages;
        } catch (e) {
            console.error("CommunicationOS: Failed to get direct messages:", e.message);
            return [];
        }
    }

    async markMessagesRead(userId, peerId) {
        const db = getDb();
        try {
            const threadId = [userId, peerId].sort().join('_');
            db.prepare(`
                UPDATE chrono_direct_messages 
                SET read_status = 1 
                WHERE thread_id = ? AND recipient_id = ?
            `).run(threadId, userId);

            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    getIceServers() {
        const customTurn = mainDb.getSyncMeta('turn_server_url');
        const customTurnUser = mainDb.getSyncMeta('turn_server_user');
        const customTurnPass = mainDb.getSyncMeta('turn_server_pass');

        const servers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            {
                urls: [
                    'turn:openrelay.metered.ca:80',
                    'turn:openrelay.metered.ca:443',
                    'turns:openrelay.metered.ca:443?transport=tcp'
                ],
                username: 'openrelay',
                credential: 'openrelay'
            }
        ];

        if (customTurn && customTurnUser && customTurnPass) {
            servers.unshift({
                urls: customTurn,
                username: customTurnUser,
                credential: customTurnPass
            });
        }

        return servers;
    }

    initiateCall(callerId, receiverId, callType = 'AUDIO', callerName = 'User') {
        const callSessionId = `call_${callerId}_${receiverId}_${Date.now()}`;
        const session = {
            callSessionId,
            callerId,
            callerName,
            receiverId,
            callType,
            sdpOffer: null,
            sdpAnswer: null,
            iceCandidates: [],
            iceServers: this.getIceServers(),
            state: 'RINGING',
            status: 'RINGING',
            startedAt: Date.now()
        };
        this.activeCalls.set(callSessionId, session);

        return {
            success: true,
            callSessionId,
            session
        };
    }

    handleSdpOffer(callSessionId, sdpOffer) {
        const session = this.activeCalls.get(callSessionId);
        if (!session) return { success: false, error: "Call session not found" };
        session.sdpOffer = sdpOffer;
        session.state = 'OFFER_RECEIVED';
        return { success: true, session };
    }

    handleSdpAnswer(callSessionId, sdpAnswer) {
        const session = this.activeCalls.get(callSessionId);
        if (!session) return { success: false, error: "Call session not found" };
        session.sdpAnswer = sdpAnswer;
        session.state = 'CONNECTED';
        session.status = 'CONNECTED';
        session.connectedAt = Date.now();
        return { success: true, session };
    }

    answerCall(callSessionId, sdpAnswer) {
        return this.handleSdpAnswer(callSessionId, sdpAnswer);
    }

    addIceCandidate(callSessionId, candidate, senderId) {
        const session = this.activeCalls.get(callSessionId);
        if (!session) return { success: false, error: "Call session not found" };
        session.iceCandidates.push({ candidate, senderId, receivedAt: Date.now() });
        return { success: true, count: session.iceCandidates.length };
    }

    setCallState(callSessionId, state) {
        const session = this.activeCalls.get(callSessionId);
        if (!session) return { success: false, error: "Call session not found" };
        session.state = state;
        session.status = state;
        if (state === 'CONNECTED' && !session.connectedAt) {
            session.connectedAt = Date.now();
        }
        return { success: true, session };
    }

    endCall(callSessionId, arg2 = 'NORMAL', arg3 = null) {
        const reason = typeof arg2 === 'string' && !arg3 ? arg2 : (arg3 || 'NORMAL');
        const db = getDb();
        const session = this.activeCalls.get(callSessionId);
        const now = Date.now();

        if (session) {
            session.state = 'ENDED';
            session.status = 'ENDED';
            session.endedAt = now;
            session.durationSeconds = session.connectedAt ? Math.round((now - session.connectedAt) / 1000) : 0;

            try {
                db.prepare(`
                    INSERT INTO chrono_call_history (id, session_id, caller_id, receiver_id, call_type, status, duration_seconds, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    mainDb.generateUUID(),
                    session.callSessionId,
                    session.callerId,
                    session.receiverId,
                    session.callType || 'AUDIO',
                    'COMPLETED',
                    session.durationSeconds,
                    now
                );
            } catch(e) {
                console.warn("Failed to persist call history:", e.message);
            }

            this.activeCalls.delete(callSessionId);
            return { success: true, session };
        }
        return { success: true, status: 'ENDED' };
    }

    getCallHistory(userId) {
        const db = getDb();
        try {
            return db.prepare(`
                SELECT * FROM chrono_call_history 
                WHERE caller_id = ? OR receiver_id = ?
                ORDER BY created_at DESC 
                LIMIT 50
            `).all(userId, userId);
        } catch(e) {
            return [];
        }
    }

    async handleExternalWebhookMessage(platform, senderIdentifier, senderName, rawContent) {
        const db = getDb();
        const now = Date.now();

        const threadId = `ext_${platform}_${senderIdentifier}`;
        const msgId = 'ext_msg_' + mainDb.generateUUID();

        db.prepare(`
            INSERT INTO chrono_direct_messages (id, thread_id, sender_id, recipient_id, content, media_url, origin, read_status, created_at)
            VALUES (?, ?, ?, 'local_user', ?, NULL, ?, 0, ?)
        `).run(msgId, threadId, senderIdentifier, rawContent, platform.toUpperCase(), now);

        const dateMatch = rawContent.match(/\b(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2})\b/i);
        const timeMatch = rawContent.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

        let proposedAction = null;
        if (dateMatch && (rawContent.toLowerCase().includes('meet') || rawContent.toLowerCase().includes('call') || rawContent.toLowerCase().includes('session'))) {
            proposedAction = {
                type: 'CALENDAR_PROPOSAL',
                title: `Meeting with ${senderName} (${platform})`,
                dateReference: dateMatch[1],
                timeReference: timeMatch ? timeMatch[1] : '10:00 AM',
                requiresConfirmation: true,
                message: `External ${platform} message received: "${rawContent}". Would you like to schedule this?`
            };
        }

        return {
            success: true,
            platform,
            sender: { identifier: senderIdentifier, name: senderName },
            messageId: msgId,
            proposedAction
        };
    }
}

module.exports = new CommunicationOS();
