const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
        try {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
        } catch (_) { }
    }
}));

const upload = require('./upload');
const authRoutes = require('./auth');
const friendRoutes = require('./friends');

app.use('/auth', authRoutes);
app.use('/friends', friendRoutes);

app.get('/', (req, res) => {
    res.send('Server is running');
});

app.post('/upload', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('UPLOAD ERROR:', err);
            return res.status(500).json({ error: 'Upload failed', details: err.message });
        }
        next();
    });
}, (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const filePath = `/uploads/${req.file.filename}`;
    // Simple mime check
    const type = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    console.log('File uploaded successfully:', filePath);
    res.json({ filePath, type });
});

// Block a user from a channel (creator/admins only)
app.post('/channels/:id/block', (req, res) => {
    const { userId, targetId } = req.body || {};
    if (!userId || !targetId) return res.status(400).json({ error: 'userId and targetId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });
    const isCreator = String(ch.createdBy) === String(userId);
    const isAdmin = (ch.admins || []).map(String).includes(String(userId));
    if (!isCreator && !isAdmin) return res.status(403).json({ error: 'forbidden' });

    ch.blocked = Array.isArray(ch.blocked) ? ch.blocked.map(String) : [];
    if (!ch.blocked.includes(String(targetId))) ch.blocked.push(String(targetId));
    // Remove from followers/members if present
    ch.followers = (ch.followers || []).map(String).filter(id => id !== String(targetId));
    ch.members = (ch.members || []).map(String).filter(id => id !== String(targetId));

    saveChannels();
    try { io.emit('channel_user_blocked', { channelId: ch.id, userId: String(targetId) }); } catch (_) { }
    res.json({ success: true, blocked: ch.blocked, followers: ch.followers });
});

// Unblock a user from a channel (creator/admins only)
app.post('/channels/:id/unblock', (req, res) => {
    const { userId, targetId } = req.body || {};
    if (!userId || !targetId) return res.status(400).json({ error: 'userId and targetId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });
    const isCreator = String(ch.createdBy) === String(userId);
    const isAdmin = (ch.admins || []).map(String).includes(String(userId));
    if (!isCreator && !isAdmin) return res.status(403).json({ error: 'forbidden' });

    ch.blocked = Array.isArray(ch.blocked) ? ch.blocked.map(String).filter(id => id !== String(targetId)) : [];
    saveChannels();
    try { io.emit('channel_user_unblocked', { channelId: ch.id, userId: String(targetId) }); } catch (_) { }
    res.json({ success: true, blocked: ch.blocked });
});

// React to a channel post (followers allowed unless reactions disabled; admins/creator can always react)
app.post('/channels/:id/posts/:postId/react', (req, res) => {
    const { userId, emoji } = req.body || {};
    if (!userId || !emoji) return res.status(400).json({ error: 'userId and emoji required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    const isCreator = String(ch.createdBy) === String(userId);
    const isAdmin = (ch.admins || []).includes(String(userId));

    // Enforce reactions toggle for non-admins/creator
    const reactionsAllowed = (ch.settings && ch.settings.reactions !== false) || isCreator || isAdmin;
    if (!reactionsAllowed) return res.status(403).json({ error: 'reactions_disabled' });

    ch.posts = Array.isArray(ch.posts) ? ch.posts : [];
    const post = ch.posts.find(p => String(p.id) === String(req.params.postId));
    if (!post) return res.status(404).json({ error: 'post_not_found' });

    post.reactions = post.reactions || {};
    const key = String(emoji);
    const uid = String(userId);
    const arr = Array.isArray(post.reactions[key]) ? post.reactions[key] : [];
    if (arr.includes(uid)) {
        post.reactions[key] = arr.filter(id => id !== uid);
        if (post.reactions[key].length === 0) delete post.reactions[key];
    } else {
        post.reactions[key] = [...arr, uid];
    }

    saveChannels();
    try {
        const io = req.app.get('io');
        io.emit('channel_post_reacted', { channelId: ch.id, postId: post.id, reactions: post.reactions });
    } catch (_) { }
    res.json({ success: true, reactions: post.reactions });
});

// Update community settings (icon, etc.)
app.post('/communities/:id/settings', (req, res) => {
    const { userId, icon } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const community = communities.find(c => String(c.id) === String(req.params.id));
    if (!community) return res.status(404).json({ error: 'not_found' });

    // Check if user is admin/owner
    if (!community.admins.includes(String(userId)) && String(community.ownerId) !== String(userId)) {
        return res.status(403).json({ error: 'forbidden' });
    }

    console.log(`Updating community ${req.params.id} settings. User: ${userId}, Icon: ${icon}`);

    if (icon) {
        community.icon = icon;
    }

    saveCommunities();
    console.log(`Community ${req.params.id} saved. New icon: ${community.icon}`);

    // Notify clients to refresh
    try {
        const io = req.app.get('io');
        io.emit('community_updated', community);
    } catch (_) { }

    res.json({ success: true, community });
});



// Update channel settings (creator only)
app.post('/channels/:id/settings', (req, res) => {
    const { userId, reactions, forwarding, slowMode, photo, requireApproval } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });
    // Allow any admin to update settings/photo
    const isAdmin = (ch.admins || []).includes(String(userId)) || String(ch.createdBy) === String(userId);
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
    ch.settings = ch.settings || { reactions: true, forwarding: true, slowMode: 0 };
    if (typeof reactions === 'boolean') ch.settings.reactions = reactions;
    if (typeof forwarding === 'boolean') ch.settings.forwarding = forwarding;
    if (Number.isFinite(slowMode)) ch.settings.slowMode = Math.max(0, Math.round(Number(slowMode)));
    if (requireApproval !== undefined) ch.settings.requireApproval = Boolean(requireApproval);
    if (photo) ch.photo = photo;
    saveChannels();
    try { io.emit('channel_updated', { ...ch }); } catch (_) { }
    res.json({ success: true, channel: ch, settings: ch.settings });
});

// Link Preview Endpoint (fetches Open Graph / meta tags)
const fetchHTML = (url, maxRedirects = 5) => new Promise((resolve, reject) => {
    try {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 (LinkPreviewBot)' } }, (resp) => {
            const status = resp.statusCode || 0;
            const loc = resp.headers.location;
            if (status >= 300 && status < 400 && loc && maxRedirects > 0) {
                const nextUrl = new URL(loc, url).toString();
                resp.resume();
                resolve(fetchHTML(nextUrl, maxRedirects - 1));
                return;
            }
            if (status < 200 || status >= 400) {
                resp.resume();
                reject(new Error('Bad status: ' + status));
                return;
            }
            let data = '';
            resp.on('data', chunk => { data += chunk.toString(); if (data.length > 2_000_000) req.destroy(); });
            resp.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(new Error('Timeout')); });
    } catch (e) { reject(e); }
});

const parsePreview = (html, baseUrl) => {
    const pick = (re) => {
        const m = html.match(re);
        return m ? (m[1] || m[2] || m[3] || '').trim() : '';
    };
    const og = (p) => pick(new RegExp(`<meta[^>]+property=["']og:${p}["'][^>]+content=["']([^"']+)["']`, 'i'))
        || pick(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${p}["']`, 'i'));
    const tw = (p) => pick(new RegExp(`<meta[^>]+name=["']twitter:${p}["'][^>]+content=["']([^"']+)["']`, 'i'))
        || pick(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:${p}["']`, 'i'));
    const title = og('title') || tw('title') || pick(/<title[^>]*>([^<]+)<\/title>/i);
    const description = og('description') || tw('description') || pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    let image = og('image') || tw('image');
    try { if (image && !/^https?:\/\//i.test(image)) { image = new URL(image, baseUrl).toString(); } } catch (_) { }
    const siteName = og('site_name') || pick(/<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i) || new URL(baseUrl).hostname;
    return { title, description, image, siteName };
};

app.get('/link-preview', async (req, res) => {
    try {
        const raw = (req.query.url || '').toString();
        if (!raw) return res.status(400).json({ error: 'url required' });
        let url = raw.trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        const u = new URL(url);
        if (!['http:', 'https:'].includes(u.protocol)) return res.status(400).json({ error: 'invalid protocol' });
        const html = await fetchHTML(u.toString());
        const preview = parsePreview(html, u.toString());
        res.json({ url: u.toString(), ...preview });
    } catch (e) {
        res.status(500).json({ error: 'failed', message: e.message });
    }
});

// Archive persistence helpers and endpoints
const dbPath = path.join(__dirname, 'db.json');
const loadDB = () => {
    if (fs.existsSync(dbPath)) {
        try {
            return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        } catch (e) { return { users: [], friendRequests: [] }; }
    }
    return { users: [], friendRequests: [] };
};
const saveDB = (db) => {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
};

app.get('/archive/:userId', (req, res) => {
    const { userId } = req.params;
    const db = loadDB();
    let users = db.users || [];
    let user = users.find(u => String(u.id) === String(userId));
    if (!user) {
        user = { id: userId, archivedItems: [], username: `user-${userId}`, avatar: 'https://i.pravatar.cc/150' };
        users.push(user);
        db.users = users;
        saveDB(db);
    }
    res.json(user.archivedItems || []);
});

app.post('/archive/:userId', (req, res) => {
    const { userId } = req.params;
    const { items } = req.body || {};
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
    const db = loadDB();
    let users = db.users || [];
    let idx = users.findIndex(u => String(u.id) === String(userId));
    if (idx === -1) {
        users.push({ id: userId, archivedItems: [] });
        idx = users.length - 1;
        db.users = users;
    }
    db.users[idx].archivedItems = items;
    saveDB(db);
    res.json({ success: true });
});

app.post('/archive/add', (req, res) => {
    const { userId, item } = req.body || {};
    if (!userId || !item || !item.type || !item.id) return res.status(400).json({ error: 'invalid payload' });
    const db = loadDB();
    let users = db.users || [];
    let user = users.find(u => String(u.id) === String(userId));
    if (!user) {
        user = { id: userId, archivedItems: [] };
        users.push(user);
        db.users = users;
    }
    const list = Array.isArray(user.archivedItems) ? user.archivedItems : [];
    if (!list.some(ai => ai.type === item.type && ai.id === item.id)) list.push(item);
    user.archivedItems = list;
    saveDB(db);
    res.json({ success: true, archivedItems: list });
});

app.post('/archive/remove', (req, res) => {
    const { userId, type, id } = req.body || {};
    if (!userId || !type || !id) return res.status(400).json({ error: 'invalid payload' });
    const db = loadDB();
    let users = db.users || [];
    let user = users.find(u => String(u.id) === String(userId));
    if (!user) {
        user = { id: userId, archivedItems: [] };
        users.push(user);
        db.users = users;
    }
    const list = Array.isArray(user.archivedItems) ? user.archivedItems : [];
    user.archivedItems = list.filter(ai => !(ai.type === type && ai.id === id));
    saveDB(db);
    res.json({ success: true, archivedItems: user.archivedItems });
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.json({ filePath: `/uploads/${req.file.filename}`, type: req.file.mimetype });
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});
app.set('io', io);

// Load messages
const messagesFile = path.join(__dirname, 'messages.json');
let messages = {};
if (fs.existsSync(messagesFile)) {
    try {
        messages = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
    } catch (e) {
        console.error("Error reading messages file:", e);
        messages = {};
    }
}

const saveMessages = () => {
    fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
};

// Load comments
const commentsFile = path.join(__dirname, 'comments.json');
let comments = {}; // { roomId: { msgId: [comment1, comment2] } }
if (fs.existsSync(commentsFile)) {
    try {
        comments = JSON.parse(fs.readFileSync(commentsFile, 'utf8'));
    } catch (e) {
        console.error("Error reading comments file:", e);
        comments = {};
    }
}

const saveComments = () => {
    try { fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2)); } catch (_) { }
};

// -------------------- Call History --------------------
const callsFile = path.join(__dirname, 'call_history.json');
let calls = [];
try {
    if (fs.existsSync(callsFile)) {
        calls = JSON.parse(fs.readFileSync(callsFile, 'utf8')) || [];
    }
} catch (_) { calls = []; }
const saveCalls = () => {
    try { fs.writeFileSync(callsFile, JSON.stringify(calls, null, 2)); } catch (_) { }
};

// Get call history for a user
app.get('/calls/:userId', (req, res) => {
    const { userId } = req.params;
    const userCalls = calls.filter(c =>
        String(c.callerId) === String(userId) ||
        (Array.isArray(c.participants) && c.participants.map(String).includes(String(userId)))
    );
    // Sort by timestamp desc
    userCalls.sort((a, b) => b.timestamp - a.timestamp);
    res.json(userCalls);
});

// Log a call
// Log a call
const logCall = (data) => {
    const { callerId, participants, type, status, duration, timestamp } = data;
    // type: 'audio' | 'video'
    // status: 'completed' | 'missed' | 'rejected' | 'busy' | 'market_missed' (if offline)

    const newCall = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        callerId: String(callerId),
        participants: Array.isArray(participants) ? participants.map(String) : [],
        type: type || 'audio',
        status: status || 'completed',
        duration: duration || 0,
        timestamp: timestamp || Date.now()
    };

    calls.unshift(newCall);
    // Keep only last 1000 calls
    if (calls.length > 1000) calls = calls.slice(0, 1000);

    saveCalls();

    // Real-time update via socket
    try {
        // Notify caller
        io.to(String(callerId)).emit('call_log_added', newCall);
        // Notify participants
        newCall.participants.forEach(pId => {
            if (String(pId) !== String(callerId)) {
                io.to(String(pId)).emit('call_log_added', newCall);
            }
        });
    } catch (_) { }

    return newCall;
};

app.post('/calls', (req, res) => {
    const { callerId } = req.body || {};
    if (!callerId) return res.status(400).json({ error: 'callerId required' });

    const newCall = logCall(req.body);
    res.json({ success: true, call: newCall });
});

// Delete a call log
app.delete('/calls/:id', (req, res) => {
    const { id } = req.params;
    const { userId } = req.body; // pass userId in body to verify ownership if needed, or just allow delete

    // For now, just allow deleting if the ID matches
    const initLen = calls.length;
    calls = calls.filter(c => String(c.id) !== String(id));

    if (calls.length !== initLen) {
        saveCalls();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'not_found' });
    }
});

// -------------------- Channels (minimal) --------------------
const channelsFile = path.join(__dirname, 'channels.json');
let channels = [];
try {
    if (fs.existsSync(channelsFile)) {
        channels = JSON.parse(fs.readFileSync(channelsFile, 'utf8')) || [];
    }
} catch (_) { channels = []; }
const saveChannels = () => {
    try { fs.writeFileSync(channelsFile, JSON.stringify(channels, null, 2)); } catch (_) { }
};

// List channels
app.get('/channels', (req, res) => {
    res.json(channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        category: ch.category,
        visibility: ch.visibility,
        photo: ch.photo,
        members: Array.isArray(ch.members) ? ch.members.length : 0,
        createdBy: ch.createdBy,
        isChannel: true
    })));
});

// Channel details
app.get('/channels/:id', (req, res) => {
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    // Populate missing author details for historical posts
    const db = loadDB();
    const posts = (ch.posts || []).map(p => {
        if (p.author && p.avatar) return p; // Already has details
        const authorUser = (db.users || []).find(u => String(u.id) === String(p.authorId));
        return {
            ...p,
            author: p.author || (authorUser ? (authorUser.username || authorUser.name) : 'Admin'),
            avatar: p.avatar || (authorUser ? authorUser.avatar : '')
        };
    });

    res.json({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        category: ch.category,
        visibility: ch.visibility,
        photo: ch.photo,
        createdBy: ch.createdBy,
        admins: ch.admins || [ch.createdBy],
        members: ch.members || [],
        followers: ch.followers || ch.members || [],
        blocked: ch.blocked || [],
        joinRequests: ch.joinRequests || [],
        posts: posts,
        settings: ch.settings || { reactions: true, forwarding: true, slowMode: 0, requireApproval: false },
        stats: ch.stats || { totalPosts: 0, totalFollowers: 0, activeFollowers: 0, postsToday: 0, postsThisWeek: 0, postsThisMonth: 0, engagementRate: 0, growthRate: 0 }
    });
});

// Create channel
app.post('/channels', (req, res) => {
    const { name, description, category, visibility, photo, createdBy } = req.body || {};
    if (!name || !createdBy) return res.status(400).json({ error: 'name and createdBy required' });
    const id = Date.now().toString();
    const ch = {
        id,
        name: String(name).trim(),
        description: String(description || ''),
        category: String(category || 'News'),
        visibility: (visibility === 'Private') ? 'Private' : 'Public',
        photo: photo || '',
        createdBy: String(createdBy),
        admins: [String(createdBy)], // Creator is first admin
        members: [String(createdBy)], // Keep for backward compatibility
        followers: [String(createdBy)], // New terminology
        blocked: [], // Blocked user IDs
        joinRequests: [], // Pending join requests for private channels
        posts: [],
        settings: {
            reactions: true,
            forwarding: true,
            slowMode: 0,
            requireApproval: visibility === 'Private' // Auto-enable for private channels
        },
        stats: {
            totalPosts: 0,
            totalFollowers: 1,
            activeFollowers: 1,
            postsToday: 0,
            postsThisWeek: 0,
            postsThisMonth: 0,
            viewsToday: 0,
            viewsThisWeek: 0,
            engagementRate: 0,
            topPostId: null,
            growthRate: 0,
            lastActivity: Date.now(),
            followerHistory: [{ date: Date.now(), count: 1 }] // For growth chart
        }
    };
    channels.unshift(ch);
    saveChannels();
    try { io.emit('channel_created', { ...ch, followers: ch.followers.length }); } catch (_) { }
    res.json({ success: true, channel: { ...ch, followers: ch.followers.length } });
});

