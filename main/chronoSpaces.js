/**
 * 🚀 CHRONO SPACES: GITHUB-STYLE CIRCLE COLLABORATION & EVENT PROPOSALS (PRs)
 * 
 * Provides decentralized team/friend spaces, granular ACL resource sharing,
 * calendar event proposals (PRs) with automated conflict detection, and merge commits.
 */

const mainDb = require('./main_db');

class ChronoSpaces {
    constructor() {
        this.db = mainDb.db;
    }

    /**
     * Create a new Collaborative Space
     */
    async createSpace(ownerId, name, description = '', icon = '🚀') {
        try {
            const spaceId = 'spc_' + mainDb.generateUUID();
            const now = Date.now();

            this.db.prepare(`
                INSERT INTO chrono_spaces (id, name, description, icon, owner_id, created_at, updated_at, synced, deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
            `).run(spaceId, name, description, icon, ownerId, now, now);

            // Add creator as OWNER
            this.db.prepare(`
                INSERT INTO chrono_space_members (space_id, user_id, display_name, role, joined_at, synced, deleted)
                VALUES (?, ?, 'Owner', 'OWNER', ?, 0, 0)
            `).run(spaceId, ownerId, now);

            return { success: true, spaceId, name };
        } catch (e) {
            console.error("ChronoSpaces: Failed to create space:", e.message);
            return { success: false, error: e.message };
        }
    }

    /**
     * List all Spaces a user belongs to
     */
    async getSpaces(userId) {
        try {
            const spaces = this.db.prepare(`
                SELECT s.*, m.role 
                FROM chrono_spaces s
                JOIN chrono_space_members m ON s.id = m.space_id
                WHERE m.user_id = ? AND s.deleted = 0 AND m.deleted = 0
                ORDER BY s.updated_at DESC
            `).all(userId);

            return spaces;
        } catch (e) {
            console.error("ChronoSpaces: Failed to get spaces:", e.message);
            return [];
        }
    }

    /**
     * Get detailed Space information including members and stats
     */
    async getSpaceDetails(spaceId, userId) {
        try {
            const memberCheck = this.db.prepare(`
                SELECT role FROM chrono_space_members 
                WHERE space_id = ? AND user_id = ? AND deleted = 0
            `).get(spaceId, userId);

            if (!memberCheck) {
                return { success: false, error: "Access Denied: Not a member of this space." };
            }

            const space = this.db.prepare(`SELECT * FROM chrono_spaces WHERE id = ? AND deleted = 0`).get(spaceId);
            const members = this.db.prepare(`
                SELECT user_id, display_name, role, joined_at 
                FROM chrono_space_members 
                WHERE space_id = ? AND deleted = 0
            `).all(spaceId);

            const resources = this.db.prepare(`
                SELECT * FROM chrono_space_resources WHERE space_id = ?
            `).all(spaceId);

            const proposals = this.db.prepare(`
                SELECT * FROM chrono_space_proposals WHERE space_id = ? ORDER BY created_at DESC
            `).all(spaceId);

            return {
                success: true,
                space,
                userRole: memberCheck.role,
                members,
                resources,
                proposals
            };
        } catch (e) {
            console.error("ChronoSpaces: Failed to get space details:", e.message);
            return { success: false, error: e.message };
        }
    }

    /**
     * Add a member to a Space
     */
    async addMember(spaceId, requesterId, targetUserId, displayName = 'Member', role = 'CONTRIBUTOR') {
        try {
            const requester = this.db.prepare(`
                SELECT role FROM chrono_space_members WHERE space_id = ? AND user_id = ? AND deleted = 0
            `).get(spaceId, requesterId);

            if (!requester || (requester.role !== 'OWNER' && requester.role !== 'MAINTAINER')) {
                return { success: false, error: "Permission Denied: Must be OWNER or MAINTAINER to add members." };
            }

            const now = Date.now();
            this.db.prepare(`
                INSERT OR REPLACE INTO chrono_space_members (space_id, user_id, display_name, role, joined_at, synced, deleted)
                VALUES (?, ?, ?, ?, ?, 0, 0)
            `).run(spaceId, targetUserId, displayName, role, now);

            return { success: true, spaceId, targetUserId, role };
        } catch (e) {
            console.error("ChronoSpaces: Failed to add member:", e.message);
            return { success: false, error: e.message };
        }
    }

