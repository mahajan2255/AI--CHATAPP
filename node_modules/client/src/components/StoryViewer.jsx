import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiChevronLeft, FiChevronRight, FiHeart, FiTrash2, FiEye, FiSend } from 'react-icons/fi';

const FloatingHeart = ({ id, onComplete }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 2000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div style={{
            position: 'absolute',
            bottom: '80px',
            right: '40px',
            fontSize: '2rem',
            color: '#ff2d55',
            animation: 'floatUp 2s ease-out forwards',
            zIndex: 3005,
            pointerEvents: 'none'
        }}>
            <FiHeart fill="#ff2d55" />
            <style>{`
                @keyframes floatUp {
                    0% { transform: translateY(0) scale(1); opacity: 1; }
                    100% { transform: translateY(-200px) scale(1.5); opacity: 0; }
                }
            `}</style>
        </div>
    );
};

const StoryViewer = ({ story, currentUser, socket, onClose, onNext }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [showViews, setShowViews] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [floatingHearts, setFloatingHearts] = useState([]);
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const DURATION = 5000;

    const currentItem = story?.items?.[currentIndex];
    const isOwner = currentUser?.id === story?.userId;

    useEffect(() => {
        if (!currentItem) return;
        startTimer();
        if (!isOwner) {
            socket.emit('story_view', {
                storyId: story.userId,
                itemId: currentItem.url,
                viewerId: currentUser.id,
                viewerName: currentUser.username,
                viewerAvatar: currentUser.avatar
            });
        }
        return () => stopTimer();
    }, [currentIndex, isOwner, story.userId, currentItem, currentUser.id, currentUser.username, currentUser.avatar, socket]);

    const startTimer = () => {
        stopTimer();
        setProgress(0);
        startTimeRef.current = Date.now();

        timerRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const newProgress = (elapsed / DURATION) * 100;

            if (newProgress >= 100) {
                handleNext();
            } else {
                setProgress(newProgress);
            }
        }, 50);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleNext = () => {
        if (currentIndex < story.items.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        } else {
            setCurrentIndex(0);
            startTimer();
        }
    };

    const handleLike = (e) => {
        e.stopPropagation();
        socket.emit('story_like', {
            storyId: story.userId,
            itemId: currentItem.url,
            likerId: currentUser.id
        });

        // Add floating heart
        const newHeart = { id: Date.now() };
        setFloatingHearts(prev => [...prev, newHeart]);
    };

    const removeHeart = (id) => {
        setFloatingHearts(prev => prev.filter(h => h.id !== id));
    };

    const handleReply = (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;

        const messageData = {
            id: Date.now().toString(),
            room: [currentUser.id, story.userId].sort().join('-'), // Assuming direct chat room ID convention
            author: currentUser.username,
            message: replyText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            to: story.userId,
            justSent: true,
            isRead: false,
            storyContext: {
                imageUrl: currentItem.url,
                storyId: story.userId
            }
        };

        socket.emit("send_message", messageData);
        setReplyText("");
        // Optional: Show some feedback or close viewer?
        // For now, just clear input and keep viewing
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        if (window.confirm("Delete this status update?")) {
            socket.emit('delete_story', {
                storyId: story.userId,
                itemId: currentItem.url
            });
            if (story.items.length <= 1) {
                onClose();
            } else {
                if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
                else startTimer();
            }
        }
    };

    const toggleViews = (e) => {
        e.stopPropagation();
        setShowViews(!showViews);
        if (!showViews) stopTimer();
        else startTimer();
    };

    const handleFocus = () => stopTimer();
    const handleBlur = () => startTimer();

    if (!currentItem) {
        return <div style={{ color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'black' }}>Loading...</div>;
    }

    const hasLiked = currentItem.likes && currentItem.likes.includes(currentUser.id);

    return (
        <div className="story-viewer-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'black', zIndex: 3000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            {/* Progress Bars */}
            <div style={{ position: 'absolute', top: '20px', left: '10px', right: '10px', display: 'flex', gap: '4px', zIndex: 3001 }}>
                {story.items.map((item, index) => (
                    <div key={index} style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', background: index === currentIndex ? 'var(--accent-primary)' : 'white',
                            width: index < currentIndex ? '100%' : index === currentIndex ? `${progress}%` : '0%',
                            transition: index === currentIndex ? 'width 0.05s linear' : 'none'
                        }}></div>
                    </div>
                ))}
            </div>

            {/* Header Info */}
            <div style={{ position: 'absolute', top: '35px', left: '20px', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 3001, color: 'white' }}>
                <img src={story.avatar || "https://i.pravatar.cc/150?img=3"} alt={story.username} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.5)' }} />
                <div>
                    <div style={{ fontWeight: '600' }}>{story.username}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{currentItem.time}</div>
                </div>
            </div>

            <button onClick={onClose} style={{ position: 'absolute', top: '35px', right: '20px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', zIndex: 3001 }}>
                <FiX size={28} />
            </button>

            {/* Content */}
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {currentItem.type.startsWith('image') ? (
                    <img src={currentItem.url} alt="Story" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                ) : (
                    <video src={currentItem.url} autoPlay controls={false} style={{ maxHeight: '100%', maxWidth: '100%' }} />
                )}

                {currentItem.caption && (
                    <div style={{ position: 'absolute', bottom: '120px', left: 0, right: 0, textAlign: 'center', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '10px', fontSize: '1.1rem' }}>
                        {currentItem.caption}
                    </div>
                )}
            </div>

            {/* Navigation Areas */}
            <div onClick={handlePrev} style={{ position: 'absolute', top: '100px', bottom: '100px', left: 0, width: '30%', zIndex: 3000, cursor: 'pointer' }}></div>
            <div onClick={handleNext} style={{ position: 'absolute', top: '100px', bottom: '100px', right: 0, width: '30%', zIndex: 3000, cursor: 'pointer' }}></div>

            {/* Floating Hearts */}
            {floatingHearts.map(heart => (
                <FloatingHeart key={heart.id} id={heart.id} onComplete={() => removeHeart(heart.id)} />
            ))}

            {/* Footer Controls */}
            <div style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3002, gap: '16px', padding: '0 20px' }}>
                {isOwner ? (
                    <>
                        <div onClick={toggleViews} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'white', cursor: 'pointer' }}>
                            <FiEye size={24} />
                            <span style={{ fontSize: '0.8rem' }}>{currentItem.views ? currentItem.views.length : 0}</span>
                        </div>
                        <div onClick={handleDelete} className="liquid-button-red" style={{ padding: '12px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FiTrash2 size={24} />
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '500px' }}>
                        <form onSubmit={handleReply} style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.2)', borderRadius: '24px', padding: '4px 16px', border: '1px solid rgba(255,255,255,0.3)' }}>
                            <input
                                type="text"
                                placeholder="Reply..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', padding: '8px', outline: 'none', fontSize: '1rem' }}
                            />
                            {replyText && (
                                <button type="submit" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <FiSend size={20} />
                                </button>
                            )}
                        </form>
                        <div onClick={handleLike} className="liquid-button-pink" style={{ padding: '12px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '48px', minHeight: '48px' }}>
                            <FiHeart size={24} fill={hasLiked ? "white" : "none"} color="white" />
                        </div>
                    </div>
                )}
            </div>

            {/* Views Bottom Sheet */}
            {showViews && isOwner && (
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'var(--bg-panel)',
                    borderTopLeftRadius: '20px', borderTopRightRadius: '20px', zIndex: 3003, padding: '20px', overflowY: 'auto', animation: 'slideUp 0.3s ease-out'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3>Viewed by {currentItem.views ? currentItem.views.length : 0}</h3>
                        <FiX size={24} onClick={toggleViews} style={{ cursor: 'pointer' }} />
                    </div>
                    {currentItem.views && currentItem.views.map((view, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <img src={view.viewerAvatar || "https://i.pravatar.cc/150?img=3"} alt={view.viewerName} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '500' }}>{view.viewerName}</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{new Date(view.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                            {/* Check if this user liked the story (assuming likes array stores userIds) */}
                            {currentItem.likes && currentItem.likes.includes(view.viewerId) && (
                                <FiHeart fill="#ff2d55" color="#ff2d55" size={20} />
                            )}
                        </div>
                    ))}
                    {(!currentItem.views || currentItem.views.length === 0) && (
                        <div style={{ textAlign: 'center', opacity: 0.6, marginTop: '40px' }}>No views yet</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StoryViewer;
