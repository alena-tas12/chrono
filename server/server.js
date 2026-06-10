const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('./db');
const dbInit = require('./db_init');
const { processAIChat } = require('./ai_gateway');

require('dotenv').config();

// Global BigInt JSON serialization fix
BigInt.prototype.toJSON = function() {
    return Number(this);
};

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PRODUCT_LAYER = (process.env.CHRONO_LAYER || '').toLowerCase() === 'product';
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCT_LAYER ? null : 'chrono_secret_token_key_123!');
const ADMIN_SECRET = process.env.ADMIN_DASHBOARD_TOKEN || process.env.ADMIN_PASSWORD || (IS_PRODUCT_LAYER ? null : 'chrono-founder-dev');
const EMERGENCY_CONFIRMATION = 'CONFIRM EMERGENCY ACTION';
const BACKUP_DIR = process.env.CHRONO_BACKUP_DIR || path.join(__dirname, 'backups');
const rateLimitBuckets = new Map();

app.use(cors());
app.use(express.json());

function rateLimit(name, limit, windowMs) {
    return (req, res, next) => {
        const now = Date.now();
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const key = `${name}:${ip}`;
        const bucket = rateLimitBuckets.get(key) || { count: 0, resetAt: now + windowMs };

        if (now > bucket.resetAt) {
            bucket.count = 0;
            bucket.resetAt = now + windowMs;
        }

        bucket.count += 1;
        rateLimitBuckets.set(key, bucket);

        if (bucket.count > limit) {
            return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
        }

        next();
    };
}

const authRateLimit = rateLimit('auth', 20, 15 * 60 * 1000);
const adminRateLimit = rateLimit('admin', 120, 15 * 60 * 1000);

app.get('/api/health', async (req, res) => {
    try {
        await prisma.$queryRawUnsafe('SELECT 1');
        res.json({
            ok: true,
            database: 'online',
            adminProtection: ADMIN_SECRET ? (ADMIN_SECRET === 'chrono-founder-dev' ? 'development-token' : 'protected') : 'disabled',
            time: new Date().toISOString()
        });
    } catch (e) {
        res.status(503).json({ ok: false, database: 'offline', error: e.message });
    }
});

// Serving static files for the Admin Observability Dashboard
app.use('/admin', express.static(__dirname + '/admin'));

// Database Auto-Initialization on server start
async function startServer() {
    await dbInit(); // Run dummy initializer
    await ensureAdminTables();
    app.listen(PORT, () => {
        console.log(`🚀 Chrono Cloud Backend listening on http://localhost:${PORT}`);
        console.log(`🧠 Admin Observability Panel available at http://localhost:${PORT}/admin/`);
        if (!ADMIN_SECRET) {
            console.warn('Founder Dashboard is disabled because no admin token is configured.');
        } else if (!process.env.ADMIN_DASHBOARD_TOKEN && !process.env.ADMIN_PASSWORD) {
            console.warn('Founder Dashboard is using the local development admin token. Set ADMIN_DASHBOARD_TOKEN before sharing this server.');
        }
        if (!JWT_SECRET) {
            console.warn('Authentication is disabled because JWT_SECRET is not configured.');
        }
    });
}

