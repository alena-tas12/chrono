const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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
const JWT_SECRET = process.env.JWT_SECRET || 'chrono_secret_token_key_123!';

app.use(cors());
app.use(express.json());

// Serving static files for the Admin Observability Dashboard
app.use('/admin', express.static(__dirname + '/admin'));

// Database Auto-Initialization on server start
async function startServer() {
    await dbInit(); // Run dummy initializer
    app.listen(PORT, () => {
        console.log(`🚀 Chrono Cloud Backend listening on http://localhost:${PORT}`);
        console.log(`🧠 Admin Observability Panel available at http://localhost:${PORT}/admin/`);
    });
}

// ========================================
// 🔐 AUTHENTICATION MIDDLEWARE
// ========================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

// ========================================
// 👤 AUTH & USER ENDPOINTS
// ========================================

app.post('/api/auth/register', async (req, res) => {
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

app.post('/api/auth/login', async (req, res) => {
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

app.get('/api/admin/metrics', async (req, res) => {
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
app.get('/api/admin/traces', async (req, res) => {
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
            user_input: ch.user_input,
            ai_response: ch.ai_response,
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
