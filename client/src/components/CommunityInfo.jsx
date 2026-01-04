import React, { useState, useEffect } from 'react';
import { FiX, FiUsers, FiSettings, FiLogOut, FiUserPlus, FiShield, FiHash, FiLock, FiGlobe, FiLink, FiTrash2, FiActivity, FiCheck, FiXCircle, FiPlus } from 'react-icons/fi';
import Avatar from './Avatar';

// Local Avatar component removed

function CommunityInfo({ community, onClose, currentUser, socket, groups = [] }) {
    const [activeTab, setActiveTab] = useState('overview'); // overview, members, groups, settings, requests
    const [refreshTick, setRefreshTick] = useState(0);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [subGroups, setSubGroups] = useState([]);
    const [members, setMembers] = useState([]);
    const [joinRequests, setJoinRequests] = useState([]);
    const [showAddGroupModal, setShowAddGroupModal] = useState(false);

    useEffect(() => {
        if (community && currentUser) {
            setIsAdmin(community.admins.includes(currentUser.id));
            setIsOwner(community.ownerId === currentUser.id);

            // Filter sub-groups
            const linkedGroups = groups.filter(g => community.subGroups.includes(g.id));
            setSubGroups(linkedGroups);

            // Set members = community members UNION announcement group members
            try {
                const ann = groups.find(g => g.id === community.announcementGroupId);
                const merged = Array.from(new Set([...
                    (Array.isArray(community.members) ? community.members : []),
                ...(ann && Array.isArray(ann.members) ? ann.members : [])
                ]));
                setMembers(merged);
            } catch (_) {
                setMembers(community.members);
            }

            if (community.joinRequests) {
                setJoinRequests(community.joinRequests);
            }
        }
    }, [community, currentUser, groups]);

    // Groups created by current user that are not yet linked to any community (available to add)
    const availableGroups = groups.filter(g => !g.communityId && !g.isAnnouncementGroup && g.admins.includes(currentUser.id));

    const handleLeave = () => {
        if (window.confirm('Are you sure you want to leave this community?')) {
            socket.emit('leave_community', { communityId: community.id, userId: currentUser.id });
            onClose();
        }
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this community? This action cannot be undone.')) {
            socket.emit('delete_community', { communityId: community.id, userId: currentUser.id });
            onClose();
        }
    };

    const handleApproveRequest = (userId) => {
        socket.emit('approve_join_request', {
            communityId: community.id,
            userId,
            approverId: currentUser.id
        });
    };

    const handleRejectRequest = (userId) => {
        socket.emit('reject_join_request', {
            communityId: community.id,
            userId,
            rejecterId: currentUser.id
        });
    };

    const handleAddGroup = (groupId) => {
        socket.emit('add_group_to_community', {
            communityId: community.id,
            groupId,
            userId: currentUser.id
        });
        setShowAddGroupModal(false);
    };

    return (
        <div className="info-sidebar" style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-panel)', overflowX: 'hidden', borderLeft: 'var(--glass-border)' }}>
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <FiX size={24} />
                </button>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Community Info</h2>
            </div>

            {/* Community Profile */}
            <div style={{ padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)' }}>
                <Avatar
                    src={(() => {
                        try {
                            const base = localStorage.getItem('community_icon_' + community.id) || community.icon;
                            const ver = localStorage.getItem('community_icon_ver_' + community.id) || '';
                            return base ? (ver ? `${base}${base.includes('?') ? '&' : '?'}v=${ver}` : base) : base;
                        } catch (_) { return community.icon; }
                    })()}
                    alt={community.name}
                    style={{ width: '100px', height: '100px', borderRadius: '25px', marginBottom: '10px', objectFit: 'cover' }}
                />
                <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', textAlign: 'center' }}>{community.name}</h2>
                <p style={{ margin: '0 0 15px 0', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>
                    {community.description || 'No description'}
                </p>
                <div style={{ display: 'flex', gap: '15px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FiUsers size={14} /> {community.members.length} members
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FiHash size={14} /> {subGroups.length} groups
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {community.visibility === 'public' ? <FiGlobe size={14} /> : community.visibility === 'private' ? <FiLock size={14} /> : <FiLink size={14} />}
                        {community.visibility.charAt(0).toUpperCase() + community.visibility.slice(1)}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)' }}>
                <button
                    onClick={() => setActiveTab('overview')}
                    style={{ flex: 1, padding: '15px', background: 'none', border: 'none', borderBottom: activeTab === 'overview' ? '2px solid var(--accent-color)' : 'none', color: activeTab === 'overview' ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}
                >
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab('groups')}
                    style={{ flex: 1, padding: '15px', background: 'none', border: 'none', borderBottom: activeTab === 'groups' ? '2px solid var(--accent-color)' : 'none', color: activeTab === 'groups' ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}
                >
                    Groups
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('admin')}
                        style={{ flex: 1, padding: '15px', background: 'none', border: 'none', borderBottom: activeTab === 'admin' ? '2px solid var(--accent-color)' : 'none', color: activeTab === 'admin' ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}
                    >
                        Admin
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Announcement Channel */}
                        <div style={{ backgroundColor: 'var(--bg-panel)', borderRadius: '12px', padding: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--accent-color-alpha)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--accent-color)' }}>
                                <FiActivity size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ margin: 0 }}>Announcements</h4>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Official updates from admins</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={handleLeave} style={{ padding: '15px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--bg-panel)', color: '#ff6b6b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '1rem', fontWeight: 500 }}>
                                <FiLogOut /> Leave Community
                            </button>
                            {isOwner && (
                                <button onClick={handleDelete} style={{ padding: '15px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--bg-panel)', color: '#ff6b6b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '1rem', fontWeight: 500 }}>
                                    <FiTrash2 /> Delete Community
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* GROUPS TAB */}
                {activeTab === 'groups' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>Sub-Groups ({subGroups.length})</h3>
                            {isAdmin && (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => setShowAddGroupModal(true)}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem' }}
                                    >
                                        <FiPlus /> Add Group
                                    </button>
                                </div>
                            )}
                        </div>

                        {subGroups.map(group => (
                            <div key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', cursor: 'pointer' }}>
                                <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                                    {group.members.slice(0, 2).map((m, i) => (
                                        <div key={i} style={{
                                            width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#ddd',
                                            position: 'absolute', top: i * 5, left: i * 10, border: '2px solid var(--bg-panel)',
                                            backgroundImage: `url(https://i.pravatar.cc/150?u=${m})`, backgroundSize: 'cover'
                                        }} />
                                    ))}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: 0 }}>{group.name}</h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{group.members.length} members</p>
                                </div>
                            </div>
                        ))}
                        {subGroups.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                                No sub-groups yet.
                            </div>
                        )}

                        {/* Your available groups (not yet linked) */}
                        {isAdmin && (
                            <div style={{ marginTop: '10px' }}>
                                <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>Your Groups ({availableGroups.length})</h3>
                                {availableGroups.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {availableGroups.map(group => (
                                            <div key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px' }}>
                                                <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                                                    {group.members.slice(0, 2).map((m, i) => (
                                                        <div key={i} style={{
                                                            width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#ddd',
                                                            position: 'absolute', top: i * 5, left: i * 10, border: '2px solid var(--bg-panel)',
                                                            backgroundImage: `url(https://i.pravatar.cc/150?u=${m})`, backgroundSize: 'cover'
                                                        }} />
                                                    ))}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <h4 style={{ margin: 0 }}>{group.name}</h4>
                                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{group.members.length} members</p>
                                                </div>
                                                <button onClick={() => handleAddGroup(group.id)} style={{ background: 'none', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <FiPlus /> Add
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-secondary)' }}>No available groups you own.</div>
                                )}
                            </div>
                        )}

                        {/* Add Group Modal */}
                        {showAddGroupModal && (
                            <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                                <div className="modal-content" style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '16px', width: '400px', maxWidth: '90%', position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                                    <button onClick={() => setShowAddGroupModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        <FiX size={24} />
                                    </button>
                                    <h2 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>Add Group to Community</h2>

                                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                        {groups.filter(g => !g.communityId && !g.isAnnouncementGroup && g.admins.includes(currentUser.id)).length > 0 ? (
                                            groups.filter(g => !g.communityId && !g.isAnnouncementGroup && g.admins.includes(currentUser.id)).map(group => (
                                                <div key={group.id} onClick={() => handleAddGroup(group.id)} style={{ display: 'flex', alignItems: 'center', padding: '10px', cursor: 'pointer', borderRadius: '8px', marginBottom: '8px', backgroundColor: 'var(--bg-input)' }}>
                                                    <div style={{ fontWeight: 600, flex: 1 }}>{group.name}</div>
                                                    <FiPlus color="var(--accent-color)" />
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                                                No available groups to add. You must be an admin of a group to add it.
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                                        <button style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--accent-primary)', color: 'white', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                                            Create New Group
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ADMIN TAB */}
                {activeTab === 'admin' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Join Requests */}
                        {community.settings.requireApproval && (
                            <div>
                                <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                                    Join Requests ({joinRequests.length})
                                </h3>
                                {joinRequests.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {joinRequests.map(req => (
                                            <div key={req.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <Avatar src={`https://i.pravatar.cc/150?u=${req.userId}`} alt="User" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                                                    <span style={{ fontSize: '0.9rem' }}>User {req.userId.slice(-4)}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <button onClick={() => handleApproveRequest(req.userId)} style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--status-online)', color: 'white', cursor: 'pointer' }}>
                                                        <FiCheck />
                                                    </button>
                                                    <button onClick={() => handleRejectRequest(req.userId)} style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#ff6b6b', color: 'white', cursor: 'pointer' }}>
                                                        <FiX />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '15px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        No pending requests
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Settings */}
                        <div>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>Settings</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', height: '56px', backgroundColor: 'var(--bg-secondary)', borderRadius: '18px' }}>
                                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', flexShrink: 0 }}><FiShield size={18} /></div>
                                        <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Require Approval to Join</span>
                                    </div>
                                    <div style={{
                                        width: '40px', height: '20px', backgroundColor: community.settings.requireApproval ? 'var(--accent-color)' : 'var(--border-color)',
                                        borderRadius: '10px', position: 'relative', cursor: 'pointer', flexShrink: 0
                                    }}>
                                        <div style={{
                                            width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '50%',
                                            position: 'absolute', top: '2px', left: community.settings.requireApproval ? '22px' : '2px', transition: 'left 0.2s'
                                        }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', height: '56px', backgroundColor: 'var(--bg-secondary)', borderRadius: '18px' }}>
                                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', flexShrink: 0 }}><FiUserPlus size={18} /></div>
                                        <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Allow Member Invites</span>
                                    </div>
                                    <div style={{
                                        width: '40px', height: '20px', backgroundColor: community.settings.allowMemberInvites ? 'var(--accent-color)' : 'var(--border-color)',
                                        borderRadius: '10px', position: 'relative', cursor: 'pointer', flexShrink: 0
                                    }}>
                                        <div style={{
                                            width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '50%',
                                            position: 'absolute', top: '2px', left: community.settings.allowMemberInvites ? '22px' : '2px', transition: 'left 0.2s'
                                        }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Invite Link */}
                        <div>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>Invite Link</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ flex: 1, padding: '10px', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: '1px solid var(--border-color)' }}>
                                    {community.inviteLink || 'No link generated'}
                                </div>
                                <button style={{ padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>
                                    Copy
                                </button>
                            </div>
                            <button style={{ marginTop: '10px', background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <FiLink /> Generate New Link
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CommunityInfo;