// Follow channel (replaces join)
app.post('/channels/:id/follow', (req, res) => {
    const { userId, userName, avatar } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    // Initialize arrays if needed
    ch.followers = Array.isArray(ch.followers) ? ch.followers : (ch.members || []);

    const userIdStr = String(userId);
    if (!ch.followers.includes(userIdStr)) {
        ch.followers.push(userIdStr);

        // Keep members in sync (without duplicates)
        ch.members = [...ch.followers];

        // Persist minimal user display info for followers not present in users.json
        ch.userMeta = ch.userMeta || {};
        if (!ch.userMeta[userIdStr]) ch.userMeta[userIdStr] = {};
        if (userName) ch.userMeta[userIdStr].username = String(userName);
        if (avatar) ch.userMeta[userIdStr].avatar = String(avatar);

        // Update stats
        if (!ch.stats) ch.stats = {};
        ch.stats.totalFollowers = ch.followers.length;
        ch.stats.followerHistory = ch.stats.followerHistory || [];
        ch.stats.followerHistory.push({ date: Date.now(), count: ch.followers.length });
        // Compute growthRate based on last 2 history points
        if (ch.stats.followerHistory.length >= 2) {
            const len = ch.stats.followerHistory.length;
            const prev = ch.stats.followerHistory[len - 2].count || 0;
            const curr = ch.stats.followerHistory[len - 1].count || 0;
            ch.stats.growthRate = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 100;
        } else {
            ch.stats.growthRate = 100;
        }

        saveChannels();
        try {
            io.emit('channel_followed', { channelId: ch.id, userId });
            io.emit('channel_updated', { channelId: ch.id, followersCount: ch.followers.length, growthRate: ch.stats.growthRate || 0 });
        } catch (_) { }
    }
    res.json({ success: true, followers: ch.followers.length });
});

// Backward compatibility: keep /join endpoint
app.post('/channels/:id/join', (req, res) => {
    const { userId, userName, avatar } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });
    ch.members = Array.isArray(ch.members) ? ch.members : [];
    ch.followers = Array.isArray(ch.followers) ? ch.followers : ch.members;
    if (!ch.members.includes(String(userId))) {
        ch.members.push(String(userId));
        ch.followers.push(String(userId));
        // Store display info
        ch.userMeta = ch.userMeta || {};
        if (!ch.userMeta[String(userId)]) ch.userMeta[String(userId)] = {};
        if (userName) ch.userMeta[String(userId)].username = String(userName);
        if (avatar) ch.userMeta[String(userId)].avatar = String(avatar);
    }
    // Update growth rate similarly to follow
    if (!ch.stats) ch.stats = {};
    ch.stats.totalFollowers = (ch.followers || []).length;
    ch.stats.followerHistory = ch.stats.followerHistory || [];
    ch.stats.followerHistory.push({ date: Date.now(), count: ch.stats.totalFollowers });
    if (ch.stats.followerHistory.length >= 2) {
        const len = ch.stats.followerHistory.length;
        const prev = ch.stats.followerHistory[len - 2].count || 0;
        const curr = ch.stats.followerHistory[len - 1].count || 0;
        ch.stats.growthRate = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 100;
    } else {
        ch.stats.growthRate = 100;
    }
    saveChannels();
    try { io.emit('channel_updated', { channelId: ch.id, membersCount: ch.members.length, followersCount: ch.followers.length, growthRate: ch.stats.growthRate || 0 }); } catch (_) { }
    res.json({ success: true, members: ch.members.length });
});

// Unfollow channel (replaces leave)
app.post('/channels/:id/unfollow', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    ch.followers = Array.isArray(ch.followers) ? ch.followers : (ch.members || []);

    const userIdStr = String(userId);
    ch.followers = ch.followers.filter(uid => String(uid) !== userIdStr);

    // Keep members in sync
    ch.members = [...ch.followers];

    // Update stats
    if (!ch.stats) ch.stats = {};
    ch.stats.totalFollowers = ch.followers.length;
    ch.stats.followerHistory = ch.stats.followerHistory || [];
    ch.stats.followerHistory.push({ date: Date.now(), count: ch.followers.length });
    if (ch.stats.followerHistory.length >= 2) {
        const len = ch.stats.followerHistory.length;
        const prev = ch.stats.followerHistory[len - 2].count || 0;
        const curr = ch.stats.followerHistory[len - 1].count || 0;
        ch.stats.growthRate = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
    } else {
        ch.stats.growthRate = 0;
    }

    saveChannels();
    try {
        io.emit('channel_unfollowed', { channelId: ch.id, userId });
        io.emit('channel_updated', { channelId: ch.id, followersCount: ch.followers.length, growthRate: ch.stats.growthRate || 0 });
    } catch (_) { }
    res.json({ success: true, followers: ch.followers.length });
});

// Backward compatibility: keep /leave endpoint
app.post('/channels/:id/leave', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });
    ch.members = Array.isArray(ch.members) ? ch.members : [];
    ch.followers = Array.isArray(ch.followers) ? ch.followers : ch.members;
    ch.members = ch.members.filter(uid => String(uid) !== String(userId));
    ch.followers = ch.followers.filter(uid => String(uid) !== String(userId));
    saveChannels();
    try { io.emit('channel_updated', { channelId: ch.id, membersCount: ch.members.length, followersCount: ch.followers.length }); } catch (_) { }
    res.json({ success: true, members: ch.members.length });
});


// Post to channel (admin-only, creator for now)
app.post('/channels/:id/post', (req, res) => {
    const { userId, type = 'text', text = '', imageUrl = '' } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });
    if (String(ch.createdBy) !== String(userId)) return res.status(403).json({ error: 'forbidden' });

    // Fetch user details for the author
    const db = loadDB();
    const authorUser = (db.users || []).find(u => String(u.id) === String(userId));
    const authorName = authorUser ? (authorUser.username || authorUser.name) : 'Admin';
    const authorAvatar = authorUser ? authorUser.avatar : '';

    ch.posts = Array.isArray(ch.posts) ? ch.posts : [];
    const post = {
        id: Date.now().toString(),
        type,
        text: String(text || ''),
        imageUrl: String(imageUrl || ''),
        createdAt: Date.now(),
        authorId: String(userId),
        author: authorName, // Add author name
        avatar: authorAvatar // Add author avatar
    };
    ch.posts.unshift(post);

    // Update stats
    if (!ch.stats) ch.stats = {};
    ch.stats.totalPosts = (ch.stats.totalPosts || 0) + 1;
    ch.stats.postsToday = (ch.stats.postsToday || 0) + 1;
    ch.stats.postsThisWeek = (ch.stats.postsThisWeek || 0) + 1;
    ch.stats.postsThisMonth = (ch.stats.postsThisMonth || 0) + 1;
    ch.stats.lastActivity = Date.now();

    saveChannels();
    try { io.emit('channel_post_created', { channelId: ch.id, post: { ...post, postId: post.id } }); } catch (_) { }
    res.json({ success: true, post });
});

// Leave channel
app.post('/channels/:id/leave', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });
    ch.members = Array.isArray(ch.members) ? ch.members : [];
    ch.members = ch.members.filter(uid => String(uid) !== String(userId));
    saveChannels();
    try { io.emit('channel_updated', { channelId: ch.id, membersCount: ch.members.length }); } catch (_) { }
    res.json({ success: true, members: ch.members.length });
});

// React to channel post
app.post('/channels/:id/posts/:postId/react', (req, res) => {
    const { userId, emoji } = req.body || {};
    if (!userId || !emoji) return res.status(400).json({ error: 'userId and emoji required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    // Check if reactions are enabled
    if (ch.settings && ch.settings.reactions === false) {
        return res.status(403).json({ error: 'Reactions are disabled for this channel' });
    }

    ch.posts = Array.isArray(ch.posts) ? ch.posts : [];
    const p = ch.posts.find(pp => String(pp.id) === String(req.params.postId));
    if (!p) return res.status(404).json({ error: 'post_not_found' });
    p.reactions = p.reactions || {};
    const key = String(emoji);
    const uid = String(userId);
    const list = Array.isArray(p.reactions[key]) ? [...p.reactions[key]] : [];
    const idx = list.findIndex(v => String(v) === uid);
    if (idx === -1) list.push(uid); else list.splice(idx, 1);
    p.reactions[key] = list;
    saveChannels();
    try { io.emit('channel_post_reacted', { channelId: ch.id, postId: p.id, userId: uid, emoji: key, reactions: p.reactions }); } catch (_) { }
    res.json({ success: true, reactions: p.reactions });
});

// Forward channel post
app.post('/channels/:id/posts/:postId/forward', (req, res) => {
    const { userId, targetChatId, targetType } = req.body || {}; // targetType: 'user', 'group', 'channel'
    if (!userId || !targetChatId) return res.status(400).json({ error: 'userId and targetChatId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    // Check if forwarding is enabled
    if (ch.settings && ch.settings.forwarding === false) {
        return res.status(403).json({ error: 'Forwarding is disabled for this channel' });
    }

    const post = (ch.posts || []).find(p => String(p.id) === String(req.params.postId));
    if (!post) return res.status(404).json({ error: 'post_not_found' });

    // Track share/forward
    if (!post.shares) post.shares = 0;
    post.shares += 1;
    saveChannels();

    // Create forwarded message
    const forwardedMessage = {
        id: Date.now().toString(),
        author: userId,
        message: post.text || '',
        file: post.imageUrl ? { url: post.imageUrl, type: 'image/jpeg' } : null,
        timestamp: Date.now(),
        isForwarded: true,
        originalChannel: ch.name
    };

    // Emit to target chat (implementation depends on your message system)
    try {
        io.to(targetChatId).emit('receive_message', forwardedMessage);
    } catch (_) { }

    res.json({ success: true, message: 'Post forwarded successfully' });
});


// Add admin to channel (creator or existing admin only)
app.post('/channels/:id/admins', (req, res) => {
    const { userId, targetUserId } = req.body || {};
    if (!userId || !targetUserId) return res.status(400).json({ error: 'userId and targetUserId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    // Check if requester is creator or admin
    const isCreator = String(ch.createdBy) === String(userId);
    const isAdmin = (ch.admins || []).includes(String(userId));
    if (!isCreator && !isAdmin) return res.status(403).json({ error: 'forbidden' });

    ch.admins = ch.admins || [ch.createdBy];
    if (!ch.admins.includes(String(targetUserId))) {
        ch.admins.push(String(targetUserId));
        saveChannels();
        try { io.emit('channel_admin_added', { channelId: ch.id, userId: targetUserId }); } catch (_) { }
        res.json({ success: true, admins: ch.admins });
    } else {
        res.json({ success: true, message: 'Already admin' });
    }
});

// Remove admin from channel (creator only)
app.delete('/channels/:id/admins/:targetUserId', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    // Only creator can remove admins
    if (String(ch.createdBy) !== String(userId)) return res.status(403).json({ error: 'forbidden' });

    // Cannot remove creator
    if (String(req.params.targetUserId) === String(ch.createdBy)) {
        return res.status(400).json({ error: 'Cannot remove creator' });
    }

    ch.admins = (ch.admins || []).filter(id => String(id) !== String(req.params.targetUserId));
    saveChannels();
    try { io.emit('channel_admin_removed', { channelId: ch.id, userId: req.params.targetUserId }); } catch (_) { }
    res.json({ success: true, admins: ch.admins });
});

// Block user from channel (admin only)
app.post('/channels/:id/block/:targetUserId', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    const isAdmin = (ch.admins || []).includes(String(userId));
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

    ch.blocked = ch.blocked || [];
    if (!ch.blocked.includes(String(req.params.targetUserId))) {
        ch.blocked.push(String(req.params.targetUserId));
        // Remove from members if present
        ch.members = (ch.members || []).filter(id => String(id) !== String(req.params.targetUserId));
        saveChannels();
        try { io.emit('channel_user_blocked', { channelId: ch.id, userId: req.params.targetUserId }); } catch (_) { }
    }
    res.json({ success: true, blocked: ch.blocked });
});

// Unblock user from channel (admin only)
app.delete('/channels/:id/block/:targetUserId', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    const isAdmin = (ch.admins || []).includes(String(userId));
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

    ch.blocked = (ch.blocked || []).filter(id => String(id) !== String(req.params.targetUserId));
    saveChannels();
    try { io.emit('channel_user_unblocked', { channelId: ch.id, userId: req.params.targetUserId }); } catch (_) { }
    res.json({ success: true, blocked: ch.blocked });
});

// Delete post from channel (admin only)
app.delete('/channels/:id/posts/:postId', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    const isAdmin = (ch.admins || []).includes(String(userId));
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

    ch.posts = (ch.posts || []).filter(p => String(p.id) !== String(req.params.postId));
    saveChannels();
    try { io.emit('channel_post_deleted', { channelId: ch.id, postId: req.params.postId }); } catch (_) { }
    res.json({ success: true });
});

// Edit post in channel (admin only)
app.put('/channels/:id/posts/:postId', (req, res) => {
    const { userId, text } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    const isAdmin = (ch.admins || []).includes(String(userId));
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

    const post = (ch.posts || []).find(p => String(p.id) === String(req.params.postId));
    if (!post) return res.status(404).json({ error: 'post_not_found' });

    post.text = String(text || '');
    post.edited = true;
    post.editedAt = Date.now();
    saveChannels();
    try { io.emit('channel_post_edited', { channelId: ch.id, postId: post.id, text: post.text }); } catch (_) { }
    res.json({ success: true, post });
});

// Get channel stats (creator only)
app.post('/channels/:id/view', (req, res) => {
    const { userId } = req.body || {};
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    if (!ch.stats) ch.stats = {};
    // Track unique view events per post: { userId, postId, timestamp }
    if (!ch.stats.postViewEvents) ch.stats.postViewEvents = [];

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Skip counting for creator/admins, but still allow endpoint to succeed
    const isCreator = String(ch.createdBy) === String(userId);
    const isAdmin = (ch.admins || []).includes(String(userId));

    // Determine latest post ID; if none, just return current stats
    const latestPostId = Array.isArray(ch.posts) && ch.posts.length > 0 ? ch.posts[0].id : null;
    if (latestPostId && !isCreator && !isAdmin) {
        const alreadyViewed = ch.stats.postViewEvents.find(e => String(e.userId) === String(userId) && String(e.postId) === String(latestPostId));
        if (!alreadyViewed) {
            ch.stats.postViewEvents.push({ userId: String(userId), postId: String(latestPostId), timestamp: now });
            // Keep only last 30 days of events to bound file size
            const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
            ch.stats.postViewEvents = ch.stats.postViewEvents.filter(e => e.timestamp > thirtyDaysAgo);
        }
    }

    // Compute quick stats: unique viewers today and this week based on unique (user, post) pairs
    const uniq = (arr) => Array.from(new Set(arr));
    const todayUsers = uniq(ch.stats.postViewEvents.filter(e => e.timestamp >= oneDayAgo).map(e => `${e.userId}:${e.postId}`));
    const weekUsers = uniq(ch.stats.postViewEvents.filter(e => e.timestamp >= oneWeekAgo).map(e => `${e.userId}:${e.postId}`));
    ch.stats.viewsToday = todayUsers.length;
    ch.stats.viewsThisWeek = weekUsers.length;
    ch.stats.activeFollowers = uniq(ch.stats.postViewEvents.filter(e => e.timestamp >= oneWeekAgo).map(e => String(e.userId))).length;

    saveChannels();

    // Emit real-time payload so clients can update immediately
    try {
        const io = req.app.get('io');
        io.emit('channel_updated', {
            channelId: ch.id,
            viewsToday: ch.stats.viewsToday || 0,
            viewsThisWeek: ch.stats.viewsThisWeek || 0,
            activeFollowers: ch.stats.activeFollowers || 0
        });
    } catch (e) { /* noop */ }

    res.json({ success: true, viewsToday: ch.stats.viewsToday, viewsThisWeek: ch.stats.viewsThisWeek });
});

app.get('/channels/:id/stats', (req, res) => {
    const { userId } = req.query || {};
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    const isCreator = String(ch.createdBy) === String(userId);
    const isAdmin = (ch.admins || []).includes(String(userId));
    if (!isCreator && !isAdmin) return res.status(403).json({ error: 'forbidden' });

    // Ensure stats object exists
    if (!ch.stats) ch.stats = {};

    // Always calculate from actual posts for accuracy
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

    // Calculate from actual posts
    ch.stats.totalPosts = (ch.posts || []).length;
    ch.stats.postsToday = (ch.posts || []).filter(p => p.createdAt >= oneDayAgo).length;
    ch.stats.postsThisWeek = (ch.posts || []).filter(p => p.createdAt >= oneWeekAgo).length;
    ch.stats.postsThisMonth = (ch.posts || []).filter(p => p.createdAt >= oneMonthAgo).length;

    // Calculate engagement metrics from actual post data
    let totalReactions = 0;
    let totalShares = 0;

    (ch.posts || []).forEach(post => {
        // Count reactions
        if (post.reactions) {
            Object.values(post.reactions).forEach(users => {
                totalReactions += (users || []).length;
            });
        }
        // Count shares/forwards (if tracked in post metadata)
        if (post.shares) {
            totalShares += post.shares;
        }
    });

    ch.stats.totalReactions = totalReactions;
    ch.stats.totalShares = totalShares;

    // Calculate engagement rate: (reactions + shares) / (followers * posts) * 100
    const totalEngagements = totalReactions + totalShares;
    const possibleEngagements = (ch.followers || []).length * (ch.posts || []).length;
    ch.stats.engagementRate = possibleEngagements > 0
        ? Math.round((totalEngagements / possibleEngagements) * 100)
        : 0;

    // Calculate views from postViewEvents (unique by userId+postId)
    if (ch.stats.postViewEvents) {
        const uniq = (arr) => Array.from(new Set(arr));
        const todayPairs = uniq(ch.stats.postViewEvents.filter(e => e.timestamp >= oneDayAgo).map(e => `${e.userId}:${e.postId}`));
        const weekPairs = uniq(ch.stats.postViewEvents.filter(e => e.timestamp >= oneWeekAgo).map(e => `${e.userId}:${e.postId}`));
        ch.stats.viewsToday = todayPairs.length;
        ch.stats.viewsThisWeek = weekPairs.length;
        // Active followers: unique users who viewed any post in last 7 days
        const activeUsers = uniq(ch.stats.postViewEvents.filter(e => e.timestamp >= oneWeekAgo).map(e => String(e.userId)));
        ch.stats.activeFollowers = activeUsers.length;
    } else {
        ch.stats.viewsToday = 0;
        ch.stats.viewsThisWeek = 0;
        ch.stats.activeFollowers = 0;
    }

    // Populate followers list with details (mocking details if not in memory, ideally fetch from users DB/file)
    // Since we don't have easy access to users.json here without reading it, we'll try to read it or rely on what we have.
    // For now, we'll just return IDs. The frontend can resolve them if it has the friends list, or we can read users.json.
    // Let's read users.json to be safe.
    let followersList = [];
    try {
        const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8')).users || [];
        followersList = (ch.followers || []).map(fid => {
            const meta = (ch.userMeta || {})[String(fid)] || {};
            const u = usersData.find(user => String(user.id) === String(fid));
            const username = (u && (u.username || String(u.id))) || meta.username || `User ${String(fid).slice(-4)}`;
            const avatar = (u && u.avatar) || meta.avatar || '';
            return { id: fid, username, avatar };
        });
    } catch (e) {
        followersList = (ch.followers || []).map(fid => {
            const meta = (ch.userMeta || {})[String(fid)] || {};
            const username = meta.username || `User ${String(fid).slice(-4)}`;
            const avatar = meta.avatar || '';
            return { id: fid, username, avatar };
        });
    }

    // Ensure growthRate present in stats
    if (ch.stats && !('growthRate' in ch.stats)) {
        if ((ch.stats.followerHistory || []).length >= 2) {
            const len = ch.stats.followerHistory.length;
            const prev = ch.stats.followerHistory[len - 2].count || 0;
            const curr = ch.stats.followerHistory[len - 1].count || 0;
            ch.stats.growthRate = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0);
        } else {
            ch.stats.growthRate = (ch.followers || []).length > 0 ? 100 : 0;
        }
    }
    res.json({ success: true, stats: ch.stats || {}, followers: followersList });
});

// Update channel settings (admin only)
app.post('/channels/:id/settings', (req, res) => {
    const { userId, reactions, forwarding, slowMode, requireApproval } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    const isAdmin = (ch.admins || []).includes(String(userId));
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

    // Update settings
    if (!ch.settings) ch.settings = {};
    if (reactions !== undefined) ch.settings.reactions = Boolean(reactions);
    if (forwarding !== undefined) ch.settings.forwarding = Boolean(forwarding);
    if (slowMode !== undefined) ch.settings.slowMode = Number(slowMode) || 0;
    if (requireApproval !== undefined) ch.settings.requireApproval = Boolean(requireApproval);

    saveChannels();
    try { io.emit('channel_settings_updated', { channelId: ch.id, settings: ch.settings }); } catch (_) { }
    res.json({ success: true, settings: ch.settings });
});

// Request to join private channel
app.post('/channels/:id/join-request', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    if (ch.visibility !== 'Private') {
        return res.status(400).json({ error: 'Channel is not private' });
    }

    ch.joinRequests = ch.joinRequests || [];
    if (!ch.joinRequests.includes(String(userId))) {
        ch.joinRequests.push(String(userId));
        saveChannels();
        try { io.emit('channel_join_request', { channelId: ch.id, userId }); } catch (_) { }
    }
    res.json({ success: true, message: 'Join request sent' });
});

