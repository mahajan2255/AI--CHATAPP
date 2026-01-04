import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';
const USER_A = { id: 'group_test_user_a', username: 'GroupUserA' };
const USER_B = { id: 'group_test_user_b', username: 'GroupUserB' };
const GROUP_ID = 'group-test-' + Date.now();

console.log(`Group ID: ${GROUP_ID}`);

const socketA = io(SERVER_URL);
const socketB = io(SERVER_URL);

let messageReceived = false;

socketA.on('connect', () => {
    console.log('User A connected');
    socketA.emit('join_room', USER_A.id); // Login

    // Create group
    setTimeout(() => {
        socketA.emit('create_group', {
            name: 'Test Group',
            members: [USER_B.id],
            createdBy: USER_A.id,
            avatar: ''
        });
    }, 500);
});

socketA.on('group_created', (group) => {
    console.log('Group created:', group.id);
    // Join the room
    socketA.emit('join_room', group.id);

    // Wait for B to join
    setTimeout(() => {
        console.log('User A sending message to group...');
        socketA.emit('send_message', {
            id: 'msg_' + Date.now(),
            room: group.id,
            author: USER_A.username,
            message: 'Hello Group',
            time: new Date().toLocaleTimeString(),
            userId: USER_A.id
        });
    }, 2000);
});

socketB.on('connect', () => {
    console.log('User B connected');
    socketB.emit('join_room', USER_B.id); // Login
});

socketB.on('group_created', (group) => {
    console.log('User B notified of group:', group.id);
    socketB.emit('join_room', group.id);
});

socketB.on('receive_message', (data) => {
    console.log('User B received message:', data);
    if (data.message === 'Hello Group') {
        messageReceived = true;
        console.log('SUCCESS: Group message delivered!');

        // Check persistence
        console.log('Checking persistence...');
        socketB.disconnect();

        setTimeout(() => {
            const socketB2 = io(SERVER_URL);
            socketB2.on('connect', () => {
                console.log('User B reconnected');
                socketB2.emit('join_room', data.room);
            });
            socketB2.on('load_messages', (msgs) => {
                console.log('Loaded messages:', msgs.length);
                const found = msgs.find(m => m.message === 'Hello Group');
                if (found) {
                    console.log('SUCCESS: Group message persisted!');
                    socketB2.disconnect();
                    cleanup();
                } else {
                    console.error('FAILURE: Group message NOT persisted.');
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
        console.error('FAILURE: Group message NOT received by User B within timeout.');
        cleanup();
        process.exit(1);
    }
}, 8000);

function cleanup() {
    socketA.disconnect();
    socketB.disconnect();
    if (messageReceived) process.exit(0);
}
