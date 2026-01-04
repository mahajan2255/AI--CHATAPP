import React, { useState, useEffect } from 'react';
import { FiHeart, FiX, FiHash, FiLock, FiGlobe, FiUsers, FiLogOut, FiTrash2, FiUserPlus, FiUserMinus, FiShield, FiSettings, FiBarChart2, FiClock, FiCheckCircle, FiXCircle, FiAlertTriangle, FiBell, FiBellOff, FiShare2, FiChevronDown, FiChevronUp, FiSearch, FiUserX } from 'react-icons/fi';
import ChannelStats from './ChannelStats';
import LiquidToggle from './LiquidToggle';
import ContactInfo from './ContactInfo';
import Avatar from './Avatar';

// Local Avatar component removed

function ChannelInfo({ channel, onClose, currentUser, socket, onViewStats, friends = [], onlineUsers = [] }) {
    const [fullChannel, setFullChannel] = useState(channel);
    const [showBlockedUsers, setShowBlockedUsers] = useState(false);
    const [showJoinRequests, setShowJoinRequests] = useState(false);
    const [loading, setLoading] = useState(false);
    const [followers, setFollowers] = useState([]);
    const [stats, setStats] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDark, setIsDark] = useState(() =>
        (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark')
    );
    const [selectedProfile, setSelectedProfile] = useState(null);

    // Member preferences (stored locally)
    const [isMuted, setIsMuted] = useState(localStorage.getItem(`channel_mute_${channel.id}`) === 'true');
    const [alertMode, setAlertMode] = useState(localStorage.getItem(`channel_alert_${channel.id}`) === 'true');

    useEffect(() => {
        // Watch for theme changes (data-theme on <html>)
        if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
            const el = document.documentElement;
            const observer = new MutationObserver(() => {
                setIsDark(el.getAttribute('data-theme') === 'dark');
            });
            observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
            return () => observer.disconnect();
        }
    }, []);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await fetch(`http://localhost:3001/channels/${channel.id}`);
                const data = await res.json();
                setFullChannel(data);
            } catch (err) {

            }
        };
        const fetchStats = async () => {
            try {
                const res = await fetch(`http://localhost:3001/channels/${channel.id}/stats?userId=${encodeURIComponent(currentUser.id)}`);
                const data = await res.json();
                if (data && data.success) {
                    setStats(data.stats || {});
                    setFollowers(Array.isArray(data.followers) ? data.followers : []);
                }
            } catch (e) {

            }
        };
        if (channel?.id) {
            fetchDetails();
            fetchStats();
        }

        // Socket listeners for real-time updates
        const handleChannelUpdated = (data) => {
            if (data.channelId === channel.id) {
                fetchDetails();
                fetchStats();
            }
        };

        const handleFollowed = (data) => {
            if (data.channelId === channel.id) {
                fetchDetails();
            }
        };

        const handleUnfollowed = (data) => {
            if (data.channelId === channel.id) {
                fetchDetails();
            }
        };

        const handleChannelPostReacted = (data) => {
            try {
                if (String(data.channelId) === String(channel.id)) {
                    fetchDetails();
                    fetchStats();
                }
            } catch (_) { }
        };

        socket.on('channel_updated', handleChannelUpdated);
        socket.on('channel_post_reacted', handleChannelPostReacted);
        socket.on('channel_followed', handleFollowed);
        socket.on('channel_unfollowed', handleUnfollowed);
        // Update stats when server emits a view or stats update event
        const handleChannelViewed = (data) => {
            try {
                if (String(data?.channelId) === String(channel.id)) {
                    fetchStats();
                }
            } catch (_) { }
        };
        const handleChannelStatsUpdated = (data) => {
            try {
                if (String(data?.channelId) === String(channel.id)) {
                    fetchStats();
                }
            } catch (_) { }
        };
        socket.on('channel_viewed', handleChannelViewed);
        socket.on('channel_stats_updated', handleChannelStatsUpdated);

        return () => {
            socket.off('channel_updated', handleChannelUpdated);
            socket.off('channel_post_reacted', handleChannelPostReacted);
            socket.off('channel_followed', handleFollowed);
            socket.off('channel_unfollowed', handleUnfollowed);
            socket.off('channel_viewed', handleChannelViewed);
            socket.off('channel_stats_updated', handleChannelStatsUpdated);
        };
    }, [channel?.id, socket, currentUser.id]);

    // Light polling while the panel is open to ensure near real-time updates if server doesn't emit events on view
    useEffect(() => {
        if (!channel?.id) return;
        let timer;
        const tick = async () => {
            try {
                const res = await fetch(`http://localhost:3001/channels/${channel.id}/stats?userId=${encodeURIComponent(currentUser.id)}`);
                const data = await res.json();
                if (data && data.success) setStats(data.stats || {});
            } catch (_) { /* best effort */ }
        };
        // Poll every 5s
        timer = setInterval(tick, 5000);
        return () => { try { clearInterval(timer); } catch (_) { } };
    }, [channel?.id, currentUser.id]);

    // Use fullChannel for rendering details
    const displayChannel = fullChannel || channel;
    const isCreator = String(displayChannel.createdBy) === String(currentUser.id);
    const isAdmin = Array.isArray(displayChannel.admins) && (displayChannel.admins || []).includes(String(currentUser.id));
    const isFollowing = Array.isArray(displayChannel.followers) && (displayChannel.followers || []).includes(String(currentUser.id));
    const followerCount = Array.isArray(displayChannel.followers) ? displayChannel.followers.length : (displayChannel.followers || 0);

    const handleFollow = async () => {
        setLoading(true);

        // Optimistic update
        setFullChannel(prev => ({
            ...prev,
            followers: [...(prev.followers || []), String(currentUser.id)]
        }));

        try {
            if (displayChannel.visibility === 'Private' && displayChannel.settings?.requireApproval) {
                // Request to join
                await fetch(`http://localhost:3001/channels/${displayChannel.id}/join-request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id })
                });
                alert('Join request sent! Waiting for admin approval.');
                // Revert optimistic update for private channels
                setFullChannel(prev => ({
                    ...prev,
                    followers: (prev.followers || []).filter(id => String(id) !== String(currentUser.id))
                }));
            } else {
                // Follow directly
                await fetch(`http://localhost:3001/channels/${displayChannel.id}/follow`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: currentUser.id,
                        userName: currentUser.username,
                        avatar: currentUser.avatar
                    })
                });
            }
        } catch (err) {

            // Revert optimistic update on error
            setFullChannel(prev => ({
                ...prev,
                followers: (prev.followers || []).filter(id => String(id) !== String(currentUser.id))
            }));
        } finally {
            setLoading(false);
        }
    };

    const handleUnfollow = async () => {
        setLoading(true);

        // Optimistic update
        setFullChannel(prev => ({
            ...prev,
            followers: (prev.followers || []).filter(id => String(id) !== String(currentUser.id))
        }));

        try {
            await fetch(`http://localhost:3001/channels/${displayChannel.id}/unfollow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id })
            });
        } catch (err) {

            // Revert optimistic update on error
            setFullChannel(prev => ({
                ...prev,
                followers: [...(prev.followers || []), String(currentUser.id)]
            }));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete "${displayChannel.name}"? This action cannot be undone.`)) {
            try {
                await fetch(`http://localhost:3001/channels/${displayChannel.id}`, {
                    method: 'DELETE'
                });
                onClose();
            } catch (err) {

            }
        }
    };

    const toggleSetting = async (setting, currentValue) => {
        try {
            const newSettings = { ...displayChannel.settings, [setting]: !currentValue };
            await fetch(`http://localhost:3001/channels/${displayChannel.id}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, ...newSettings })
            });
            setFullChannel({ ...displayChannel, settings: newSettings });
        } catch (err) {

        }
    };



    const handleMuteToggle = () => {
        const newValue = !isMuted;
        setIsMuted(newValue);
        localStorage.setItem(`channel_mute_${channel.id}`, newValue);
    };

    const handleAlertToggle = () => {
        const newValue = !alertMode;
        setAlertMode(newValue);
        localStorage.setItem(`channel_alert_${channel.id}`, newValue);
    };

    const handleShare = () => {
        const shareText = `Check out this channel: ${displayChannel.name}`;
        if (navigator.share) {
            navigator.share({ title: displayChannel.name, text: shareText });
        } else {
            navigator.clipboard.writeText(shareText);
            alert('Channel info copied to clipboard!');
        }
    };

    const handleReport = () => {
        const reason = prompt('Please describe your concern:');
        if (reason) {
            // In a real app, send to backend
            alert('Report submitted. Thank you for helping keep our community safe.');
        }
    };

    if (selectedProfile) {
        return (
            <ContactInfo
                user={selectedProfile}
                onClose={() => setSelectedProfile(null)}
                currentUser={currentUser}
                socket={socket}
            />
        );
    }

    return (
        <div className="contact-info no-scrollbar">
            {/* Styles injected at bottom to ensure they override and availability */}
            <div className="info-header" style={{ padding: '30px 20px 20px 20px', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 10 }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    <FiX size={24} />
                </button>
                <h3 style={{ margin: 0, fontWeight: 600 }}>Channel Info</h3>
            </div>

            <div style={{ flex: 1, padding: '20px' }}>
                {/* Channel Header */}
                <div className="" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                    {displayChannel.photo ? (
                        <div style={{ position: 'relative' }}>
                            <Avatar src={displayChannel.photo} alt={displayChannel.name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                            {isAdmin && (
                                <label style={{ position: 'absolute', bottom: '16px', right: '0', background: 'var(--bg-panel)', borderRadius: '50%', padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', cursor: 'pointer', border: '1px solid var(--border-color)' }}>
                                    <FiSettings size={16} />
                                    <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={async (e) => {
                                        const file = e.target.files && e.target.files[0];
                                        if (!file) return;
                                        try {
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            const res = await fetch('http://localhost:3001/upload', { method: 'POST', body: formData });
                                            const data = await res.json();
                                            if (data.filePath) {
                                                const url = `http://localhost:3001${data.filePath}`;
                                                // Update channel photo via settings endpoint or a dedicated endpoint if available
                                                // For now, assuming we can patch the channel or use settings endpoint
                                                // Let's try to update via a direct patch or similar if available, otherwise use settings
                                                // Actually, we should probably add a specific endpoint or just use the update mechanism
                                                // Let's assume we can update the channel object directly
                                                await fetch(`http://localhost:3001/channels/${displayChannel.id}/settings`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ userId: currentUser.id, photo: url })
                                                });
                                                setFullChannel(prev => ({ ...prev, photo: url }));
                                            }
                                        } catch (err) {

                                        }
                                    }} />
                                </label>
                            )}
                        </div>
                    ) : (
                        <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: 'var(--text-secondary)' }}>
                            <FiHash size={48} />
                            {isAdmin && (
                                <label style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--bg-panel)', borderRadius: '50%', padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', cursor: 'pointer', border: '1px solid var(--border-color)' }}>
                                    <FiSettings size={16} />
                                    <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={async (e) => {
                                        const file = e.target.files && e.target.files[0];
                                        if (!file) return;
                                        try {
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            const res = await fetch('http://localhost:3001/upload', { method: 'POST', body: formData });
                                            const data = await res.json();
                                            if (data.filePath) {
                                                const url = `http://localhost:3001${data.filePath}`;
                                                await fetch(`http://localhost:3001/channels/${displayChannel.id}/settings`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ userId: currentUser.id, photo: url })
                                                });
                                                setFullChannel(prev => ({ ...prev, photo: url }));
                                            }
                                        } catch (err) {

                                        }
                                    }} />
                                </label>
                            )}
                        </div>
                    )}
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', textAlign: 'center' }}>{displayChannel.name}</h2>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {displayChannel.visibility === 'Private' ? <FiLock size={14} /> : <FiGlobe size={14} />}
                        {displayChannel.visibility} Channel
                    </div>
                </div>

                {/* Description */}
                {displayChannel.description && (
                    <div className="" style={{ marginBottom: '24px', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</h4>
                        <p style={{ margin: 0, lineHeight: '1.5', color: 'var(--text-primary)' }}>{displayChannel.description}</p>
                    </div>
                )}

                {/* Stats - quick KPIs (text only) - visible only to creator/admins */}
                {(isCreator || isAdmin) && (
                    <div className="" style={{ marginBottom: '24px', background: isDark ? '#282828ff' : 'var(--bg-card)', padding: '16px', borderRadius: '12px', boxShadow: isDark ? '0 6px 16px rgba(0,0,0,0.35)' : '0 8px 24px rgba(0,0,0,0.08)' }}>
                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'space-between', alignItems: 'stretch' }}>
                            <div style={{ flex: '1 1 0', textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: '1.2rem', lineHeight: 1 }}>{followerCount}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>Followers</div>
                            </div>
                            <div style={{ flex: '1 1 0', textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: '1.2rem', lineHeight: 1 }}>{stats?.growthRate ?? displayChannel?.stats?.growthRate ?? 0}%</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>Growth</div>
                            </div>
                            <div style={{ flex: '1 1 0', textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: '1.2rem', lineHeight: 1 }}>{stats?.viewsToday ?? displayChannel?.stats?.viewsToday ?? 0}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>Views Today</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Followers List (expander) - show to creator/admins */}
                {(isCreator || isAdmin) && (
                    <div style={{ marginBottom: '24px' }}>
                        <div className="members-expander" style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '20px',
                            overflow: 'hidden', marginTop: '8px', transition: 'all 0.3s ease', position: 'relative'
                        }}>
                            <div className="members-expander-header"
                                style={{
                                    padding: '17px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}
                            >
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Followers ({followers.length})</span>
                            </div>

                            <div className="" style={{
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '8px' }}>
                                    {/* Search Box */}
                                    <div className="search-box" style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: 'var(--bg-input)', padding: '8px 12px', borderRadius: '10px',
                                        marginBottom: '12px', border: '1px solid var(--border-color)'
                                    }}>
                                        <FiSearch color="var(--text-secondary)" />
                                        <input
                                            type="text"
                                            placeholder="Search followers..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            style={{

                                                border: 'none', background: 'transparent', outline: 'none',
                                                color: 'var(--text-primary)', width: '100%', fontSize: '0.9rem'
                                            }}
                                        />
                                    </div>

                                    <div className="members-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingLeft: '10px', paddingRight: '10px' }}>
                                        {followers
                                            .map(f => {
                                                // Resolve user details from friends list if available, otherwise use follower data
                                                const friend = friends.find(fr => String(fr.id) === String(f.id));
                                                const rawName = friend?.username || f.username || f.name;
                                                const displayName = rawName || `User ${String(f.id).slice(-4)}`;
                                                const avatar = friend?.avatar || f.avatar || `https://i.pravatar.cc/150?u=${f.id}`;
                                                return { ...f, displayName, avatar };
                                            })
                                            .filter(f => f.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
                                            .map((f, index) => {
                                                const isMe = String(f.id) === String(currentUser.id);

                                                const isOnline = onlineUsers.includes(String(f.id));

                                                return (
                                                    <div key={`${f.id}-${index}`} className="member-item"
                                                        onClick={() => {
                                                            const profileUser = { id: f.id, username: f.displayName, avatar: f.avatar };
                                                            setSelectedProfile(profileUser);
                                                        }}
                                                    >
                                                        <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                                                            <Avatar
                                                                src={f.avatar}
                                                                alt={f.displayName}
                                                                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #808080' }}
                                                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://i.pravatar.cc/150?u=${f.id}`; }}
                                                            />
                                                            {isOnline && (
                                                                <div style={{
                                                                    position: 'absolute', bottom: 0, right: 0,
                                                                    width: '12px', height: '12px', borderRadius: '50%',
                                                                    background: '#22c55e', border: '2px solid var(--bg-secondary)'
                                                                }} />
                                                            )}
                                                        </div>
                                                        <div className="member-info">
                                                            <span className="member-name">
                                                                {isMe ? 'You' : f.displayName}
                                                            </span>
                                                            <span className="member-status">
                                                                {isMe ? 'Follower' : (isOnline ? 'Online' : 'Offline')}
                                                            </span>
                                                        </div>

                                                        {/* Actions (only for admins/creator on others) */}
                                                        {isCreator && !isMe && (
                                                            <div className="icon-actions">
                                                                <button
                                                                    className="icon-circle danger"
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        if (window.confirm(`Remove ${f.displayName} from followers?`)) {
                                                                            try {
                                                                                await fetch(`http://localhost:3001/channels/${displayChannel.id}/unfollow`, {
                                                                                    method: 'POST',
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify({ userId: f.id })
                                                                                });
                                                                                const res = await fetch(`http://localhost:3001/channels/${displayChannel.id}`);
                                                                                const data = await res.json();
                                                                                setFullChannel(data);
                                                                            } catch (e) { }
                                                                        }
                                                                    }}
                                                                    title="Remove follower"
                                                                >
                                                                    <FiUserX size={14} />
                                                                </button>
                                                                <button
                                                                    className="icon-circle"
                                                                    style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        if (window.confirm(`Block ${f.displayName} from this channel?`)) {
                                                                            try {
                                                                                await fetch(`http://localhost:3001/channels/${displayChannel.id}/block`, {
                                                                                    method: 'POST',
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify({ userId: currentUser.id, targetId: f.id })
                                                                                });
                                                                                const res = await fetch(`http://localhost:3001/channels/${displayChannel.id}`);
                                                                                const data = await res.json();
                                                                                setFullChannel(data);
                                                                            } catch (e) { }
                                                                        }
                                                                    }}
                                                                    title="Block user"
                                                                >
                                                                    <FiShield size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        {followers.length === 0 && (
                                            <div style={{ padding: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>No followers yet</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="expander-blur-overlay"></div>
                    </div>
                )}

                {/* Admin Controls */}
                {isAdmin && (
                    <div style={{ marginBottom: '24px' }}>
                        <div className="members-expander" style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '20px',
                            overflow: 'hidden', marginTop: '8px', transition: 'all 0.3s ease', position: 'relative'
                        }}>
                            <div
                                className="members-expander-header"
                                style={{
                                    padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FiShield /> <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Admin Controls</span>
                                </div>
                            </div>

                            <div className="" style={{
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600 }}>Channel Settings</h4>

                                    {/* Toggle Reactions */}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', height: '56px',
                                        background: 'var(--bg-secondary)', borderRadius: '18px', marginBottom: '16px'
                                    }}>
                                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', flexShrink: 0 }}><FiHeart size={18} /></div>
                                            <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                Reactions
                                            </span>
                                        </div>
                                        <div style={{ flexShrink: 0 }}>
                                            <LiquidToggle
                                                checked={displayChannel.settings?.reactions || false}
                                                onChange={() => toggleSetting('reactions', displayChannel.settings?.reactions)}
                                            />
                                        </div>
                                    </div>

                                    {/* Toggle Forwarding */}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', height: '56px',
                                        background: 'var(--bg-secondary)', borderRadius: '18px', marginBottom: '16px'
                                    }}>
                                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', flexShrink: 0 }}><FiShare2 size={18} /></div>
                                            <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                Forwarding
                                            </span>
                                        </div>
                                        <div style={{ flexShrink: 0 }}>
                                            <LiquidToggle
                                                checked={displayChannel.settings?.forwarding || false}
                                                onChange={() => toggleSetting('forwarding', displayChannel.settings?.forwarding)}
                                            />
                                        </div>
                                    </div>



                                    {/* View Stats */}
                                    <button
                                        onClick={() => onViewStats && onViewStats()}
                                        style={{ width: '100%', marginTop: '12px', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', border: '1px solid var(--border-color)', background: isDark ? '#303030ff' : 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                                    >
                                        <FiBarChart2 /> View Statistics
                                    </button>

                                    {/* Blocked Users */}
                                    <button
                                        onClick={() => setShowBlockedUsers(!showBlockedUsers)}
                                        style={{ width: '100%', marginTop: '8px', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', border: '1px solid var(--border-color)', background: isDark ? '#303030ff' : 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                                    >
                                        <FiAlertTriangle /> Blocked Users ({(displayChannel.blocked || []).length})
                                    </button>

                                    {showBlockedUsers && (
                                        <div style={{ marginTop: '10px', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                                            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                                {Array.isArray(displayChannel.blocked) && displayChannel.blocked.length > 0 ? (
                                                    displayChannel.blocked.map((bid, idx) => {
                                                        const friend = friends.find(fr => String(fr.id) === String(bid));
                                                        const name = friend?.username || `User ${String(bid).slice(-4)}`;
                                                        const avatar = friend?.avatar || `https://i.pravatar.cc/150?u=${bid}`;
                                                        const isMe = String(bid) === String(currentUser.id);
                                                        return (
                                                            <div key={`${bid}-${idx}`} className="member-item">
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <Avatar src={avatar} alt={name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                                                                    <span className="member-name">{isMe ? 'You' : name}</span>
                                                                </div>
                                                                <div className="icon-actions">
                                                                    <button className="icon-circle" onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        try {
                                                                            await fetch(`http://localhost:3001/channels/${displayChannel.id}/unblock`, {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({ userId: currentUser.id, targetId: bid })
                                                                            });
                                                                            const res = await fetch(`http://localhost:3001/channels/${displayChannel.id}`);
                                                                            const data = await res.json();
                                                                            setFullChannel(data);
                                                                        } catch (_) { }
                                                                    }} title="Unblock">
                                                                        <FiShield size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div style={{ padding: '12px', color: 'var(--text-secondary)' }}>No blocked users</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Join Requests (Private Channels) */}
                                    {displayChannel.visibility === 'Private' && (
                                        <button
                                            onClick={() => setShowJoinRequests(!showJoinRequests)}
                                            style={{ width: '100%', marginTop: '8px', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                        >
                                            <FiUserPlus /> Join Requests ({(displayChannel.joinRequests || []).length})
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="expander-blur-overlay"></div>
                    </div>
                )}

                {/* Member Controls */}
                {isFollowing && (
                    <div style={{ marginBottom: '24px', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600 }}>Your Preferences</h4>

                        {/* Mute Notifications */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', height: '56px',
                            background: 'var(--bg-secondary)', borderRadius: '18px', marginBottom: '16px'
                        }}>
                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(255,193,7,0.15)', color: '#ffc107', flexShrink: 0 }}>
                                    {isMuted ? <FiBellOff size={18} /> : <FiBell size={18} />}
                                </div>
                                <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Mute Notifications</span>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                                <LiquidToggle
                                    checked={isMuted}
                                    onChange={handleMuteToggle}
                                />
                            </div>
                        </div>

                        {/* Alert Mode */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', height: '56px',
                            background: 'var(--bg-secondary)', borderRadius: '18px', marginBottom: '16px'
                        }}>
                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', flexShrink: 0 }}>
                                    <FiBell size={18} />
                                </div>
                                <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Alert for Every Post</span>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                                <LiquidToggle
                                    checked={alertMode}
                                    onChange={handleAlertToggle}
                                />
                            </div>
                        </div>

                        {/* Share Channel */}
                        <button
                            onClick={handleShare}
                            style={{ width: '100%', marginTop: '12px', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                        >
                            <FiShare2 /> Share Channel
                        </button>

                        {/* Report */}
                        {!isAdmin && (
                            <button
                                onClick={handleReport}
                                style={{ width: '100%', marginTop: '8px', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', border: isDark ? '#2b2b2bff' : '1px solid #fee2e2', background: isDark ? '#2b2b2bff' : '', color: '#ef4444' }}
                            >
                                <FiAlertTriangle /> Report Channel
                            </button>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="group-actions-footer">
                    {!isFollowing ? (
                        <button onClick={handleFollow} disabled={loading} className="footer-btn primary">
                            <FiUserPlus size={18} /> {displayChannel.visibility === 'Private' && displayChannel.settings?.requireApproval ? 'Request to Follow' : 'Follow'}
                        </button>
                    ) : !isCreator && (
                        <button onClick={handleUnfollow} disabled={loading} className="footer-btn delete-subtle">
                            <FiUserMinus size={18} /> Unfollow
                        </button>
                    )}

                    {isCreator && (
                        <button onClick={handleDelete} className="footer-btn delete-strong">
                            <FiTrash2 size={18} /> Delete Channel
                        </button>
                    )}
                </div>
            </div>
            {/* Injecting Styles */}
            <style>{`
                @keyframes ci_fade_up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                .ci-fade-up { animation: ci_fade_up 280ms ease forwards; will-change: opacity, transform; }
                
                .contact-info {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    background: var(--bg-panel);
                    overflow-y: auto;
                    overflow-x: hidden;
                    font-family: var(--font-family);
                    border-left: var(--glass-border);
                }
                
                /* Reusing modern styles from GroupInfo */
                .group-actions-footer {
                    padding: 24px 16px 32px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .footer-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 12px;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    font-weight: var(--font-weight-medium);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: none;
                }
                .footer-btn.primary {
                    background: var(--accent-primary);
                    color: #ffffff;
                }
                .footer-btn.primary:hover {
                    background: var(--accent-primary); /* slight darken handled by global if needed, or opacity */
                    opacity: 0.9;
                }
                .footer-btn.delete-subtle {
                    background: var(--bg-secondary);
                    color: #ff6b6b;
                    border: 1px solid transparent;
                }
                .footer-btn.delete-subtle:hover {
                    background: #ffeded;
                    border-color: rgba(255,107,107,0.2);
                }
                [data-theme='dark'] .footer-btn.delete-subtle:hover {
                    background: rgba(255,107,107,0.1);
                }
                .footer-btn.delete-strong {
                    background: rgba(255,107,107,0.1);
                    color: #ff6b6b;
                    border: 1px solid rgba(255,107,107,0.2);
                }
                .footer-btn.delete-strong:hover {
                    background: #ff6b6b;
                    color: #ffffff;
                }

                /* Member Items for Followers/Blocked */
                .members-list {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 8px 12px;
                    width: 100%;
                }
                .member-item {
                     display: flex;
                     align-items: center;
                     gap: 12px;
                     padding: 8px 16px;
                     background: #ececec;
                     border: 1px solid var(--border-color);
                     border-radius: 12px;
                     box-shadow: 0 6px 12px rgba(0,0,0,0.5);
                     width: 100%;
                     box-sizing: border-box;
                     transition: box-shadow 0.25s ease, transform 0.15s ease;
                }
                .member-item:hover { box-shadow: 0 12px 28px rgba(0,0,0,0.35); }
                [data-theme='light'] .member-item {
                    background: #ececec;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
                }
                [data-theme='light'] .member-item:hover { box-shadow: 0 6px 14px rgba(0,0,0,0.16); }
                [data-theme='dark'] .member-item {
                     background: #262626;
                }
                .member-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .member-name {
                    font-weight: var(--font-weight-regular);
                    color: var(--text-primary);
                    font-size: 1rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .member-status {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }
                .icon-actions {
                    margin-left: auto;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .icon-circle {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--border-color);
                    background: var(--bg-panel);
                    color: var(--text-primary);
                    cursor: pointer;
                    transition: background 0.2s ease, transform 0.1s ease;
                }
                .icon-circle:hover { background: var(--bg-secondary); }
                .icon-circle.danger { color: #ff6b6b; border-color: rgba(255,107,107,0.4); }
                .icon-circle.danger:hover { background: rgba(255,107,107,0.12); }
            `}</style>
        </div >
    );
}

export default ChannelInfo;
