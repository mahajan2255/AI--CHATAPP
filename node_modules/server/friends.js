const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');

const readDb = () => {
    const data = fs.readFileSync(dbPath);
    return JSON.parse(data);
};

const writeDb = (data) => {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

// Send Friend Request
router.post('/request', (req, res) => {
    const { fromId, toUsername } = req.body;
    const db = readDb();

    const toUser = db.users.find(u => u.username === toUsername);
    if (!toUser) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (db.friendRequests.find(r => r.fromId === fromId && r.toId === toUser.id)) {
        return res.status(400).json({ message: 'Request already sent' });
    }

    const fromUser = db.users.find(u => u.id === fromId);
    if (fromUser.friends.includes(toUser.id)) {
        return res.status(400).json({ message: 'Already friends' });
    }

    db.friendRequests.push({
        id: Date.now().toString(),
        fromId,
        toId: toUser.id,
        status: 'pending'
    });

    writeDb(db);
    res.json({ message: 'Friend request sent' });
});

// Get Friend Requests
router.get('/requests/:userId', (req, res) => {
    const { userId } = req.params;
    const db = readDb();

    const requests = db.friendRequests
        .filter(r => r.toId === userId && r.status === 'pending')
        .map(r => {
            const fromUser = db.users.find(u => u.id === r.fromId);
            return { ...r, fromUsername: fromUser.username, fromAvatar: fromUser.avatar };
        });

    res.json(requests);
});

// Accept Friend Request
router.post('/accept', (req, res) => {
    const { requestId } = req.body;
    const db = readDb();

    const requestIndex = db.friendRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) return res.status(404).json({ message: 'Request not found' });

    const request = db.friendRequests[requestIndex];

    const user1 = db.users.find(u => u.id === request.fromId);
    const user2 = db.users.find(u => u.id === request.toId);

    user1.friends.push(user2.id);
    user2.friends.push(user1.id);

    db.friendRequests.splice(requestIndex, 1); // Remove request
    writeDb(db);

    // Emit socket event to notify both users about new friendship
    try {
        const io = req.app.get('io');
        if (io) {
            // Calculate room ID
            const roomId = [user1.id, user2.id].sort().join('-');

            // Notify both users to join the room and update their friend list
            io.emit('friend_request_accepted', {
                fromId: user1.id,
                toId: user2.id,
                roomId: roomId,
                user1: { id: user1.id, username: user1.username, avatar: user1.avatar },
                user2: { id: user2.id, username: user2.username, avatar: user2.avatar }
            });
        }
    } catch (_) { }

    res.json({ message: 'Friend request accepted' });
});

// Remove Friend
router.post('/remove', (req, res) => {
    const { userId, friendId } = req.body;
    const db = readDb();

    const user = db.users.find(u => u.id === userId);
    const friend = db.users.find(u => u.id === friendId);

    if (!user || !friend) return res.status(404).json({ message: 'User not found' });

    // Remove friendId from user's friends list
    user.friends = user.friends.filter(id => id !== friendId);

    // Remove userId from friend's friends list
    friend.friends = friend.friends.filter(id => id !== userId);

    writeDb(db);
    res.json({ message: 'Friend removed successfully' });
});

// Get Friends List
router.get('/list/:userId', (req, res) => {
    const { userId } = req.params;
    const db = readDb();
    const user = db.users.find(u => u.id === userId);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const friends = user.friends
        .filter(friendId => friendId !== userId) // Don't include self
        .map(friendId => {
            const f = db.users.find(u => u.id === friendId);
            if (!f) return null; // Handle deleted friends
            return { id: f.id, username: f.username, avatar: f.avatar, about: f.about };
        })
        .filter(Boolean); // Remove nulls

    res.json(friends);
});

// Search Users by username (substring, case-insensitive)
// GET /friends/search?query=abc&excludeId=<currentUserId>
router.get('/search', (req, res) => {
    const { query = '', excludeId, excludeFriendsOf } = req.query;
    const q = String(query).trim().toLowerCase();
    if (!q) return res.json([]);

    const db = readDb();
    let results = db.users
        .filter(u => !!u.username)
        .filter(u => u.username.toLowerCase().includes(q));

    if (excludeId) {
        results = results.filter(u => String(u.id) !== String(excludeId));
    }

    if (excludeFriendsOf) {
        const user = db.users.find(u => String(u.id) === String(excludeFriendsOf));
        const friendsSet = new Set((user?.friends || []).map(id => String(id)));
        results = results.filter(u => !friendsSet.has(String(u.id)));
    }

    res.json(results.map(u => ({ id: u.id, username: u.username, avatar: u.avatar, about: u.about })));
});

module.exports = router;