// Approve join request (admin only)
app.post('/channels/:id/join-requests/:targetUserId/approve', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    const isAdmin = (ch.admins || []).includes(String(userId));
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

    ch.joinRequests = (ch.joinRequests || []).filter(id => String(id) !== String(req.params.targetUserId));
    if (!ch.members.includes(String(req.params.targetUserId))) {
        ch.members.push(String(req.params.targetUserId));
    }
    saveChannels();
    try {
        io.emit('channel_join_approved', { channelId: ch.id, userId: req.params.targetUserId });
        io.emit('channel_updated', { channelId: ch.id, membersCount: ch.members.length });
    } catch (_) { }
    res.json({ success: true });
});

// Reject join request (admin only)
app.post('/channels/:id/join-requests/:targetUserId/reject', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const ch = channels.find(c => String(c.id) === String(req.params.id));
    if (!ch) return res.status(404).json({ error: 'not_found' });

    const isAdmin = (ch.admins || []).includes(String(userId));
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

    ch.joinRequests = (ch.joinRequests || []).filter(id => String(id) !== String(req.params.targetUserId));
    saveChannels();
    try { io.emit('channel_join_rejected', { channelId: ch.id, userId: req.params.targetUserId }); } catch (_) { }
    res.json({ success: true });
});


// Delete channel
app.delete('/channels/:id', (req, res) => {
    const id = String(req.params.id);
    const idx = channels.findIndex(c => String(c.id) === id);
    if (idx === -1) return res.status(404).json({ error: 'not_found' });
    const removed = channels.splice(idx, 1)[0];
    saveChannels();
    try { io.emit('channel_deleted', { channelId: id }); } catch (_) { }
    res.json({ success: true, id });
});

// Load stories
const storiesFile = path.join(__dirname, 'stories.json');
let stories = [];
if (fs.existsSync(storiesFile)) {
    try {
        const data = JSON.parse(fs.readFileSync(storiesFile, 'utf8'));
        stories = data.stories || [];
    } catch (e) {
        console.error("Error reading stories file:", e);
        stories = [];
    }
}

const cleanupStories = () => {
    const EXPIRY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    let changed = false;

    // Filter items within each story
    stories.forEach(story => {
        const initialCount = story.items.length;
        story.items = story.items.filter(item => {
            let itemTime = item.timestamp;
            // Fallback: extract from URL if timestamp missing
            if (!itemTime && item.url) {
                const match = item.url.match(/\/(\d{13})\./);
                if (match) {
                    itemTime = parseInt(match[1], 10);
                    // Save it so we don't regex next time (optional, but good for perf)
                    item.timestamp = itemTime;
                }
            }
            // If still no time, assume simple 'time' string which is not enough, 
            // but for safety maybe keep? Or if user wants strictly 24h, we might delete.
            // Let's rely on the URL fallback as it's reliable for uploads.
            if (!itemTime) return false; // Remove if undetermined

            return (now - itemTime) < EXPIRY_MS;
        });
        if (story.items.length !== initialCount) changed = true;
    });

    // Remove empty stories
    const initialStoryCount = stories.length;
    stories = stories.filter(s => s.items.length > 0);
    if (stories.length !== initialStoryCount) changed = true;

    if (changed) saveStories();
};

const saveStories = () => {
    fs.writeFileSync(storiesFile, JSON.stringify({ stories }, null, 2));
};

// Initial cleanup on server start
cleanupStories();

// Load groups
const groupsFile = path.join(__dirname, 'groups.json');
let groups = [];
if (fs.existsSync(groupsFile)) {
    try {
        const data = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));
        groups = data.groups || [];
    } catch (e) {
        console.error("Error reading groups file:", e);
        groups = [];
    }
}

const saveGroups = () => {
    fs.writeFileSync(groupsFile, JSON.stringify({ groups }, null, 2));
};

// Normalize groups on startup: ensure creator has 'owner' role and default roles exist
try {
    let changed = false;
    groups = (groups || []).map(g => {
        const out = { ...g };
        if (!Array.isArray(out.roles) || out.roles.length === 0) {
            out.roles = [...DEFAULT_GROUP_ROLES];
            changed = true;
        } else {
            // Ensure default role IDs exist at least once
            const have = new Set(out.roles.map(r => r.id));
            DEFAULT_GROUP_ROLES.forEach(dr => { if (!have.has(dr.id)) { out.roles.push(dr); changed = true; } });
        }
        if (!out.memberRoles || typeof out.memberRoles !== 'object') out.memberRoles = {};
        if (out.createdBy && out.memberRoles[out.createdBy] !== 'owner') {
            out.memberRoles[out.createdBy] = 'owner';
            changed = true;
        }
        // Ensure settings object and default for adminFullPermissionsEnabled
        if (!out.settings || typeof out.settings !== 'object') { out.settings = {}; changed = true; }
        if (typeof out.settings.adminFullPermissionsEnabled === 'undefined') { out.settings.adminFullPermissionsEnabled = true; changed = true; }
        return out;
    });
    if (changed) saveGroups();
} catch (_) { /* ignore normalize errors */ }

// Default role presets for all groups
const DEFAULT_GROUP_ROLES = [
    { id: 'owner', name: 'Owner', color: '#a855f7' },
    { id: 'admin', name: 'Admin', color: '#ef4444' },
    { id: 'mod', name: 'Moderator', color: '#22c55e' },
    { id: 'member', name: 'Member', color: '#6b7280' },
    { id: 'muted', name: 'Muted', color: '#f97316' },
];

// Load communities
const communitiesFile = path.join(__dirname, 'communities.json');
let communities = [];
if (fs.existsSync(communitiesFile)) {
    try {
        const data = JSON.parse(fs.readFileSync(communitiesFile, 'utf8'));
        communities = data.communities || [];
    } catch (e) {
        console.error("Error reading communities file:", e);
        communities = [];
    }
}

const saveCommunities = () => {
    fs.writeFileSync(communitiesFile, JSON.stringify({ communities }, null, 2));
};

// Load doodles
const doodlesFile = path.join(__dirname, 'doodles.json');
let doodles = {}; // roomId -> [doodle objects]
if (fs.existsSync(doodlesFile)) {
    try {
        doodles = JSON.parse(fs.readFileSync(doodlesFile, 'utf8'));
    } catch (e) {
        console.error("Error reading doodles file:", e);
        doodles = {};
    }
}

const saveDoodles = () => {
    fs.writeFileSync(doodlesFile, JSON.stringify(doodles, null, 2));
};

// Track online users
const onlineUsers = new Map(); // userId -> socketId

// Helper function to generate invite link
const generateInviteLink = (communityId) => {
    const token = crypto.randomBytes(16).toString('hex');
    return `${communityId}-${token}`;
};

// Helper function to log moderation actions
const logModerationAction = (community, action, by, target = null) => {
    if (!community.moderationLogs) community.moderationLogs = [];
    community.moderationLogs.push({
        action,
        by,
        target,
        timestamp: Date.now()
    });
};