async function ensureAdminTables() {
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS admin_audit_log (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            actor TEXT NOT NULL,
            target_user_id TEXT,
            result TEXT NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS admin_user_flags (
            user_id VARCHAR(100) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            disabled BOOLEAN DEFAULT FALSE,
            disabled_reason TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await prisma.$executeRawUnsafe(`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS previous_hash TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS audit_hash TEXT`);
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

async function writeAudit(action, actor, result, details = {}) {
    const id = 'audit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const previous = await prisma.$queryRawUnsafe(
        `SELECT audit_hash FROM admin_audit_log ORDER BY created_at DESC LIMIT 1`
    );
    const previousHash = previous[0]?.audit_hash || null;
    const detailsJson = JSON.stringify(details);
    const auditHash = crypto
        .createHash('sha256')
        .update([id, action, actor || 'founder', details.targetUserId || '', result, detailsJson, previousHash || ''].join('|'))
        .digest('hex');

    await prisma.$executeRawUnsafe(
        `INSERT INTO admin_audit_log (id, action, actor, target_user_id, result, details, previous_hash, audit_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        id,
        action,
        actor || 'founder',
        details.targetUserId || null,
        result,
        detailsJson,
        previousHash,
        auditHash
    );
}

function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = req.headers['x-admin-token'] || bearerToken;

    if (!ADMIN_SECRET || !token || token !== ADMIN_SECRET) {
        return res.status(401).json({ error: 'Founder access required' });
    }

    req.adminActor = 'founder';
    return adminRateLimit(req, res, next);
}

function safeBackupPath(fileName) {
    const resolved = path.resolve(BACKUP_DIR, fileName);
    if (!resolved.startsWith(path.resolve(BACKUP_DIR))) {
        throw new Error('Invalid backup file');
    }
    return resolved;
}

async function collectBackupData() {
    const [users, profiles, calendars, calendarMembers, events, chatHistory, cognitiveMemories, adminUserFlags] = await Promise.all([
        prisma.user.findMany(),
        prisma.profile.findMany(),
        prisma.calendar.findMany(),
        prisma.calendarMember.findMany(),
        prisma.event.findMany(),
        prisma.chatHistory.findMany(),
        prisma.cognitiveMemory.findMany(),
        prisma.$queryRawUnsafe(`SELECT user_id, disabled, disabled_reason, updated_at FROM admin_user_flags`)
    ]);

    return {
        version: 1,
        createdAt: new Date().toISOString(),
        tables: {
            users,
            profiles,
            calendars,
            calendarMembers,
            events,
            chatHistory,
            cognitiveMemories,
            adminUserFlags
        }
    };
}

async function createBackupFile(reason = 'manual') {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const backup = await collectBackupData();
    backup.reason = reason;
    const fileName = `chrono_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = safeBackupPath(fileName);
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
    return { fileName, filePath, createdAt: backup.createdAt };
}

function requireEmergencyConfirmation(req, res, next) {
    if (req.body?.confirmation !== EMERGENCY_CONFIRMATION) {
        return res.status(400).json({
            error: `Type "${EMERGENCY_CONFIRMATION}" to run emergency admin controls.`
        });
    }
    next();
}

// ========================================
// 🔐 AUTHENTICATION MIDDLEWARE
// ========================================
function authenticateToken(req, res, next) {
    if (!JWT_SECRET) {
        return res.status(503).json({ error: 'Authentication is not configured' });
    }
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        const disabledRows = await prisma.$queryRawUnsafe(
            `SELECT disabled FROM admin_user_flags WHERE user_id = $1 AND disabled = TRUE LIMIT 1`,
            user.userId
        );
        if (disabledRows.length > 0) {
            return res.status(403).json({ error: 'Account disabled by founder emergency controls' });
        }
        req.user = user;
        next();
    });
}

// ========================================
// 👤 AUTH & USER ENDPOINTS
// ========================================

app.post('/api/auth/register', authRateLimit, async (req, res) => {
    if (!JWT_SECRET) {
        return res.status(503).json({ error: 'Authentication is not configured' });
    }
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = 'u_' + Math.random().toString(36).substring(2, 11);

        // 1. Create User & Profile nested
        await prisma.user.create({
            data: {
                id: userId,
                email,
                password_hash: hashedPassword,
                profile: {
                    create: {
                        display_name: displayName,
                        cognitive_style: 'adaptive'
                    }
                }
            }
        });

        // 2. Create default calendars for user
        const defaultLayers = ['Personal', 'Study', 'Routine', 'Focus'];
        const serverTime = Date.now();
        for (const layer of defaultLayers) {
            const calId = 'c_' + Math.random().toString(36).substring(2, 11);
            await prisma.calendar.create({
                data: {
                    id: calId,
                    name: layer,
                    owner_id: userId,
                    layer_type: layer.toLowerCase(),
                    updated_at: serverTime,
                    device_id: 'server',
                    deleted: 0
                }
            });
            await prisma.calendarMember.create({
                data: {
                    calendar_id: calId,
                    user_id: userId,
                    role: 'owner',
                    updated_at: serverTime,
                    device_id: 'server',
                    deleted: 0
                }
            });
        }

        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ success: true, token, userId, displayName });
    } catch (e) {
        console.error("Registration error:", e.message);
        res.status(500).json({ error: e.message.includes('unique') ? 'Email is already registered' : e.message });
    }
});

