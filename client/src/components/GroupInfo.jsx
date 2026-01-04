import React, { useState, useEffect, useRef } from 'react';
import { FiClock, FiX, FiEdit2, FiBookmark, FiUserPlus, FiLogOut, FiTrash2, FiShield, FiMoreVertical, FiCheck, FiSearch, FiBell, FiBellOff, FiFile, FiChevronDown, FiChevronUp, FiChevronRight, FiLock, FiStar, FiUserX, FiArrowUpRight } from 'react-icons/fi';
import LiquidToggle from './LiquidToggle';
import ContactInfo from './ContactInfo';
import Avatar from './Avatar';

// Local Avatar component removed

const GroupInfo = ({ group, onClose, currentUser, socket, friends, mediaMessages = [], links = [], onlineUsers = [], room, pinnedMessages = [], messages = [] }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [newGroupName, setNewGroupName] = useState(group.name);
    const [showAddMember, setShowAddMember] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [localGroup, setLocalGroup] = useState(group);
    const [isEditingAbout, setIsEditingAbout] = useState(false);
    const [aboutDraft, setAboutDraft] = useState(group.about || '');
    // Pending optimistic changes to avoid UI reappearing or reverting before server confirms
    const pendingRemovalsRef = useRef(new Set()); // Set<string memberId>
    const pendingRoleMapRef = useRef({}); // { [memberId]: roleId|null }
    const pendingAdminAddsRef = useRef(new Set()); // Set<string memberId>
    const pendingAdminRemovesRef = useRef(new Set()); // Set<string memberId>
    const pendingMemberAddsRef = useRef(new Map()); // Map<string memberId, {id, username, avatar}>

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [modalAction, setModalAction] = useState(null);

    const [isMuted, setIsMuted] = useState(false);
    const [disappearingEnabled, setDisappearingEnabled] = useState(false);

    const DURATIONS = [
        { key: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
        { key: '7d', label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
        { key: '30d', label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
        { key: '90d', label: '90d', ms: 90 * 24 * 60 * 60 * 1000 },
    ];
    const [disappearingDuration, setDisappearingDuration] = useState('24h');
    const [mediaTab, setMediaTab] = useState('media');

    const [pins, setPins] = useState(() => {
        try {
            const scope = room || group?.id;
            const summariesKey = `pinned_summaries_${scope}`;
            const raw = localStorage.getItem(summariesKey);
            if (raw) return JSON.parse(raw);
        } catch (_) { }
        return pinnedMessages || [];
    });
    const [slowSeconds, setSlowSeconds] = useState(0);


    const [starredMessages, setStarredMessages] = useState([]);
    const [starredCount, setStarredCount] = useState(0);
    const [isEditingStarred, setIsEditingStarred] = useState(false);
    const [banModalOpen, setBanModalOpen] = useState(false);
    const [banTargetId, setBanTargetId] = useState(null);
    const [banMinutes, setBanMinutes] = useState('60');

    const [selectedProfile, setSelectedProfile] = useState(null);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleColor, setNewRoleColor] = useState('#6b7280');
    const [editRoleId, setEditRoleId] = useState(null);
    const [editRoleName, setEditRoleName] = useState('');
    const [editRoleColor, setEditRoleColor] = useState('#6b7280');
    const [newPermNames, setNewPermNames] = useState({});

    useEffect(() => {
        const handler = (data) => {
            if (data.room === room || data.room === localGroup.id) {
                const msgs = data.messages || [];
                setStarredMessages(msgs);
                try {
                    const key = `starred_count_${room || localGroup.id}`;
                    localStorage.setItem(key, String(msgs.length));
                    setStarredCount(msgs.length);
                } catch (_) { }
            }
        };
        socket.on('starred_messages_list', handler);
        return () => socket.off('starred_messages_list', handler);
    }, [socket, room, localGroup.id]);

    // Initialize badge count from cache immediately
    useEffect(() => {
        try {
            const key = `starred_count_${room || localGroup.id}`;
            const v = localStorage.getItem(key);
            if (v != null) setStarredCount(parseInt(v, 10) || 0);
        } catch (_) { }
    }, [room, localGroup.id]);

    useEffect(() => {
        if (room || localGroup.id) {
            socket.emit('get_starred_messages', { room: room || localGroup.id, userId: currentUser.id });
        }
    }, [room, localGroup.id, currentUser.id, socket]);

    // Preload starred messages so count shows even when collapsed
    useEffect(() => {
        try {
            if ((room || localGroup.id) && currentUser?.id) {
                socket.emit('get_starred_messages', { room: room || localGroup.id, userId: currentUser.id });
            }
        } catch (_) { }
        // no cleanup needed
    }, [room, localGroup.id, currentUser?.id, socket]);

    // Keep starred counter fresh even when collapsed: re-fetch on star/unstar or message delete in this room
    useEffect(() => {
        const refetch = (payload) => {
            try {
                const scope = room || localGroup.id;
                if (!payload) return;
                // message_starred: { msgId, starredBy, room? } in ChatWindow; receive_delete_message: { id, room }
                const payloadRoom = payload.room || payload?.roomId || payload?.groupId;
                if (String(payloadRoom || scope) !== String(scope)) return;
                socket.emit('get_starred_messages', { room: scope, userId: currentUser.id });
            } catch (_) { }
        };
        const starListener = (data) => refetch(data || {});
        const deleteListener = (data) => refetch(data || {});
        socket.on('message_starred', starListener);
        socket.on('receive_delete_message', deleteListener);
        return () => {
            socket.off('message_starred', starListener);
            socket.off('receive_delete_message', deleteListener);
        };
    }, [socket, room, localGroup.id, currentUser.id]);

    // Helper: robust online check (supports ids or objects in onlineUsers)
    const isOnlineId = (id) => {
        try {
            if (!Array.isArray(onlineUsers)) return false;
            return onlineUsers.some(u => {
                const val = (u && typeof u === 'object') ? (u.id ?? u._id ?? u.userId ?? u) : u;
                return String(val) === String(id);
            });
        } catch (_) { return false; }
    };

    useEffect(() => {
        try {
            const mapMembers = (arr) => (arr || []).map(m => {
                const id = (m && typeof m === 'object') ? (m.id ?? m._id ?? m) : m;
                const fr = (friends || []).find(f => String(f.id) === String(id));
                const username = fr?.username || ((m && typeof m === 'object' && (m.username || m.name)) || String(id));
                const avatar = fr?.avatar || ((m && typeof m === 'object' && m.avatar) || `https://i.pravatar.cc/150?u=${id}`);
                return { id, username, avatar };
            });

            // Start with incoming group
            let next = {
                ...localGroup,
                ...group,
                roles: Array.isArray(group.roles) ? group.roles : localGroup.roles,
                rolePermissions: group.rolePermissions ? { ...(localGroup.rolePermissions || {}), ...group.rolePermissions } : (localGroup.rolePermissions || {}),
                memberRoles: group.memberRoles ? { ...(localGroup.memberRoles || {}), ...group.memberRoles } : (localGroup.memberRoles || {}),
                members: mapMembers(group?.members)
            };

            // Apply pending member adds optimistically
            const pendingAdds = pendingMemberAddsRef.current;
            if (pendingAdds && pendingAdds.size > 0) {
                const currentMemberIds = new Set(next.members.map(m => String(m.id)));
                pendingAdds.forEach((member, id) => {
                    if (!currentMemberIds.has(String(id))) {
                        next.members.push(member);
                    } else {
                        // Confirmed by server
                        pendingAdds.delete(String(id));
                    }
                });
            }

            // Apply pending removals optimistically
            const pendingRemovals = pendingRemovalsRef.current;
            if (pendingRemovals && pendingRemovals.size > 0) {
                next.members = (next.members || []).filter(m => !pendingRemovals.has(String(m.id)));
                // Clear entries that are now confirmed removed
                (Array.isArray(group.members) ? group.members : []).forEach(m => {
                    const id = (m && typeof m === 'object') ? (m.id ?? m._id ?? m) : m;
                    if (!id) return;
                    if (!pendingRemovals.has(String(id))) return;
                });
                // If server no longer includes a member, ensure it's not in pending
                const serverIds = new Set((group.members || []).map(m => String((m && typeof m === 'object') ? (m.id ?? m._id ?? m) : m)));
                Array.from(pendingRemovals).forEach(id => { if (!serverIds.has(String(id))) pendingRemovals.delete(String(id)); });
            }

            // Apply pending role assignments
            const pendingRoleMap = pendingRoleMapRef.current || {};
            if (pendingRoleMap && Object.keys(pendingRoleMap).length > 0) {
                const merged = { ...(next.memberRoles || {}) };
                Object.entries(pendingRoleMap).forEach(([mid, rid]) => {
                    if (rid) merged[mid] = rid; else delete merged[mid];
                });
                next.memberRoles = merged;
                // Clear entries that are now confirmed by server
                Object.entries(pendingRoleMap).forEach(([mid, rid]) => {
                    const serverRid = (group.memberRoles || {})[mid];
                    if (String(serverRid || '') === String(rid || '')) delete pendingRoleMap[mid];
                });
            }

            // Apply pending admin promotions/demotions
            const adminAdds = pendingAdminAddsRef.current || new Set();
            const adminRems = pendingAdminRemovesRef.current || new Set();
            let adminsArr = Array.isArray(next.admins) ? next.admins.slice() : [];

            // Normalize adminsArr to strings for comparison
            adminsArr = adminsArr.map(String);

            if (adminAdds.size > 0) {
                const existing = new Set(adminsArr);
                adminAdds.forEach(id => { if (!existing.has(String(id))) adminsArr.push(String(id)); });
            }
            if (adminRems.size > 0) {
                adminsArr = adminsArr.filter(id => !adminRems.has(String(id)));
            }
            next.admins = adminsArr;

            // Clear pending add/remove that match server state
            const serverAdmins = new Set((group.admins || []).map(String));
            Array.from(adminAdds).forEach(id => { if (serverAdmins.has(String(id))) adminAdds.delete(String(id)); });
            Array.from(adminRems).forEach(id => { if (!serverAdmins.has(String(id))) adminRems.delete(String(id)); });

            setLocalGroup(next);
        } catch (_) {
            setLocalGroup(prev => ({ ...prev, ...group }));
        }
    }, [group, friends]);

    useEffect(() => {
        const scope = room || localGroup.id;
        const summariesKey = `pinned_summaries_${scope}`;
        const validIds = new Set(JSON.parse(localStorage.getItem(`pinned_${scope}`) || '[]'));
        let summaries = [];
        try {
            summaries = JSON.parse(localStorage.getItem(summariesKey) || '[]');
        } catch (_) { }

        // Filter summaries to only include currently pinned IDs
        summaries = summaries.filter(s => validIds.has(String(s.id)));

        const livePins = Array.isArray(pinnedMessages) ? pinnedMessages : [];

        // Merge: prefer live pins, fallback to summaries
        const merged = [...livePins];
        const liveIds = new Set(livePins.map(p => String(p.id)));

        if (Array.isArray(summaries)) {
            summaries.forEach(s => {
                if (s && s.id && !liveIds.has(String(s.id))) {
                    merged.push(s);
                }
            });
        }

        setPins(prev => {
            const next = merged;
            if (prev === next) return prev;
            if (Array.isArray(prev) && prev.length === next.length) {
                let same = true;
                for (let i = 0; i < prev.length; i++) {
                    if (prev[i]?.id !== next[i]?.id) { same = false; break; }
                }
                if (same) return prev;
            }
            return next;
        });
    }, [pinnedMessages, room, localGroup.id]);



    // Also react to socket group_pin_update events (pins changed by other users)
    useEffect(() => {
        const pinUpdateHandler = (payload = {}) => {
            try {
                const scope = room || localGroup.id;
                if (!payload || String(payload.room) !== String(scope)) return;

                // Trigger a re-fetch by dispatching pinned_updated event
                // ChatWindow will update pinnedIds and re-render with correct pinnedMessages
                window.dispatchEvent(new CustomEvent('pinned_updated', { detail: { room: scope } }));
            } catch (_) { }
        };
        socket.on('group_pin_update', pinUpdateHandler);
        return () => { socket.off('group_pin_update', pinUpdateHandler); };
    }, [socket, room, localGroup.id]);
    useEffect(() => {
        const handler = (e) => {
            const d = e?.detail || {};
            const scope = room || localGroup.id;
            if (!d.room || String(d.room) !== String(scope)) return;
            try {
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
            } catch (_) { /* ignore */ }
        };
        window.addEventListener('pinned_updated', handler);
        return () => window.removeEventListener('pinned_updated', handler);
    }, [room, localGroup.id, pinnedMessages]);

    useEffect(() => {
        try {
            const s = localStorage.getItem(`slow_mode_${room}`);
            setSlowSeconds(s ? parseInt(s, 10) : 0);
        } catch (_) { setSlowSeconds(0); }
        const slowHandler = (e) => {
            const d = e?.detail || {};
            if (d.room && String(d.room) === String(room)) {
                const secs = Math.max(0, parseInt(d.seconds || 0, 10) || 0);
                setSlowSeconds(secs);
                // Auto-expand/collapse for admins to keep UI in sync
                const amAdmin = group.admins?.includes(currentUser.id);
                if (amAdmin) {
                    setIsSlowExpanded(secs > 0);
                }
            }
        };
        window.addEventListener('slow_mode_updated', slowHandler);
        return () => window.removeEventListener('slow_mode_updated', slowHandler);
    }, [room, group.admins, currentUser.id]);

    const applySlowMode = (secs) => {
        const v = Math.max(0, parseInt(secs || 0, 10) || 0);
        setSlowSeconds(v);
        const targetRoom = room || localGroup.id;
        try { localStorage.setItem(`slow_mode_${targetRoom}`, String(v)); } catch (_) { }
        try { window.dispatchEvent(new CustomEvent('slow_mode_updated', { detail: { room: targetRoom, seconds: v } })); } catch (_) { }
        try { socket && socket.emit && socket.emit('group_slow_mode_set', { room: targetRoom, seconds: v, userId: currentUser.id }); } catch (_) { }
    };

    useEffect(() => {
        const handleGroupUpdate = (updatedGroup) => {
            if (updatedGroup.id === localGroup.id) {
                try {
                    const mapMembers = (arr) => (arr || []).map(m => {
                        const id = (m && typeof m === 'object') ? (m.id ?? m._id ?? m) : m;
                        const fr = (friends || []).find(f => f.id === id);
                        const username = fr?.username || ((m && typeof m === 'object' && (m.username || m.name)) || String(id));
                        const avatar = fr?.avatar || ((m && typeof m === 'object' && m.avatar) || `https://i.pravatar.cc/150?u=${id}`);
                        return { id, username, avatar };
                    });

                    let next = {
                        ...localGroup,
                        ...updatedGroup,
                        // Preserve local selections if server payload omits them
                        roles: Array.isArray(updatedGroup.roles) ? updatedGroup.roles : localGroup.roles,
                        rolePermissions: updatedGroup.rolePermissions ? { ...localGroup.rolePermissions, ...updatedGroup.rolePermissions } : localGroup.rolePermissions,
                        memberRoles: updatedGroup.memberRoles ? { ...localGroup.memberRoles, ...updatedGroup.memberRoles } : localGroup.memberRoles,
                        members: mapMembers(updatedGroup?.members)
                    };

                    // Apply pending member adds optimistically
                    const pendingAdds = pendingMemberAddsRef.current;
                    if (pendingAdds && pendingAdds.size > 0) {
                        const currentMemberIds = new Set(next.members.map(m => String(m.id)));
                        pendingAdds.forEach((member, id) => {
                            if (!currentMemberIds.has(String(id))) {
                                next.members.push(member);
                            } else {
                                pendingAdds.delete(String(id));
                            }
                        });
                    }

                    // Apply pending removals optimistically
                    const pendingRemovals = pendingRemovalsRef.current;
                    if (pendingRemovals && pendingRemovals.size > 0) {
                        next.members = (next.members || []).filter(m => !pendingRemovals.has(String(m.id)));
                        const serverIds = new Set((updatedGroup.members || []).map(m => String((m && typeof m === 'object') ? (m.id ?? m._id ?? m) : m)));
                        Array.from(pendingRemovals).forEach(id => { if (!serverIds.has(String(id))) pendingRemovals.delete(String(id)); });
                    }

                    // Apply pending role assignments
                    const pendingRoleMap = pendingRoleMapRef.current || {};
                    if (pendingRoleMap && Object.keys(pendingRoleMap).length > 0) {
                        const merged = { ...(next.memberRoles || {}) };
                        Object.entries(pendingRoleMap).forEach(([mid, rid]) => {
                            if (rid) merged[mid] = rid; else delete merged[mid];
                        });
                        next.memberRoles = merged;
                        Object.entries(pendingRoleMap).forEach(([mid, rid]) => {
                            const serverRid = (updatedGroup.memberRoles || {})[mid];
                            if (String(serverRid || '') === String(rid || '')) delete pendingRoleMap[mid];
                        });
                    }

                    // Apply pending admin promotions/demotions
                    const adminAdds = pendingAdminAddsRef.current || new Set();
                    const adminRems = pendingAdminRemovesRef.current || new Set();
                    let adminsArr = Array.isArray(next.admins) ? next.admins.slice() : [];
                    adminsArr = adminsArr.map(String);

                    if (adminAdds.size > 0) {
                        const existing = new Set(adminsArr);
                        adminAdds.forEach(id => { if (!existing.has(String(id))) adminsArr.push(String(id)); });
                    }
                    if (adminRems.size > 0) {
                        adminsArr = adminsArr.filter(id => !adminRems.has(String(id)));
                    }
                    next.admins = adminsArr;

                    const serverAdmins = new Set((updatedGroup.admins || []).map(String));
                    Array.from(adminAdds).forEach(id => { if (serverAdmins.has(String(id))) adminAdds.delete(String(id)); });
                    Array.from(adminRems).forEach(id => { if (!serverAdmins.has(String(id))) adminRems.delete(String(id)); });

                    setLocalGroup(next);
                } catch (_) {
                    setLocalGroup(prev => ({ ...prev, ...updatedGroup }));
                }
            }
        };

        socket.on('group_updated', handleGroupUpdate);
        return () => {
            socket.off('group_updated', handleGroupUpdate);
        };
    }, [socket, localGroup.id, friends]);

    useEffect(() => {
        try {
            const v = localStorage.getItem(`mute_group_${localGroup.id}`);
            if (v != null) setIsMuted(v === 'true');
        } catch (_) { }
    }, [localGroup.id]);

    useEffect(() => {
        try {
            const v = localStorage.getItem(`dm_enabled_group_${localGroup.id}`);
            if (v != null) {
                const isEnabled = v === 'true';
                setDisappearingEnabled(isEnabled);
                // If enabled, ensure expanded is true regardless of previous state, or at least default to true
                if (isEnabled) setIsDmExpanded(true);
            }
            const d = localStorage.getItem(`dm_duration_group_${localGroup.id}`);
            if (d) setDisappearingDuration(d);

            // Only load expanded state if not forced by enabled
            if (v !== 'true') {
                const ex = localStorage.getItem(`dm_expanded_group_${localGroup.id}`);
                if (ex != null) setIsDmExpanded(ex === 'true');
            }
        } catch (_) { }
    }, [localGroup.id]);

    useEffect(() => {
        const handler = (e) => {
            try {
                const d = e?.detail || {};
                if (d.scope === 'group' && String(d.targetId) === String(localGroup.id)) {
                    setDisappearingEnabled(!!d.enabled);
                }
            } catch (_) { }
        };
        window.addEventListener('disappearing_state_update', handler);
        return () => window.removeEventListener('disappearing_state_update', handler);
    }, [localGroup.id]);

    // If disappearing is enabled, ensure expander is open and persisted



    useEffect(() => {
        const handler = (e) => {
            try {
                const d = e?.detail || {};
                if (d.scope === 'group' && String(d.targetId) === String(localGroup.id) && d.key) {
                    setDisappearingDuration(d.key);
                }
            } catch (_) { }
        };
        window.addEventListener('disappearing_duration_update', handler);
        return () => window.removeEventListener('disappearing_duration_update', handler);
    }, [localGroup.id]);

    // Derived state - use localGroup for real-time updates
    const isAdmin = (localGroup.admins || []).map(String).includes(String(currentUser?.id));
    const DEFAULT_ROLE_IDS = ['owner', 'admin', 'mod', 'member', 'muted'];
    const PERMISSION_CATALOG = [
        { key: 'canInvite', label: 'Invite members' },
        { key: 'canRemove', label: 'Remove members' },
        { key: 'canPin', label: 'Pin/Unpin messages' },
        { key: 'canChangeSlowMode', label: 'Change disappearing/slow mode' },
        { key: 'canAssignRoles', label: 'Assign member roles' },
        { key: 'canPromote', label: 'Promote/Demote admins' },
        { key: 'canBan', label: 'Ban members' },
        { key: 'canEditGroupName', label: 'Edit group name' },
        { key: 'canEditGroupPhoto', label: 'Change group photo' },
        { key: 'canSendMedia', label: 'Send media' },
        { key: 'canCreatePolls', label: 'Create polls' },
        { key: "canDeleteMessages", label: "Delete others' messages" }
    ];
    // Current user's role and permissions (owner always full; admins depend on adminFull setting)
    const currentRoleId = (localGroup.memberRoles || {})[currentUser?.id];
    const currentRolePerms = (localGroup.rolePermissions || {})[currentRoleId] || {};
    // Be robust: creator check against both incoming group and localGroup, coerce types
    const isOwnerMe = String(currentUser?.id) === String(localGroup.createdBy ?? group?.createdBy);
    const adminFullEnabled = !!(localGroup.settings && localGroup.settings.adminFullPermissionsEnabled);
    // Helper:
    // - Owner: full
    // - If Admin and adminFull is enabled: full (regardless of role)
    // - Else if has a role: check role perms
    // - Else: no special permissions
    const allowOrRole = (permKey) => {
        // Owner: full permissions
        if (isOwnerMe) return true;
        // Admins: full if adminFull is enabled
        if (isAdmin && adminFullEnabled) return true;
        // If a role is assigned, defer to role permissions
        if (currentRoleId) return !!currentRolePerms[permKey];
        // No role and no admin full access: deny
        return false;
    };
    const eCanInvite = allowOrRole('canInvite');
    const eCanRemove = allowOrRole('canRemove');
    const eCanAssignRoles = allowOrRole('canAssignRoles');
    const eCanPromote = allowOrRole('canPromote');
    const eCanBan = allowOrRole('canBan');
    const eCanEditGroupName = allowOrRole('canEditGroupName');
    const eCanEditGroupPhoto = allowOrRole('canEditGroupPhoto');
    const eCanChangeSlowMode = allowOrRole('canChangeSlowMode');
    const eCanPin = allowOrRole('canPin');

    // Members are now populated from parent
    const members = localGroup.members || [];
    // Prepare sorting and helpers
    const rolesArr = Array.isArray(localGroup.roles) ? localGroup.roles : [];
    const roleIndex = new Map(rolesArr.map((r, i) => [r.id, i]));
    const nameOf = (m) => m.username || (friends.find(f => String(f.id) === String(m.id))?.username) || String(m.id);
    const hasRole = (m) => !!(localGroup.memberRoles && localGroup.memberRoles[m.id]);
    const isOwner = (m) => String(m.id) === String(localGroup.createdBy);
    const isAdm = (m) => Array.isArray(localGroup.admins) && localGroup.admins.map(String).includes(String(m.id));
    const rolePos = (m) => roleIndex.has((localGroup.memberRoles || {})[m.id]) ? roleIndex.get((localGroup.memberRoles || {})[m.id]) : Number.MAX_SAFE_INTEGER;
    const sortedMembers = members
        .filter(m => String(m.id) !== String(currentUser?.id))
        .slice()
        .sort((a, b) => {
            // Owner first
            if (isOwner(a) && !isOwner(b)) return -1;
            if (!isOwner(a) && isOwner(b)) return 1;
            // Admins next
            if (isAdm(a) && !isAdm(b)) return -1;
            if (!isAdm(a) && isAdm(b)) return 1;
            // Members with roles next (by role order)
            const aHas = hasRole(a), bHas = hasRole(b);
            if (aHas && !bHas) return -1;
            if (!aHas && bHas) return 1;
            if (aHas && bHas) {
                const rp = rolePos(a) - rolePos(b);
                if (rp !== 0) return rp;
            }
            // Finally by name
            return nameOf(a).localeCompare(nameOf(b));
        });
    const [permModalOpen, setPermModalOpen] = useState(false);
    const [permModalRoleId, setPermModalRoleId] = useState(null);
    const [permDraft, setPermDraft] = useState(null);

    // Initialize permission draft when opening modal or switching role
    useEffect(() => {
        if (!permModalOpen || !permModalRoleId) return;
        try {
            const current = ((localGroup.rolePermissions || {})[permModalRoleId]) || {};
            setPermDraft({ roleId: permModalRoleId, perms: { ...current } });
        } catch (_) { setPermDraft({ roleId: permModalRoleId, perms: {} }); }
    }, [permModalOpen, permModalRoleId, localGroup.rolePermissions]);

    const handleRename = () => {
        if (newGroupName.trim() !== localGroup.name) {
            socket.emit('rename_group', { groupId: localGroup.id, newName: newGroupName, userId: currentUser.id });
        }
        setIsEditingName(false);
    };

    const handleAddMember = (friendId) => {
        try {
            const fr = (friends || []).find(f => f.id === friendId);
            const newMember = { id: friendId, username: fr?.username || String(friendId), avatar: fr?.avatar || `https://i.pravatar.cc/150?u=${friendId}` };

            // Track optimistically
            pendingMemberAddsRef.current.set(String(friendId), newMember);

            setLocalGroup(prev => ({
                ...prev,
                members: [...(prev.members || []), newMember]
            }));
        } catch (_) { }
        socket.emit('add_group_member', { groupId: localGroup.id, newMemberId: friendId, addedBy: currentUser.id });
        try { socket.emit('get_groups', currentUser.id); } catch (_) { }
        setShowAddMember(false);
    };

    const handleRemoveMember = (memberId) => {
        // Prevent removing the creator if they are the only admin (silent no-op)
        const isCreator = String(memberId) === String(localGroup.createdBy);
        const otherAdmins = (localGroup.admins || []).filter(id => String(id) !== String(memberId));
        if (isCreator && otherAdmins.length === 0) {
            return;
        }

        // Optimistic UI update (no confirm dialogs)
        try {
            pendingRemovalsRef.current.add(String(memberId));
            setLocalGroup(prev => ({
                ...prev,
                members: (prev.members || []).filter(m => String(m.id) !== String(memberId)),
                admins: (prev.admins || []).filter(id => String(id) !== String(memberId))
            }));
        } catch (_) { }
        try { socket.emit('remove_group_member', { groupId: localGroup.id, memberId, removedBy: currentUser.id }); } catch (_) { }
        try { socket.emit('get_groups', currentUser.id); } catch (_) { }
    };

    const handleMakeAdmin = (memberId) => {
        setModalAction({
            type: 'promote',
            memberId,
            message: 'Make this member an admin?',
            onConfirm: () => {
                socket.emit('promote_group_admin', { groupId: localGroup.id, memberId, promotedBy: currentUser.id });
                setShowConfirmModal(false);
                setModalAction(null);
            }
        });
        setShowConfirmModal(true);
    };

    const handleRemoveAdmin = (memberId) => {
        setModalAction({
            type: 'demote',
            memberId,
            message: 'Remove admin privileges from this member?',
            onConfirm: () => {
                socket.emit('demote_group_admin', { groupId: localGroup.id, memberId, demotedBy: currentUser.id });
                setShowConfirmModal(false);
                setModalAction(null);
            }
        });
        setShowConfirmModal(true);
    };

    const handleLeaveGroup = () => {
        if (window.confirm("Are you sure you want to leave this group?")) {
            socket.emit('leave_group', { groupId: localGroup.id, userId: currentUser.id });
            onClose();
        }
    };

    const handleRemoveGroup = () => {
        if (!(isOwnerMe || (isAdmin && adminFullEnabled))) return;
        if (window.confirm("Delete this group? This action cannot be undone.")) {
            socket.emit('delete_group', { groupId: localGroup.id, userId: currentUser.id });
            onClose();
        }
    };

    // Overlapping avatars for header
    const getOverlappingAvatars = () => {
        return members.slice(0, 3).map((m, i) => (
            <Avatar
                key={m.id}
                src={m.avatar}
                alt={m.username}
                className="group-header-avatar"
                style={{
                    left: `${i * 30}px`,
                    zIndex: 3 - i
                }}
            />
        ));
    };

    if (selectedProfile) {
        return (
            <ContactInfo
                user={selectedProfile}
                onClose={() => setSelectedProfile(null)}
                currentUser={currentUser}
                socket={socket}
                room={room}
            />
        );
    }

    return (
        <div className="contact-info-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                <div className="contact-header" style={{ paddingTop: '40px' }}>
                    <button onClick={onClose} className="close-btn"><FiX size={24} /></button>
                    <h3>Group Info</h3>
                </div>
                <div className="panel-label">Group Info</div>

                <div className="group-profile" style={{}}>
                    <div className="group-avatars-container" style={{
                        width: (() => { try { return (localStorage.getItem('group_avatar_mode_' + localGroup.id) || 'stack') === 'single' ? '60px' : `${60 + (Math.min(3, members.length) - 1) * 30}px`; } catch (_) { return `${60 + (Math.min(3, members.length) - 1) * 30}px`; } })(),
                        height: '80px',
                        marginBottom: '16px',
                        position: 'relative',
                        marginLeft: 'auto',
                        marginRight: 'auto'
                    }}>
                        {(() => {
                            try {
                                const mode = localStorage.getItem('group_avatar_mode_' + localGroup.id) || 'stack';
                                if (mode === 'single') {
                                    const url = localStorage.getItem('group_avatar_' + localGroup.id);
                                    if (url) {
                                        return (
                                            <Avatar src={url} alt={localGroup.name} style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid #808080', objectFit: 'cover', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
                                        );
                                    }
                                }
                            } catch (_) { }
                            return getOverlappingAvatars();
                        })()}
                    </div>
                    {/* Removed top-level disappearing durations; moved to expander below */}

                    {isEditingName ? (
                        <div className="edit-name-container">
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                autoFocus
                                onBlur={handleRename}
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                            />
                            <button onClick={handleRename}><FiCheck /></button>
                        </div>
                    ) : (
                        <div className="group-name-display">
                            <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>{group.name}</h2>
                            {eCanEditGroupName && <button onClick={() => setIsEditingName(true)} className="edit-btn"><FiEdit2 size={16} /></button>}
                        </div>
                    )}
                    <p className="group-meta">Group · {(localGroup.members?.length) || 0} members</p>

                    {/* About section */}
                    <div style={{ width: '100%', marginTop: 8 }}>
                        {isEditingAbout ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <textarea
                                    value={aboutDraft}
                                    onChange={(e) => setAboutDraft(e.target.value)}
                                    rows={3}
                                    autoFocus
                                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                                />
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await fetch(`http://localhost:3001/groups/${localGroup.id}/settings`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ userId: currentUser.id, about: aboutDraft })
                                                });
                                                setLocalGroup(prev => ({ ...prev, about: aboutDraft }));
                                                setIsEditingAbout(false);
                                            } catch (e) { setIsEditingAbout(false); }
                                        }}
                                        title="Save"
                                        className="icon-circle"
                                        style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', background: 'var(--accent-primary)', color: '#fff' }}
                                    >
                                        <FiCheck size={16} />
                                    </button>
                                    <button
                                        onClick={() => { setAboutDraft(localGroup.about || ''); setIsEditingAbout(false); }}
                                        title="Cancel"
                                        className="icon-circle"
                                        style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)' }}
                                    >
                                        <FiX size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                    {localGroup.about && localGroup.about.trim().length > 0 ? localGroup.about : (isAdmin || isOwnerMe ? 'Add a group about...' : '')}
                                </p>
                                {(isAdmin || isOwnerMe) && (
                                    <button onClick={() => { setAboutDraft(localGroup.about || ''); setIsEditingAbout(true); }} className="edit-btn" title="Edit about" style={{ marginTop: 0 }}>
                                        <FiEdit2 size={16} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>



                {eCanEditGroupPhoto && (
                    <div className="contact-section" style={{ paddingTop: 0 }}>
                        <div className="members-expander" style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '20px',
                            overflow: 'hidden', marginTop: '8px', transition: 'all 0.3s ease', position: 'relative'
                        }}>
                            <div style={{
                                padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Group Profile Photo</span>
                            </div>
                            <div style={{
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => { try { localStorage.setItem('group_avatar_mode_' + localGroup.id, 'stack'); } catch (_) { }; setLocalGroup({ ...localGroup }); }}
                                        style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: ((() => { try { return (localStorage.getItem('group_avatar_mode_' + localGroup.id) || 'stack') === 'stack'; } catch (_) { return true; } })()) ? 'var(--bg-secondary)' : 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                                    >
                                        Stack Avatars
                                    </button>
                                    <label style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: ((() => { try { return (localStorage.getItem('group_avatar_mode_' + localGroup.id) || 'stack') === 'single'; } catch (_) { return false; } })()) ? 'var(--bg-secondary)' : 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                                        Single Photo
                                        <input
                                            type="file"
                                            accept="image/*,video/*"
                                            style={{ display: 'none' }}
                                            onChange={async (e) => {
                                                const f = e.target.files && e.target.files[0];
                                                if (!f) return;
                                                try {
                                                    const formData = new FormData();
                                                    formData.append('file', f);
                                                    const res = await fetch('http://localhost:3001/upload', { method: 'POST', body: formData });
                                                    const data = await res.json();
                                                    if (data.filePath) {
                                                        const url = `http://localhost:3001${data.filePath}`;
                                                        localStorage.setItem('group_avatar_' + localGroup.id, url);
                                                        localStorage.setItem('group_avatar_mode_' + localGroup.id, 'single');
                                                        setLocalGroup({ ...localGroup });
                                                    }
                                                } catch (err) {

                                                }
                                            }}
                                        />
                                    </label>
                                    {group.sourceCommunityId && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginRight: '4px' }}>Community Photo</span>
                                            <label style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-primary)', background: 'transparent', fontFamily: 'inherit' }}>
                                                Change
                                                <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={async (e) => {
                                                    const f = e.target.files && e.target.files[0];
                                                    if (!f) return;
                                                    try {
                                                        const formData = new FormData();
                                                        formData.append('file', f);
                                                        const res = await fetch('http://localhost:3001/upload', { method: 'POST', body: formData });
                                                        const data = await res.json();
                                                        if (data.filePath) {
                                                            const url = `http://localhost:3001${data.filePath}`;
                                                            localStorage.setItem('community_icon_' + group.sourceCommunityId, url);
                                                            // Persist to server
                                                            await fetch(`http://localhost:3001/communities/${group.sourceCommunityId}/settings`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ userId: user.id, icon: url })
                                                            });
                                                            window.dispatchEvent(new Event('force_sidebar_refresh'));
                                                        }
                                                    } catch (err) {

                                                    }
                                                }} />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="expander-blur-overlay"></div>
                    </div>
                )}





                {/* Pinned Messages - Remade */}
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
                                                {eCanPin && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            try {
                                                                const targetRoom = room || localGroup.id;
                                                                const raw = localStorage.getItem(`pinned_${targetRoom}`) || '[]';
                                                                const arr = JSON.parse(raw).filter(id => id !== pm.id);
                                                                localStorage.setItem(`pinned_${targetRoom}`, JSON.stringify(arr));
                                                                window.dispatchEvent(new CustomEvent('pinned_updated', { detail: { room: targetRoom, pinnedIds: arr } }));
                                                                socket.emit('group_pin_update', { room: targetRoom, msgId: pm.id, action: 'unpin', userId: currentUser.id });
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
                                                )}
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

                {banModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                        <div style={{ width: '90%', maxWidth: 420, background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Adjust Ban</h4>
                                <button onClick={() => setBanModalOpen(false)} className="icon-circle" title="Close"><FiX /></button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Ban duration (minutes)</label>
                                <input type="number" min="1" step="1" value={banMinutes} onChange={(e) => setBanMinutes(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)' }} />
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {[15, 60, 240, 1440, 10080].map(v => (
                                        <button key={v} onClick={() => setBanMinutes(String(v))} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}>{v}m</button>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
                                    <button onClick={() => {
                                        const mins = parseInt(banMinutes, 10);
                                        const durationMs = isNaN(mins) || mins <= 0 ? null : mins * 60000;
                                        try { socket.emit('group_ban_member', { groupId: localGroup.id, memberId: banTargetId, durationMs, userId: currentUser.id }); } catch (_) { }
                                        setBanModalOpen(false);
                                    }} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer' }}>Ban</button>
                                    <button onClick={() => {
                                        try { socket.emit('group_ban_member', { groupId: localGroup.id, memberId: banTargetId, durationMs: -1, userId: currentUser.id }); } catch (_) { }
                                        setBanModalOpen(false);
                                    }} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Permanent</button>
                                    <button onClick={() => {
                                        try { socket.emit('group_ban_member', { groupId: localGroup.id, memberId: banTargetId, durationMs: null, userId: currentUser.id }); } catch (_) { }
                                        setBanModalOpen(false);
                                    }} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #22c55e', background: 'transparent', color: '#22c55e', cursor: 'pointer' }}>Unban</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="contact-section">
                    {/* Members Expander: match Sidebar communities style */}
                    <div className="members-expander" style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '20px',
                        overflow: 'hidden', marginTop: '8px', transition: 'all 0.3s ease', position: 'relative'
                    }}>
                        <div className="members-expander-header"
                            style={{
                                padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}
                        >
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Members ({(localGroup.members?.length) || 0})</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {eCanInvite && (
                                    <button
                                        className="icon-circle"
                                        title={showAddMember ? 'Close' : 'Add members'}
                                        onClick={(e) => { e.stopPropagation(); setShowAddMember(v => !v); }}
                                    >
                                        <FiUserPlus size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{
                            maxHeight: '500px',
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '8px' }}>
                                {eCanInvite && showAddMember && (
                                    <div className="add-member-dropdown">
                                        <div className="search-box">
                                            <FiSearch color="var(--text-secondary)" />
                                            <input
                                                type="text"
                                                placeholder="Search friends..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                        <div className="friends-list-mini">
                                            {(() => {
                                                const memberIdSet = new Set((localGroup.members || []).map(m => (typeof m === 'object' ? (m.id ?? m._id) : m)));
                                                return friends
                                                    .filter(f => !memberIdSet.has(f.id))
                                                    .filter(f => (f.username || '').toLowerCase().includes(searchQuery.toLowerCase()))
                                                    .map((friend, index) => (
                                                        <div key={`${friend.id}-${index}`} className="friend-item-mini" onClick={() => handleAddMember(friend.id)}>
                                                            <Avatar src={friend.avatar} alt={friend.username} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://i.pravatar.cc/150?u=${friend.id}`; }} />
                                                            <span>{friend.username}</span>
                                                        </div>
                                                    ));
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Pinned self card (always at top if you're in the group) */}
                                {Array.isArray(localGroup.members) && localGroup.members.some(m => String(m.id) === String(currentUser?.id)) && (
                                    <div className="member-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, width: '100%', boxSizing: 'border-box', margin: '0 auto 8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ position: 'relative', width: 40, height: 40 }}>
                                                <Avatar src={currentUser?.avatar || `https://i.pravatar.cc/150?u=${currentUser?.id}`}
                                                    alt={currentUser?.username || 'You'}
                                                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://i.pravatar.cc/150?u=${currentUser?.id}`; }}
                                                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: onlineUsers.includes(currentUser?.id) ? 'var(--status-online)' : '#ff6b6b', border: '2px solid var(--bg-secondary)' }} />
                                            </div>
                                        </div>
                                        <div className="member-info" style={{ flex: '0 0 auto', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', alignItems: 'flex-start', textAlign: 'left' }}>
                                            <span className="member-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.username || 'You'}</span>
                                            <span className="admin-badge">You</span>
                                            {String(currentUser?.id) === String(localGroup.createdBy) && (
                                                <span title="Creator" style={{
                                                    marginTop: 2,
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    borderRadius: '999px',
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700,
                                                    background: '#ffeb3b',
                                                    color: '#000000',
                                                    letterSpacing: 0.2,
                                                    boxShadow: '0 0 8px rgba(255,255,255,0.25)'
                                                }}>Creator</span>
                                            )}
                                            {(() => {
                                                const memberRoles = localGroup.memberRoles || {};
                                                const rid = memberRoles[currentUser?.id];
                                                // Hide role chip for creator on self pinned card
                                                if (String(currentUser?.id) === String(localGroup.createdBy)) return null;
                                                if (!rid) return null;
                                                const isOnline = onlineUsers.some(u => {

                                                    return String(u) === String(currentUser?.id);
                                                });
                                                const role = rolesArr.find(r => r.id === rid);
                                                if (!role) return null;
                                                return (
                                                    <span style={{
                                                        marginTop: 2,
                                                        display: 'inline-block',
                                                        padding: '2px 6px',
                                                        borderRadius: '999px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 500,
                                                        background: role.color || 'var(--accent-primary)',
                                                        color: '#ffffff',
                                                        maxWidth: 80,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>{role.name}</span>
                                                );
                                            })()}
                                        </div>
                                        {/* No actions for self */}
                                    </div>
                                )}

                                <div className="members-list">
                                    {sortedMembers.map((member, index) => {
                                        const showRoleSelector = eCanAssignRoles && member.id !== currentUser.id && String(member.id) !== String(localGroup.createdBy);
                                        const isOnline = isOnlineId(member.id);
                                        return (
                                            <div key={`${member.id}-${index}`} style={{ position: 'relative', width: '100%', boxSizing: 'border-box', marginBottom: 8, display: 'flex', justifyContent: 'center', paddingTop: showRoleSelector ? 30 : 0 }}>
                                                {/* Absolute role selector outside top-left of card */}
                                                {showRoleSelector && (
                                                    <div style={{ position: 'absolute', top: 0, left: 1, zIndex: 6 }}>
                                                        <select
                                                            value={String((((localGroup.memberRoles || {})[String(member.id)]) ?? ((localGroup.memberRoles || {})[member.id]) ?? ''))}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                const roleObj = (Array.isArray(localGroup.roles) ? localGroup.roles : []).find(r => String(r.id) === String(value));
                                                                const roleId = value ? (roleObj ? roleObj.id : value) : null;
                                                                try {
                                                                    setLocalGroup(prev => {
                                                                        const next = { ...prev, memberRoles: { ...(prev.memberRoles || {}) } };
                                                                        const key = String(member.id);
                                                                        if (roleId) {
                                                                            next.memberRoles[key] = roleId;
                                                                        } else {
                                                                            delete next.memberRoles[key];
                                                                        }
                                                                        return next;
                                                                    });
                                                                    // Track optimistically until server confirms
                                                                    pendingRoleMapRef.current[String(member.id)] = roleId;
                                                                } catch (_) { }
                                                                socket.emit('group_set_member_role', {
                                                                    groupId: localGroup.id,
                                                                    memberId: member.id,
                                                                    roleId,
                                                                    userId: currentUser.id
                                                                });
                                                            }}
                                                            style={{
                                                                padding: '4px 8px',
                                                                borderRadius: '10px',
                                                                border: '1px solid var(--border-color)',
                                                                background: 'var(--bg-secondary)',
                                                                color: 'var(--text-primary)',
                                                                fontSize: '0.8rem',
                                                                fontFamily: 'var(--app-font, inherit)',
                                                                maxWidth: 160,
                                                                boxShadow: '0 6px 18px rgba(0,0,0,0.15)'
                                                            }}
                                                        >
                                                            <option value="">No role</option>
                                                            {(Array.isArray(localGroup.roles) ? localGroup.roles : []).map(r => (
                                                                <option key={r.id} value={String(r.id)}>{r.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}

                                                <div className="member-item tap-scale fade-in-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, width: '100%', boxSizing: 'border-box', margin: '0 auto', cursor: 'pointer' }}
                                                    onClick={() => setSelectedProfile({ id: member.id, username: member.username, avatar: member.avatar })}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ position: 'relative', width: 40, height: 40 }}>
                                                            <Avatar src={member.avatar} alt={member.username} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://i.pravatar.cc/150?u=${member.id}`; }} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                                            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: isOnline ? 'var(--status-online)' : '#ff6b6b', border: '2px solid var(--bg-secondary)' }} />
                                                        </div>
                                                    </div>
                                                    <div className="member-info" style={{ flex: '0 0 auto', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', alignItems: 'flex-start', textAlign: 'left' }}>
                                                        <span className="member-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.username || (friends.find(f => String(f.id) === String(member.id))?.username) || String(member.id)}</span>
                                                        {String(member.id) === String(localGroup.createdBy) ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                                                                <span className="admin-badge">Admin</span>
                                                                <span title="Creator" style={{
                                                                    display: 'inline-block',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '999px',
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: 700,
                                                                    background: '#ffeb3b',
                                                                    color: '#000000',
                                                                    letterSpacing: 0.2,
                                                                    boxShadow: '0 0 8px rgba(255,255,255,0.25)'
                                                                }}>Creator</span>
                                                            </div>
                                                        ) : (
                                                            localGroup.admins?.includes(member.id) && (
                                                                <span className="admin-badge" style={{ alignSelf: 'flex-start' }}>Admin</span>
                                                            )
                                                        )}
                                                        {(() => {
                                                            const roles = Array.isArray(localGroup.roles) ? localGroup.roles : [];
                                                            const memberRoles = localGroup.memberRoles || {};
                                                            const roleId = (memberRoles[String(member.id)] ?? memberRoles[member.id]);
                                                            // Hide 'Owner' role chip for creator; show only Creator bubble above
                                                            if (String(member.id) === String(localGroup.createdBy)) return null;
                                                            if (!roleId) return null;
                                                            const role = roles.find(r => r.id === roleId);
                                                            if (!role) return null;
                                                            return (
                                                                <span style={{
                                                                    marginTop: 2,
                                                                    display: 'inline-block',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '999px',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 500,
                                                                    background: role.color || 'var(--accent-primary)',
                                                                    color: '#ffffff',
                                                                    maxWidth: 80,
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis'
                                                                }}>
                                                                    {role.name}
                                                                </span>
                                                            );
                                                        })()}
                                                        {(() => {
                                                            const bans = localGroup.bans || {};
                                                            const until = bans[member.id];
                                                            const banned = (until === -1) || (typeof until === 'number' && until > Date.now());
                                                            if (!banned) return null;
                                                            const remainingMs = until === -1 ? null : Math.max(0, until - Date.now());
                                                            const mins = remainingMs == null ? null : Math.ceil(remainingMs / 60000);
                                                            return (
                                                                <span style={{ marginTop: 4, display: 'inline-block', padding: '2px 6px', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 600, background: '#ffeded', color: '#cc0000' }}>
                                                                    {mins == null ? 'Banned · permanent' : `Banned · ${mins}m`}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                    {eCanRemove && member.id !== currentUser.id && String(member.id) !== String(localGroup.createdBy) && (
                                                        <div className="member-actions icon-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                            <button
                                                                className={`icon-circle ${localGroup.admins?.includes(member.id) ? 'active-admin' : ''}`}
                                                                title={eCanPromote ? (localGroup.admins?.includes(member.id) ? (member.id === localGroup.createdBy ? 'Owner' : 'Demote from admin') : 'Promote to admin') : 'No permission to change admin'}
                                                                style={localGroup.admins?.includes(member.id)
                                                                    ? { backgroundColor: 'var(--accent-primary)', color: '#ffffff', borderColor: 'var(--accent-primary)' }
                                                                    : undefined}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!eCanPromote) return;
                                                                    const isAdminNow = Array.isArray(localGroup.admins) && localGroup.admins.includes(member.id);
                                                                    if (!isAdminNow) {
                                                                        try { setLocalGroup(prev => ({ ...prev, admins: [...(prev.admins || []), member.id] })); } catch (_) { }
                                                                        pendingAdminAddsRef.current.add(String(member.id));
                                                                        socket.emit('promote_group_admin', { groupId: localGroup.id, memberId: member.id, promotedBy: currentUser.id });
                                                                    } else if (member.id !== localGroup.createdBy) {
                                                                        try { setLocalGroup(prev => ({ ...prev, admins: (prev.admins || []).filter(id => id !== member.id) })); } catch (_) { }
                                                                        pendingAdminRemovesRef.current.add(String(member.id));
                                                                        socket.emit('demote_group_admin', { groupId: localGroup.id, memberId: member.id, demotedBy: currentUser.id });
                                                                    }
                                                                }}
                                                                disabled={(!eCanPromote) || (localGroup.admins?.includes(member.id) && member.id === localGroup.createdBy)}
                                                            >
                                                                <FiShield size={14} color={localGroup.admins?.includes(member.id) ? '#ffffff' : undefined} />
                                                            </button>
                                                            <button
                                                                className="icon-circle danger"
                                                                title={'Remove from group'}
                                                                onClick={(e) => { e.stopPropagation(); if (!eCanRemove) return; handleRemoveMember(member.id); }}
                                                                disabled={!eCanRemove}
                                                            >
                                                                <FiTrash2 size={14} />
                                                            </button>
                                                            {eCanBan && String(member.id) !== String(localGroup.createdBy) && (
                                                                <button
                                                                    className="icon-circle danger"
                                                                    title="Ban/Unban member"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (!eCanBan) return;
                                                                        const bans = localGroup.bans || {};
                                                                        const until = bans[member.id];
                                                                        const banned = (until === -1) || (typeof until === 'number' && until > Date.now());
                                                                        if (banned) {
                                                                            // Inline quick unban
                                                                            try { socket.emit('group_ban_member', { groupId: localGroup.id, memberId: member.id, durationMs: null, userId: currentUser.id }); } catch (_) { }
                                                                        } else {
                                                                            setBanTargetId(member.id);
                                                                            setBanMinutes('60');
                                                                            setBanModalOpen(true);
                                                                        }
                                                                    }}
                                                                >
                                                                    <FiUserX size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="expander-blur-overlay"></div>
                    </div>
                </div>

                {/* Roles Management */}
                <div className="contact-section">
                    <div className="members-expander" style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '20px',
                        overflow: 'hidden', marginTop: '8px', transition: 'all 0.3s ease', position: 'relative'
                    }}>
                        <div className="members-expander-header"
                            style={{
                                padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}
                        >
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Roles ({(Array.isArray(localGroup.roles) ? localGroup.roles.length : 0)})</span>
                        </div>
                        <div style={{
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {(Array.isArray(localGroup.roles) ? localGroup.roles : []).map(r => (
                                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {editRoleId === r.id ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                    <input
                                                        type="text"
                                                        value={editRoleName}
                                                        onChange={(e) => setEditRoleName(e.target.value)}
                                                        style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)' }}
                                                    />
                                                    <input
                                                        type="color"
                                                        value={editRoleColor}
                                                        onChange={(e) => setEditRoleColor(e.target.value)}
                                                        style={{ width: 36, height: 32, borderRadius: 6, border: '1px solid var(--border-color)' }}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const name = (editRoleName || '').trim();
                                                            if (!name) { setEditRoleId(null); return; }
                                                            try {
                                                                setLocalGroup(prev => ({
                                                                    ...prev,
                                                                    roles: (prev.roles || []).map(x => x.id === r.id ? { ...x, name, color: editRoleColor || x.color } : x)
                                                                }));
                                                            } catch (_) { }
                                                            try {
                                                                socket.emit('group_update_role', { groupId: localGroup.id, roleId: r.id, name, color: editRoleColor, userId: currentUser.id });
                                                            } catch (_) { }
                                                            setEditRoleId(null);
                                                        }}
                                                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                                                    >Save</button>
                                                    <button onClick={() => setEditRoleId(null)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span title={r.name} style={{
                                                        display: 'inline-block', padding: '4px 10px', borderRadius: '999px',
                                                        background: r.color || 'var(--bg-secondary)', color: '#fff',
                                                        fontSize: '0.75rem', fontWeight: 600, maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                    }}>{r.name}</span>
                                                    {(isOwnerMe || (isAdmin && adminFullEnabled)) && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            {!DEFAULT_ROLE_IDS.includes(r.id) && (
                                                                <button
                                                                    className="icon-circle danger"
                                                                    title="Delete role"
                                                                    onClick={() => {
                                                                        try {
                                                                            setLocalGroup(prev => ({
                                                                                ...prev,
                                                                                roles: (prev.roles || []).filter(x => x.id !== r.id),
                                                                                memberRoles: Object.fromEntries(Object.entries(prev.memberRoles || {}).filter(([_, val]) => val !== r.id))
                                                                            }));
                                                                        } catch (_) { }
                                                                        try { socket.emit('group_delete_role', { groupId: localGroup.id, roleId: r.id, userId: currentUser.id }); } catch (_) { }
                                                                    }}
                                                                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                >
                                                                    <FiTrash2 size={14} />
                                                                </button>
                                                            )}
                                                            <button
                                                                className="icon-circle"
                                                                title="Edit role"
                                                                onClick={() => { setEditRoleId(r.id); setEditRoleName(r.name || ''); setEditRoleColor(r.color || '#6b7280'); }}
                                                                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            >
                                                                <FiEdit2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    {(Array.isArray(localGroup.roles) ? localGroup.roles : []).length === 0 && (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No roles yet</span>
                                    )}
                                </div>

                                {(isOwnerMe || (isAdmin && adminFullEnabled)) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <input
                                            type="text"
                                            placeholder="Role name"
                                            value={newRoleName}
                                            onChange={(e) => setNewRoleName(e.target.value)}
                                            style={{ flex: '1 1 160px', minWidth: 140, padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)' }}
                                        />
                                        <input
                                            type="color"
                                            value={newRoleColor}
                                            onChange={(e) => setNewRoleColor(e.target.value)}
                                            title="Pick color"
                                            style={{ width: 44, height: 36, border: '1px solid var(--border-color)', borderRadius: 8, background: 'transparent', padding: 0 }}
                                        />
                                        <button
                                            onClick={() => {
                                                const name = (newRoleName || '').trim();
                                                if (!name) return;
                                                const id = 'role-' + Date.now();
                                                try {
                                                    // Optimistic update with the same ID used for the server
                                                    setLocalGroup(prev => ({
                                                        ...prev,
                                                        roles: [...(Array.isArray(prev.roles) ? prev.roles : []), { id, name, color: newRoleColor || '#6b7280' }]
                                                    }));
                                                } catch (_) { }
                                                try {
                                                    socket.emit('group_add_role', {
                                                        groupId: localGroup.id,
                                                        id,
                                                        name,
                                                        color: newRoleColor || '#6b7280',
                                                        userId: currentUser.id
                                                    });
                                                } catch (_) { }
                                                setNewRoleName('');
                                            }}
                                            style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                                        >
                                            Add Role
                                        </button>
                                    </div>
                                )}

                                {(isOwnerMe || (isAdmin && adminFullEnabled)) && (
                                    <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 6 }}>Role Permissions</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {(Array.isArray(localGroup.roles) ? localGroup.roles : []).map(r => {
                                                const perms = (localGroup.rolePermissions || {})[r.id] || {};
                                                const permKeys = Object.keys(perms);
                                                return (
                                                    <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--border-color)', borderRadius: 15, padding: '8px 10px', background: (document?.documentElement?.getAttribute('data-theme') === 'light' ? '#ECEFF3' : '#2a2a2aff') }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: r.color || '#999' }}></span>
                                                                <span style={{ fontSize: '0.85rem' }}>{r.name}</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                            {permKeys.length === 0 && (
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No permissions added</span>
                                                            )}
                                                            {permKeys.map(key => (
                                                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                                                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!perms[key]}
                                                                            onChange={(e) => {
                                                                                const val = e.target.checked;
                                                                                try {
                                                                                    setLocalGroup(prev => {
                                                                                        const next = { ...prev, rolePermissions: { ...(prev.rolePermissions || {}) } };
                                                                                        next.rolePermissions[r.id] = { ...(next.rolePermissions[r.id] || {}), [key]: val };
                                                                                        return next;
                                                                                    });
                                                                                } catch (_) { }
                                                                                try {
                                                                                    socket.emit('group_update_role_permissions', {
                                                                                        groupId: localGroup.id,
                                                                                        roleId: r.id,
                                                                                        permissions: { [key]: val },
                                                                                        userId: currentUser.id
                                                                                    });
                                                                                } catch (_) { }
                                                                            }}
                                                                        />
                                                                        <span>{key}</span>
                                                                    </label>
                                                                    <button
                                                                        className="icon-circle danger"
                                                                        title="Remove permission"
                                                                        onClick={() => {
                                                                            try {
                                                                                setLocalGroup(prev => {
                                                                                    const next = { ...prev, rolePermissions: { ...(prev.rolePermissions || {}) } };
                                                                                    const rolePerms = { ...(next.rolePermissions[r.id] || {}) };
                                                                                    delete rolePerms[key];
                                                                                    next.rolePermissions[r.id] = rolePerms;
                                                                                    return next;
                                                                                });
                                                                            } catch (_) { }
                                                                            try {
                                                                                socket.emit('group_update_role_permissions', {
                                                                                    groupId: localGroup.id,
                                                                                    roleId: r.id,
                                                                                    permissions: { [key]: null },
                                                                                    userId: currentUser.id
                                                                                });
                                                                            } catch (_) { }
                                                                        }}
                                                                        style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                    >
                                                                        <FiTrash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                            <button
                                                                onClick={() => { setPermModalRoleId(r.id); setPermModalOpen(true); }}
                                                                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
                                                            >
                                                                Add from list
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="expander-blur-overlay"></div>
                    </div>
                </div>

                <div className="section-divider"></div>

                {/* Permission Catalog Modal */}
                {permModalOpen && (isOwnerMe || (isAdmin && adminFullEnabled)) && (
                    <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 99999 }}
                        onClick={(e) => { /* do not close on backdrop click */ e.stopPropagation(); }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'var(--bg-panel)',
                                borderTop: '1px solid var(--border-color)',
                                borderLeft: '1px solid var(--border-color)',
                                borderRight: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Permission Catalog</div>
                                    {(() => {
                                        const rid = permModalRoleId;
                                        const role = (Array.isArray(localGroup.roles) ? localGroup.roles : []).find(r => r.id === rid);
                                        if (!role) return null;
                                        return <span style={{ padding: '4px 10px', borderRadius: 999, background: role.color || 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>{role.name}</span>;
                                    })()}
                                </div>
                                {/* No close (X) button to prevent accidental dismiss */}
                            </div>

                            {/* Body */}
                            <div style={{ padding: '14px 18px', flex: 1, overflow: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                                    {PERMISSION_CATALOG.map(item => {
                                        const rid = permModalRoleId;
                                        const checked = !!(permDraft && permDraft.roleId === rid && permDraft.perms && permDraft.perms[item.key]);
                                        return (
                                            <label key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-secondary)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                    <span style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.key}</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const val = e.target.checked;
                                                        setPermDraft(prev => {
                                                            const base = prev && prev.roleId === rid ? prev.perms : (((localGroup.rolePermissions || {})[rid]) || {});
                                                            return { roleId: rid, perms: { ...base, [item.key]: val } };
                                                        });
                                                    }}
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button
                                    onClick={() => {
                                        const rid = permModalRoleId;
                                        const draft = permDraft && permDraft.roleId === rid ? (permDraft.perms || {}) : {};
                                        const current = ((localGroup.rolePermissions || {})[rid]) || {};
                                        const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(draft)]));

                                        // Apply to local state first (no sidebar closing)
                                        try {
                                            setLocalGroup(prev => {
                                                const next = { ...prev, rolePermissions: { ...(prev.rolePermissions || {}) } };
                                                const merged = { ...current };
                                                keys.forEach(k => {
                                                    const v = draft.hasOwnProperty(k) ? draft[k] : current[k];
                                                    if (v == null || v === false) delete merged[k]; else merged[k] = !!v;
                                                });
                                                next.rolePermissions[rid] = merged;
                                                return next;
                                            });
                                        } catch (_) { }

                                        // Emit diffs to server
                                        try {
                                            keys.forEach(k => {
                                                const before = !!current[k];
                                                const after = !!draft[k];
                                                if (before !== after) {
                                                    socket.emit('group_update_role_permissions', {
                                                        groupId: localGroup.id,
                                                        roleId: rid,
                                                        permissions: { [k]: after },
                                                        userId: currentUser.id
                                                    });
                                                }
                                            });
                                        } catch (_) { }

                                        setPermModalOpen(false);
                                    }}
                                    style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Media Section */}
                {/* Media Section */}
                <div className="contact-section">
                    <div className="section-header media-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                        <h4 className="media-title" style={{ display: 'flex', alignItems: 'center' }}>Media, Links and Docs</h4>
                        <div className="count-with-arrow" style={{ alignItems: 'center' }}>
                            <span className="count-text">{mediaMessages.length + (links?.length || 0)}</span>
                        </div>
                    </div>
                    <div className="media-tabs-container" style={{ paddingBottom: '16px' }}>
                        <div className="media-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', margin: '0 16px 12px' }}>
                            <div className={`media-tab ${mediaTab === 'media' ? 'active' : ''}`} onClick={() => setMediaTab('media')} style={{ flex: 1, textAlign: 'center', padding: '8px', cursor: 'pointer', fontSize: '0.9rem', color: mediaTab === 'media' ? 'var(--accent-primary)' : 'var(--text-secondary)', borderBottom: mediaTab === 'media' ? '2px solid var(--accent-primary)' : '2px solid transparent' }}>Media</div>
                            <div className={`media-tab ${mediaTab === 'docs' ? 'active' : ''}`} onClick={() => setMediaTab('docs')} style={{ flex: 1, textAlign: 'center', padding: '8px', cursor: 'pointer', fontSize: '0.9rem', color: mediaTab === 'docs' ? 'var(--accent-primary)' : 'var(--text-secondary)', borderBottom: mediaTab === 'docs' ? '2px solid var(--accent-primary)' : '2px solid transparent' }}>Docs</div>
                            <div className={`media-tab ${mediaTab === 'links' ? 'active' : ''}`} onClick={() => setMediaTab('links')} style={{ flex: 1, textAlign: 'center', padding: '8px', cursor: 'pointer', fontSize: '0.9rem', color: mediaTab === 'links' ? 'var(--accent-primary)' : 'var(--text-secondary)', borderBottom: mediaTab === 'links' ? '2px solid var(--accent-primary)' : '2px solid transparent' }}>Links</div>
                        </div>
                        <div className="media-content" style={{ padding: '0 16px' }}>
                            {mediaTab === 'media' && (
                                <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                    {mediaMessages.filter(msg => msg.file?.type?.startsWith('image') || msg.file?.type?.startsWith('video')).map((msg, index) => (
                                        <div key={index} className="media-grid-item" style={{ aspectRatio: '1', overflow: 'hidden', borderRadius: '8px', background: 'var(--bg-secondary)' }}>
                                            {msg.file.type.startsWith('image') ? (
                                                <img src={msg.file.url} alt="media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <video src={msg.file.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            )}
                                        </div>
                                    ))}
                                    {mediaMessages.filter(msg => msg.file?.type?.startsWith('image') || msg.file?.type?.startsWith('video')).length === 0 && (
                                        <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '20px 0' }}>No media</p>
                                    )}
                                </div>
                            )}
                            {mediaTab === 'docs' && (
                                <div className="docs-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {mediaMessages.filter(msg => !msg.file?.type?.startsWith('image') && !msg.file?.type?.startsWith('video')).map((msg, index) => (
                                        <div key={index} className="doc-item" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)' }}>
                                            <div className="doc-icon" style={{ width: '32px', height: '32px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><FiFile /></div>
                                            <div className="doc-info" style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span className="doc-name" style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{msg.file.name}</span>
                                                <span className="doc-date" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{msg.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {mediaMessages.filter(msg => !msg.file?.type?.startsWith('image') && !msg.file?.type?.startsWith('video')).length === 0 && (
                                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '12px 0' }}>No documents</p>
                                    )}
                                </div>
                            )}
                            {mediaTab === 'links' && (
                                <div className="links-list" style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {Array.isArray(links) && links.length > 0 ? (
                                        links.map((url, idx) => (
                                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '8px 10px', borderRadius: '10px',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                                textDecoration: 'none', overflow: 'hidden'
                                            }}>
                                                <span style={{
                                                    width: '28px', height: '28px', borderRadius: '6px',
                                                    background: 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'var(--text-secondary)'
                                                }}>🔗</span>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                                            </a>
                                        ))
                                    ) : (
                                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No links found</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Starred Messages Expander */}
                <div className="contact-section" style={{ marginBottom: '16px' }}>
                    <div className="members-expander" style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '20px',
                        overflow: 'hidden', marginTop: '8px', transition: 'all 0.3s ease', position: 'relative',
                        background: 'transparent'
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
                                                    socket.emit('unstar_all_messages', { room: room || localGroup.id, userId: currentUser.id });
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
                            maxHeight: '500px',
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '0' }}>
                                <div className="members-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 15px' }}>
                                    {starredMessages.length > 0 ? (
                                        starredMessages.map(msg => (
                                            <div key={msg.id} className="starred-card" style={{
                                                padding: '10px 10px',
                                                borderRadius: '12px',
                                                background: (document?.documentElement?.getAttribute('data-theme') === 'light' ? '#ececec' : 'rgba(255, 255, 255, 0.08)'),
                                                border: (document?.documentElement?.getAttribute('data-theme') === 'light' ? 'none' : '1px solid var(--border-color)'),
                                                cursor: 'pointer', position: 'relative', width: '100%', boxSizing: 'border-box'
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
                                                        socket.emit('star_message', { room: room || localGroup.id, msgId: msg.id, action: 'unstar', userId: currentUser.id });
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
                                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '8px' }}>No starred messages</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="expander-blur-overlay"></div>
                    </div>
                </div>

                <div className="section-divider"></div>

                {/* Mute Notifications */}
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
                            <LiquidToggle
                                checked={isMuted}
                                onChange={(enabled) => { setIsMuted(enabled); try { localStorage.setItem(`mute_group_${localGroup.id}`, String(enabled)); window.dispatchEvent(new Event('force_sidebar_refresh')); } catch (_) { } }}
                            />
                        </div>
                    </div>
                    {/* Disappearing Messages Toggle Box */}
                    {eCanChangeSlowMode && (
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
                                        onChange={(enabled) => {
                                            setDisappearingEnabled(enabled);
                                            try { localStorage.setItem(`dm_expanded_group_${localGroup.id}`, String(!!enabled)); } catch (_) { }
                                            try { localStorage.setItem(`dm_enabled_group_${localGroup.id}`, String(enabled)); } catch (_) { }
                                            if (enabled) {
                                                try { window.dispatchEvent(new CustomEvent('disappearing_toggle', { detail: { scope: 'group', enabled: true, targetId: localGroup.id, targetName: localGroup.name, actor: currentUser?.username } })); } catch (_) { }
                                                try {
                                                    const now = Date.now();
                                                    const sys = { id: 'sys-' + now + '-' + Math.random().toString(36).substr(2, 9), room: room || localGroup.id, author: currentUser?.username || 'system', message: `⏳ ${currentUser?.username || 'Someone'} turned on disappearing messages`, file: null, time: new Date(now).getHours() + ':' + new Date(now).getMinutes(), reactions: {}, replyTo: null, isRead: false, justSent: true, to: localGroup.id, timestamp: now, type: 'system' };
                                                    socket && socket.emit('send_message', sys);
                                                } catch (_) { }
                                            }
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
                                                    if (!eCanChangeSlowMode) return;
                                                    setDisappearingDuration(opt.key);
                                                    try { localStorage.setItem(`dm_duration_group_${localGroup.id}`, opt.key); } catch (_) { }
                                                    try { window.dispatchEvent(new CustomEvent('disappearing_duration_update', { detail: { scope: 'group', targetId: localGroup.id, key: opt.key } })); } catch (_) { }
                                                    try {
                                                        const now = Date.now();
                                                        const sys = { id: 'sys-' + now + '-' + Math.random().toString(36).substr(2, 9), room: room || localGroup.id, author: currentUser?.username || 'system', message: `⏳ ${currentUser?.username || 'Someone'} set disappearing to ${opt.label}`, file: null, time: new Date(now).getHours() + ':' + new Date(now).getMinutes(), reactions: {}, replyTo: null, isRead: false, justSent: true, to: localGroup.id, timestamp: now, type: 'system' };
                                                        socket && socket.emit('send_message', sys);
                                                    } catch (_) { }
                                                }}
                                                style={{
                                                    padding: '8px', borderRadius: '10px', textAlign: 'center',
                                                    border: '1px solid var(--border-color)', background: disappearingDuration === opt.key ? 'var(--accent-light)' : 'var(--bg-card)',
                                                    color: disappearingDuration === opt.key ? 'var(--accent-primary)' : 'var(--text-primary)', cursor: eCanChangeSlowMode ? 'pointer' : 'not-allowed',
                                                    opacity: eCanChangeSlowMode ? 1 : 0.6, fontSize: '0.85rem', fontWeight: disappearingDuration === opt.key ? 600 : 400
                                                }}
                                            >{opt.label}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


                    {/* Slow Mode Controls */}
                    {eCanChangeSlowMode && (
                        <div className="option-item" style={{
                            display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderRadius: '18px', marginBottom: '16px', overflow: 'hidden'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', height: '56px' }}>
                                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', flexShrink: 0 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: slowSeconds > 0 ? '#a855f7' : '#a855f7', opacity: slowSeconds > 0 ? 1 : 0.5 }}></div>
                                    </div>
                                    <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        Slow Mode {slowSeconds > 0 ? `• ${slowSeconds}s` : ''}
                                    </span>
                                </div>
                                <div style={{ flexShrink: 0 }}>
                                    <LiquidToggle
                                        checked={slowSeconds > 0}
                                        onChange={(enabled) => {
                                            if (!eCanChangeSlowMode) return;
                                            if (!enabled) applySlowMode(0); else applySlowMode(slowSeconds || 10);
                                        }}
                                        disabled={!eCanChangeSlowMode}
                                    />
                                </div>
                            </div>
                            {slowSeconds > 0 && (
                                <div style={{ padding: '0 12px 12px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {[5, 10, 30, 60].map(sec => (
                                        <button key={sec} onClick={() => eCanChangeSlowMode && applySlowMode(sec)} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: slowSeconds === sec ? 'var(--accent-primary)' : 'var(--bg-card)', color: 'var(--text-primary)', cursor: eCanChangeSlowMode ? 'pointer' : 'not-allowed', opacity: eCanChangeSlowMode ? 1 : 0.6 }}>{sec}s</button>
                                    ))}
                                    <button onClick={() => eCanChangeSlowMode && applySlowMode(0)} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: slowSeconds === 0 ? 'var(--accent-primary)' : 'var(--bg-card)', color: 'var(--text-primary)', cursor: eCanChangeSlowMode ? 'pointer' : 'not-allowed', opacity: eCanChangeSlowMode ? 1 : 0.6 }}>Off</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Admins Full Permissions (Owner only) */}
                    {isOwnerMe && (
                        <div className="option-item" style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', height: '56px',
                            background: 'var(--bg-secondary)', borderRadius: '18px', marginBottom: '16px'
                        }}>
                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', flexShrink: 0 }}><FiShield size={18} /></div>
                                <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    Admin full access
                                </span>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                                <LiquidToggle
                                    checked={adminFullEnabled}
                                    onChange={(val) => {
                                        try { socket.emit('group_toggle_admin_full', { groupId: localGroup.id, enabled: !!val, userId: currentUser.id }); } catch (_) { }
                                        // Optimistic update
                                        setLocalGroup(prev => ({ ...prev, settings: { ...(prev.settings || {}), adminFullPermissionsEnabled: !!val } }));
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Admin-Only Chat Toggle */}
                    {isAdmin && (
                        <div className="option-item" style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', height: '56px',
                            background: 'var(--bg-secondary)', borderRadius: '18px', marginBottom: '16px'
                        }}>
                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', flexShrink: 0 }}><FiShield size={18} /></div>
                                <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    Admin Only Chat
                                </span>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                                <LiquidToggle
                                    checked={localGroup.adminOnlyChat || false}
                                    onChange={(enabled) => {
                                        socket.emit('toggle_admin_only_chat', {
                                            groupId: localGroup.id,
                                            enabled,
                                            userId: currentUser.id
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="section-divider"></div>

                <div className="group-actions-footer">
                    {!localGroup.isAnnouncementGroup && (
                        <>
                            <button className="footer-btn delete-subtle" onClick={handleLeaveGroup}>
                                <FiLogOut size={18} /> Exit Group
                            </button>
                            {isAdmin && (
                                <button className="footer-btn delete-strong" onClick={handleRemoveGroup}>
                                    <FiTrash2 size={18} /> Remove Group
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Confirmation Modal */}
                {
                    showConfirmModal && modalAction && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10000
                        }}>
                            <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    maxWidth: '400px',
                                    width: '90%',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                                }}>
                                <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                                    Confirm Action
                                </h3>
                                <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                    {modalAction.message}
                                </p>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => {
                                            setShowConfirmModal(false);
                                            setModalAction(null);
                                        }}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'transparent',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={modalAction.onConfirm}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: 'var(--accent-primary)',
                                            color: '#ffffff',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: 600
                                        }}
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                            ```
                        </div>
                    )
                }
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
                    padding: 0 25px;
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
                    margin-left: -25px;
                    margin-right: -25px;
                    padding-left: 25px;
                    padding-right: 25px;
                }
                .contact-header::after {
                    content: '';
                    position: absolute;
                    left: 25px;
                    right: 25px;
                    bottom: 0;
                    height: 1px;
                    background: var(--border-color);
                }
                [data-theme='light'] .contact-info-sidebar .contact-header { background: transparent; }
                [data-theme='dark'] .contact-info-sidebar .contact-header { background: transparent; }
                .contact-header h3 { margin: 0; color: var(--text-primary); font-size: 1.3rem; font-weight: var(--font-weight-bold); }
                .panel-label { display: none; }
                .panel-label {
                    padding: 10px 0 6px;
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                    letter-spacing: 0.02em;
                }
                .close-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                }
                .group-profile {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 24px 0;
                    text-align: center;
                }
                .group-avatars-container {
                    position: relative;
                    width: 100px;
                    height: 80px;
                    margin-bottom: 16px;
                    display: flex;
                    justify-content: center;
                }
                .group-header-avatar {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    border: 2px solid #808080;
                    position: absolute;
                    object-fit: cover;
                    box-shadow: 2px 6px 10px rgba(0,0,0,0.45);
                }
                .group-name-display {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    justify-content: center;
                }
                .group-name-display h2 {
                    margin: 0;
                    font-size: 1.4rem;
                    color: var(--text-primary);
                    font-family: var(--font-family);
                    font-weight: var(--font-weight-bold);
                    letter-spacing: 0.01em;
                    line-height: 1.2;
                }
                .group-photo-controls button,
                .group-photo-controls label {
                    font-family: var(--font-family);
                    font-size: 0.95rem;
                    font-weight: var(--font-weight-medium);
                    color: var(--text-primary);
                }
                [data-theme='dark'] .group-photo-controls button,
                [data-theme='dark'] .group-photo-controls label {
                    color: #ffffff;
                }
                /* Unify font rendering to match app */
                .group-profile, .group-name-display h2, .group-meta, .group-photo-controls button, .group-photo-controls label {
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    text-rendering: optimizeLegibility;
                }
                @media (prefers-color-scheme: dark) {
                    .group-name-display h2 { color: #ffffff; }
                    .group-meta { color: #ffffff; }
                }
                .edit-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 4px;
                }
                .edit-name-container {
                    display: flex;
                    gap: 8px;
                    justify-content: center;
                }
                .edit-name-container input {
                    padding: 8px;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-input);
                    color: var(--text-primary);
                }
                .group-meta {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    margin-top: 4px;
                    font-weight: var(--font-weight-regular);
                    letter-spacing: 0.02em;
                    font-family: var(--font-family);
                    line-height: 1.3;
                }
                .section-divider {
                    height: 1px;
                    background: var(--border-color);
                    margin: 14px 0; /* equal vertical spacing between sections */
                    border: none;
                }
                .count-with-arrow {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    line-height: 1;
                }
                .count-with-arrow .arrow-anim { display: inline-flex; opacity: 0.85; transition: transform 0.2s ease; }
                .count-with-arrow .arrow-anim.right { transform: rotate(0deg); }
                .count-with-arrow .arrow-anim.down { transform: rotate(90deg); }
                .count-with-arrow svg { display: block; }
                .media-header .media-title { margin: 0; line-height: 1; }
                @keyframes nudgeRight {
                    0% { transform: translateX(0); opacity: 0.6; }
                    50% { transform: translateX(3px); opacity: 1; }
                    100% { transform: translateX(0); opacity: 0.6; }
                }
                .contact-section {
                    padding: 12px 0;
                }
                .contact-section h4 {
                    margin: 0 0 12px;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    font-weight: var(--font-weight-regular);
                }
                .card {
                    background: var(--bg-panel);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 12px;
                    box-shadow: var(--shadow-card, 0 4px 12px rgba(0,0,0,0.12));
                }
                .section-header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                .add-member-btn {
                    background: var(--bg-secondary);
                    border: none;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: var(--accent-primary);
                }
                .add-member-dropdown {
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    padding: 12px;
                    margin-bottom: 16px;
                    animation: fadeIn 0.2s;
                }
                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--bg-input);
                    padding: 8px;
                    border-radius: 8px;
                    margin-bottom: 8px;
                }
                .search-box input {
                    background: none;
                    border: none;
                    color: var(--text-primary);
                    width: 100%;
                    outline: none;
                }
                .friends-list-mini {
                    max-height: 150px;
                    overflow-y: auto;
                }
                .friend-item-mini {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px;
                    cursor: pointer;
                    border-radius: 8px;
                }
                .friend-item-mini:hover {
                    background: rgba(0,0,0,0.05);
                }
                .friend-item-mini img {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                }
                .members-list {
                    display: flex;
                    flex-direction: column;
                    align-items: center; /* center cards */
                    gap: 10px;
                    padding: 8px 8px 12px;
                    overflow-y: auto;
                    padding-right: 4px;
                    width: 100%;
                    margin: 0 auto;
                    scrollbar-gutter: stable both-edges;
                    max-height: 240px; /* ~3 cards */
                }
                .members-list::-webkit-scrollbar { /* Chrome/Safari */
                    width: 6px;
                    height: 6px;
                }
                .members-list::-webkit-scrollbar-track { background: transparent; }
                .members-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 8px; }
                [data-theme='dark'] .members-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); }
                [data-theme='dark'] .members-list::-webkit-scrollbar-track { background: transparent; }
                /* Firefox */
                .members-list { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.2) transparent; }
                [data-theme='dark'] .members-list { scrollbar-color: rgba(255,255,255,0.25) transparent; }
                .member-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 16px;
                    background: #ececec; /* slightly darker than expander in light mode */
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    box-shadow: 0 6px 12px rgba(0,0,0,0.5);
                    width: 92%;
                    max-width: 360px;
                    margin-left: 8px;
                    margin-right: auto;
                    box-sizing: border-box; /* include padding in width */
                    transition: box-shadow 0.25s ease, transform 0.15s ease;
                }
                .member-item:hover { box-shadow: 0 12px 28px rgba(0,0,0,0.35); }
                [data-theme='dark'] .member-item { background: #262626; }
                /* Softer shadows in light mode */
                [data-theme='light'] .member-item { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
                [data-theme='light'] .member-item:hover { box-shadow: 0 6px 14px rgba(0,0,0,0.16); }
                @media (prefers-color-scheme: light) {
                    .member-item { background: #ececec; }
                }
                .member-item img {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 2px solid #808080;
                }
                /* Collapsed members stack preview */
                .members-collapsed-stack {
                    position: relative;
                    height: 40px;
                    margin: 8px 16px 12px;
                }
                .members-collapsed-stack img {
                    position: absolute;
                    width: 34px;
                    height: 34px;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 2px solid #808080;
                    box-shadow: 2px 6px 10px rgba(0,0,0,0.35);
                    top: 3px;
                }
                .members-collapsed-stack .more-badge {
                    position: absolute;
                    top: 4px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 34px;
                    height: 34px;
                    border-radius: 50%;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    font-size: 0.75rem;
                    border: 1px solid var(--border-color);
                    box-shadow: 2px 6px 10px rgba(0,0,0,0.25);
                }
                /* Expand/collapse transition wrapper */
                .members-list-wrapper {
                    max-height: 0;
                    opacity: 0;
                    overflow: hidden;
                    transition: max-height 0.35s ease, opacity 0.25s ease;
                }
                .members-list-wrapper.open {
                    max-height: 1200px; /* plenty to show list */
                    opacity: 1;
                }
                .member-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .member-name {
                    font-weight: var(--font-weight-regular);
                    color: var(--text-primary);
                    font-size: 1rem;
                }
                /* Add-member dropdown item shadow */
                .friend-item-mini {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 10px;
                    border: 1px solid var(--border-color);
                    background: #ececec; /* match member card contrast in light mode */
                    border-radius: 10px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.18);
                    cursor: pointer;
                    margin: 0 auto 8px;
                    width: 92%;
                    transition: box-shadow 0.25s ease, transform 0.15s ease;
                }
                .friend-item-mini:hover { box-shadow: 0 8px 18px rgba(0,0,0,0.22); }
                [data-theme='light'] .friend-item-mini { box-shadow: 0 1px 4px rgba(0,0,0,0.10); }
                [data-theme='light'] .friend-item-mini:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.14); }
                [data-theme='dark'] .friend-item-mini { background: #262626; }
                .friend-item-mini img {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                /* Right-side icon actions */
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
                    transition: background 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                }
                .icon-circle:hover { background: var(--bg-secondary); }
                .icon-circle:active { transform: scale(0.96); }
                .icon-circle.danger { color: #ff6b6b; border-color: rgba(255,107,107,0.4); }
                .icon-circle.danger:hover { background: rgba(255,107,107,0.12); }
                .icon-circle.active-admin { color: var(--accent-primary); border-color: var(--accent-primary); box-shadow: 0 3px 10px rgba(73,73,238,0.3); }
                .admin-badge {
                    font-size: 0.7rem;
                    color: var(--accent-primary);
                    background: var(--accent-light);
                    padding: 2px 6px;
                    border-radius: 4px;
                    align-self: flex-start;
                    margin-top: 2px;
                }
                .icon-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 4px;
                }
                .dropdown {
                    position: relative;
                    display: inline-block;
                }
                .dropdown-content {
                    display: none;
                    position: absolute;
                    right: 0;
                    background-color: var(--bg-panel);
                    min-width: 120px;
                    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
                    z-index: 1;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .dropdown:hover .dropdown-content {
                    display: block;
                }
                .dropdown-content button {
                    color: var(--text-primary);
                    padding: 12px 16px;
                    text-decoration: none;
                    display: block;
                    width: 100%;
                    text-align: left;
                    background: none;
                    border: none;
                    cursor: pointer;
                }
                .dropdown-content button:hover {
                    background-color: var(--bg-secondary);
                }
                .dropdown-content button.danger {
                    color: #ff6b6b;
                }
                /* Members Expander theme alignment */
                [data-theme='light'] .members-expander { background: var(--bg-panel); border-color: rgba(0,0,0,0.06); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
                [data-theme='light'] .members-expander-header { background: inherit; }
                [data-theme='dark'] .members-expander {
                    background: #1d1d1dff;
                    border-color: rgba(255,255,255,0.08);
                    box-shadow: 0 10px 15px rgba(0,0,0,0.35);
                }
                [data-theme='dark'] .members-expander-header {
                    background: inherit;
                }
                /* Starred card backgrounds */
                [data-theme='light'] .contact-info-sidebar .starred-card { background: rgba(0,0,0,0.04); }
                [data-theme='dark'] .contact-info-sidebar .starred-card { background: #212121; }
                .contact-footer {
                    padding: 24px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
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
            `}</style>
            </div>
            <div className="blur-fade-bottom" />
            <div className="blur-fade-top" />
        </div >
    );
};

export default GroupInfo;
