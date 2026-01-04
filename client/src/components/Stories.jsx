import React, { useState, useEffect, useRef } from 'react';
import { FiPlus, FiX, FiImage, FiSend, FiSmile } from 'react-icons/fi';
import axios from 'axios';
import StoryViewer from './StoryViewer';
import StoryUploadModal from './StoryUploadModal';
import Avatar from './Avatar';

const Stories = ({ user, socket }) => {
    const [stories, setStories] = useState([]);
    const [viewingStory, setViewingStory] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        socket.emit('get_stories');
        socket.on('stories_list', (data) => setStories(data));
        socket.on('stories_updated', (data) => setStories(data));
        return () => {
            socket.off('stories_list');
            socket.off('stories_updated');
        };
    }, [socket]);

    // Seen stories tracking (legacy by user) and per-latest-item tracking (real-time)
    const [seenStories, setSeenStories] = useState(new Set());
    const [seenStoryKeys, setSeenStoryKeys] = useState({}); // { [storyUserId]: latestUrl }
    useEffect(() => {
        const key = `seen_stories_${user?.id}`;
        try {
            const stored = JSON.parse(localStorage.getItem(key) || '[]');
            setSeenStories(new Set(stored));
        } catch (_) {
            setSeenStories(new Set());
        }
    }, [user?.id]);

    // Load latest seen key per story user
    useEffect(() => {
        const key = `seen_story_keys_${user?.id}`;
        try {
            const stored = JSON.parse(localStorage.getItem(key) || '{}');
            setSeenStoryKeys(typeof stored === 'object' && stored ? stored : {});
        } catch (_) {
            setSeenStoryKeys({});
        }
    }, [user?.id]);

    useEffect(() => {
        let timer;
        if (viewingStory && viewingStory.userId) {
            setSeenStories(prev => {
                const next = new Set([...prev, viewingStory.userId]);
                const key = `seen_stories_${user?.id}`;
                try { localStorage.setItem(key, JSON.stringify(Array.from(next))); } catch (_) { }
                return next;
            });
            // Mark latest item as seen for this user so future updates are detected
            try {
                const latest = (viewingStory.items && viewingStory.items.length > 0)
                    ? viewingStory.items[viewingStory.items.length - 1]
                    : null;
                const latestKey = latest?.url;
                if (latestKey) {
                    setSeenStoryKeys(prev => {
                        const uid = String(viewingStory.userId);
                        const next = { ...(prev || {}), [uid]: latestKey };
                        try { localStorage.setItem(`seen_story_keys_${user?.id}`, JSON.stringify(next)); } catch (_) { }
                        return next;
                    });
                }
            } catch (_) { }
            try { socket.emit('mark_story_seen', { storyUserId: viewingStory.userId, viewerId: user.id }); } catch (_) { }
            timer = setTimeout(() => setViewingStory(null), 10000);
        }
        return () => clearTimeout(timer);
    }, [viewingStory, socket, user?.id, user?.id]);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const myStory = stories.find(s => s.userId === user.id);
    const otherStories = stories.filter(s => s.userId !== user.id);

    return (
        <div className="stories-container" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px', color: 'var(--text-primary)', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>Status</h2>

            <div className="stories-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
                {/* My Status Card */}
                <div className="story-card glass-panel" style={{
                    position: 'relative', height: '250px', borderRadius: '30px', overflow: 'hidden', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.2)'
                }} onClick={() => myStory ? setViewingStory(myStory) : fileInputRef.current.click()}>



                    {(() => {
                        const hasItems = myStory && myStory.items.length > 0;
                        const latest = hasItems ? myStory.items[myStory.items.length - 1] : null;
                        const isVideo = latest && latest.type.startsWith('video');

                        if (hasItems) {
                            return isVideo ? (
                                <video src={latest.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                            ) : (
                                <Avatar src={latest.url} alt="My Status" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            );
                        }
                        return (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)' }}>
                                <FiPlus size={40} color="white" />
                            </div>
                        );
                    })()}

                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', color: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={user.avatar || "https://i.pravatar.cc/150?img=11"} alt="Me" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid white' }} onError={(e) => { e.currentTarget.src = "https://i.pravatar.cc/150?img=11"; }} />
                            <span style={{ fontWeight: '500' }}>My Status</span>
                        </div>
                    </div>
                    <input type="file" accept="image/*,video/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
                </div>

                {/* Other Stories */}
                {otherStories.map((story) => {
                    const latest = story.items && story.items.length > 0 ? story.items[story.items.length - 1] : null;
                    const latestKey = latest?.url;
                    const isSeen = latestKey && seenStoryKeys ? (seenStoryKeys[String(story.userId)] === latestKey) : seenStories.has(story.userId);
                    return (
                        <div key={story.userId} className="story-card" style={{
                            position: 'relative', height: '250px', borderRadius: '30px', overflow: 'hidden', cursor: 'pointer', background: '#000',
                            border: '1px solid rgba(73, 73, 73, 1)'
                        }} onClick={() => setViewingStory(story)}>
                            {latest && (
                                latest.type.startsWith('video') ? (
                                    <video src={latest.url} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} muted />
                                ) : (
                                    <Avatar src={latest.url} alt={story.username} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                )
                            )}
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', color: 'white' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ padding: '2px', border: isSeen ? '2px dotted rgba(255,255,255,0.2)' : '2px dotted var(--accent-primary)', borderRadius: '50%' }}>
                                        <Avatar src={story.avatar || "https://i.pravatar.cc/150?img=3"} alt={story.username} style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'block' }} onError={(e) => { e.currentTarget.src = "https://i.pravatar.cc/150?img=3"; }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>{story.username}</span>
                                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{latest?.time}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Upload Modal */}
            {selectedFile && (
                <StoryUploadModal
                    file={selectedFile}
                    onClose={() => setSelectedFile(null)}
                    user={user}
                    socket={socket}
                    onUploadSuccess={() => setSelectedFile(null)}
                />
            )}

            {viewingStory && (
                <StoryViewer
                    story={viewingStory}
                    currentUser={user}
                    socket={socket}
                    onClose={() => setViewingStory(null)}
                />
            )}
        </div>
    );
};

export default Stories;