app.post('/api/auth/login', authRateLimit, async (req, res) => {
    if (!JWT_SECRET) {
        return res.status(503).json({ error: 'Authentication is not configured' });
    }
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: { profile: true }
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const disabledRows = await prisma.$queryRawUnsafe(
            `SELECT disabled FROM admin_user_flags WHERE user_id = $1 AND disabled = TRUE LIMIT 1`,
            user.id
        );
        if (disabledRows.length > 0) {
            return res.status(403).json({ error: 'Account disabled by founder emergency controls' });
        }

        const displayName = user.profile?.display_name || 'User';
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, userId: user.id, displayName });
    } catch (e) {
        console.error("Login error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/profiles/me', authenticateToken, async (req, res) => {
    try {
        const profile = await prisma.profile.findUnique({
            where: { user_id: req.user.userId },
            select: { display_name: true, cognitive_style: true, reassurance_needs: true }
        });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        res.json({
            display_name: profile.display_name,
            cognitive_style: profile.cognitive_style,
            reassurance_needs: profile.reassurance_needs
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/profiles/me', authenticateToken, async (req, res) => {
    const { displayName, cognitiveStyle } = req.body;
    try {
        await prisma.profile.update({
            where: { user_id: req.user.userId },
            data: {
                display_name: displayName !== undefined ? displayName : undefined,
                cognitive_style: cognitiveStyle !== undefined ? cognitiveStyle : undefined,
                updated_at: new Date()
            }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ========================================
// 📅 CALENDARS & WORKSPACES
// ========================================

app.get('/api/calendars', authenticateToken, async (req, res) => {
    try {
        const memberships = await prisma.calendarMember.findMany({
            where: { user_id: req.user.userId, deleted: 0 },
            include: { calendar: true }
        });
        const calendars = memberships.map(m => ({
            id: m.calendar.id,
            name: m.calendar.name,
            owner_id: m.calendar.owner_id,
            layer_type: m.calendar.layer_type,
            updated_at: m.calendar.updated_at,
            device_id: m.calendar.device_id,
            deleted: m.calendar.deleted,
            role: m.role
        }));
        res.json(calendars);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create or share a calendar
app.post('/api/calendars', authenticateToken, async (req, res) => {
    const { name, layerType, sharedWithEmail, role } = req.body;
    if (!name) return res.status(400).json({ error: 'Calendar name required' });

    try {
        const calId = 'c_' + Math.random().toString(36).substring(2, 11);
        const serverTime = Date.now();

        await prisma.calendar.create({
            data: {
                id: calId,
                name,
                owner_id: req.user.userId,
                layer_type: layerType || 'personal',
                updated_at: serverTime,
                device_id: 'server',
                deleted: 0
            }
        });

        await prisma.calendarMember.create({
            data: {
                calendar_id: calId,
                user_id: req.user.userId,
                role: 'owner',
                updated_at: serverTime,
                device_id: 'server',
                deleted: 0
            }
        });

        // Share invite configuration
        if (sharedWithEmail) {
            const invitee = await prisma.user.findUnique({
                where: { email: sharedWithEmail }
            });
            if (invitee) {
                await prisma.calendarMember.create({
                    data: {
                        calendar_id: calId,
                        user_id: invitee.id,
                        role: role || 'viewer',
                        updated_at: serverTime,
                        device_id: 'server',
                        deleted: 0
                    }
                });
            }
        }

        res.status(201).json({ success: true, calendarId: calId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ========================================
// 📝 EVENT / TASK ROUTER
// ========================================

app.get('/api/events', authenticateToken, async (req, res) => {
    const { start, end } = req.query;
    try {
        const events = await prisma.event.findMany({
            where: {
                deleted: 0,
                calendar: {
                    members: {
                        some: {
                            user_id: req.user.userId,
                            deleted: 0
                        }
                    }
                },
                start_time: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                calendar: true
            }
        });

        // Map column formats to client expectations
        const formatted = events.map(e => ({
            id: e.id,
            text: e.text,
            date: e.start_time ? e.start_time.split('T')[0] : (e.date || ''),
            calendar: e.calendar?.layer_type || 'personal',
            completed: e.completed ? 1 : 0
        }));

        res.json(formatted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/events', authenticateToken, async (req, res) => {
    const { text, date, calendar } = req.body;
    if (!text || !date) return res.status(400).json({ error: 'Text and date required' });

    try {
        const layer = calendar || 'personal';
        const calMember = await prisma.calendarMember.findFirst({
            where: {
                user_id: req.user.userId,
                deleted: 0,
                calendar: {
                    name: {
                        equals: layer,
                        mode: 'insensitive'
                    }
                }
            },
            select: { calendar_id: true }
        });

        let calendarId;
        if (calMember) {
            calendarId = calMember.calendar_id;
        } else {
            const fallbackCal = await prisma.calendar.findFirst({
                where: { owner_id: req.user.userId, deleted: 0 },
                select: { id: true }
            });
            calendarId = fallbackCal?.id;
        }

        if (!calendarId) {
            return res.status(400).json({ error: 'No active calendar layer available' });
        }

        const id = 'e_' + Math.random().toString(36).substring(2, 11);
        const startTime = `${date}T09:00:00`;
        const serverTime = Date.now();

        await prisma.event.create({
            data: {
                id,
                calendar_id: calendarId,
                text,
                date,
                start_time: startTime,
                completed: false,
                created_by: req.user.userId,
                updated_at: serverTime,
                device_id: 'server',
                deleted: 0
            }
        });

        res.status(201).json({ success: true, eventId: id });
    } catch (e) {
        console.error("Failed to add event:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/events/complete', authenticateToken, async (req, res) => {
    const { text } = req.body;
    try {
        await prisma.event.updateMany({
            where: {
                text: text,
                calendar: {
                    members: {
                        some: {
                            user_id: req.user.userId,
                            deleted: 0
                        }
                    }
                }
            },
            data: {
                completed: true,
                updated_at: Date.now(),
                device_id: 'server'
            }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ========================================
// 💬 CHAT COORDINATOR
// ========================================

app.post('/api/chat', authenticateToken, async (req, res) => {
    const { input, selectedDate, activeView, taskCount } = req.body;
    try {
        const aiResponse = await processAIChat(req.user.userId, input, { selectedDate, activeView, taskCount });
        res.json(aiResponse);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/chat/history', authenticateToken, async (req, res) => {
    try {
        const history = await prisma.chatHistory.findMany({
            where: { user_id: req.user.userId },
            orderBy: { created_at: 'asc' },
            take: 50
        });
        const mapped = history.map(r => ({
            userInput: r.user_input,
            aiResponse: r.ai_response
        }));
        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ========================================
// 📊 OBSERVABILITY / COGNITIVE DASHBOARD
// ========================================

app.get('/api/admin/metrics', authenticateAdmin, async (req, res) => {
    try {
        const usersCount = await prisma.user.count();
        const eventsCount = await prisma.event.count();
        const memoriesCount = await prisma.cognitiveMemory.count();
        
        // AI Metrics
        const totalChats = await prisma.chatHistory.count();
        const avgLatencyAgg = await prisma.chatHistory.aggregate({
            _avg: {
                latency_ms: true
            }
        });
        const avgLatency = parseFloat(avgLatencyAgg._avg.latency_ms || 0).toFixed(0);

        // Compute AI simulated pricing ($0.003 per input + $0.006 per response)
        const totalCost = (totalChats * 0.0034).toFixed(4);

        // Simple intent parsing diagnostics based on inputs
        const intentResult = await prisma.chatHistory.findMany({
            select: { user_input: true },
            take: 100
        });
        let schedulingCount = 0;
        let queryCount = 0;
        intentResult.forEach(r => {
            const input = r.user_input.toLowerCase();
            if (input.includes('add') || input.includes('schedule') || input.includes('put') || input.includes('create')) {
                schedulingCount++;
            } else {
                queryCount++;
            }
        });

        res.json({
            users: usersCount,
            events: eventsCount,
            memories: memoriesCount,
            totalChats,
            avgLatencyMs: avgLatency,
            estimatedCost: `$${totalCost}`,
            topIntent: schedulingCount >= queryCount ? 'Scheduling & Adding Blocks' : 'Conversational Querying',
            topFailure: 'Date range parsing anomalies (resolved)'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Trace log feed for active traces panel
app.get('/api/admin/traces', authenticateAdmin, async (req, res) => {
    try {
        const chatTraces = await prisma.chatHistory.findMany({
            include: {
                user: {
                    include: {
                        profile: true
                    }
                }
            },
            orderBy: { created_at: 'desc' },
            take: 50
        });
        const mappedTraces = chatTraces.map(ch => ({
            id: ch.id,
            user_id: ch.user_id,
            input_length: ch.user_input ? ch.user_input.length : 0,
            response_length: ch.ai_response ? ch.ai_response.length : 0,
            model_used: ch.model_used,
            latency_ms: ch.latency_ms,
            created_at: ch.created_at,
            display_name: ch.user?.profile?.display_name || null
        }));
        res.json(mappedTraces);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/founder-dashboard', authenticateAdmin, async (req, res) => {
    try {
        const [users, calendars, memberships, events, chats, memories, disabledUsers, auditCount] = await Promise.all([
            prisma.user.count(),
            prisma.calendar.count({ where: { deleted: 0 } }),
            prisma.calendarMember.count({ where: { deleted: 0 } }),
            prisma.event.count({ where: { deleted: 0 } }),
            prisma.chatHistory.count(),
            prisma.cognitiveMemory.count(),
            prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM admin_user_flags WHERE disabled = TRUE`),
            prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM admin_audit_log`)
        ]);

        const lastChat = await prisma.chatHistory.findFirst({
            orderBy: { created_at: 'desc' },
            select: { created_at: true, latency_ms: true, model_used: true }
        });

        res.json({
            users,
            calendars,
            relationships: memberships,
            events,
            chats,
            memories,
            disabledUsers: disabledUsers[0]?.count || 0,
            auditEntries: auditCount[0]?.count || 0,
            systemHealth: {
                database: 'online',
                adminProtection: ADMIN_SECRET ? (ADMIN_SECRET === 'chrono-founder-dev' ? 'development-token' : 'protected') : 'disabled',
                lastChatAt: lastChat?.created_at || null,
                lastLatencyMs: lastChat?.latency_ms || null,
                model: lastChat?.model_used || 'none'
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            include: { profile: true },
            orderBy: { created_at: 'desc' },
            take: 200
        });
        const flags = await prisma.$queryRawUnsafe(
            `SELECT user_id, disabled, disabled_reason, updated_at FROM admin_user_flags`
        );
        const flagsByUser = new Map(flags.map(flag => [flag.user_id, flag]));

        const rows = await Promise.all(users.map(async user => {
            const [eventsCount, calendarsCount, chatsCount, lastChat] = await Promise.all([
                prisma.event.count({ where: { created_by: user.id, deleted: 0 } }),
                prisma.calendarMember.count({ where: { user_id: user.id, deleted: 0 } }),
                prisma.chatHistory.count({ where: { user_id: user.id } }),
                prisma.chatHistory.findFirst({
                    where: { user_id: user.id },
                    orderBy: { created_at: 'desc' },
                    select: { created_at: true }
                })
            ]);

            const flag = flagsByUser.get(user.id);
            return {
                id: user.id,
                email: user.email,
                displayName: user.profile?.display_name || 'User',
                createdAt: user.created_at,
                lastActivityAt: lastChat?.created_at || null,
                eventsCount,
                calendarsCount,
                chatsCount,
                disabled: Boolean(flag?.disabled),
                disabledReason: flag?.disabled_reason || null
            };
        }));

        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/audit', authenticateAdmin, async (req, res) => {
    try {
        const rows = await prisma.$queryRawUnsafe(
            `SELECT id, action, actor, target_user_id, result, details, created_at
             FROM admin_audit_log
             ORDER BY created_at DESC
             LIMIT 100`
        );
        res.json(rows.map(row => ({
            ...row,
            details: row.details ? JSON.parse(row.details) : {}
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/backups', authenticateAdmin, async (req, res) => {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(fileName => fileName.endsWith('.json'))
            .map(fileName => {
                const stats = fs.statSync(safeBackupPath(fileName));
                return { fileName, sizeBytes: stats.size, createdAt: stats.birthtime };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(backups);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/backups/create', authenticateAdmin, async (req, res) => {
    try {
        const backup = await createBackupFile(req.body?.reason || 'manual-admin-backup');
        await writeAudit('Create Backup', req.adminActor, 'Success', { fileName: backup.fileName });
        res.json({ success: true, ...backup });
    } catch (e) {
        await writeAudit('Create Backup', req.adminActor, 'Failed', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/backups/restore', authenticateAdmin, requireEmergencyConfirmation, async (req, res) => {
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: 'fileName is required' });

    try {
        const restorePath = safeBackupPath(fileName);
        if (!fs.existsSync(restorePath)) {
            return res.status(404).json({ error: 'Backup file not found' });
        }

        const preRestoreBackup = await createBackupFile('automatic-pre-restore');
        const backup = JSON.parse(fs.readFileSync(restorePath, 'utf8'));
        const tables = backup.tables || {};

        await prisma.$transaction(async tx => {
            await tx.chatHistory.deleteMany();
            await tx.cognitiveMemory.deleteMany();
            await tx.event.deleteMany();
            await tx.calendarMember.deleteMany();
            await tx.calendar.deleteMany();
            await tx.profile.deleteMany();
            await tx.user.deleteMany();
            await tx.user.createMany({ data: tables.users || [], skipDuplicates: true });
            await tx.profile.createMany({ data: tables.profiles || [], skipDuplicates: true });
            await tx.calendar.createMany({ data: tables.calendars || [], skipDuplicates: true });
            await tx.calendarMember.createMany({ data: tables.calendarMembers || [], skipDuplicates: true });
            await tx.event.createMany({ data: tables.events || [], skipDuplicates: true });
            await tx.chatHistory.createMany({ data: tables.chatHistory || [], skipDuplicates: true });
            await tx.cognitiveMemory.createMany({ data: tables.cognitiveMemories || [], skipDuplicates: true });
            await tx.$executeRawUnsafe(`DELETE FROM admin_user_flags`);
            for (const flag of tables.adminUserFlags || []) {
                await tx.$executeRawUnsafe(
                    `INSERT INTO admin_user_flags (user_id, disabled, disabled_reason, updated_at)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (user_id)
                     DO UPDATE SET disabled = EXCLUDED.disabled, disabled_reason = EXCLUDED.disabled_reason, updated_at = EXCLUDED.updated_at`,
                    flag.user_id,
                    flag.disabled,
                    flag.disabled_reason,
                    flag.updated_at
                );
            }
        });

        await writeAudit('Restore Backup', req.adminActor, 'Success', {
            fileName,
            preRestoreBackup: preRestoreBackup.fileName
        });
        res.json({ success: true, restoredFrom: fileName, preRestoreBackup: preRestoreBackup.fileName });
    } catch (e) {
        await writeAudit('Restore Backup', req.adminActor, 'Failed', { fileName, error: e.message });
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/emergency/disable-account', authenticateAdmin, requireEmergencyConfirmation, async (req, res) => {
    const { userId, reason } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO admin_user_flags (user_id, disabled, disabled_reason, updated_at)
             VALUES ($1, TRUE, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id)
             DO UPDATE SET disabled = TRUE, disabled_reason = EXCLUDED.disabled_reason, updated_at = CURRENT_TIMESTAMP`,
            userId,
            reason || 'Emergency founder intervention'
        );
        await writeAudit('Disable Account', req.adminActor, 'Success', { targetUserId: userId, reason });
        res.json({ success: true });
    } catch (e) {
        await writeAudit('Disable Account', req.adminActor, 'Failed', { targetUserId: userId, error: e.message });
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/emergency/enable-account', authenticateAdmin, requireEmergencyConfirmation, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO admin_user_flags (user_id, disabled, disabled_reason, updated_at)
             VALUES ($1, FALSE, NULL, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id)
             DO UPDATE SET disabled = FALSE, disabled_reason = NULL, updated_at = CURRENT_TIMESTAMP`,
            userId
        );
        await writeAudit('Enable Account', req.adminActor, 'Success', { targetUserId: userId });
        res.json({ success: true });
    } catch (e) {
        await writeAudit('Enable Account', req.adminActor, 'Failed', { targetUserId: userId, error: e.message });
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/emergency/reset-account', authenticateAdmin, requireEmergencyConfirmation, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const deletedEvents = await prisma.event.deleteMany({ where: { created_by: userId } });
        const deletedChats = await prisma.chatHistory.deleteMany({ where: { user_id: userId } });
        const deletedMemories = await prisma.cognitiveMemory.deleteMany({ where: { user_id: userId } });
        const result = {
            targetUserId: userId,
            events: deletedEvents.count,
            chats: deletedChats.count,
            memories: deletedMemories.count
        };
        await writeAudit('Reset Account Data', req.adminActor, 'Success', result);
        res.json({ success: true, ...result });
    } catch (e) {
        await writeAudit('Reset Account Data', req.adminActor, 'Failed', { targetUserId: userId, error: e.message });
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/emergency/repair-sync', authenticateAdmin, requireEmergencyConfirmation, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const serverTime = Date.now();
        const calendars = await prisma.calendar.updateMany({
            where: { members: { some: { user_id: userId } } },
            data: { updated_at: serverTime, device_id: 'admin-repair' }
        });
        const members = await prisma.calendarMember.updateMany({
            where: { user_id: userId },
            data: { updated_at: serverTime, device_id: 'admin-repair' }
        });
        const events = await prisma.event.updateMany({
            where: { calendar: { members: { some: { user_id: userId } } } },
            data: { updated_at: serverTime, device_id: 'admin-repair' }
        });
        const result = { targetUserId: userId, calendars: calendars.count, members: members.count, events: events.count };
        await writeAudit('Repair Sync', req.adminActor, 'Success', result);
        res.json({ success: true, ...result });
    } catch (e) {
        await writeAudit('Repair Sync', req.adminActor, 'Failed', { targetUserId: userId, error: e.message });
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/synthetic-users/run', authenticateAdmin, async (req, res) => {
    const count = Math.min(Math.max(parseInt(req.body?.count || 10, 10), 1), 1000);
    const eventsPerUser = Math.min(Math.max(parseInt(req.body?.eventsPerUser || 3, 10), 0), 25);
    const chatsPerUser = Math.min(Math.max(parseInt(req.body?.chatsPerUser || 1, 10), 0), 25);
    const dryRun = req.body?.dryRun !== false;

    if (dryRun) {
        return res.json({
            success: true,
            dryRun: true,
            wouldCreate: {
                users: count,
                events: count * eventsPerUser,
                chats: count * chatsPerUser
            }
        });
    }

    try {
        const batchId = Date.now().toString(36);
        const passwordHash = await bcrypt.hash('synthetic-user-password', 10);
        const today = new Date().toISOString().slice(0, 10);
        const serverTime = Date.now();

        for (let i = 0; i < count; i++) {
            const userId = `bot_${batchId}_${i}`;
            const calendarId = `cal_${batchId}_${i}`;
            await prisma.user.create({
                data: {
                    id: userId,
                    email: `${userId}@synthetic.chrono.local`,
                    password_hash: passwordHash,
                    profile: {
                        create: {
                            display_name: `Synthetic User ${i + 1}`,
                            cognitive_style: 'synthetic-load-test'
                        }
                    }
                }
            });

            await prisma.calendar.create({
                data: {
                    id: calendarId,
                    name: 'Synthetic',
                    owner_id: userId,
                    layer_type: 'synthetic',
                    updated_at: serverTime,
                    device_id: 'synthetic-runner',
                    deleted: 0
                }
            });

            await prisma.calendarMember.create({
                data: {
                    calendar_id: calendarId,
                    user_id: userId,
                    role: 'owner',
                    updated_at: serverTime,
                    device_id: 'synthetic-runner',
                    deleted: 0
                }
            });

            for (let ev = 0; ev < eventsPerUser; ev++) {
                await prisma.event.create({
                    data: {
                        id: `evt_${batchId}_${i}_${ev}`,
                        calendar_id: calendarId,
                        text: `Synthetic milestone ${ev + 1}`,
                        date: today,
                        start_time: `${today}T${String(9 + (ev % 8)).padStart(2, '0')}:00:00`,
                        duration_min: 45,
                        created_by: userId,
                        updated_at: serverTime + ev,
                        device_id: 'synthetic-runner',
                        deleted: 0
                    }
                });
            }

            for (let ch = 0; ch < chatsPerUser; ch++) {
                await prisma.chatHistory.create({
                    data: {
                        id: `chat_${batchId}_${i}_${ch}`,
                        user_id: userId,
                        user_input: 'Synthetic scheduling request',
                        ai_response: 'Synthetic response',
                        model_used: 'synthetic-runner',
                        latency_ms: 25 + (ch % 10)
                    }
                });
            }
        }

        const result = { batchId, users: count, events: count * eventsPerUser, chats: count * chatsPerUser };
        await writeAudit('Synthetic User Run', req.adminActor, 'Success', result);
        res.json({ success: true, dryRun: false, ...result });
    } catch (e) {
        await writeAudit('Synthetic User Run', req.adminActor, 'Failed', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/load-test/run', authenticateAdmin, async (req, res) => {
    const virtualUsers = Math.min(Math.max(parseInt(req.body?.virtualUsers || 25, 10), 1), 500);
    const operationsPerUser = Math.min(Math.max(parseInt(req.body?.operationsPerUser || 5, 10), 1), 50);
    const concurrency = Math.min(Math.max(parseInt(req.body?.concurrency || 10, 10), 1), 100);
    const dryRun = req.body?.dryRun === true;

    if (dryRun) {
        return res.json({
            success: true,
            dryRun: true,
            estimatedOperations: virtualUsers * operationsPerUser,
            concurrency
        });
    }

    const startedAt = Date.now();
    const latencies = [];
    let errors = 0;
    let completed = 0;
    let nextUser = 0;

    async function runVirtualUser() {
        const userStarted = Date.now();
        try {
            for (let op = 0; op < operationsPerUser; op++) {
                const opStarted = Date.now();
                await prisma.event.count({ where: { deleted: 0 } });
                await prisma.chatHistory.count();
                latencies.push(Date.now() - opStarted);
            }
            completed += 1;
            latencies.push(Date.now() - userStarted);
        } catch (e) {
            errors += 1;
        }
    }

    async function worker() {
        while (nextUser < virtualUsers) {
            nextUser += 1;
            await runVirtualUser();
        }
    }

    try {
        await Promise.all(Array.from({ length: Math.min(concurrency, virtualUsers) }, worker));
        const durationMs = Date.now() - startedAt;
        const sorted = latencies.slice().sort((a, b) => a - b);
        const percentile = p => sorted[Math.floor((sorted.length - 1) * p)] || 0;
        const result = {
            virtualUsers,
            operations: virtualUsers * operationsPerUser * 2,
            completedUsers: completed,
            errors,
            durationMs,
            avgLatencyMs: sorted.length ? Math.round(sorted.reduce((sum, n) => sum + n, 0) / sorted.length) : 0,
            p95LatencyMs: percentile(0.95),
            p99LatencyMs: percentile(0.99)
        };
        await writeAudit('Load Test Run', req.adminActor, 'Success', result);
        res.json({ success: true, ...result });
    } catch (e) {
        await writeAudit('Load Test Run', req.adminActor, 'Failed', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

// ========================================
// 🔄 OFFLINE-FIRST SYNCHRONIZATION API
// ========================================

app.post('/api/sync/pull', authenticateToken, async (req, res) => {
    const { lastSyncTime, deviceId } = req.body;
    const lastSync = lastSyncTime ? BigInt(lastSyncTime) : 0n;
    const devId = deviceId || '';

    try {
        // 1. Pull events (tasks)
        const events = await prisma.event.findMany({
            where: {
                calendar: {
                    members: {
                        some: {
                            user_id: req.user.userId,
                            deleted: 0
                        }
                    }
                },
                updated_at: {
                    gt: lastSync
                },
                OR: [
                    { device_id: null },
                    { device_id: { not: devId } }
                ]
            }
        });
        const mappedEvents = events.map(e => ({
            id: e.id,
            calendar: e.calendar_id,
            text: e.text,
            date: e.date,
            completed: e.completed,
            start_time: e.start_time,
            duration_min: e.duration_min,
            updated_at: e.updated_at,
            device_id: e.device_id,
            deleted: e.deleted
        }));

        // 2. Pull calendars
        const calendars = await prisma.calendar.findMany({
            where: {
                members: {
                    some: {
                        user_id: req.user.userId,
                        deleted: 0
                    }
                },
                updated_at: {
                    gt: lastSync
                },
                OR: [
                    { device_id: null },
                    { device_id: { not: devId } }
                ]
            }
        });

        // 3. Pull calendar members
        const members = await prisma.calendarMember.findMany({
            where: {
                calendar: {
                    members: {
                        some: {
                            user_id: req.user.userId,
                            deleted: 0
                        }
                    }
                },
                updated_at: {
                    gt: lastSync
                },
                OR: [
                    { device_id: null },
                    { device_id: { not: devId } }
                ]
            }
        });

        res.json({
            serverTime: Date.now(),
            events: mappedEvents,
            calendars: calendars,
            calendar_members: members
        });
    } catch (e) {
        console.error("Sync pull error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sync/push', authenticateToken, async (req, res) => {
    const { deviceId, events, calendars, calendar_members } = req.body;

    try {
        // 1. Reconcile calendars
        if (calendars && calendars.length > 0) {
            for (const cal of calendars) {
                const existing = await prisma.calendar.findUnique({
                    where: { id: cal.id },
                    select: { id: true, updated_at: true }
                });
                if (!existing) {
                    await prisma.calendar.create({
                        data: {
                            id: cal.id,
                            name: cal.name,
                            owner_id: cal.owner_id || req.user.userId,
                            layer_type: cal.layer_type || 'personal',
                            updated_at: cal.updated_at,
                            device_id: cal.device_id,
                            deleted: cal.deleted ? 1 : 0
                        }
                    });
                } else if (BigInt(cal.updated_at) > (existing.updated_at || 0n)) {
                    await prisma.calendar.update({
                        where: { id: cal.id },
                        data: {
                            name: cal.name,
                            owner_id: cal.owner_id || req.user.userId,
                            layer_type: cal.layer_type || 'personal',
                            updated_at: cal.updated_at,
                            device_id: cal.device_id,
                            deleted: cal.deleted ? 1 : 0
                        }
                    });
                }
            }
        }

        // 2. Reconcile calendar members
        if (calendar_members && calendar_members.length > 0) {
            for (const mem of calendar_members) {
                const existing = await prisma.calendarMember.findUnique({
                    where: {
                        calendar_id_user_id: {
                            calendar_id: mem.calendar_id,
                            user_id: mem.user_id
                        }
                    },
                    select: { updated_at: true }
                });
                if (!existing) {
                    await prisma.calendarMember.create({
                        data: {
                            calendar_id: mem.calendar_id,
                            user_id: mem.user_id,
                            role: mem.role || 'viewer',
                            updated_at: mem.updated_at,
                            device_id: mem.device_id,
                            deleted: mem.deleted ? 1 : 0
                        }
                    });
                } else if (BigInt(mem.updated_at) > (existing.updated_at || 0n)) {
                    await prisma.calendarMember.update({
                        where: {
                            calendar_id_user_id: {
                                calendar_id: mem.calendar_id,
                                user_id: mem.user_id
                            }
                        },
                        data: {
                            role: mem.role || 'viewer',
                            updated_at: mem.updated_at,
                            device_id: mem.device_id,
                            deleted: mem.deleted ? 1 : 0
                        }
                    });
                }
            }
        }

        // 3. Reconcile events
        if (events && events.length > 0) {
            for (const ev of events) {
                const existing = await prisma.event.findUnique({
                    where: { id: ev.id },
                    select: { id: true, updated_at: true }
                });
                const calId = ev.calendar_id || ev.calendar;
                if (!existing) {
                    await prisma.event.create({
                        data: {
                            id: ev.id,
                            calendar_id: calId,
                            text: ev.text,
                            date: ev.date,
                            completed: ev.completed,
                            start_time: ev.start_time || null,
                            duration_min: ev.duration_min || 60,
                            created_by: req.user.userId,
                            updated_at: ev.updated_at,
                            device_id: ev.device_id,
                            deleted: ev.deleted ? 1 : 0
                        }
                    });
                } else if (BigInt(ev.updated_at) > (existing.updated_at || 0n)) {
                    await prisma.event.update({
                        where: { id: ev.id },
                        data: {
                            calendar_id: calId,
                            text: ev.text,
                            date: ev.date,
                            completed: ev.completed,
                            start_time: ev.start_time || null,
                            duration_min: ev.duration_min || 60,
                            updated_at: ev.updated_at,
                            device_id: ev.device_id,
                            deleted: ev.deleted ? 1 : 0
                        }
                    });
                }
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Sync push error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

startServer();