    /**
     * Explicitly link a resource (Note, File, or Milestone) to a Space
     */
    async linkResource(spaceId, requesterId, resourceType, resourceId, title, permissionLevel = 'VIEW') {
        try {
            const requester = this.db.prepare(`
                SELECT role FROM chrono_space_members WHERE space_id = ? AND user_id = ? AND deleted = 0
            `).get(spaceId, requesterId);

            if (!requester) {
                return { success: false, error: "Access Denied." };
            }

            const linkId = 'lnk_' + mainDb.generateUUID();
            const now = Date.now();

            this.db.prepare(`
                INSERT INTO chrono_space_resources (id, space_id, resource_type, resource_id, title, permission_level, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(linkId, spaceId, resourceType, resourceId, title, permissionLevel, now);

            return { success: true, linkId };
        } catch (e) {
            console.error("ChronoSpaces: Failed to link resource:", e.message);
            return { success: false, error: e.message };
        }
    }

    /**
     * Create a Calendar Event Proposal ("Calendar PR")
     * Performs automated conflict detection against all space members.
     */
    async createEventProposal(spaceId, proposerId, proposerName, eventData) {
        try {
            const { title, date, startTime, endTime, category, location, description } = eventData;
            const proposalId = 'pr_' + mainDb.generateUUID();
            const now = Date.now();

            // Conflict Check: Query existing events on that date for conflicting time windows
            let conflictStatus = 'CLEAN';
            let conflictDetails = null;

            const existingTasks = this.db.prepare(`
                SELECT text, start_time, duration_min, date 
                FROM tasks 
                WHERE date = ? AND deleted = 0
            `).all(date);

            function toMinutes(tStr) {
                if (!tStr) return 540; // 09:00 default
                const parts = tStr.split(':');
                return parseInt(parts[0], 10) * 60 + (parseInt(parts[1], 10) || 0);
            }

            const propStart = toMinutes(startTime);
            const propEnd = endTime ? toMinutes(endTime) : (propStart + 60);

            const conflicts = existingTasks.filter(t => {
                if (!t.start_time) return false;
                const tStart = toMinutes(t.start_time);
                const tEnd = tStart + (t.duration_min || 60);
                return (propStart < tEnd && propEnd > tStart);
            });

            if (conflicts.length > 0) {
                conflictStatus = 'CONFLICT_DETECTED';
                conflictDetails = JSON.stringify(conflicts.map(c => ({
                    event: c.text,
                    time: `${c.start_time} (+${c.duration_min || 60}m)`
                })));
            }

            const payloadJson = JSON.stringify({
                title,
                date,
                startTime,
                endTime,
                category: category || 'Group Focus',
                location: location || 'Online Space',
                description: description || ''
            });

            this.db.prepare(`
                INSERT INTO chrono_space_proposals (id, space_id, proposer_id, proposer_name, proposal_type, title, payload_json, status, conflict_status, conflict_details, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'CALENDAR_EVENT', ?, ?, 'OPEN', ?, ?, ?, ?)
            `).run(proposalId, spaceId, proposerId, proposerName, title, payloadJson, conflictStatus, conflictDetails, now, now);

            return {
                success: true,
                proposalId,
                conflictStatus,
                conflictDetails: conflictDetails ? JSON.parse(conflictDetails) : null
            };
        } catch (e) {
            console.error("ChronoSpaces: Failed to create event proposal:", e.message);
            return { success: false, error: e.message };
        }
    }

    /**
     * Review and Merge or Reject an Event Proposal (Merge PR)
     */
    async reviewProposal(proposalId, reviewerId, action = 'MERGE', feedback = '') {
        try {
            const proposal = this.db.prepare(`SELECT * FROM chrono_space_proposals WHERE id = ?`).get(proposalId);
            if (!proposal) return { success: false, error: "Proposal not found." };

            const member = this.db.prepare(`
                SELECT role FROM chrono_space_members WHERE space_id = ? AND user_id = ? AND deleted = 0
            `).get(proposal.space_id, reviewerId);

            if (!member) return { success: false, error: "Access Denied." };

            const now = Date.now();

            if (action === 'MERGE') {
                const payload = JSON.parse(proposal.payload_json);

                // Commit event to the workspace calendar (tasks table)
                const eventId = 'ev_' + mainDb.generateUUID();
                this.db.prepare(`
                    INSERT INTO tasks (id, text, date, calendar, completed, start_time, duration_min, updated_at, device_id, synced, deleted)
                    VALUES (?, ?, ?, 'space', 0, ?, 60, ?, 'space_merge', 0, 0)
                `).run(
                    eventId,
                    `[${proposal.title}]`,
                    payload.date,
                    payload.startTime || '09:00',
                    now
                );

                this.db.prepare(`
                    UPDATE chrono_space_proposals 
                    SET status = 'MERGED', updated_at = ? 
                    WHERE id = ?
                `).run(now, proposalId);

                return { success: true, action: 'MERGED', eventId };
            } else {
                this.db.prepare(`
                    UPDATE chrono_space_proposals 
                    SET status = 'REJECTED', updated_at = ? 
                    WHERE id = ?
                `).run(now, proposalId);

                return { success: true, action: 'REJECTED', feedback };
            }
        } catch (e) {
            console.error("ChronoSpaces: Failed to review proposal:", e.message);
            return { success: false, error: e.message };
        }
    }
}

module.exports = new ChronoSpaces();
