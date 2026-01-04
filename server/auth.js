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

router.post('/register', (req, res) => {
    console.log("Register request:", req.body);
    const { username, password } = req.body;
    try {
        const db = readDb();

        if (db.users.find(u => u.username === username)) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const newUser = {
            id: Date.now().toString(),
            username,
            password, // In a real app, hash this!
            avatar: `https://i.pravatar.cc/150?u=${Date.now()}`,
            friends: []
        };

        db.users.push(newUser);
        writeDb(db);

        res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/login', (req, res) => {
    console.log("Login request:", req.body);
    const { username, password } = req.body;
    const db = readDb();

    const user = db.users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({ message: 'Login successful', user });
});

module.exports = router;