io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_room', (data) => {
        socket.join(data);
        console.log(`User with ID: ${socket.id} joined room: ${data}`);

        // If data looks like a userId (not a room pair), mark as online
        // Simple heuristic: if it doesn't contain a hyphen (room pair) AND is not a known group ID
        const isGroup = groups.some(g => g.id === data);
        if (!data.includes('-') && !isGroup) {
            onlineUsers.set(data, socket.id);
            io.emit('online_users', Array.from(onlineUsers.keys()));
        }

        // Send history
        if (messages[data]) {
            socket.emit('load_messages', messages[data]);
        } else {
            socket.emit('load_messages', []);
        }

        // Send group metadata (slow mode, pinned messages) if it's a group
        const group = groups.find(g => g.id === data);
        if (group) {
            socket.emit('group_meta', {
                id: group.id,
                settings: group.settings || {},
                pinnedMessages: group.pinnedMessages || []
            });
        }

        // Send doodles
        if (doodles[data]) {
            socket.emit('load_doodles', doodles[data]);
        } else {
            socket.emit('load_doodles', []);
        }

        // Send comments
        if (comments[data]) {
            socket.emit('load_comments', comments[data]);
        } else {
            socket.emit('load_comments', {});
        }
    });

    // Realtime Doodle: begin drawing in a room (group or dm)
    // payload: { room, userId }
    socket.on('doodle_begin', (payload) => {
        try {
            if (!payload || !payload.room) return;
            socket.to(payload.room).emit('doodle_begin', { room: payload.room, userId: payload.userId });
        } catch (_) { }
    });

    // Realtime Doodle: draw segment
    // payload: { room, userId, from: {x,y}, to: {x,y}, color?: string, width?: number }
    socket.on('doodle_draw', (payload) => {
        try {
            if (!payload || !payload.room || !payload.from || !payload.to) return;
            socket.to(payload.room).emit('doodle_draw', payload);
        } catch (_) { }
    });

    // Realtime Doodle: end drawing
    // payload: { room, userId }
    socket.on('doodle_end', (payload) => {
        try {
            if (!payload || !payload.room) return;
            socket.to(payload.room).emit('doodle_end', { room: payload.room, userId: payload.userId });
        } catch (_) { }
    });

    // Realtime Doodle: clear canvas
    // payload: { room, userId }
    // Realtime Doodle: clear canvas
    // payload: { room, userId }
    socket.on('doodle_clear', (payload) => {
        try {
            if (!payload || !payload.room) return;

            // Remove from persistence
            if (doodles[payload.room]) {
                const initialLength = doodles[payload.room].length;
                doodles[payload.room] = doodles[payload.room].filter(d => String(d.creatorUserId) !== String(payload.userId));
                if (doodles[payload.room].length !== initialLength) {
                    saveDoodles();
                }
            }

            io.to(payload.room).emit('doodle_clear', { room: payload.room, userId: payload.userId });
        } catch (_) { }
    });

    // Placed Doodle: place an overlay
    // payload: { room, doodle: { id, image, top, width, height, creatorUserId } }
    // Placed Doodle: place an overlay
    // payload: { room, doodle: { id, image, top, width, height, creatorUserId } }
    socket.on('doodle_place', (payload = {}) => {
        try {
            if (!payload.room || !payload.doodle) return;

            // Persist doodle
            if (!doodles[payload.room]) doodles[payload.room] = [];
            // Avoid duplicates
            if (!doodles[payload.room].some(d => d.id === payload.doodle.id)) {
                doodles[payload.room].push(payload.doodle);
                saveDoodles();
            }

            io.to(payload.room).emit('doodle_place', payload);
        } catch (_) { }
    });

    // Placed Doodle: erase stroke on an overlay
    // payload: { room, doodleId, x, y, radius }
    socket.on('doodle_erase', (payload = {}) => {
        try {
            if (!payload.room || !payload.doodleId) return;

            // Persist erasure
            if (doodles[payload.room]) {
                const doodle = doodles[payload.room].find(d => d.id === payload.doodleId);
                if (doodle) {
                    if (!doodle.erasures) doodle.erasures = [];
                    doodle.erasures.push({ x: payload.x, y: payload.y, radius: payload.radius });
                    saveDoodles();
                }
            }

            socket.to(payload.room).emit('doodle_erase', payload);
        } catch (_) { }
    });

    // Placed Doodle: remove an overlay entirely
    // payload: { room, doodleId }
    // Placed Doodle: remove an overlay entirely
    // payload: { room, doodleId }
    socket.on('doodle_remove', (payload = {}) => {
        try {
            if (!payload.room || !payload.doodleId) return;

            // Remove from persistence
            if (doodles[payload.room]) {
                const initialLength = doodles[payload.room].length;
                doodles[payload.room] = doodles[payload.room].filter(d => d.id !== payload.doodleId);
                if (doodles[payload.room].length !== initialLength) {
                    saveDoodles();
                }
            }

            io.to(payload.room).emit('doodle_remove', payload);
        } catch (_) { }
    });

    // Channel comments: relay to room so admins and users see in real time
    // payload: { room, msgId, comment: { id, userId, author, text, ts, pos } }
    socket.on('channel_comment', (payload = {}) => {
        try {
            if (!payload.room || !payload.msgId || !payload.comment) return;

            // Persist
            if (!comments[payload.room]) comments[payload.room] = {};
            const roomComments = comments[payload.room];
            const list = Array.isArray(roomComments[payload.msgId]) ? roomComments[payload.msgId] : [];

            // Update or add (enforce single comment per user per message if needed, but payload.comment usually has unique ID)
            // Assuming payload.comment is the full comment object
            const existingIdx = list.findIndex(c => String(c.id) === String(payload.comment.id));
            if (existingIdx >= 0) {
                list[existingIdx] = { ...list[existingIdx], ...payload.comment };
            } else {
                list.push(payload.comment);
            }
            roomComments[payload.msgId] = list;
            saveComments();

            io.to(payload.room).emit('channel_comment', payload);
        } catch (_) { }
    });

    // Channel comments: deletion relay
    // payload: { room, msgId, commentId }
    socket.on('channel_comment_delete', (payload = {}) => {
        try {
            if (!payload.room || !payload.msgId || !payload.commentId) return;

            // Persist deletion
            if (comments[payload.room] && comments[payload.room][payload.msgId]) {
                const list = comments[payload.room][payload.msgId];
                comments[payload.room][payload.msgId] = list.filter(c => String(c.id) !== String(payload.commentId));
                saveComments();
            }

            io.to(payload.room).emit('channel_comment_delete', payload);
        } catch (_) { }
    });

    // --- Audio/Video Calling Signaling ---

    // call:initiate
    // payload: { room, isVideo, caller, isGroupCall }
    socket.on('call:initiate', (payload = {}) => {
        try {
            if (!payload.room) return;
            // Relay to all other users in the room
            socket.to(payload.room).emit('call:incoming', {
                room: payload.room,
                caller: payload.caller,
                isVideo: payload.isVideo,
                isGroupCall: payload.isGroupCall
            });
        } catch (_) { }
    });

    // call:answer
    // payload: { room, to }
    socket.on('call:answer', (payload = {}) => {
        try {
            if (!payload.room) return;
            // Notify the caller that call is accepted
            // If it's a 1-on-1 call (payload.to is the caller ID)
            if (payload.to) {
                io.to(onlineUsers.get(payload.to)).emit('call:accepted', {
                    room: payload.room,
                    responder: { id: socket.id }, // Basic responder info
                    peerId: payload.peerId
                });
            } else {
                // For group calls, notify everyone
                io.to(payload.room).emit('call:accepted', {
                    room: payload.room,
                    responder: { id: socket.id },
                    peerId: payload.peerId
                });
            }
        } catch (_) { }
    });

    // call:reject
    // payload: { room, to }
    socket.on('call:reject', (payload = {}) => {
        try {
            if (payload.to) {
                io.to(onlineUsers.get(payload.to)).emit('call:rejected', { room: payload.room });
            }
        } catch (_) { }
    });

    // call:end
    // payload: { room }
    socket.on('call:end', (payload = {}) => {
        try {
            if (!payload.room) return;
            socket.to(payload.room).emit('call:ended', { room: payload.room });
        } catch (_) { }
    });

    // call:offer (WebRTC Offer)
    // payload: { room, to, offer }
    socket.on('call:offer', (payload = {}) => {
        try {
            if (payload.to && onlineUsers.get(payload.to)) {
                io.to(onlineUsers.get(payload.to)).emit('call:offer', {
                    from: socket.id, // Use socket ID for peer connection mapping
                    offer: payload.offer,
                    room: payload.room
                });
            }
        } catch (_) { }
    });

    // call:answer-signal (WebRTC Answer)
    // payload: { room, to, answer }
    socket.on('call:answer-signal', (payload = {}) => {
        try {
            if (payload.to && onlineUsers.get(payload.to)) {
                io.to(onlineUsers.get(payload.to)).emit('call:answer-signal', {
                    from: socket.id,
                    answer: payload.answer,
                    room: payload.room
                });
            }
        } catch (_) { }
    });

    // call:ice-candidate
    // payload: { room, to, candidate }
    socket.on('call:ice-candidate', (payload = {}) => {
        try {
            if (payload.to && onlineUsers.get(payload.to)) {
                io.to(onlineUsers.get(payload.to)).emit('call:ice-candidate', {
                    from: socket.id,
                    candidate: payload.candidate,
                    room: payload.room
                });
            } else if (payload.room && !payload.to) {
                // Broadcast to potential group peers if 'to' is not specified (less common for direct ICE)
                socket.to(payload.room).emit('call:ice-candidate', {
                    from: socket.id,
                    candidate: payload.candidate,
                    room: payload.room
                });
            }
        } catch (_) { }
    });

    // Ban or unban a group member (admin or role with canBan)
    // data: { groupId, memberId, durationMs|null, userId }
    socket.on('group_ban_member', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (!group) return;

        const admins = group.admins || [group.createdBy];
        const isOwner = String(data.userId) === String(group.createdBy);
        const roleId = (group.memberRoles || {})[data.userId];
        const perms = (group.rolePermissions || {})[roleId] || {};
        const isAdmin = admins.includes(data.userId);
        const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
        const allow = isOwner || (roleId ? !!perms.canBan : (isAdmin && adminFull));
        if (!allow) return;

        if (!group.bans || typeof group.bans !== 'object') group.bans = {};
        if (data.durationMs === null || data.durationMs === 0 || typeof data.durationMs === 'undefined') {
            delete group.bans[data.memberId];
        } else {
            const until = (data.durationMs === -1) ? -1 : (Date.now() + Math.max(0, Number(data.durationMs) || 0));
            group.bans[data.memberId] = until;
        }
        saveGroups();

        // Broadcast updated group with populated members
        const dbPath = path.join(__dirname, 'db.json');
        let users = [];
        if (fs.existsSync(dbPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                users = dbData.users;
            } catch (e) { console.error(e); }
        }
        const populatedMembers = group.members.map(memberId => {
            const user = users.find(u => u.id === memberId);
            return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
        });
        const updatedGroup = { ...group, members: populatedMembers, roles: group.roles && Array.isArray(group.roles) ? group.roles : DEFAULT_GROUP_ROLES, memberRoles: group.memberRoles || {}, rolePermissions: group.rolePermissions || {} };
        group.members.forEach(memberId => {
            const socketId = onlineUsers.get(memberId);
            if (socketId) io.to(socketId).emit('group_updated', updatedGroup);
        });
    });

    // Delete a group (owner or admin)
    // data: { groupId, userId }
    socket.on('delete_group', (data) => {
        const group = groups.find(g => String(g.id) === String(data.groupId));
        if (!group) return;
        const isOwner = String(data.userId) === String(group.createdBy);
        const admins = group.admins || [group.createdBy];
        const isAdmin = admins.includes(data.userId);
        const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
        if (!(isOwner || (isAdmin && adminFull))) return;

        // Remove group
        groups = groups.filter(g => String(g.id) !== String(group.id));
        saveGroups();

        // Cleanup messages for the room if present
        try {
            if (messages && messages[group.id]) {
                delete messages[group.id];
                saveMessages();
            }
        } catch (_) { }

        // Notify members
        try {
            (group.members || []).forEach(memberId => {
                const socketId = onlineUsers.get(memberId);
                if (socketId) io.to(socketId).emit('group_removed', { groupId: group.id });
            });
        } catch (_) { }

        // Notify room listeners to clear chat
        try { io.to(group.id).emit('chat_deleted', group.id); } catch (_) { }
    });

    // Promote a member to admin (admin or role with canPromote)
    // data: { groupId, memberId, promotedBy }
    socket.on('promote_group_admin', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (!group) return;
        const admins = group.admins || [group.createdBy];
        const isOwner = String(data.promotedBy) === String(group.createdBy);
        const roleId = (group.memberRoles || {})[data.promotedBy];
        const perms = (group.rolePermissions || {})[roleId] || {};
        const isAdmin = admins.includes(data.promotedBy);
        const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
        const allow = isOwner || (roleId ? !!perms.canPromote : (isAdmin && adminFull));
        if (!allow) return;
        if (!group.admins) group.admins = [];
        if (!group.admins.includes(data.memberId)) group.admins.push(data.memberId);
        saveGroups();

        // Broadcast updated group
        const dbPath = path.join(__dirname, 'db.json');
        let users = [];
        if (fs.existsSync(dbPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                users = dbData.users;
            } catch (e) { console.error(e); }
        }
        const populatedMembers = group.members.map(memberId => {
            const user = users.find(u => u.id === memberId);
            return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
        });
        const updatedGroup = { ...group, members: populatedMembers, roles: group.roles && Array.isArray(group.roles) ? group.roles : DEFAULT_GROUP_ROLES, memberRoles: group.memberRoles || {}, rolePermissions: group.rolePermissions || {} };
        group.members.forEach(memberId => {
            const socketId = onlineUsers.get(memberId);
            if (socketId) io.to(socketId).emit('group_updated', updatedGroup);
        });
    });

    // Demote an admin (admin or role with canPromote), cannot demote owner
    // data: { groupId, memberId, demotedBy }
    socket.on('demote_group_admin', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (!group) return;
        if (data.memberId === group.createdBy) return;
        const admins = group.admins || [group.createdBy];
        const isOwner = String(data.demotedBy) === String(group.createdBy);
        const roleId = (group.memberRoles || {})[data.demotedBy];
        const perms = (group.rolePermissions || {})[roleId] || {};
        const isAdmin = admins.includes(data.demotedBy);
        const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
        const allow = isOwner || (roleId ? !!perms.canPromote : (isAdmin && adminFull));
        if (!allow) return;
        group.admins = (group.admins || []).filter(id => id !== data.memberId);
        saveGroups();

        // Broadcast updated group
        const dbPath = path.join(__dirname, 'db.json');
        let users = [];
        if (fs.existsSync(dbPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                users = dbData.users;
            } catch (e) { console.error(e); }
        }
        const populatedMembers = group.members.map(memberId => {
            const user = users.find(u => u.id === memberId);
            return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
        });
        const updatedGroup = { ...group, members: populatedMembers, roles: group.roles && Array.isArray(group.roles) ? group.roles : DEFAULT_GROUP_ROLES, memberRoles: group.memberRoles || {}, rolePermissions: group.rolePermissions || {} };
        group.members.forEach(memberId => {
            const socketId = onlineUsers.get(memberId);
            if (socketId) io.to(socketId).emit('group_updated', updatedGroup);
        });
    });

    // Update per-role permissions (admin-only)
    // data: { groupId, roleId, permissions: { canInvite?, canRemove?, canPin?, canChangeSlowMode? }, userId }
    socket.on('group_update_role_permissions', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (!group) return;
        const isOwner = String(data.userId) === String(group.createdBy);
        const admins = group.admins || [group.createdBy];
        const roleId = (group.memberRoles || {})[data.userId];
        const perms = (group.rolePermissions || {})[roleId] || {};
        const isAdmin = admins.includes(data.userId);
        const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
        const allow = isOwner || (roleId ? !!perms.canAssignRoles : (isAdmin && adminFull));
        if (!allow) return;

        if (!group.rolePermissions || typeof group.rolePermissions !== 'object') group.rolePermissions = {};
        const prev = group.rolePermissions[data.roleId] || {};
        const updates = data.permissions || {};
        Object.keys(updates).forEach(k => {
            const v = updates[k];
            if (v === null) {
                delete prev[k];
            } else {
                prev[k] = v;
            }
        });
        group.rolePermissions[data.roleId] = prev;
        saveGroups();

        // Broadcast updated group with populated members
        const dbPath = path.join(__dirname, 'db.json');
        let users = [];
        if (fs.existsSync(dbPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                users = dbData.users;
            } catch (e) { console.error(e); }
        }
        const populatedMembers = group.members.map(memberId => {
            const user = users.find(u => u.id === memberId);
            return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
        });
        const updatedGroup = { ...group, members: populatedMembers, roles: group.roles && Array.isArray(group.roles) ? group.roles : DEFAULT_GROUP_ROLES, memberRoles: group.memberRoles || {}, rolePermissions: group.rolePermissions || {} };
        group.members.forEach(memberId => {
            const socketId = onlineUsers.get(memberId);
            if (socketId) io.to(socketId).emit('group_updated', updatedGroup);
        });
    });

    socket.on('group_slow_mode_set', (data) => {
        // data: { room, seconds, userId }
        const group = groups.find(g => g.id === data.room);
        if (group) {
            const isOwner = String(data.userId) === String(group.createdBy);
            const admins = group.admins || [group.createdBy];
            const roleId = (group.memberRoles || {})[data.userId];
            const perms = (group.rolePermissions || {})[roleId] || {};
            const isAdmin = admins.includes(data.userId);
            const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
            const allow = isOwner || (roleId ? !!perms.canChangeSlowMode : (isAdmin && adminFull));
            if (!allow) return;
            if (!group.settings) group.settings = {};
            group.settings.slowMode = data.seconds;
            saveGroups();
            // Broadcast to room (including sender, to confirm)
            io.to(data.room).emit('group_slow_mode_set', data);
        }
    });

    socket.on('group_pin_update', (data) => {
        // data: { room, msgId, action, userId }
        const group = groups.find(g => String(g.id) === String(data.room));
        if (group) {
            // Permission per rule: owner always; if user has role -> role perms; else if admin with no role -> allow
            const isOwner = String(data.userId) === String(group.createdBy);
            const admins = group.admins || [group.createdBy];
            const roleId = (group.memberRoles || {})[data.userId];
            const perms = (group.rolePermissions || {})[roleId] || {};
            const isAdmin = admins.includes(data.userId);
            const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
            const allow = isOwner || (roleId ? !!perms.canPin : (isAdmin && adminFull));
            if (!allow) return;
            if (!group.pinnedMessages) group.pinnedMessages = [];
            if (data.action === 'pin') {
                if (!group.pinnedMessages.includes(data.msgId)) {
                    group.pinnedMessages.push(data.msgId);
                }
            } else if (data.action === 'unpin') {
                group.pinnedMessages = group.pinnedMessages.filter(id => id !== data.msgId);
            }
            saveGroups();
            try {
                const roomMsgs = messages[data.room] || [];
                const msg = roomMsgs.find(m => String(m.id) === String(data.msgId));
                if (msg && data.action === 'pin') {
                    data.summary = {
                        id: msg.id,
                        author: msg.author,
                        message: msg.message || (msg.file ? (msg.file.name || 'Attachment') : ''),
                        file: msg.file ? { name: msg.file.name } : null
                    };
                }
            } catch (_) { /* best effort */ }
            io.to(data.room).emit('group_pin_update', data);
        } else {
            // Not a group room (likely a DM). Just broadcast to sync both peers.
            try { io.to(data.room).emit('group_pin_update', data); } catch (_) { }
        }
    });

    socket.on('message_read', (data) => {
        // data: { room, id, user }
        const roomMessages = messages[data.room];
        if (roomMessages) {
            const msg = roomMessages.find(m => m.id === data.id);
            if (msg) {
                msg.isRead = true;
                saveMessages();
                // Broadcast to everyone in the room so sender sees the update immediately
                io.to(data.room).emit('message_read_update', { id: data.id, room: data.room });
            }
        }
    });

    // Owner toggles whether admins without roles have full permissions
    // data: { groupId, enabled, userId }
    socket.on('group_toggle_admin_full', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (!group) return;
        const isOwner = String(data.userId) === String(group.createdBy);
        if (!isOwner) return;
        if (!group.settings || typeof group.settings !== 'object') group.settings = {};
        group.settings.adminFullPermissionsEnabled = !!data.enabled;
        saveGroups();
        // Broadcast updated group (include basic population if available)
        try {
            const dbPath = path.join(__dirname, 'db.json');
            let users = [];
            if (fs.existsSync(dbPath)) {
                try { const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8')); users = dbData.users; } catch (e) { }
            }
            const populatedMembers = (group.members || []).map(memberId => {
                const user = users.find(u => u.id === memberId);
                return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
            });
            const updatedGroup = { ...group, members: populatedMembers };
            (group.members || []).forEach(memberId => {
                const socketId = onlineUsers.get(memberId);
                if (socketId) io.to(socketId).emit('group_updated', updatedGroup);
            });
        } catch (_) { }
    });

    // Add a custom role to a group (admin-only)
    // data: { groupId, name, color, userId }
    socket.on('group_add_role', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (!group) return;

        const admins = group.admins || [group.createdBy];
        const isOwner = String(data.userId) === String(group.createdBy);
        const roleId = (group.memberRoles || {})[data.userId];
        const isAdmin = admins.includes(data.userId);
        const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
        // Only allow: owner or admin with no role when adminFull on (role-based creation not exposed)
        if (!(isOwner || (!roleId && isAdmin && adminFull))) return;

        if (!group.roles || !Array.isArray(group.roles)) {
            group.roles = [...DEFAULT_GROUP_ROLES];
        }

        const id = data.id || ('role-' + Date.now());
        // Avoid duplicate IDs
        if (group.roles.some(r => r.id === id)) return;

        group.roles.push({
            id,
            name: data.name || 'New Role',
            color: data.color || '#6b7280'
        });
        saveGroups();

        // Broadcast updated group with populated members
        const dbPath = path.join(__dirname, 'db.json');
        let users = [];
        if (fs.existsSync(dbPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                users = dbData.users;
            } catch (e) { console.error(e); }
        }

        const populatedMembers = group.members.map(memberId => {
            const user = users.find(u => u.id === memberId);
            return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
        });

        const updatedGroup = {
            ...group,
            members: populatedMembers,
            roles: group.roles,
            memberRoles: group.memberRoles || {}
        };

        group.members.forEach(memberId => {
            const socketId = onlineUsers.get(memberId);
            if (socketId) {
                io.to(socketId).emit('group_updated', updatedGroup);
            }
        });
    });

    // Update a role's name/color (admin-only, only for custom roles)
    // data: { groupId, roleId, name?, color?, userId }
    socket.on('group_update_role', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (!group) return;
        const admins = group.admins || [group.createdBy];
        const isOwner = String(data.userId) === String(group.createdBy);
        const roleIdActor = (group.memberRoles || {})[data.userId];
        const isAdmin = admins.includes(data.userId);
        const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
        if (!(isOwner || (!roleIdActor && isAdmin && adminFull))) return;

        const DEFAULT_IDS = (DEFAULT_GROUP_ROLES || []).map(r => r.id);
        if (!group.roles || !Array.isArray(group.roles)) group.roles = [...DEFAULT_GROUP_ROLES];

        const role = group.roles.find(r => r.id === data.roleId);
        if (!role) return;
        // Do not allow editing default role ids' name (color could be allowed, but keep simple: disallow both)
        if (DEFAULT_IDS.includes(role.id)) return;

        if (typeof data.name === 'string' && data.name.trim()) role.name = data.name.trim();
        if (typeof data.color === 'string' && data.color.trim()) role.color = data.color.trim();
        saveGroups();

        // Broadcast updated group with populated members
        const dbPath = path.join(__dirname, 'db.json');
        let users = [];
        if (fs.existsSync(dbPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                users = dbData.users;
            } catch (e) { console.error(e); }
        }
        const populatedMembers = group.members.map(memberId => {
            const user = users.find(u => u.id === memberId);
            return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
        });
        const updatedGroup = { ...group, members: populatedMembers, roles: group.roles, memberRoles: group.memberRoles || {} };
        group.members.forEach(memberId => {
            const socketId = onlineUsers.get(memberId);
            if (socketId) io.to(socketId).emit('group_updated', updatedGroup);
        });
    });

    // Delete a custom role (admin-only). Clears memberAssignments of that role
    // data: { groupId, roleId, userId }
    socket.on('group_delete_role', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (!group) return;
        const admins = group.admins || [group.createdBy];
        const isOwner = String(data.userId) === String(group.createdBy);
        const roleIdActor = (group.memberRoles || {})[data.userId];
        const isAdmin = admins.includes(data.userId);
        const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
        if (!(isOwner || (!roleIdActor && isAdmin && adminFull))) return;

        if (!group.roles || !Array.isArray(group.roles)) group.roles = [...DEFAULT_GROUP_ROLES];
        const DEFAULT_IDS = (DEFAULT_GROUP_ROLES || []).map(r => r.id);
        if (DEFAULT_IDS.includes(data.roleId)) return;

        const before = group.roles.length;
        group.roles = group.roles.filter(r => r.id !== data.roleId);
        if (before === group.roles.length) return; // nothing changed

        if (!group.memberRoles) group.memberRoles = {};
        Object.keys(group.memberRoles).forEach(uid => {
            if (group.memberRoles[uid] === data.roleId) delete group.memberRoles[uid];
        });
        saveGroups();

        // Broadcast updated group with populated members
        const dbPath = path.join(__dirname, 'db.json');
        let users = [];
        if (fs.existsSync(dbPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                users = dbData.users;
            } catch (e) { console.error(e); }
        }
        const populatedMembers = group.members.map(memberId => {
            const user = users.find(u => u.id === memberId);
            return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
        });
        const updatedGroup = { ...group, members: populatedMembers, roles: group.roles, memberRoles: group.memberRoles };
        group.members.forEach(memberId => {
            const socketId = onlineUsers.get(memberId);
            if (socketId) io.to(socketId).emit('group_updated', updatedGroup);
        });
    });

    // Assign or clear a role for a member (admin or role with canAssignRoles)
    // data: { groupId, memberId, roleId|null, userId }
    socket.on('group_set_member_role', (data) => {
        console.log('group_set_member_role received:', data);
        const group = groups.find(g => g.id === data.groupId);
        if (!group) return;

        const admins = group.admins || [group.createdBy];
        const isOwner = String(data.userId) === String(group.createdBy);
        const roleId = (group.memberRoles || {})[data.userId];
        const perms = (group.rolePermissions || {})[roleId] || {};
        const isAdmin = admins.includes(data.userId);
        const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
        const allow = isOwner || (roleId ? !!perms.canAssignRoles : (isAdmin && adminFull));
        if (!allow) return;

        if (!group.memberRoles || typeof group.memberRoles !== 'object') {
            group.memberRoles = {};
        }

        if (data.roleId) {
            // Don't allow changing the creator's role away from 'owner'
            if (String(data.memberId) === String(group.createdBy) && data.roleId !== 'owner') return;
            // Ensure group.roles exists
            if (!group.roles || !Array.isArray(group.roles)) {
                group.roles = DEFAULT_GROUP_ROLES;
            }
            // Ensure role exists; if not, ignore
            if (!group.roles.some(r => r.id === data.roleId)) return;
            group.memberRoles[data.memberId] = data.roleId;
        } else {
            // Clear role
            // Never clear owner's role
            if (String(data.memberId) === String(group.createdBy)) {
                group.memberRoles[data.memberId] = 'owner';
            } else {
                delete group.memberRoles[data.memberId];
            }
        }
        saveGroups();

        // Broadcast updated group with populated members
        const dbPath = path.join(__dirname, 'db.json');
        let users = [];
        if (fs.existsSync(dbPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                users = dbData.users;
            } catch (e) { console.error(e); }
        }

        const populatedMembers = group.members.map(memberId => {
            const user = users.find(u => u.id === memberId);
            return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
        });

        const updatedGroup = {
            ...group,
            members: populatedMembers,
            roles: group.roles && Array.isArray(group.roles) ? group.roles : DEFAULT_GROUP_ROLES,
            memberRoles: group.memberRoles || {}
        };

        group.members.forEach(memberId => {
            const socketId = onlineUsers.get(memberId);
            if (socketId) {
                console.log(`Emitting group_updated to member ${memberId} (socket: ${socketId})`);
                io.to(socketId).emit('group_updated', updatedGroup);
            } else {
                console.log(`Member ${memberId} is offline or not found in onlineUsers`);
            }
        });
    });

    socket.on('star_message', (data) => {
        // data: { room, msgId, action, userId }
        const roomMessages = messages[data.room];
        if (roomMessages) {
            const msg = roomMessages.find(m => m.id === data.msgId);
            if (msg) {
                if (!msg.starredBy) msg.starredBy = [];
                if (data.action === 'star') {
                    if (!msg.starredBy.includes(data.userId)) {
                        msg.starredBy.push(data.userId);
                    }
                } else if (data.action === 'unstar') {
                    msg.starredBy = msg.starredBy.filter(id => id !== data.userId);
                }
                saveMessages();
                // Broadcast to room so other devices of the user (or other users if we want to show 'starred by X') update
                io.to(data.room).emit('message_starred', { msgId: data.msgId, starredBy: msg.starredBy, room: data.room });
            }
        }
    });

    socket.on('get_starred_messages', (data) => {
        // data: { room, userId }
        const roomMessages = messages[data.room] || [];
        const starred = roomMessages.filter(m => m.starredBy && m.starredBy.includes(data.userId));
        socket.emit('starred_messages_list', { room: data.room, messages: starred });
    });

    socket.on('unstar_all_messages', (data) => {
        // data: { room, userId }
        const roomMessages = messages[data.room];
        if (roomMessages) {
            let updated = false;
            roomMessages.forEach(msg => {
                if (msg.starredBy && msg.starredBy.includes(data.userId)) {
                    msg.starredBy = msg.starredBy.filter(id => id !== data.userId);
                    updated = true;
                }
            });
            if (updated) {
                saveMessages();
                // Broadcast update to the user so their list clears immediately
                const starred = roomMessages.filter(m => m.starredBy && m.starredBy.includes(data.userId));
                socket.emit('starred_messages_list', { room: data.room, messages: starred });
                // Also notify room to update UI icons
                io.to(data.room).emit('starred_messages_cleared', { room: data.room, userId: data.userId });
            }
        }
    });

    socket.on('create_group', (data) => {
        // data: { name, members: [userIds], avatar, createdBy }
        const newGroup = {
            id: 'group-' + Date.now(),
            name: data.name,
            members: [...data.members, data.createdBy], // Ensure creator is member
            admins: [data.createdBy], // Creator is admin
            avatar: data.avatar || "https://i.pravatar.cc/150?img=12", // Default avatar
            about: data.about || '',
            createdBy: data.createdBy,
            createdAt: Date.now(),
            adminOnlyChat: false, // New property for admin-only messaging
            // Roles: presets + per-member assignment
            roles: DEFAULT_GROUP_ROLES,
            memberRoles: {}
        };

        // Seed memberRoles: creator as owner, others as member by default
        if (!newGroup.memberRoles) newGroup.memberRoles = {};
        newGroup.memberRoles[data.createdBy] = 'owner';
        (data.members || []).forEach(mId => {
            if (!newGroup.memberRoles[mId]) {
                newGroup.memberRoles[mId] = 'member';
            }
        });
        groups.push(newGroup);
        saveGroups();

        // Notify all members
        newGroup.members.forEach(memberId => {
            const socketId = onlineUsers.get(memberId);
            if (socketId) {
                io.to(socketId).emit('group_created', newGroup);
            }
        });
    });

    // Update Group Settings (e.g., about)
    app.post('/groups/:id/settings', (req, res) => {
        const { userId, about } = req.body || {};
        if (!userId) return res.status(400).json({ error: 'userId required' });
        const group = groups.find(g => String(g.id) === String(req.params.id));
        if (!group) return res.status(404).json({ error: 'not_found' });
        // Only creator or admins can edit settings
        const isAdmin = (group.admins || []).map(String).includes(String(userId)) || String(group.createdBy) === String(userId);
        if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

        if (about !== undefined) {
            group.about = String(about);
        }
        saveGroups();
        try { io.emit('group_updated', group); } catch (_) { }
        res.json({ success: true, group });
    });

    socket.on('get_groups', (userId) => {
        const userGroups = groups.filter(g => g.members.includes(userId));

        // Populate member details
        const dbPath = path.join(__dirname, 'db.json');
        let users = [];
        if (fs.existsSync(dbPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                users = dbData.users;
            } catch (e) { console.error(e); }
        }

        const populatedGroups = userGroups.map(g => {
            const populatedMembers = g.members.map(memberId => {
                const user = users.find(u => u.id === memberId);
                return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
            });

            return {
                ...g,
                members: populatedMembers, // Now an array of objects
                admins: g.admins || (g.createdBy ? [g.createdBy] : []),
                roles: g.roles && Array.isArray(g.roles) ? g.roles : DEFAULT_GROUP_ROLES,
                memberRoles: g.memberRoles || {},
                rolePermissions: g.rolePermissions || {}
            };
        });

        socket.emit('groups_list', populatedGroups);
    });

    socket.on('get_channels', (userId) => {
        // Return all public channels + private channels the user is a member of
        const userChannels = channels.map(ch => ({
            id: ch.id,
            name: ch.name,
            description: ch.description,
            category: ch.category,
            visibility: ch.visibility,
            photo: ch.photo,
            members: Array.isArray(ch.members) ? ch.members.length : 0,
            createdBy: ch.createdBy,
            followers: ch.followers || []
        }));
        socket.emit('channels_list', userChannels);
    });

    socket.on('delete_group', (data) => {
        // data: { groupId, userId }
        const groupIndex = groups.findIndex(g => g.id === data.groupId);
        if (groupIndex === -1) return;

        const group = groups[groupIndex];

        // Check if user is admin
        if (!group.admins.includes(data.userId)) {
            return; // Only admins can delete
        }

        // Check if this group is part of a community
        const community = communities.find(c =>
            c.subGroups.includes(data.groupId) || c.announcementGroupId === data.groupId
        );

        if (community) {
            // If it's an announcement group, don't allow deletion (delete community instead)
            if (community.announcementGroupId === data.groupId) {
                return; // Can't delete announcement group directly
            }

            // Remove from community's subGroups
            community.subGroups = community.subGroups.filter(id => id !== data.groupId);
            saveCommunities();

            // Log the action
            logModerationAction(community, 'group_removed', data.userId, data.groupId);
        }

        // Remove the group
        groups.splice(groupIndex, 1);
        saveGroups();

        // Delete messages for this group
        if (messages[data.groupId]) {
            delete messages[data.groupId];
            saveMessages();
        }

        // Notify all members
        group.members.forEach(memberId => {
            const socketId = onlineUsers.get(memberId);
            if (socketId) {
                io.to(socketId).emit('group_removed', { groupId: data.groupId });
                // Also update communities list if it was part of a community
                if (community) {
                    io.to(socketId).emit('community_updated', community);
                }
            }
        });
    });

    // Fetch user details for group members
    app.post('/users/details', (req, res) => {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds)) return res.status(400).send("Invalid userIds");

        const dbPath = path.join(__dirname, 'db.json');
        if (fs.existsSync(dbPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                const users = dbData.users.filter(u => userIds.includes(u.id)).map(u => ({
                    id: u.id,
                    username: u.username,
                    avatar: u.avatar
                }));
                res.json(users);
            } catch (e) {
                res.status(500).send("Error reading db");
            }
        } else {
            res.json([]);
        }
    });

    socket.on('rename_group', (data) => {
        // data: { groupId, newName, userId }
        const group = groups.find(g => g.id === data.groupId);
        if (group) {
            const admins = group.admins || [group.createdBy];
            const isOwner = String(data.userId) === String(group.createdBy);
            const roleId = (group.memberRoles || {})[data.userId];
            const perms = (group.rolePermissions || {})[roleId] || {};
            const isAdmin = admins.includes(data.userId);
            const adminFull = !!(group.settings && group.settings.adminFullPermissionsEnabled);
            const allow = isOwner || (roleId ? !!perms.canEditGroupName : (isAdmin && adminFull));
            if (allow) {
                group.name = data.newName;
                saveGroups();

                // Populate member details before sending
                const dbPath = path.join(__dirname, 'db.json');
                let users = [];
                if (fs.existsSync(dbPath)) {
                    try {
                        const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                        users = dbData.users;
                    } catch (e) { console.error(e); }
                }

                const populatedMembers = group.members.map(memberId => {
                    const user = users.find(u => u.id === memberId);
                    return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
                });

                const updatedGroup = {
                    ...group,
                    members: populatedMembers
                };

                // Notify all members
                group.members.forEach(memberId => {
                    const socketId = onlineUsers.get(memberId);
                    if (socketId) {
                        io.to(socketId).emit('group_updated', updatedGroup);
                    }
                });
            }
        }
    });

    socket.on('add_group_member', (data) => {
        // data: { groupId, newMemberId, addedBy }
        const group = groups.find(g => g.id === data.groupId);
        if (group) {
            const admins = group.admins || [group.createdBy];
            const isOwner = String(data.addedBy) === String(group.createdBy);
            const roleId = (group.memberRoles || {})[data.addedBy];
            const perms = (group.rolePermissions || {})[roleId] || {};
            const isAdmin = admins.includes(data.addedBy);
            const allow = isOwner || (roleId ? !!perms.canInvite : isAdmin);
            if (allow) {
                // Prevent adding banned members if ban still active
                const bans = group.bans || {};
                const until = bans[data.newMemberId];
                const activeBan = (until === -1) || (typeof until === 'number' && until > Date.now());
                if (activeBan) return;
                if (!group.members.includes(data.newMemberId)) {
                    group.members.push(data.newMemberId);
                    saveGroups();

                    // Notify the new member
                    const newMemberSocket = onlineUsers.get(data.newMemberId);
                    if (newMemberSocket) {
                        // Join the socket room
                        const socketInstance = io.sockets.sockets.get(newMemberSocket);
                        if (socketInstance) socketInstance.join(group.id);
                        io.to(newMemberSocket).emit('group_created', group); // Treat as new group for them
                    }

                    // Notify existing members
                    group.members.forEach(memberId => {
                        const socketId = onlineUsers.get(memberId);
                        if (socketId) {
                            io.to(socketId).emit('group_updated', group);
                        }
                    });

                    // If this group is a community's announcement group, update the new member's community list immediately
                    try {
                        const community = communities.find(c => String(c.announcementGroupId) === String(group.id));
                        if (community) {
                            const socketId = onlineUsers.get(data.newMemberId);
                            if (socketId) {
                                const userId = data.newMemberId;
                                const userCommunities = communities
                                    .filter(c => {
                                        const ann = groups.find(g => g.id === c.announcementGroupId);
                                        const inAnnouncement = !!(ann && Array.isArray(ann.members) && ann.members.includes(userId));
                                        const inMembers = Array.isArray(c.members) && c.members.includes(userId);
                                        const notBlocked = !(Array.isArray(c.blockedMembers) && c.blockedMembers.includes(userId));
                                        return notBlocked && (inMembers || inAnnouncement);
                                    })
                                    .map(c => {
                                        try {
                                            const ann = groups.find(g => g.id === c.announcementGroupId);
                                            const mergedMembers = Array.from(new Set([...
                                                (Array.isArray(c.members) ? c.members : []),
                                            ...(ann && Array.isArray(ann.members) ? ann.members : [])
                                            ]));
                                            return { ...c, members: mergedMembers };
                                        } catch (_) { return c; }
                                    });
                                io.to(socketId).emit('communities_list', userCommunities);
                            }
                        }
                    } catch (_) { }

                    // System message with member names
                    const dbPath = path.join(__dirname, 'db.json');
                    let users = [];
                    if (fs.existsSync(dbPath)) {
                        try {
                            const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                            users = dbData.users;
                        } catch (e) { console.error(e); }
                    }
                    const addedByUser = users.find(u => u.id === data.addedBy);
                    const newMemberUser = users.find(u => u.id === data.newMemberId);
                    const addedByName = addedByUser ? addedByUser.username : 'Someone';
                    const newMemberName = newMemberUser ? newMemberUser.username : 'A new member';

                    const sysMsg = {
                        id: Date.now(),
                        room: group.id,
                        author: "System",
                        message: `${addedByName} added ${newMemberName}`,
                        type: "system",
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        systemType: "add_member",
                        actorId: data.addedBy,
                        targetId: data.newMemberId
                    };

                    if (!messages[group.id]) messages[group.id] = [];
                    messages[group.id].push(sysMsg);
                    saveMessages();
                    io.to(group.id).emit('receive_message', sysMsg);
                }
            }
        }
    });

    socket.on('remove_group_member', (data) => {
        // data: { groupId, memberId, removedBy }
        const group = groups.find(g => g.id === data.groupId);
        if (group) {
            const admins = group.admins || [group.createdBy];
            const isOwner = String(data.removedBy) === String(group.createdBy);
            const roleId = (group.memberRoles || {})[data.removedBy];
            const perms = (group.rolePermissions || {})[roleId] || {};
            const isAdmin = admins.includes(data.removedBy);
            const allow = isOwner || (roleId ? !!perms.canRemove : isAdmin);
            if (allow) {
                // Check if removing the creator
                const isRemovingCreator = data.memberId === group.createdBy;
                const otherAdmins = group.admins?.filter(id => id !== data.memberId) || [];

                // If removing creator, ensure there are other admins to take over
                if (isRemovingCreator && otherAdmins.length === 0) {
                    // Cannot remove creator if no other admins exist
                    return;
                }

                if (group.members.includes(data.memberId)) {
                    group.members = group.members.filter(m => m !== data.memberId);
                    // Also remove from admins if they were one
                    if (group.admins) {
                        group.admins = group.admins.filter(a => a !== data.memberId);
                    }

                    // If creator was removed, transfer ownership to the first remaining admin
                    if (isRemovingCreator && otherAdmins.length > 0) {
                        group.createdBy = otherAdmins[0];
                    }

                    saveGroups();

                    // Notify the removed member (so they can remove from list)
                    const removedMemberSocket = onlineUsers.get(data.memberId);
                    if (removedMemberSocket) {
                        io.to(removedMemberSocket).emit('group_removed', { groupId: group.id });
                        const socketInstance = io.sockets.sockets.get(removedMemberSocket);
                        if (socketInstance) socketInstance.leave(group.id);
                    }

                    // Notify remaining members
                    group.members.forEach(memberId => {
                        const socketId = onlineUsers.get(memberId);
                        if (socketId) {
                            io.to(socketId).emit('group_updated', group);
                        }
                    });

                    // System message with member names
                    const dbPath = path.join(__dirname, 'db.json');
                    let users = [];
                    if (fs.existsSync(dbPath)) {
                        try {
                            const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                            users = dbData.users;
                        } catch (e) { console.error(e); }
                    }
                    const removedByUser = users.find(u => u.id === data.removedBy);
                    const removedMemberUser = users.find(u => u.id === data.memberId);
                    const removedByName = removedByUser ? removedByUser.username : 'Someone';
                    const removedMemberName = removedMemberUser ? removedMemberUser.username : 'A member';

                    const sysMsg = {
                        id: Date.now(),
                        room: group.id,
                        author: "System",
                        message: `${removedByName} removed ${removedMemberName}`,
                        type: "system",
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        systemType: "remove_member",
                        actorId: data.removedBy,
                        targetId: data.memberId
                    };

                    if (!messages[group.id]) messages[group.id] = [];
                    messages[group.id].push(sysMsg);
                    saveMessages();
                    io.to(group.id).emit('receive_message', sysMsg);
                }
            }
        }
    });

    socket.on('promote_group_admin', (data) => {
        // data: { groupId, memberId, promotedBy }
        const group = groups.find(g => g.id === data.groupId);
        if (group) {
            const admins = group.admins || [group.createdBy];
            if (admins.includes(data.promotedBy)) {
                if (group.members.includes(data.memberId) && !admins.includes(data.memberId)) {
                    if (!group.admins) group.admins = [group.createdBy];
                    group.admins.push(data.memberId);
                    saveGroups();

                    // Notify all members with populated member details
                    const dbPath = path.join(__dirname, 'db.json');
                    let users = [];
                    if (fs.existsSync(dbPath)) {
                        try {
                            const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                            users = dbData.users;
                        } catch (e) { console.error(e); }
                    }

                    const populatedMembers = group.members.map(memberId => {
                        const user = users.find(u => u.id === memberId);
                        return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
                    });

                    const updatedGroup = {
                        ...group,
                        members: populatedMembers
                    };

                    // Notify all members
                    group.members.forEach(memberId => {
                        const socketId = onlineUsers.get(memberId);
                        if (socketId) {
                            io.to(socketId).emit('group_updated', updatedGroup);
                        }
                    });
                }
            }
        }
    });

    socket.on('demote_group_admin', (data) => {
        // data: { groupId, memberId, demotedBy }
        const group = groups.find(g => g.id === data.groupId);
        if (group) {
            const admins = group.admins || [group.createdBy];
            // Only admins can demote, and can't demote the creator
            if (admins.includes(data.demotedBy) && data.memberId !== group.createdBy) {
                if (group.admins && group.admins.includes(data.memberId)) {
                    group.admins = group.admins.filter(id => id !== data.memberId);
                    saveGroups();

                    // Notify all members with populated member details
                    const dbPath = path.join(__dirname, 'db.json');
                    let users = [];
                    if (fs.existsSync(dbPath)) {
                        try {
                            const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                            users = dbData.users;
                        } catch (e) { console.error(e); }
                    }

                    const populatedMembers = group.members.map(memberId => {
                        const user = users.find(u => u.id === memberId);
                        return user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: memberId, username: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
                    });

                    const updatedGroup = {
                        ...group,
                        members: populatedMembers
                    };

                    group.members.forEach(memberId => {
                        const socketId = onlineUsers.get(memberId);
                        if (socketId) {
                            io.to(socketId).emit('group_updated', updatedGroup);
                        }
                    });
                }
            }
        }
    });

    socket.on('leave_group', (data) => {
        // data: { groupId, userId }
        const group = groups.find(g => g.id === data.groupId);
        if (group) {
            if (group.members.includes(data.userId)) {
                group.members = group.members.filter(m => m !== data.userId);
                if (group.admins) {
                    group.admins = group.admins.filter(a => a !== data.userId);
                }
                // If no members left, delete group? Or keep it. Let's keep it for now or delete if empty.
                if (group.members.length === 0) {
                    groups = groups.filter(g => g.id !== data.groupId);
                }
                saveGroups();

                // Notify the user who left
                const socketId = onlineUsers.get(data.userId);
                if (socketId) {
                    io.to(socketId).emit('group_removed', { groupId: group.id });
                    const socketInstance = io.sockets.sockets.get(socketId);
                    if (socketInstance) socketInstance.leave(group.id);
                }

                // Notify remaining members
                group.members.forEach(memberId => {
                    const sockId = onlineUsers.get(memberId);
                    if (sockId) {
                        io.to(sockId).emit('group_updated', group);
                    }
                });

                // System message with member name
                if (group.members.length > 0) {
                    const dbPath = path.join(__dirname, 'db.json');
                    let users = [];
                    if (fs.existsSync(dbPath)) {
                        try {
                            const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                            users = dbData.users;
                        } catch (e) { console.error(e); }
                    }
                    const leftUser = users.find(u => u.id === data.userId);
                    const leftUserName = leftUser ? leftUser.username : 'A member';

                    const sysMsg = {
                        id: Date.now(),
                        room: group.id,
                        author: "System",
                        message: `${leftUserName} left the group`,
                        type: "system",
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        systemType: "leave_member",
                        actorId: data.userId
                    };

                    if (!messages[group.id]) messages[group.id] = [];
                    messages[group.id].push(sysMsg);
                    saveMessages();
                    io.to(group.id).emit('receive_message', sysMsg);
                }
            }
        }
    });

    socket.on('toggle_admin_only_chat', (data) => {
        // data: { groupId, enabled, userId }
        const group = groups.find(g => g.id === data.groupId);
        if (group) {
            const admins = group.admins || [group.createdBy];
            if (admins.includes(data.userId)) {
                group.adminOnlyChat = data.enabled;
                saveGroups();

                // Notify all members
                group.members.forEach(memberId => {
                    const socketId = onlineUsers.get(memberId);
                    if (socketId) {
                        io.to(socketId).emit('admin_only_chat_toggled', { groupId: group.id, enabled: data.enabled });
                    }
                });
            }
        }
    });


    // ============================================
    // COMMUNITY SOCKET EVENTS
    // ============================================

    // Create Community
    socket.on('create_community', (data) => {
        const communityId = 'community-' + Date.now();
        const announcementGroupId = 'group-' + Date.now();

        // Create Announcement Group
        const announcementGroup = {
            id: announcementGroupId,
            name: `${data.name} Announcements`,
            members: [data.createdBy],
            admins: [data.createdBy],
            avatar: data.icon || "https://i.pravatar.cc/150?img=12",
            createdBy: data.createdBy,
            createdAt: Date.now(),
            adminOnlyChat: true,
            isAnnouncementGroup: true,
            isGroup: true,
            communityId: communityId,
            permissions: {
                posting: 'admins',
                media: true,
                forwarding: true
            },
            settings: {
                slowMode: 0,
                locked: false,
                announcementsOnly: true
            },
            pinnedMessages: []
        };
        groups.push(announcementGroup);
        saveGroups();

        const newCommunity = {
            id: communityId,
            name: data.name,
            description: data.description || '',
            icon: data.icon || "https://i.pravatar.cc/150?img=12",
            ownerId: data.createdBy,
            admins: [data.createdBy],
            members: [data.createdBy],
            subGroups: [],
            announcementGroupId: announcementGroupId,
            visibility: data.visibility || 'public',
            inviteLink: generateInviteLink(communityId),
            joinRequests: [],
            blockedMembers: [],
            settings: {
                allowMemberInvites: false,
                requireApproval: data.visibility === 'private' || data.visibility === 'invite-only',
                allowForwarding: true
            },
            createdAt: Date.now(),
            moderationLogs: []
        };

        logModerationAction(newCommunity, 'community_created', data.createdBy);
        communities.push(newCommunity);
        saveCommunities();

        socket.emit('community_created', newCommunity);
        // Also send updated list so client sidebar reflects immediately
        try {
            const userCommunities = communities
                .filter(c => {
                    const ann = groups.find(g => g.id === c.announcementGroupId);
                    const inAnnouncement = !!(ann && Array.isArray(ann.members) && ann.members.includes(data.createdBy));
                    const inMembers = Array.isArray(c.members) && c.members.includes(data.createdBy);
                    const notBlocked = !(Array.isArray(c.blockedMembers) && c.blockedMembers.includes(data.createdBy));
                    return notBlocked && (inMembers || inAnnouncement);
                })
                .map(c => {
                    try {
                        const ann = groups.find(g => g.id === c.announcementGroupId);
                        const mergedMembers = Array.from(new Set([...
                            (Array.isArray(c.members) ? c.members : []),
                        ...(ann && Array.isArray(ann.members) ? ann.members : [])
                        ]));
                        return { ...c, members: mergedMembers };
                    } catch (_) { return c; }
                });
            socket.emit('communities_list', userCommunities);
        } catch (_) { }
        socket.emit('group_created', announcementGroup);
        socket.join(announcementGroupId);
    });

    // Get Communities
    socket.on('get_communities', (userId) => {
        const userCommunities = communities
            .filter(c => {
                const ann = groups.find(g => g.id === c.announcementGroupId);
                const inAnnouncement = !!(ann && Array.isArray(ann.members) && ann.members.includes(userId));
                const inMembers = Array.isArray(c.members) && c.members.includes(userId);
                const notBlocked = !(Array.isArray(c.blockedMembers) && c.blockedMembers.includes(userId));
                return notBlocked && (inMembers || inAnnouncement);
            })
            .map(c => {
                try {
                    const ann = groups.find(g => g.id === c.announcementGroupId);
                    const mergedMembers = Array.from(new Set([...
                        (Array.isArray(c.members) ? c.members : []),
                    ...(ann && Array.isArray(ann.members) ? ann.members : [])
                    ]));
                    return { ...c, members: mergedMembers };
                } catch (_) { return c; }
            });
        socket.emit('communities_list', userCommunities);
    });

    // Edit Community
    socket.on('edit_community', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.admins.includes(data.userId)) {
            if (data.name) community.name = data.name;
            if (data.description !== undefined) community.description = data.description;
            if (data.icon) community.icon = data.icon;
            if (data.visibility) community.visibility = data.visibility;

            logModerationAction(community, 'community_edited', data.userId);
            saveCommunities();

            // Notify all members
            community.members.forEach(memberId => {
                const socketId = onlineUsers.get(memberId);
                if (socketId) {
                    io.to(socketId).emit('community_updated', community);
                }
            });
        }
    });

    // Delete Community
    socket.on('delete_community', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.ownerId === data.userId) {
            // Delete announcement group
            const announcementGroup = groups.find(g => g.id === community.announcementGroupId);
            if (announcementGroup) {
                groups = groups.filter(g => g.id !== community.announcementGroupId);
                saveGroups();
            }

            // Unlink all sub-groups
            community.subGroups.forEach(groupId => {
                const group = groups.find(g => g.id === groupId);
                if (group) {
                    delete group.communityId;
                }
            });
            saveGroups();

            // Notify all members
            community.members.forEach(memberId => {
                const socketId = onlineUsers.get(memberId);
                if (socketId) {
                    io.to(socketId).emit('community_deleted', { communityId: community.id });
                }
            });

            communities = communities.filter(c => c.id !== data.communityId);
            saveCommunities();
        }
    });

    // Join Community
    socket.on('join_community', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (!community || community.blockedMembers.includes(data.userId)) return;

        if (community.settings.requireApproval) {
            // Add to join requests
            if (!community.joinRequests.find(r => r.userId === data.userId)) {
                community.joinRequests.push({
                    userId: data.userId,
                    requestedAt: Date.now()
                });
                saveCommunities();

                // Notify admins
                community.admins.forEach(adminId => {
                    const socketId = onlineUsers.get(adminId);
                    if (socketId) {
                        io.to(socketId).emit('join_request_received', {
                            communityId: community.id,
                            userId: data.userId
                        });
                    }
                });

                socket.emit('join_request_sent', { communityId: community.id });
            }
        } else {
            // Auto-join
            if (!community.members.includes(data.userId)) {
                community.members.push(data.userId);

                // Add to announcement group
                const announcementGroup = groups.find(g => g.id === community.announcementGroupId);
                if (announcementGroup && !announcementGroup.members.includes(data.userId)) {
                    announcementGroup.members.push(data.userId);
                    saveGroups();
                    socket.join(announcementGroup.id);
                    socket.emit('group_created', announcementGroup);
                }

                logModerationAction(community, 'member_joined', data.userId);
                saveCommunities();
                socket.emit('community_joined', community);
            }
        }
    });

    // Leave Community
    socket.on('leave_community', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.ownerId !== data.userId) {
            community.members = community.members.filter(id => id !== data.userId);
            community.admins = community.admins.filter(id => id !== data.userId);

            // Remove from announcement group
            const announcementGroup = groups.find(g => g.id === community.announcementGroupId);
            if (announcementGroup) {
                announcementGroup.members = announcementGroup.members.filter(id => id !== data.userId);
                announcementGroup.admins = announcementGroup.admins.filter(id => id !== data.userId);
                saveGroups();
            }

            // Remove from all sub-groups
            community.subGroups.forEach(groupId => {
                const group = groups.find(g => g.id === groupId);
                if (group) {
                    group.members = group.members.filter(id => id !== data.userId);
                    group.admins = group.admins.filter(id => id !== data.userId);
                }
            });
            saveGroups();

            logModerationAction(community, 'member_left', data.userId);
            saveCommunities();
            socket.emit('community_left', { communityId: community.id });
        }
    });

    // Approve Join Request
    socket.on('approve_join_request', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.admins.includes(data.approverId)) {
            const request = community.joinRequests.find(r => r.userId === data.userId);
            if (request) {
                // Add to members
                if (!community.members.includes(data.userId)) {
                    community.members.push(data.userId);
                }

                // Add to announcement group
                const announcementGroup = groups.find(g => g.id === community.announcementGroupId);
                if (announcementGroup && !announcementGroup.members.includes(data.userId)) {
                    announcementGroup.members.push(data.userId);
                    saveGroups();

                    const socketId = onlineUsers.get(data.userId);
                    if (socketId) {
                        const socketInstance = io.sockets.sockets.get(socketId);
                        if (socketInstance) {
                            socketInstance.join(announcementGroup.id);
                            io.to(socketId).emit('group_created', announcementGroup);
                        }
                    }
                }

                // Remove from requests
                community.joinRequests = community.joinRequests.filter(r => r.userId !== data.userId);

                logModerationAction(community, 'join_request_approved', data.approverId, data.userId);
                saveCommunities();

                // Notify user
                const socketId = onlineUsers.get(data.userId);
                if (socketId) {
                    io.to(socketId).emit('community_joined', community);
                }
            }
        }
    });

    // Reject Join Request
    socket.on('reject_join_request', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.admins.includes(data.rejecterId)) {
            community.joinRequests = community.joinRequests.filter(r => r.userId !== data.userId);
            logModerationAction(community, 'join_request_rejected', data.rejecterId, data.userId);
            saveCommunities();

            // Notify user
            const socketId = onlineUsers.get(data.userId);
            if (socketId) {
                io.to(socketId).emit('join_request_rejected', { communityId: community.id });
            }
        }
    });

    // Add Sub-group
    socket.on('add_subgroup', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.admins.includes(data.userId)) {
            const group = groups.find(g => g.id === data.groupId);
            if (group && !community.subGroups.includes(data.groupId)) {
                community.subGroups.push(data.groupId);
                group.communityId = community.id;

                // Add all group members to community
                group.members.forEach(memberId => {
                    if (!community.members.includes(memberId)) {
                        community.members.push(memberId);
                    }

                    // Add to announcement group
                    const announcementGroup = groups.find(g => g.id === community.announcementGroupId);
                    if (announcementGroup && !announcementGroup.members.includes(memberId)) {
                        announcementGroup.members.push(memberId);

                        const socketId = onlineUsers.get(memberId);
                        if (socketId) {
                            const socketInstance = io.sockets.sockets.get(socketId);
                            if (socketInstance) {
                                socketInstance.join(announcementGroup.id);
                                io.to(socketId).emit('community_joined', community);
                                io.to(socketId).emit('group_created', announcementGroup);
                            }
                        }
                    }
                });

                logModerationAction(community, 'subgroup_added', data.userId, data.groupId);
                saveGroups();
                saveCommunities();

                socket.emit('subgroup_added', { communityId: community.id, groupId: data.groupId });
            }
        }
    });

    // Remove Sub-group (scoped to the given community only)
    socket.on('remove_subgroup', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.admins.includes(data.userId)) {
            community.subGroups = community.subGroups.filter(id => id !== data.groupId);

            const group = groups.find(g => g.id === data.groupId);
            if (group) {
                // Only unset group.communityId if the group is not part of any community anymore
                const stillUsedElsewhere = communities.some(c => c.subGroups.includes(group.id));
                if (!stillUsedElsewhere) {
                    delete group.communityId;
                }
            }

            logModerationAction(community, 'subgroup_removed', data.userId, data.groupId);
            saveGroups();
            saveCommunities();

            // Notify members of this community
            community.members.forEach(memberId => {
                const socketId = onlineUsers.get(memberId);
                if (socketId) {
                    io.to(socketId).emit('community_updated', community);
                }
            });

            socket.emit('subgroup_removed', { communityId: community.id, groupId: data.groupId });
        }
    });

    // Promote Admin
    socket.on('promote_admin', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && (community.ownerId === data.promoterId || community.admins.includes(data.promoterId))) {
            if (!community.admins.includes(data.memberId) && community.members.includes(data.memberId)) {
                community.admins.push(data.memberId);

                // Add as admin to announcement group and ensure membership + client visibility
                const announcementGroup = groups.find(g => g.id === community.announcementGroupId);
                if (announcementGroup) {
                    if (!announcementGroup.admins.includes(data.memberId)) {
                        announcementGroup.admins.push(data.memberId);
                    }
                    if (!announcementGroup.members.includes(data.memberId)) {
                        announcementGroup.members.push(data.memberId);
                    }
                    saveGroups();

                    // Join socket room and emit group_created to the promoted admin so they can open announcements
                    const socketId = onlineUsers.get(data.memberId);
                    if (socketId) {
                        const socketInstance = io.sockets.sockets.get(socketId);
                        if (socketInstance) socketInstance.join(announcementGroup.id);
                        io.to(socketId).emit('group_created', announcementGroup);
                    }
                }

                logModerationAction(community, 'admin_promoted', data.promoterId, data.memberId);
                saveCommunities();

                // Notify all members
                community.members.forEach(memberId => {
                    const socketId = onlineUsers.get(memberId);
                    if (socketId) {
                        io.to(socketId).emit('community_updated', community);
                    }
                });
            }
        }
    });

    // Demote Admin
    socket.on('demote_admin', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.ownerId === data.demoterId && data.memberId !== community.ownerId) {
            community.admins = community.admins.filter(id => id !== data.memberId);

            // Remove as admin from announcement group
            const announcementGroup = groups.find(g => g.id === community.announcementGroupId);
            if (announcementGroup) {
                announcementGroup.admins = announcementGroup.admins.filter(id => id !== data.memberId);
                saveGroups();
            }

            logModerationAction(community, 'admin_demoted', data.demoterId, data.memberId);
            saveCommunities();

            // Notify all members
            community.members.forEach(memberId => {
                const socketId = onlineUsers.get(memberId);
                if (socketId) {
                    io.to(socketId).emit('community_updated', community);
                }
            });
        }
    });

    // Remove Member
    socket.on('remove_member', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.admins.includes(data.removerId) && data.memberId !== community.ownerId) {
            community.members = community.members.filter(id => id !== data.memberId);
            community.admins = community.admins.filter(id => id !== data.memberId);

            // Remove from announcement group
            const announcementGroup = groups.find(g => g.id === community.announcementGroupId);
            if (announcementGroup) {
                announcementGroup.members = announcementGroup.members.filter(id => id !== data.memberId);
                announcementGroup.admins = announcementGroup.admins.filter(id => id !== data.memberId);
                saveGroups();
            }

            // Remove from all sub-groups
            community.subGroups.forEach(groupId => {
                const group = groups.find(g => g.id === groupId);
                if (group) {
                    group.members = group.members.filter(id => id !== data.memberId);
                    group.admins = group.admins.filter(id => id !== data.memberId);
                }
            });
            saveGroups();

            logModerationAction(community, 'member_removed', data.removerId, data.memberId);
            saveCommunities();

            // Notify removed member
            const socketId = onlineUsers.get(data.memberId);
            if (socketId) {
                io.to(socketId).emit('removed_from_community', { communityId: community.id });
            }
        }
    });

    // Block Member
    socket.on('block_member', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.admins.includes(data.blockerId) && data.memberId !== community.ownerId) {
            if (!community.blockedMembers.includes(data.memberId)) {
                community.blockedMembers.push(data.memberId);
            }

            // Remove from members
            community.members = community.members.filter(id => id !== data.memberId);
            community.admins = community.admins.filter(id => id !== data.memberId);

            // Remove from all groups
            const announcementGroup = groups.find(g => g.id === community.announcementGroupId);
            if (announcementGroup) {
                announcementGroup.members = announcementGroup.members.filter(id => id !== data.memberId);
                announcementGroup.admins = announcementGroup.admins.filter(id => id !== data.memberId);
            }

            community.subGroups.forEach(groupId => {
                const group = groups.find(g => g.id === groupId);
                if (group) {
                    group.members = group.members.filter(id => id !== data.memberId);
                    group.admins = group.admins.filter(id => id !== data.memberId);
                }
            });
            saveGroups();

            logModerationAction(community, 'member_blocked', data.blockerId, data.memberId);
            saveCommunities();

            // Notify blocked member
            const socketId = onlineUsers.get(data.memberId);
            if (socketId) {
                io.to(socketId).emit('blocked_from_community', { communityId: community.id });
            }
        }
    });

    // Generate Invite Link
    socket.on('generate_invite_link', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.admins.includes(data.userId)) {
            community.inviteLink = generateInviteLink(community.id);
            logModerationAction(community, 'invite_link_generated', data.userId);
            saveCommunities();
            socket.emit('invite_link_generated', { communityId: community.id, inviteLink: community.inviteLink });
        }
    });

    // Update Community Settings
    socket.on('update_community_settings', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        if (community && community.admins.includes(data.userId)) {
            if (data.settings) {
                community.settings = { ...community.settings, ...data.settings };
            }
            logModerationAction(community, 'settings_updated', data.userId);
            saveCommunities();
            socket.emit('community_settings_updated', { communityId: community.id, settings: community.settings });
        }
    });

    // Update Group Permissions
    socket.on('update_group_permissions', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (group && group.communityId) {
            const community = communities.find(c => c.id === group.communityId);
            if (community && community.admins.includes(data.userId)) {
                if (data.permissions) {
                    group.permissions = { ...group.permissions, ...data.permissions };
                }
                if (data.settings) {
                    group.settings = { ...group.settings, ...data.settings };
                }
                saveGroups();

                // Notify all group members
                group.members.forEach(memberId => {
                    const socketId = onlineUsers.get(memberId);
                    if (socketId) {
                        io.to(socketId).emit('group_updated', group);
                    }
                });
            }
        }
    });

    // Pin Message
    socket.on('pin_message', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (group && group.admins.includes(data.userId)) {
            if (!group.pinnedMessages) group.pinnedMessages = [];
            if (!group.pinnedMessages.includes(data.messageId)) {
                group.pinnedMessages.push(data.messageId);
                saveGroups();

                // Notify all group members
                io.to(group.id).emit('message_pinned', { groupId: group.id, messageId: data.messageId });
            }
        }
    });

    // Unpin Message
    socket.on('unpin_message', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (group && group.admins.includes(data.userId)) {
            if (group.pinnedMessages) {
                group.pinnedMessages = group.pinnedMessages.filter(id => id !== data.messageId);
                saveGroups();

                // Notify all group members
                io.to(group.id).emit('message_unpinned', { groupId: group.id, messageId: data.messageId });
            }
        }
    });

    // Lock Group
    socket.on('lock_group', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (group && group.communityId) {
            const community = communities.find(c => c.id === group.communityId);
            if (community && community.admins.includes(data.userId)) {
                if (!group.settings) group.settings = {};
                group.settings.locked = true;
                saveGroups();

                // Notify all group members
                io.to(group.id).emit('group_locked', { groupId: group.id });
            }
        }
    });

    // Unlock Group
    socket.on('unlock_group', (data) => {
        const group = groups.find(g => g.id === data.groupId);
        if (group && group.communityId) {
            const community = communities.find(c => c.id === group.communityId);
            if (community && community.admins.includes(data.userId)) {
                if (!group.settings) group.settings = {};
                group.settings.locked = false;
                saveGroups();

                // Notify all group members
                io.to(group.id).emit('group_unlocked', { groupId: group.id });
            }
        }
    });


    // Add Group to Community
    socket.on('add_group_to_community', (data) => {
        const community = communities.find(c => c.id === data.communityId);
        const group = groups.find(g => g.id === data.groupId);

        if (community && group && community.admins.includes(data.userId)) {

            if (!community.subGroups.includes(data.groupId)) {
                community.subGroups.push(data.groupId);
                // Allow many-to-many: do not enforce single communityId link
                // Keep existing group.communityId for backward compatibility, but don't block
                if (!group.communityId) {
                    group.communityId = community.id;
                }

                // Auto-add group members to community
                let newMembersCount = 0;
                group.members.forEach(memberId => {
                    if (!community.members.includes(memberId) && !community.blockedMembers.includes(memberId)) {
                        community.members.push(memberId);
                        newMembersCount++;

                        // Also add to announcement group
                        const announcementGroup = groups.find(g => g.id === community.announcementGroupId);
                        if (announcementGroup && !announcementGroup.members.includes(memberId)) {
                            announcementGroup.members.push(memberId);
                        }

                        // Notify the user they've been added
                        const socketId = onlineUsers.get(memberId);
                        if (socketId) {
                            io.to(socketId).emit('community_joined', community);
                            io.to(socketId).emit('group_joined', announcementGroup);
                        }
                    }
                });

                logModerationAction(community, 'group_added', data.userId, data.groupId);
                saveCommunities();
                saveGroups();

                // Notify community members
                community.members.forEach(memberId => {
                    const socketId = onlineUsers.get(memberId);
                    if (socketId) {
                        io.to(socketId).emit('community_updated', community);
                        io.to(socketId).emit('subgroup_added', { communityId: community.id, groupId: group.id });
                    }
                });

                // Notify group members (they are now part of community structure)
                group.members.forEach(memberId => {
                    const socketId = onlineUsers.get(memberId);
                    if (socketId) {
                        io.to(socketId).emit('group_updated', group);
                    }
                });
            }
        }
    });

    // Get Public Communities
    socket.on('get_public_communities', (userId) => {
        const publicCommunities = communities.filter(c => c.visibility === 'public');
        socket.emit('public_communities_list', publicCommunities);
    });

    // Provide media/docs/links summary for a room (DM or group)
    socket.on('get_media', (payload) => {
        try {
            const room = (payload && payload.room) || null;
            if (!room) return;
            const list = Array.isArray(messages[room]) ? messages[room] : [];
            const outMedia = [];
            const outDocs = [];
            const outLinks = [];
            const linkRe = /(https?:\/\/[^\s]+)/gi;
            list.forEach(m => {
                try {
                    if (m && m.file && m.file.url && m.file.type) {
                        const type = (m.file.type || '').toLowerCase();
                        const base = { id: m.id, author: m.author, time: m.time, file: m.file, message: m.message };
                        if (type.startsWith('image') || type.startsWith('video')) outMedia.push(base);
                        else outDocs.push(base);
                    }
                    if (m && typeof m.message === 'string') {
                        const matches = m.message.match(linkRe) || [];
                        matches.forEach(u => outLinks.push({ id: m.id, author: m.author, time: m.time, url: u }));
                    }
                } catch (_) { }
            });
            socket.emit('media_list', { room, media: outMedia, docs: outDocs, links: outLinks });
        } catch (_) { }
    });

    socket.on('send_message', (message) => {
        const fs = require('fs');
        const log = (msg) => fs.appendFileSync('debug_log.txt', msg + '\n');

        const room = message.room || message.to;
        log(`[send_message] Received: ${JSON.stringify(message)}`);
        log(`[send_message] Derived room: ${room}`);

        if (!room) {
            log('[send_message] No room, returning');
            return;
        }

        const group = groups.find(g => g.id === room);
        log(`[send_message] Group found: ${!!group}`);

        // Enforce admin-only chat if enabled
        if (group && group.adminOnlyChat) {
            const admins = group.admins || [group.createdBy];
            const senderId = message.userId || message.authorId;
            if (!admins.includes(senderId)) {
                log('[send_message] Admin only, returning');
                return;
            }
        }
        // Enforce bans
        if (group) {
            const bans = group.bans || {};
            const senderId = message.userId || message.authorId || message.author;
            const until = bans[senderId];
            const activeBan = (until === -1) || (typeof until === 'number' && until > Date.now());
            if (activeBan) {
                log('[send_message] User banned, returning');
                return;
            }
        }
        if (!messages[room]) messages[room] = [];
        messages[room].push(message);
        saveMessages();
        log(`[send_message] Saved message to ${room}. Total messages: ${messages[room].length}`);

        // Check if this is a channel post and save it to channel data
        const channel = channels.find(c => String(c.id) === String(room));
        if (channel) {
            // Check if sender is allowed to post (admin/creator)
            const senderId = message.userId || message.authorId || (users.find(u => u.username === message.author)?.id);
            const isCreator = String(channel.createdBy) === String(senderId);
            const isAdmin = (channel.admins || []).includes(String(senderId));

            if (isCreator || isAdmin) {
                if (!channel.posts) channel.posts = [];

                // Avoid duplicates if API was also called (check by ID or timestamp/author)
                const existingPost = channel.posts.find(p => p.id === message.id);
                if (!existingPost) {
                    const post = {
                        id: message.id, // Use the message ID as post ID
                        type: message.file ? (message.file.type?.startsWith('image') ? 'image' : 'file') : 'text',
                        text: message.message || '',
                        imageUrl: message.file ? message.file.url : '',
                        createdAt: message.timestamp || Date.now(),
                        authorId: String(senderId),
                        author: message.author,
                        reactions: {},
                        shares: 0
                    };

                    channel.posts.unshift(post);

                    // Update stats
                    if (!channel.stats) channel.stats = {};
                    channel.stats.totalPosts = (channel.stats.totalPosts || 0) + 1;
                    channel.stats.postsToday = (channel.stats.postsToday || 0) + 1;
                    channel.stats.postsThisWeek = (channel.stats.postsThisWeek || 0) + 1;
                    channel.stats.postsThisMonth = (channel.stats.postsThisMonth || 0) + 1;
                    channel.stats.lastActivity = Date.now();

                    saveChannels();
                    io.emit('channel_updated', { channelId: channel.id });
                    io.emit('channel_post_created', { channelId: channel.id, post });
                    log(`[send_message] Saved channel post to ${channel.name}`);
                }
            }
        }

        io.to(room).emit('receive_message', message);
        log(`[send_message] Emitted to room ${room}`);

        // If this is a direct message (not a group room), also emit to the recipient's personal room/socket
        if (!group && message.to) {
            try {
                // Emit to the recipient's personal room so their client updates immediately
                io.to(message.to).emit('receive_message', message);
                // Additionally, if we have the socket id, send a notification
                const socketId = onlineUsers.get(String(message.to));
                if (socketId) {
                    // For DMs, ensure we send the composite room ID so client can key it correctly
                    // The client expects [id1, id2].sort().join('-')
                    const dmRoomId = [String(message.userId || message.authorId), String(message.to)].sort().join('-');

                    io.to(socketId).emit('message_notification', {
                        to: message.to,
                        author: message.author,
                        room: dmRoomId, // Send composite ID
                        time: message.time,
                        timestamp: Date.now(),
                        senderId: message.userId || message.authorId
                    });
                    // Inform sender that delivery reached recipient device
                    try { io.to(socket.id).emit('message_delivered', { id: message.id, room }); } catch (_) { }
                }
            } catch (_) { /* best-effort */ }
        }
    });
    // Send notification to the receiver's personal room (for unseen counts)
    socket.on('send_notification', (data) => {
        if (data.to) {
            // Direct message
            socket.to(data.to).emit('message_notification', { ...data, timestamp: Date.now() });
            return;
        }
        // Group message - notify all members except sender by resolving room id to a group
        const group = groups.find(g => String(g.id) === String(data.room));
        if (group && Array.isArray(group.members)) {
            group.members.forEach(memberId => {
                if (String(memberId) !== String(data.senderId)) { // Don't notify sender
                    const socketId = onlineUsers.get(memberId);
                    if (socketId) {
                        io.to(socketId).emit('message_notification', { ...data, timestamp: Date.now() });
                    }
                }
            });
        }
    });

    socket.on('block_user', (data) => {
        // data: { userId, blockedId, block: boolean }
        try {
            const { userId, blockedId, block } = data;
            if (!userId || !blockedId) return;

            // Find the user who is blocking
            // We don't have a global 'users' object that persists easily in this file structure 
            // without seeing where 'users' is defined. 
            // Looking at previous lines, 'users' seems to be a list of all users? 
            // Or maybe we just broadcast the block event to the user's other sessions?
            // For now, let's just emit back to the user to confirm, and maybe to the blocked user?
            // Actually, the client handles localStorage. 
            // But if we want server-side persistence, we need to save it.
            // Assuming 'users' is the array of user objects.

            const userObj = users.find(u => String(u.id) === String(userId));
            if (userObj) {
                if (!userObj.blocked) userObj.blocked = [];
                if (block) {
                    if (!userObj.blocked.includes(String(blockedId))) {
                        userObj.blocked.push(String(blockedId));
                    }
                } else {
                    userObj.blocked = userObj.blocked.filter(id => id !== String(blockedId));
                }
                // Emit update to the user's other sessions
                const socketIds = onlineUsers.getAll(userId); // Assuming onlineUsers has getAll or similar, or we iterate
                // onlineUsers is a Map<userId, socketId> based on previous view.
                // It seems onlineUsers might only store one socketId per user?
                // Let's just rely on the client for now if server persistence isn't fully set up with a DB.
                // But we can update the in-memory user object so it persists until server restart.
            }
        } catch (e) {
            console.error('Error in block_user:', e);
        }
    });

    socket.on('typing', (data) => {
        socket.to(data.room).emit('display_typing', data);
    });

    socket.on('stop_typing', (data) => {
        socket.to(data.room).emit('hide_typing', data);
    });

    // Provide unseen counts snapshot for a user (useful on reconnect/login)
    socket.on('get_unseen', (payload = {}) => {
        try {
            const userId = String(payload.userId || '');
            if (!userId) return;
            const snapshot = {};
            // Iterate over all rooms we have messages for
            Object.keys(messages || {}).forEach((roomId) => {
                const list = messages[roomId];
                if (!Array.isArray(list) || list.length === 0) return;
                const isCompositeDm = String(roomId).includes('-');
                if (isCompositeDm) {
                    // Only include DMs that involve this user
                    const parts = String(roomId).split('-');
                    if (!parts.includes(String(userId))) return;
                    // Count messages authored by someone else and not read
                    let count = 0;
                    let lastTime = '';
                    for (let i = 0; i < list.length; i++) {
                        const m = list[i];
                        const authorId = String(m.userId || m.authorId || '');
                        const isMine = authorId === String(userId);
                        if (!isMine && !m.isRead) {
                            count += 1;
                            lastTime = m.time || lastTime;
                        }
                    }
                    if (count > 0) snapshot[roomId] = { count, time: lastTime };
                } else {
                    // Groups/channels: optional – only if user is a member
                    const group = groups.find(g => String(g.id) === String(roomId));
                    if (!group) return;
                    const isMember = Array.isArray(group.members) && group.members.some(m => String(m) === String(userId) || String(m?.id || m?._id) === String(userId));
                    if (!isMember) return;
                    let count = 0;
                    let lastTime = '';
                    for (let i = 0; i < list.length; i++) {
                        const m = list[i];
                        const authorId = String(m.userId || m.authorId || '');
                        const isMine = authorId === String(userId);
                        if (!isMine) {
                            count += 1;
                            lastTime = m.time || lastTime;
                        }
                    }
                    if (count > 0) snapshot[roomId] = { count, time: lastTime };
                }
            });
            // Reply to this socket with the snapshot
            socket.emit('unseen_snapshot', { unseen: snapshot });
        } catch (_) { /* ignore */ }
    });

    socket.on('message_read', (data) => {
        // Update message in store
        if (messages[data.room]) {
            const msg = messages[data.room].find(m => m.id === data.id);
            if (msg) {
                msg.isRead = true;
                saveMessages();
            }
        }
        // Broadcast to the entire room (including sender) so all devices update ticks in real time
        io.to(data.room).emit('message_read_update', data);
    });

    // Mark latest message in a room as read for a user (from chat list menu)
    socket.on('mark_room_read', (data = {}) => {
        try {
            const roomId = String(data.room || '');
            if (!roomId) return;
            const readerId = String(data.readerId || '');
            const readerUsername = String(data.readerUsername || '');
            const list = messages[roomId];
            if (!Array.isArray(list) || list.length === 0) return;
            // Mark all messages authored by someone else as read and broadcast updates
            let changed = false;
            for (let i = 0; i < list.length; i++) {
                const m = list[i];
                const authorId = m.userId || m.authorId || '';
                const authorName = m.author || '';
                const isSystem = String(m.type || '').toLowerCase() === 'system';
                const isMine = (readerId && String(authorId) === String(readerId)) || (readerUsername && String(authorName) === String(readerUsername));
                if (!isSystem && !isMine && !m.isRead) {
                    m.isRead = true;
                    io.to(roomId).emit('message_read_update', { id: m.id, room: roomId, readerId, readerUsername });
                    changed = true;
                }
            }
            if (changed) saveMessages();
        } catch (_) { /* ignore */ }
    });

    socket.on('message_reaction', (data) => {
        const roomId = String(data.room);
        let updatedReactions = null;

        if (messages[roomId]) {
            const msg = messages[roomId].find(m => String(m.id) === String(data.msgId));
            if (msg) {
                if (!msg.reactions) msg.reactions = {};
                const users = msg.reactions[data.emoji] || [];
                if (users.includes(data.user)) {
                    msg.reactions[data.emoji] = users.filter(u => u !== data.user);
                } else {
                    msg.reactions[data.emoji] = [...users, data.user];
                }
                if (msg.reactions[data.emoji].length === 0) delete msg.reactions[data.emoji];
                saveMessages();
                updatedReactions = msg.reactions;
            }
        }

        // Fallback: channel posts that aren't mirrored in messages[room]
        const channel = channels.find(c => String(c.id) === roomId);
        if (channel && channel.posts) {
            const post = channel.posts.find(p => String(p.id) === String(data.msgId));
            if (post) {
                post.reactions = post.reactions || {};
                const arr = Array.isArray(post.reactions[data.emoji]) ? post.reactions[data.emoji] : [];
                if (arr.includes(data.user)) {
                    post.reactions[data.emoji] = arr.filter(u => u !== data.user);
                    if (post.reactions[data.emoji].length === 0) delete post.reactions[data.emoji];
                } else {
                    post.reactions[data.emoji] = [...arr, data.user];
                }

                // Update stats and engagement
                let totalReactions = 0;
                channel.posts.forEach(p => {
                    if (p.reactions) {
                        Object.values(p.reactions).forEach(u => totalReactions += u.length);
                    }
                });
                if (!channel.stats) channel.stats = {};
                channel.stats.totalReactions = totalReactions;
                const totalShares = channel.stats.totalShares || 0;
                const totalEngagements = totalReactions + totalShares;
                const possibleEngagements = (channel.followers || []).length * (channel.posts || []).length;
                channel.stats.engagementRate = possibleEngagements > 0
                    ? Math.round((totalEngagements / possibleEngagements) * 100)
                    : 0;

                saveChannels();
                updatedReactions = post.reactions;

                // Notify ChannelInfo/clients
                io.emit('channel_post_reacted', { channelId: channel.id, postId: post.id, reactions: post.reactions });
            }
        }

        if (updatedReactions) {
            // Emit to the room for message bubble updates
            io.to(roomId).emit('receive_reaction', { msgId: data.msgId, reactions: updatedReactions, room: roomId });
        }
    });

    // Persist and broadcast poll votes
    socket.on('poll_vote', (data) => {
        // data: { room, msgId, optionIndex, userId }
        if (!data || !data.room || !data.msgId || typeof data.optionIndex !== 'number' || !data.userId) return;
        const roomId = data.room;
        if (!messages[roomId]) return;
        const msg = messages[roomId].find(m => m.id === data.msgId);
        if (!msg || !msg.poll || !Array.isArray(msg.poll.options)) return;

        // Remove user's previous vote(s)
        msg.poll.options = msg.poll.options.map((opt) => {
            const votes = Array.isArray(opt.votes) ? opt.votes.filter(v => v !== data.userId) : [];
            return { ...opt, votes };
        });

        // Add to selected option
        const target = msg.poll.options[data.optionIndex];
        if (target) {
            target.votes = [...(target.votes || []), data.userId];
        }

        saveMessages();
        // Broadcast minimal update payload
        io.to(roomId).emit('poll_vote_update', { msgId: data.msgId, options: msg.poll.options });
    });

    socket.on('delete_message', (data) => {
        // data: { room, id, userId }
        const roomMessages = messages[data.room];
        const group = groups.find(g => g.id === data.room);
        if (!roomMessages) return;
        const idx = roomMessages.findIndex(m => m.id === data.id);
        if (idx === -1) return;
        const msg = roomMessages[idx];
        const isAuthor = String(msg.author) === String(data.userId) || String(msg.userId) === String(data.userId);

        let allow = isAuthor;
        if (!allow && group) {
            const admins = group.admins || [group.createdBy];
            const byAdmin = admins.includes(data.userId);
            const roleId = (group.memberRoles || {})[data.userId];
            const perms = (group.rolePermissions || {})[roleId] || {};
            const byRole = !!perms.canDeleteMessages;
            allow = byAdmin || byRole;
        }
        if (!allow) return;

        roomMessages.splice(idx, 1);
        saveMessages();
        io.to(data.room).emit('receive_delete_message', { id: data.id, room: data.room });
    });

    socket.on('delete_chat', (data) => {
        if (messages[data.room]) {
            delete messages[data.room];
            saveMessages();
        }
        io.to(data.room).emit('chat_deleted', data.room);
    });

    socket.on('edit_message', (data) => {
        if (messages[data.room]) {
            const msg = messages[data.room].find(m => m.id === data.id);
            if (msg) {
                msg.message = data.newMessage;
                msg.isEdited = true;
                saveMessages();
            }
        }
        socket.to(data.room).emit('receive_edit_message', data);
    });

    socket.on('channel_comment', (data) => {
        io.to(data.room).emit('channel_comment', data);
    });

    socket.on('channel_comment_delete', (data) => {
        io.to(data.room).emit('channel_comment_delete', data);
    });

    socket.on('send_status', (data) => {
        socket.broadcast.emit('receive_status', data);
    });

    // Stories Events
    socket.on('get_stories', () => {
        cleanupStories(); // Ensure expired ones are gone before sending
        socket.emit('stories_list', stories);
    });

    socket.on('post_story', (data) => {
        // data: { userId, username, avatar, items: [{ url, type, time, duration, caption }] }

        // Add timestamp to new items
        const newItems = (data.items || []).map(item => ({
            ...item,
            timestamp: Date.now()
        }));

        // Check if user already has a story
        const existingStoryIndex = stories.findIndex(s => s.userId === data.userId);
        if (existingStoryIndex !== -1) {
            // Append new items to existing story
            stories[existingStoryIndex].items = [...stories[existingStoryIndex].items, ...newItems];
            // Update timestamp to latest
            stories[existingStoryIndex].timestamp = Date.now();
        } else {
            // Create new story entry
            stories.push({
                ...data,
                items: newItems,
                timestamp: Date.now()
            });
        }
        cleanupStories(); // Check expiration
        saveStories(); // Redundant if cleanup saves, but cleanup only saves on change. Explicit save safety.
        io.emit('stories_updated', stories);
    });

    socket.on('story_view', (data) => {
        // data: { storyId, itemId, viewerId, viewerName, viewerAvatar }
        const story = stories.find(s => s.userId === data.storyId);
        if (story) {
            const item = story.items.find(i => i.url === data.itemId); // Using URL as ID for now
            if (item) {
                if (!item.views) item.views = [];
                // Check if already viewed
                if (!item.views.find(v => v.viewerId === data.viewerId)) {
                    item.views.push({
                        viewerId: data.viewerId,
                        viewerName: data.viewerName,
                        viewerAvatar: data.viewerAvatar,
                        time: new Date().toISOString()
                    });
                    saveStories();
                    // Emit update to owner if they are online? Or just broadcast update
                    io.emit('stories_updated', stories);
                }
            }
        }
    });

    socket.on('story_like', (data) => {
        // data: { storyId, itemId, likerId }
        const story = stories.find(s => s.userId === data.storyId);
        if (story) {
            const item = story.items.find(i => i.url === data.itemId);
            if (item) {
                if (!item.likes) item.likes = [];
                if (item.likes.includes(data.likerId)) {
                    item.likes = item.likes.filter(id => id !== data.likerId);
                } else {
                    item.likes.push(data.likerId);
                }
                saveStories();
                io.emit('stories_updated', stories);
            }
        }
    });

    socket.on('delete_story', (data) => {
        // data: { storyId, itemId }
        const storyIndex = stories.findIndex(s => s.userId === data.storyId);
        if (storyIndex !== -1) {
            const story = stories[storyIndex];
            // Filter out the item
            story.items = story.items.filter(i => i.url !== data.itemId);

            // If no items left, remove the story object entirely
            if (story.items.length === 0) {
                stories.splice(storyIndex, 1);
            } else {
                story.timestamp = Date.now(); // Update timestamp? Maybe not needed for delete
            }
            saveStories();
            io.emit('stories_updated', stories);
        }
    });

    socket.on('update_profile', (data) => {
        // data: { userId, username, avatar, about }
        const dbPath = path.join(__dirname, 'db.json');
        if (fs.existsSync(dbPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                const userIndex = dbData.users.findIndex(u => u.id === data.userId);

                if (userIndex !== -1) {
                    // Update user fields
                    if (data.avatar) dbData.users[userIndex].avatar = data.avatar;
                    if (data.about) dbData.users[userIndex].about = data.about;

                    // Note: Username update might require checking for duplicates, skipping for now or assuming validation on client/simple update

                    fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));

                    // Emit update to all clients
                    io.emit('profile_updated', dbData.users[userIndex]);
                }
            } catch (e) {
                console.error("Error updating profile:", e);
            }
        }
    });

    socket.on('logout', (userId) => {
        if (onlineUsers.has(userId)) {
            onlineUsers.delete(userId);
            io.emit('online_users', Array.from(onlineUsers.keys()));
        }
    });

    // --- Call Signaling ---

    socket.on('call:initiate', (data) => {
        // data: { room, isVideo, caller, isGroupCall }
        const { room, caller, isGroupCall, isVideo } = data;
        const type = isVideo ? 'video' : 'audio';

        if (isGroupCall) {
            // Broadcast to group room (excluding sender)
            socket.to(room).emit('call:incoming', { ...data, roomId: room });
            // Should we log outgoing call here?
        } else {
            // 1:1 - Find target
            let targetId = null;
            if (room && room.includes('-')) {
                const parts = room.split('-');
                targetId = parts.find(p => p !== String(caller.id));
            } else if (room) {
                targetId = room; // Fallback
            }

            if (targetId) {
                const socketId = onlineUsers.get(targetId);
                // Check if user is online
                if (socketId) {
                    io.to(socketId).emit('call:incoming', { ...data, roomId: room });
                } else {
                    // User Offline -> Log Missed Call
                    logCall({
                        callerId: caller.id,
                        participants: [targetId],
                        type: type,
                        status: 'missed', // 'missed' implies not picked up. Since offline, they definitely missed it.
                        duration: 0,
                        timestamp: Date.now()
                    });

                    // Notify caller
                    socket.emit('call:failed', { reason: 'User is offline' });
                }
            }
        }
    });

    socket.on('call:answer', (data) => {
        // data: { room, to, peerId, responder }
        const socketId = onlineUsers.get(data.to); // 'to' is the original caller
        if (socketId) {
            io.to(socketId).emit('call:accepted', data);
        }
    });

    socket.on('call:reject', (data) => {
        // data: { room, to, rejecterId, callerId, type }
        const socketId = onlineUsers.get(data.to); // 'to' is the caller
        if (socketId) {
            io.to(socketId).emit('call:rejected');
        }

        // Log the rejected call (as missed or rejected)
        if (data.callerId && data.rejecterId) {
            logCall({
                callerId: data.callerId,
                participants: [data.rejecterId],
                type: data.type || 'audio',
                status: 'missed', // UI typically shows 'Missed' for rejected calls too, or we can use 'rejected'
                duration: 0,
                timestamp: Date.now()
            });
        }
    });

    socket.on('call:end', (data) => {
        // data: { room, duration, status, callerId, participants, type }
        // Only log if status is completed or specialized
        if (data.status === 'completed' || data.status === 'missed') {
            logCall({
                callerId: data.callerId,
                participants: data.participants,
                type: data.type || 'audio',
                status: data.status,
                duration: data.duration,
                timestamp: Date.now()
            });
        }

        // Notify others to clean up? Usually peerjs connection close handles media, but we can emit event
        if (data.room) {
            socket.to(data.room).emit('call:ended');
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);
        // Remove user from online list
        for (const [userId, sockId] of onlineUsers.entries()) {
            if (sockId === socket.id) {
                onlineUsers.delete(userId);
                io.emit('online_users', Array.from(onlineUsers.keys()));
                break;
            }
        }
    });
});

const PORT = 3001;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
