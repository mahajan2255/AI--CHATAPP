import React, { useState } from 'react';
import { FiClock, FiBellOff, FiX, FiPhone, FiChevronDown, FiChevronUp, FiVideo, FiChevronRight, FiStar, FiBell, FiLock, FiUsers, FiTrash2, FiSlash, FiFile, FiArrowUpRight, FiBookmark, FiPlus } from 'react-icons/fi';
import LiquidToggle from './LiquidToggle';
import Avatar from './Avatar';

// Local Avatar component removed

const ContactInfo = ({ user, onClose, mediaMessages = [], links = [], isOnline = false, onBlock, onDeleteChat, isBlocked, groups = [], currentUser, socket, room, pinnedMessages = [], onStartCall }) => {
    const [isMuted, setIsMuted] = useState(false);
    const [mediaTab, setMediaTab] = useState('media');
    const [disappearingEnabled, setDisappearingEnabled] = useState(false);
    const DURATIONS = [
        { key: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
        { key: '7d', label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
        { key: '30d', label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
        { key: '90d', label: '90d', ms: 90 * 24 * 60 * 60 * 1000 },
    ];
    const [disappearingDuration, setDisappearingDuration] = useState('24h');
    const [pins, setPins] = useState(() => {
        try {
            const scope = room || user?.id;
            const summariesKey = `pinned_summaries_${scope}`;
            const raw = localStorage.getItem(summariesKey);
            if (raw) return JSON.parse(raw);
        } catch (_) { }
        return pinnedMessages || [];
    });
    const [starredMessages, setStarredMessages] = useState([]);
    const [starredCount, setStarredCount] = useState(0);
    const [isEditingStarred, setIsEditingStarred] = useState(false);
    const [contactTags, setContactTags] = useState([]); // Array of strings or objects
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [newTagInput, setNewTagInput] = useState('');

    React.useEffect(() => {
        const handler = (data) => {
            if (data.room === room || data.room === user?.id) {
                const msgs = Array.isArray(data.messages) ? data.messages : [];
                setStarredMessages(msgs);
                try {
                    const key = `starred_count_${room || user?.id || 'unknown'}`;
                    localStorage.setItem(key, String(msgs.length));
                    setStarredCount(msgs.length);
                } catch (_) { }
            }
        };
        socket.on('starred_messages_list', handler);
        return () => socket.off('starred_messages_list', handler);
    }, [socket, room, user?.id]);

    React.useEffect(() => {
        if (room || user?.id) {
            socket.emit('get_starred_messages', { room: room, userId: currentUser.id });
        }
    }, [room, user?.id, currentUser?.id, socket]);
    const prevPinnedIdsRef = React.useRef('');

    React.useEffect(() => {
        const scope = room || user?.id;
        const validIds = new Set(JSON.parse(localStorage.getItem(`pinned_${scope}`) || '[]'));
        let summaries = [];
        try {
            const summariesKey = `pinned_summaries_${scope}`;
            summaries = JSON.parse(localStorage.getItem(summariesKey) || '[]');
        } catch (_) { }

        // Filter summaries to only include currently pinned IDs (fixes zombie pins)
        summaries = summaries.filter(s => validIds.has(String(s.id)));

        const livePins = Array.isArray(pinnedMessages) ? pinnedMessages : [];

        // Merge: prefer live pins, fallback to summaries
        const merged = [...livePins];
        const liveIds = new Set(livePins.map(p => String(p.id)));

        if (Array.isArray(summaries)) {
            summaries.forEach(s => {
                // If it's a valid pin (in validIds) but not in livePins (not loaded), add it
                if (s && s.id && !liveIds.has(String(s.id))) {
                    merged.push(s);
                }
            });
        }

        const nextIds = merged.map(m => String(m.id)).sort().join(',');
        if (nextIds !== prevPinnedIdsRef.current) {
            prevPinnedIdsRef.current = nextIds;
            setPins(merged);
        }
    }, [pinnedMessages, room, user?.id]);

    // Listen for pinned_updated events to refresh pins in real-time
    React.useEffect(() => {
        const handler = (e) => {
            const d = e?.detail || {};
            const scope = room || user?.id;
            if (!d.room || String(d.room) !== String(scope)) return;

            // Don't do anything here - the pinnedMessages prop will update via React's normal flow
            // This event is just a signal that ChatWindow has updated
        };
        window.addEventListener('pinned_updated', handler);
        return () => window.removeEventListener('pinned_updated', handler);
    }, [room, user?.id]);

    // Also react to socket group_pin_update events (pins changed by other users)
    React.useEffect(() => {
        const pinUpdateHandler = (payload = {}) => {
            try {
                const scope = room || user?.id;
                if (!payload || String(payload.room) !== String(scope)) return;
                // Recompute local pins by merging live prop and cached summaries
                const summariesKey = `pinned_summaries_${scope}`;
                let summaries = [];
                try { summaries = JSON.parse(localStorage.getItem(summariesKey) || '[]'); } catch (_) { summaries = []; }
                const livePins = Array.isArray(pinnedMessages) ? pinnedMessages : [];
                const merged = [...livePins];
                const liveIds = new Set(livePins.map(p => String(p.id)));
                if (Array.isArray(summaries)) {
                    summaries.forEach(s => { if (s && s.id && !liveIds.has(String(s.id))) merged.push(s); });
                }
                setPins(merged);
                // Also dispatch window event so other panes update if needed
                try { window.dispatchEvent(new CustomEvent('pinned_updated', { detail: { room: scope } })); } catch (_) { }
            } catch (_) { }
        };
        socket.on('group_pin_update', pinUpdateHandler);
        return () => socket.off('group_pin_update', pinUpdateHandler);
    }, [socket, room, user?.id, pinnedMessages]);

    // Preload starred messages so count shows even when collapsed
    React.useEffect(() => {
        try {
            if (room && currentUser?.id) {
                socket.emit('get_starred_messages', { room: room, userId: currentUser.id });
            }
        } catch (_) { }
        // no cleanup needed
    }, [room, currentUser?.id, socket]);

    // Initialize badge count from cache immediately on mount/open
    React.useEffect(() => {
        try {
            const key = `starred_count_${room || user?.id || 'unknown'}`;
            const v = localStorage.getItem(key);
            if (v != null) setStarredCount(parseInt(v, 10) || 0);
        } catch (_) { setStarredCount(0); }
    }, [room, user?.id]);

    const commonGroups = React.useMemo(() => {
        try {
            const uid = currentUser?.id;
            const cid = user?.id;
            if (!uid || !cid || !Array.isArray(groups)) return [];
            const hasMember = (g, id) => (g.members || []).some(m => String(m?.id ?? m) === String(id));
            return groups.filter(g => !g.isAnnouncementGroup && hasMember(g, uid) && hasMember(g, cid));
        } catch (_) { return []; }
    }, [groups, currentUser?.id, user?.id]);

    React.useEffect(() => {
        const keyBase = user?.id || user?.username || 'unknown';
        try {
            const v = localStorage.getItem(`dm_enabled_contact_${keyBase}`);
            if (v != null) setDisappearingEnabled(v === 'true');
            const d = localStorage.getItem(`dm_duration_contact_${keyBase}`);
            if (d) setDisappearingDuration(d);
        } catch (_) { }
    }, [user?.id, user?.username]);

    React.useEffect(() => {
        const handler = (e) => {
            try {
                const d = e?.detail || {};
                if (d.scope === 'contact' && String(d.targetId) === String(user?.id)) {
                    setDisappearingEnabled(!!d.enabled);
                }
            } catch (_) { }
        };
        window.addEventListener('disappearing_state_update', handler);
        return () => window.removeEventListener('disappearing_state_update', handler);
    }, [user?.id]);

    React.useEffect(() => {
        const keyBase = user?.id || user?.username || 'unknown';
        try {
            const v = localStorage.getItem(`mute_contact_${keyBase}`);
            if (v != null) setIsMuted(v === 'true');
        } catch (_) { }
    }, [user?.id, user?.username]);

    // Load Tags
    React.useEffect(() => {
        if (!user?.id) return;
        try {
            const raw = localStorage.getItem(`contact_tags_${user.id}`);
            if (raw) setContactTags(JSON.parse(raw));
            else setContactTags([]);
        } catch (_) { setContactTags([]); }
    }, [user?.id]);

    const saveTags = (newTags) => {
        setContactTags(newTags);
        try {
            localStorage.setItem(`contact_tags_${user?.id}`, JSON.stringify(newTags));
            // Dispatch event for CallsPanel to pick up
            window.dispatchEvent(new CustomEvent('contact_tags_updated', { detail: { userId: user?.id, tags: newTags } }));
        } catch (_) { }
    };

    const addTag = () => {
        if (!newTagInput.trim()) return;
        const tag = { label: newTagInput.trim(), color: '#e0f2fe', text: '#0369a1' }; // Default blue-ish
        const next = [...contactTags, tag];
        saveTags(next);
        setNewTagInput('');
        setIsEditingTags(false);
    };

    const removeTag = (idx) => {
        const next = [...contactTags];
        next.splice(idx, 1);
        saveTags(next);
    };

    const handleCall = (type) => {
        if (onStartCall) {
            onStartCall(user, type === 'video');
            onClose(); // Optional: close info panel when calling? Maybe better to stay open.
            // Actually, keep it open or let user decide. The Call popup will appear.
        } else {
            alert(`Starting ${type} call with ${user?.username}...`);
        }
    };

    return (
        <div className="contact-info-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>

                <div className="contact-header" style={{ paddingTop: '40px' }}>
                    <button onClick={onClose} className="close-btn"><FiX size={24} /></button>
                    <h3>Contact info</h3>
                </div>
                <div className="panel-label">Contact Info</div>

                {/* ... (rest of the component structure is fine, just need to restore styles at the end) ... */}
                <div className="contact-profile">
                    <Avatar src={user?.avatar || "https://i.pravatar.cc/150"} alt={user?.username} className="large-avatar" />
                    <h2>{user?.username}</h2>
                    <p className="phone-number">{user?.phoneNumber || "+91 6265 081 928"}</p>
                    <p className="status-text" style={{ color: isOnline ? 'var(--status-online)' : '#ff6b6b', fontSize: '0.85rem', marginTop: '4px' }}>
                        {isOnline ? 'Online' : 'Offline'}
                    </p>
                </div>

                <div className="contact-actions">
                    <div className="action-btn" onClick={() => handleCall('video')}>
                        <div className="icon-box"><FiVideo size={20} /></div>
                        <span>Video</span>
                    </div>
                    <div className="action-btn" onClick={() => handleCall('voice')}>
                        <div className="icon-box"><FiPhone size={20} /></div>
                        <span>Voice</span>
                    </div>
                </div>

                <div className="section-divider"></div>

                <div className="contact-section">
                    <h4>About</h4>
                    <p>{user?.about || "Hi there, I am using Chat App"}</p>
                </div>

                <div className="section-divider"></div>

                <div className="contact-section">
                    <div className="section-header" style={{ cursor: 'default' }}>
                        <h4>Media, links and docs</h4>
                        <span className="count">
                            {mediaMessages.length}
                        </span>
                    </div>

                    <div className="media-tabs-container" style={{ position: 'relative' }}>
                        <div className="media-tabs">
                            <div className={`media-tab ${mediaTab === 'media' ? 'active' : ''}`} onClick={() => setMediaTab('media')}>Media</div>
                            <div className={`media-tab ${mediaTab === 'docs' ? 'active' : ''}`} onClick={() => setMediaTab('docs')}>Docs</div>
                            <div className={`media-tab ${mediaTab === 'links' ? 'active' : ''}`} onClick={() => setMediaTab('links')}>Links</div>
                        </div>

                        <div className="media-content" style={{ maxHeight: '300px', overflowY: 'auto', paddingBottom: '20px' }}>
                            {mediaTab === 'media' && (
                                <div className="media-grid">
                                    {mediaMessages.filter(msg => msg.file?.type?.startsWith('image') || msg.file?.type?.startsWith('video')).map((msg, index) => (
                                        <div key={index} className="media-grid-item">
                                            {msg.file.type.startsWith('image') ? (
                                                <img src={msg.file.url} alt="media" />
                                            ) : (
                                                <video src={msg.file.url} />
                                            )}
                                        </div>
                                    ))}
                                    {mediaMessages.filter(msg => msg.file?.type?.startsWith('image') || msg.file?.type?.startsWith('video')).length === 0 && (
                                        <p className="no-media">No media</p>
                                    )}
                                </div>
                            )}

                            {mediaTab === 'docs' && (
                                <div className="docs-list">
                                    {mediaMessages.filter(msg => !msg.file?.type?.startsWith('image') && !msg.file?.type?.startsWith('video')).map((msg, index) => (
                                        <div key={index} className="doc-item">
                                            <div className="doc-icon"><FiFile /></div>
                                            <div className="doc-info">
                                                <span className="doc-name">{msg.file.name}</span>
                                                <span className="doc-date">{msg.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {mediaMessages.filter(msg => !msg.file?.type?.startsWith('image') && !msg.file?.type?.startsWith('video')).length === 0 && (
                                        <p className="no-media">No documents</p>
                                    )}
                                </div>
                            )}

                            {mediaTab === 'links' && (
                                <div className="links-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {Array.isArray(links) && links.length > 0 ? (
                                        links.map((lnk, idx) => (
                                            <a key={lnk.id || idx} href={lnk.url} target="_blank" rel="noopener noreferrer" style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                textDecoration: 'none', color: 'var(--text-primary)',
                                                padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '10px'
                                            }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{lnk.time}</span>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lnk.url}</span>
                                            </a>
                                        ))
                                    ) : (
                                        <p className="no-media">No links found</p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="expander-blur-overlay"></div>
                    </div>
                </div>

                <div className="section-divider"></div>

                {/* Tags Section */}
                <div className="contact-section">
                    <div className="section-header" onClick={() => setIsEditingTags(!isEditingTags)}>
                        <h4>Tags</h4>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="count">{contactTags.length}</span>
                            {isEditingTags ? <FiChevronUp /> : <FiChevronDown />}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingBottom: '8px' }}>
                        {contactTags.map((tag, idx) => (
                            <div key={idx} style={{
                                background: tag.color || '#f3f4f6',
                                color: tag.text || '#374151',
                                padding: '4px 10px', borderRadius: '12px',
                                fontSize: '0.8rem', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}>
                                {tag.label}
                                {isEditingTags && (
                                    <FiX
                                        size={14}
                                        style={{ cursor: 'pointer' }}
                                        onClick={(e) => { e.stopPropagation(); removeTag(idx); }}
                                    />
                                )}
                            </div>
                        ))}
                        {isEditingTags && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                <input
                                    type="text"
                                    value={newTagInput}
                                    onChange={e => setNewTagInput(e.target.value)}
                                    placeholder="New Tag..."
                                    style={{
                                        border: '1px solid var(--border-color)', borderRadius: '8px',
                                        padding: '4px 8px', fontSize: '0.8rem', width: '80px',
                                        background: 'transparent', color: 'var(--text-primary)'
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && addTag()}
                                />
                                <button
                                    onClick={addTag}
                                    style={{
                                        background: 'var(--accent-primary)', color: '#fff', border: 'none',
                                        borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    <FiPlus size={14} />
                                </button>
                            </div>
                        )}
                        {!isEditingTags && contactTags.length === 0 && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                No tags set
                            </div>
                        )}
                    </div>
                </div>

                <div className="section-divider"></div>

                {/* Pinned Messages */}
                <div className="contact-section">
                    <div className="members-expander" style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '20px',
                        overflow: 'hidden', marginTop: '8px', transition: 'all 0.3s ease', position: 'relative',
                        background: 'transparent'
                    }}>
                        <div className="members-expander-header"
                            style={{
                                padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                userSelect: 'none', background: 'inherit'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiBookmark size={16} color="var(--accent-primary)" />
                                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Pinned Messages</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '10px' }}>{pins.length}</span>
                            </div>
                        </div>
                        <div style={{
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '0 12px 12px' }}>
                                <style>{`.pins-scroll::-webkit-scrollbar{display:none}`}</style>
                                <div className="pins-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingTop: '8px' }}>
                                    {pins.length > 0 ? pins.map((pm, index) => (
                                        <div key={`${pm.id}-${index}`} className="pinned-msg-card" style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                                            padding: '10px 12px', borderRadius: '12px',
                                            background: (document?.documentElement?.getAttribute('data-theme') === 'light' ? '#ececec' : 'rgba(255, 255, 255, 0.08)'),
                                            border: (document?.documentElement?.getAttribute('data-theme') === 'light' ? 'none' : '1px solid var(--border-color)'),
                                            boxShadow: 'var(--shadow-card)',
                                            transition: 'all 0.2s ease'
                                        }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = (document?.documentElement?.getAttribute('data-theme') === 'light' ? '#dedede' : 'rgba(255, 255, 255, 0.12)'); }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = (document?.documentElement?.getAttribute('data-theme') === 'light' ? '#ececec' : 'rgba(255, 255, 255, 0.08)'); }}
                                        >
                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {pm.author}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {pm.message || (pm.file ? `📎 ${pm.file.name}` : '(attachment)')}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            document.querySelector(`[data-msg-id="${pm.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            window.dispatchEvent(new CustomEvent('pin_view', { detail: { id: pm.id } }));
                                                            onClose && onClose();
                                                        } catch (_) { }
                                                    }}
                                                    title="Jump to message"
                                                    style={{
                                                        background: 'transparent', border: 'none', padding: '6px', borderRadius: '8px',
                                                        cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'background 0.2s, color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                                >
                                                    <FiArrowUpRight size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            const pinScope = room || user?.id;
                                                            const raw = localStorage.getItem(`pinned_${pinScope}`) || '[]';
                                                            const arr = JSON.parse(raw).filter(id => id !== pm.id);
                                                            localStorage.setItem(`pinned_${pinScope}`, JSON.stringify(arr));
                                                            window.dispatchEvent(new CustomEvent('pinned_updated', { detail: { room: pinScope, pinnedIds: arr } }));
                                                            // Broadcast to others if this is a group/chat room
                                                            if (room) socket.emit('group_pin_update', { room: pinScope, msgId: pm.id, action: 'unpin', userId: currentUser?.id });
                                                        } catch (_) { }
                                                    }}
                                                    title="Unpin"
                                                    style={{
                                                        background: 'transparent', border: 'none', padding: '6px', borderRadius: '8px',
                                                        cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'background 0.2s, color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 77, 79, 0.1)'; e.currentTarget.style.color = '#ff4d4f'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                                >
                                                    <FiTrash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    )) : (
                                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '16px 0', fontStyle: 'italic' }}>
                                            No pinned messages yet
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="expander-blur-overlay"></div>
                    </div>
                </div>

                {/* Starred Messages Expander */}
                <div className="contact-section" style={{ marginBottom: '16px' }}>
                    <div className="members-expander" style={{
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        borderRadius: '20px',
                        overflow: 'hidden', marginTop: '8px', transition: 'all 0.3s ease', position: 'relative'
                    }}>
                        <div className="members-expander-header"
                            style={{
                                padding: '12px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                <FiStar size={18} /> Starred Messages
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {starredMessages.length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px', marginRight: '8px' }}>
                                        {isEditingStarred && (
                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm('Are you sure you want to unstar all messages?')) {
                                                    socket.emit('unstar_all_messages', { room: room, userId: currentUser.id });
                                                    setIsEditingStarred(false);
                                                }
                                            }} style={{ background: 'transparent', border: 'none', color: '#ff4d4d', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                                                Delete All
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); setIsEditingStarred(!isEditingStarred); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                                            {isEditingStarred ? 'Done' : 'Edit'}
                                        </button>
                                    </div>
                                )}
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{starredCount}</span>
                            </div>
                        </div>
                        <div style={{
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '0' }}>
                                <div className="members-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 6px' }}>
                                    {starredMessages.length > 0 ? (
                                        starredMessages.map(msg => (
                                            <div key={msg.id} className="starred-card" style={{
                                                padding: '10px',
                                                borderRadius: '12px',
                                                border: (document?.documentElement?.getAttribute('data-theme') === 'light' ? 'none' : '1px solid var(--border-color)'),
                                                background: (document?.documentElement?.getAttribute('data-theme') === 'light' ? '#ececec' : 'rgba(255, 255, 255, 0.08)'),
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.35)', cursor: 'pointer', position: 'relative', width: '100%', boxSizing: 'border-box'
                                            }}
                                                onClick={() => {
                                                    if (isEditingStarred) return;
                                                    try {
                                                        document.querySelector(`[data-msg-id="${msg.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                        window.dispatchEvent(new CustomEvent('pin_view', { detail: { id: msg.id } }));
                                                        onClose();
                                                    } catch (_) { }
                                                }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-primary)' }}>{msg.author}</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{msg.time}</span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                    {msg.message || (msg.file ? `📎 ${msg.file.name}` : '')}
                                                </div>
                                                {isEditingStarred && (
                                                    <div onClick={(e) => {
                                                        e.stopPropagation();
                                                        socket.emit('star_message', { room: room, msgId: msg.id, action: 'unstar', userId: currentUser.id });
                                                    }} style={{
                                                        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
                                                        background: 'rgba(0,0,0,0.6)', borderRadius: '10px',
                                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                                        zIndex: 10
                                                    }}>
                                                        <div style={{ background: '#ff4d4d', borderRadius: '50%', padding: '8px', display: 'flex' }}>
                                                            <FiTrash2 color="white" size={16} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '12px' }}>No starred messages</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="expander-blur-overlay"></div>
                    </div>
                </div>
                <div className="section-divider"></div>
                <div className="contact-section">
                    <div className="option-item" style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', height: '56px',
                        background: 'var(--bg-secondary)', borderRadius: '18px', marginBottom: '16px'
                    }}>
                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(255,193,7,0.15)', color: '#ffc107', flexShrink: 0 }}><FiBellOff size={18} /></div>
                            <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Mute Notifications</span>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                            <LiquidToggle checked={isMuted} onChange={(v) => { setIsMuted(v); const keyBase = user?.id || user?.username || 'unknown'; try { localStorage.setItem(`mute_contact_${keyBase}`, String(v)); window.dispatchEvent(new Event('force_sidebar_refresh')); } catch (_) { } }} />
                        </div>
                    </div>
                    <div className="option-item" style={{
                        display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderRadius: '18px', marginBottom: '16px', overflow: 'hidden'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', height: '56px' }}>
                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', flexShrink: 0 }}><FiClock size={18} /></div>
                                <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    Disappearing Messages
                                </span>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                                <LiquidToggle
                                    checked={disappearingEnabled}
                                    onChange={(v) => {
                                        setDisappearingEnabled(v);
                                        const keyBase = user?.id || user?.username || 'unknown';
                                        try { localStorage.setItem(`dm_enabled_contact_${keyBase}`, String(v)); } catch (_) { }
                                        // Dispatch UI state update so open panels sync
                                        try {
                                            window.dispatchEvent(new CustomEvent('disappearing_state_update', { detail: { scope: 'contact', targetId: user?.id, enabled: !!v } }));
                                        } catch (_) { }
                                    }}
                                />
                            </div>
                        </div>
                        {disappearingEnabled && (
                            <div style={{ padding: '0 12px 12px 12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {DURATIONS.map(opt => (
                                        <button key={opt.key}
                                            onClick={() => {
                                                setDisappearingDuration(opt.key);
                                                const keyBase = user?.id || user?.username || 'unknown';
                                                try { localStorage.setItem(`dm_duration_contact_${keyBase}`, opt.key); } catch (_) { }
                                                try { window.dispatchEvent(new CustomEvent('disappearing_duration_update', { detail: { scope: 'contact', targetId: user?.id, key: opt.key } })); } catch (_) { }
                                            }}
                                            style={{
                                                padding: '8px', borderRadius: '10px', textAlign: 'center',
                                                border: '1px solid var(--border-color)', background: disappearingDuration === opt.key ? 'var(--accent-light)' : 'var(--bg-card)',
                                                color: disappearingDuration === opt.key ? 'var(--accent-primary)' : 'var(--text-primary)', cursor: 'pointer',
                                                fontSize: '0.85rem', fontWeight: disappearingDuration === opt.key ? 600 : 400
                                            }}
                                        >{opt.label}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="option-item" style={{ cursor: 'default' }}>
                        <div className="option-label"><FiUsers size={18} /> Groups in common</div>
                        <span className="count">{commonGroups.length}</span>
                    </div>
                    <div className="common-groups-expander" style={{ position: 'relative' }}>
                        <div style={{ padding: '0 16px 8px', maxHeight: '300px', overflowY: 'auto' }}>
                            {commonGroups.length > 0 ? (
                                commonGroups.map(g => (
                                    <div key={g.id} className="member-item" style={{ marginBottom: '8px', cursor: 'pointer' }}
                                        onClick={() => {
                                            /* optional: open group chat */
                                        }}
                                    >
                                        <div style={{ width: 40, height: 40, flexShrink: 0 }}>
                                            <Avatar src={g.photo} alt={g.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        </div>
                                        <div className="member-info">
                                            <span className="member-name">{g.name}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '8px 0' }}>No common groups</div>
                            )}
                        </div>
                        <div className="expander-blur-overlay"></div>
                    </div>
                </div >

                <div className="section-divider"></div>

                <div className="group-actions-footer">
                    <button className="footer-btn delete-subtle" onClick={onBlock}>
                        <FiSlash size={18} /> {isBlocked ? 'Unblock' : 'Block'} {user?.username}
                    </button>
                    <button className="footer-btn delete-strong" onClick={onDeleteChat}>
                        <FiTrash2 size={18} /> Delete chat
                    </button>
                </div>

                <style>{`
                .contact-info-sidebar {
                    width: 100%;
                    height: 100%;
                    overflow-y: auto;
                    overflow-x: visible;
                    background: #ffffff;
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                    flex-shrink: 0;
                    position: relative;
                    z-index: 100;
                    border-left: var(--glass-border);
                    border-right: none;
                    padding: 0 20px;
                }
                [data-theme='dark'] .contact-info-sidebar { background: var(--bg-panel); }
                [data-theme='light'] .contact-info-sidebar { --text-primary: #000000; --text-secondary: #333333; }
                .contact-header {
                    display: flex;
                    align-items: center;
                    padding: 24px 0 28px;
                    gap: 16px;
                    position: sticky;
                    top: 0;
                    background: transparent;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    z-index: 10;
                    border-bottom: none;
                    /* Extend header background to full sidebar width */
                    margin-left: -20px;
                    margin-right: -20px;
                    padding-left: 20px;
                    padding-right: 20px;
                }
                .contact-header::after {
                    content: '';
                    position: absolute;
                    left: 20px;
                    right: 20px;
                    bottom: 0;
                    height: 1px;
                    background: var(--border-color);
                }
                [data-theme='light'] .contact-info-sidebar .contact-header { background: transparent; }
                [data-theme='dark'] .contact-info-sidebar .contact-header { background: transparent; }
                .contact-header h3 { margin: 0; color: var(--text-primary); font-size: 1.3rem; font-weight: var(--font-weight-bold); }
                .panel-label {
                    display: none;
                }
                .close-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                }
                .contact-profile {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 24px 0;
                    text-align: center;
                }
                .large-avatar {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    object-fit: cover;
                    margin-bottom: 16px;
                    border: 4px solid var(--bg-secondary);
                }
                .contact-profile h2 {
                    margin: 0;
                    font-size: 1.4rem;
                    color: var(--text-primary);
                }
                .phone-number {
                    margin: 4px 0 0;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
                .contact-actions {
                    display: flex;
                    justify-content: center;
                    gap: 32px;
                    padding: 0 16px 24px;
                }
                .action-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    color: var(--accent-primary);
                }
                .icon-box {
                    width: 48px;
                    height: 48px;
                    border-radius: 16px;
                    border: 1px solid var(--border-color);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }
                .action-btn:hover .icon-box {
                    background: var(--bg-secondary);
                }
                .section-divider {
                    height: 1px;
                    background: var(--border-color);
                    margin: 0;
                    border: none;
                }
                .contact-section {
                    padding: 12px 0;
                }
                .contact-section h4 {
                    margin: 0 0 8px;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    font-weight: var(--font-weight-regular);
                }
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    cursor: pointer;
                }
                .section-header .count {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
                .media-preview {
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                    padding-bottom: 8px;
                }
                .media-item {
                    width: 80px;
                    height: 80px;
                    border-radius: 8px;
                    overflow: hidden;
                    flex-shrink: 0;
                    background: var(--bg-secondary);
                }
                .media-item img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .no-media {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    font-style: italic;
                }
                [data-theme='light'] .contact-info-sidebar .starred-card {
                    background: #ECEFF3;
                }
                [data-theme='dark'] .contact-info-sidebar .starred-card {
                    background: rgba(255, 255, 255, 0.08);
                }
                .contact-options {
                    padding: 8px 0;
                }
                .option-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 0;
                    cursor: pointer;
                }
                .option-item:hover {
                    /* Removed background for cleaner look */
                }
                .option-label {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    color: var(--text-primary);
                    font-size: 0.95rem;
                }
                .sub-text {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    margin-top: 4px;
                    display: block;
                }
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
                /* Reuse member-item style if needed for groups */
                .member-item {
                     display: flex;
                     align-items: center;
                     gap: 12px;
                     padding: 8px 16px;
                     background: #ececec;
                     border: 1px solid var(--border-color);
                     border-radius: 12px;
                     box-shadow: 0 6px 12px rgba(0,0,0,0.5);
                     transition: box-shadow 0.25s ease, transform 0.15s ease;
                }
                [data-theme='light'] .member-item {
                    background: #ececec;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
                }
                [data-theme='dark'] .member-item {
                     background: #262626;
                }

                .media-tabs-container {
                    margin-top: 8px;
                }
                .media-tabs {
                    display: flex;
                    border-bottom: 1px solid var(--border-color);
                    margin-bottom: 12px;
                }
                .media-tab {
                    flex: 1;
                    text-align: center;
                    padding: 8px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    border-bottom: 2px solid transparent;
                }
                .media-tab.active {
                    color: var(--accent-primary);
                    border-bottom-color: var(--accent-primary);
                }
                .media-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 4px;
                }
                .media-grid-item {
                    aspect-ratio: 1;
                    background: var(--bg-secondary);
                    border-radius: 4px;
                    overflow: hidden;
                }
                .media-grid-item img, .media-grid-item video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .docs-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .doc-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px;
                    border-radius: 8px;
                    background: var(--bg-secondary);
                }
                .doc-icon {
                    width: 32px;
                    height: 32px;
                    background: rgba(0,0,0,0.05);
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                }
                .doc-info {
                    display: flex;
                    flex-direction: column;
                }
                .doc-name {
                    font-size: 0.9rem;
                    color: var(--text-primary);
                }
                .doc-date {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }
                /* Toggle Switch */
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 40px;
                    height: 20px;
                }
                .switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: .4s;
                    border-radius: 34px;
                }
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 16px;
                    width: 16px;
                    left: 2px;
                    bottom: 2px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }
                input:checked + .slider {
                    background-color: var(--accent-primary);
                }
                input:checked + .slider:before {
                    transform: translateX(20px);
                }
            `}</style>
            </div>
            <div className="blur-fade-bottom" />
            <div className="blur-fade-top" />
        </div >
    );
};

export default ContactInfo;
