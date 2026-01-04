import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';
const USER_A = { id: 'test_user_a', username: 'UserA' };
const USER_B = { id: 'test_user_b', username: 'UserB' };
const ROOM_ID = [USER_A.id, USER_B.id].sort().join('-');

console.log(`Room ID: ${ROOM_ID}`);

const socketA = io(SERVER_URL);
const socketB = io(SERVER_URL);

let messageReceived = false;

socketA.on('connect', () => {
    console.log('User A connected');
    socketA.emit('join_room', ROOM_ID);

    // Wait a bit for join to complete then send message
    setTimeout(() => {
        console.log('User A sending message...');
        socketA.emit('send_message', {
            id: 'msg_' + Date.now(),
            room: ROOM_ID,
            author: USER_A.username,
            message: 'Hello from User A',
            time: new Date().toLocaleTimeString(),
            to: USER_B.id, // Important for notifications
            userId: USER_A.id
        });
    }, 1000);
});

socketB.on('connect', () => {
    console.log('User B connected');
    socketB.emit('join_room', ROOM_ID);
});

socketB.on('receive_message', (data) => {
    console.log('User B received message:', data);
    if (data.message === 'Hello from User A') {
        messageReceived = true;
        console.log('SUCCESS: Message delivered!');

        // Check persistence
        console.log('Checking persistence...');
        socketB.disconnect();

        setTimeout(() => {
            const socketB2 = io(SERVER_URL);
            socketB2.on('connect', () => {
                console.log('User B reconnected');
                socketB2.emit('join_room', ROOM_ID);
            });
            socketB2.on('load_messages', (msgs) => {
                console.log('Loaded messages:', msgs.length);
                const found = msgs.find(m => m.message === 'Hello from User A');
                if (found) {
                    console.log('SUCCESS: Message persisted!');
                    socketB2.disconnect();
                    cleanup();
                } else {
                    console.error('FAILURE: Message NOT persisted.');
                    socketB2.disconnect();
                    process.exit(1);
                }
            });
        }, 1000);
    }
});

// Timeout
setTimeout(() => {
    if (!messageReceived) {
        console.error('FAILURE: Message NOT received by User B within timeout.');
        cleanup();
        process.exit(1);
    }
}, 5000);

function cleanup() {
    socketA.disconnect();
    socketB.disconnect();
    if (messageReceived) process.exit(0);
}
