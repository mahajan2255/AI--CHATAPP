import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import NavigationRail from './components/NavigationRail';
import Login from './components/Login';
import Register from './components/Register';


import Settings from './components/Settings';
import Stories from './components/Stories';
import ContactInfo from './components/ContactInfo';
import GroupInfo from './components/GroupInfo';
import CommunityInfo from './components/CommunityInfo';
import ChannelInfo from './components/ChannelInfo';
import ChannelStats from './components/ChannelStats';
import CallsPanel from './components/CallsPanel';
import DraggableCallPopup from './components/DraggableCallPopup';
import { useWebRTC } from './hooks/useWebRTC';
import './index.css';

const socket = io.connect(`http://${window.location.hostname}:3001`);

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // chat, status, settings
  const [viewingStats, setViewingStats] = useState(false);
  const [view, setView] = useState('login'); // login, register, app
  const [room, setRoom] = useState("");
  const [currentChat, setCurrentChat] = useState(null); // Friend object
  const [statusList, setStatusList] = useState([]);
  const [theme, setTheme] = useState(localStorage.getItem('chat_theme') || 'light');
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [channels, setChannels] = useState([]);
  const [mediaSummary, setMediaSummary] = useState({ media: [], docs: [], links: [] });

  // Per-key debounce timestamps to avoid rapid double increments
  const unseenDebounceRef = useRef({});

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    try {
      const val = localStorage.getItem('chat_accent');
      if (val) {
        const root = document.documentElement;
        const hexToRgba = (hex, alpha) => {
          let h = (hex || '').replace('#', '');
          if (h.length === 8) h = h.substring(0, 6);
          if (h.length === 3) h = h.split('').map(c => c + c).join('');
          const r = parseInt(h.substring(0, 2), 16) || 0;
          const g = parseInt(h.substring(2, 4), 16) || 0;
          const b = parseInt(h.substring(4, 6), 16) || 0;
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        root.style.setProperty('--accent-primary', val);
        root.style.setProperty('--accent-light', hexToRgba(val, 0.15));
        window.dispatchEvent(new Event('force_sidebar_refresh'));
      }
    } catch (_) { }
  }, []);

  // Refresh group member avatars/usernames when friends list updates
  useEffect(() => {
    if (!Array.isArray(groups) || groups.length === 0) return;
    const norm = (arr) => (arr || []).map(m => {
      const id = (m && typeof m === 'object') ? (m.id ?? m._id ?? m) : m;
      const fr = (friends || []).find(f => String(f.id) === String(id));
      const username = fr?.username || (typeof m === 'object' ? (m.username || m.name || String(id)) : String(id));
      const avatar = fr?.avatar || (typeof m === 'object' ? (m.avatar || `https://i.pravatar.cc/150?u=${id}`) : `https://i.pravatar.cc/150?u=${id}`);
      return { id, username, avatar };
    });
    setGroups(prev => (Array.isArray(prev) ? prev.map(g => ({ ...g, members: norm(g.members) })) : prev));
  }, [friends]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('chat_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const fetchFriends = async (userId) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3001/friends/list/${userId}`);
      const data = await res.json();
      setFriends(data);
    } catch (err) { }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setView('app');
    // Re-apply persisted theme and accent on login
    try {
      const persistedTheme = localStorage.getItem('chat_theme');
      if (persistedTheme && (persistedTheme === 'light' || persistedTheme === 'dark')) {
        setTheme(persistedTheme);
        document.documentElement.setAttribute('data-theme', persistedTheme);
      }
      const val = localStorage.getItem('chat_accent');
      if (val) {
        const root = document.documentElement;
        const hexToRgba = (hex, alpha) => {
          let h = (hex || '').replace('#', '');
          if (h.length === 8) h = h.substring(0, 6);
          if (h.length === 3) h = h.split('').map(c => c + c).join('');
          const r = parseInt(h.substring(0, 2), 16) || 0;
          const g = parseInt(h.substring(2, 4), 16) || 0;
          const b = parseInt(h.substring(4, 6), 16) || 0;
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        root.style.setProperty('--accent-primary', val);
        root.style.setProperty('--accent-light', hexToRgba(val, 0.15));
        window.dispatchEvent(new Event('force_sidebar_refresh'));
      }
    } catch (_) { }
    socket.emit("join_room", userData.id); // Join own room for notifications
    socket.emit("get_stories"); // fetch latest stories immediately
    fetchFriends(userData.id);
    socket.emit("get_groups", userData.id);
    socket.emit("get_communities", userData.id);
    socket.emit("get_channels", userData.id);
  };

  const handleLogout = () => {
    if (user) {
      socket.emit("logout", user.id);
    }
    setUser(null);
    setView('login');
    setCurrentChat(null);
    setActiveTab('chat');
  };

  const [unseenMessages, setUnseenMessages] = useState({}); // { key -> { count, time } }; key = groupId | username
  const [onlineUsers, setOnlineUsers] = useState([]); // List of online user IDs

  // --- Global Call State ---
  const [callState, setCallState] = useState(null); // { type: 'incoming'|'outgoing', caller, isVideo, roomId }
  const [activeCall, setActiveCall] = useState(null); // { isVideo, participants }
  const callStartTimeRef = useRef(null);

  // Initialize WebRTC
  const webRTC = useWebRTC(socket, user);

  // Call Actions
  const startCall = async (target, isVideo = false) => {
    if (!target) return;
    try {
      await webRTC.getUserMedia(isVideo);

      const roomId = room || (currentChat?.id === target.id ? room : null) || target.id; // Simplification, ideally use consistent room logic

      setCallState({
        type: 'outgoing',
        isVideo,
        caller: user,
        target // Store target for displaying in outgoing UI if needed
      });

      // If target is a friend/user (not group/channel), initiate 1:1
      // If it's a group, initiate group call
      // For simplicity assuming 1:1 primarily or using existing room logic
      // We'll reuse the 'startChat' logic to ensure room is set if needed? 
      // Actually, we can just emit. 

      // Ensure we have a room ID. If we are starting call from CallsPanel, 'room' state might not be set.
      // We might need to generate a room ID or use the 1:1 convention.
      // Convention: alphabetical sort of IDs? Or just target.id if 1:1?
      // Server handles 'room' as either a specific room ID or target user ID for 1:1 fallback.
      const effectiveRoom = roomId || (user.id < target.id ? `${user.id}-${target.id}` : `${target.id}-${user.id}`);

      socket.emit('call:initiate', {
        room: effectiveRoom,
        isVideo,
        caller: {
          id: user.id,
          username: user.username,
          avatar: user.avatar
        },
        isGroupCall: !!(target.isGroup || target.isChannel)
      });
    } catch (err) {
      console.warn("Error starting call:", err);
      alert("Could not access camera/microphone");
    }
  };

  const endCall = () => {
    const duration = callStartTimeRef.current ? Math.round((Date.now() - callStartTimeRef.current) / 1000) : 0;
    const isMissedByOther = callState?.type === 'outgoing' && !activeCall;
    const status = activeCall ? 'completed' : (isMissedByOther ? 'missed' : 'cancelled');

    socket.emit('call:end', {
      room: room || currentChat?.id, // This might be undefined if called from outside chat. Use effective room if stored? 
      // We should store 'effectiveRoom' in callState?
      // For now relying on room state might be flaky if we aren't in that chat. 
      // Better to rely on callState info if possible, but we don't store room there yet fully. 
      // Adding roomId to callState is good practice.
      duration,
      status,
      callerId: callState?.caller?.id || user?.id,
      participants: activeCall ? activeCall.participants.map(p => p.id) : [],
      type: (callState?.isVideo || activeCall?.isVideo) ? 'video' : 'audio'
    });

    webRTC.cleanup();
    setCallState(null);
    setActiveCall(null);
    callStartTimeRef.current = null;
  };

  const answerCall = async () => {
    if (!callState) return;
    try {
      await webRTC.getUserMedia(callState.isVideo);
      const caller = callState.caller;

      // If we are not in the chat with this caller, switch to it?
      // User requested: "popup... if receiver have not opened caller's chat"
      // If accepted, we should probably switch to the chat view.
      // Let's find the friend object to switch chat

      setCallState(null);
      setActiveCall({
        isVideo: callState.isVideo,
        participants: [caller]
      });
      callStartTimeRef.current = Date.now();

      socket.emit('call:answer', {
        room: callState.roomId,
        to: caller.id,
        peerId: webRTC.myPeerId,
        responder: {
          id: user.id,
          username: user.username,
          avatar: user.avatar
        }
      });

      // Auto-navigate to chat
      const friend = friends.find(f => f.id === caller.id) || caller;
      startChat(friend);
      setActiveTab('chat');

    } catch (err) {
      console.warn("Error answering call:", err);
      endCall();
    }
  };

  const rejectCall = () => {
    if (!callState) return;
    socket.emit('call:reject', {
      room: callState.roomId,
      to: callState.caller.id,
      rejecterId: user.id,
      callerId: callState.caller.id,
      type: callState.isVideo ? 'video' : 'audio'
    });
    setCallState(null);
  };

  // Global Call Socket Listeners
  useEffect(() => {
    if (!socket || !user) return;

    const onIncomingCall = (data) => {
      if (activeCall || callState) {
        // socket.emit('call:busy', { to: data.caller.id });
        return;
      }
      setCallState({
        type: 'incoming',
        caller: data.caller,
        isVideo: data.isVideo,
        roomId: data.roomId
      });
    };

    const onCallAccepted = async (data) => {
      if (callState?.type === 'outgoing') {
        setCallState(null);
        setActiveCall({
          isVideo: callState.isVideo,
          participants: [data.responder || {}]
        });
        callStartTimeRef.current = Date.now();
        if (data.peerId) webRTC.connectToPeer(data.peerId);
      }
    };

    const onCallRejected = () => {
      if (callState?.type === 'outgoing') {
        setCallState(null);
        webRTC.cleanup();
        alert('Call rejected');
      }
    };

    const onCallEnded = () => {
      setCallState(null);
      setActiveCall(null);
      webRTC.cleanup();
      callStartTimeRef.current = null;
    };

    const onCallFailed = (data) => {
      if (callState?.type === 'outgoing') {
        setCallState(null);
        webRTC.cleanup();
        alert(`Call failed: ${data.reason || 'User unreachable'}`);
      }
    };

    socket.on('call:incoming', onIncomingCall);
    socket.on('call:accepted', onCallAccepted);
    socket.on('call:rejected', onCallRejected);
    socket.on('call:ended', onCallEnded);
    socket.on('call:failed', onCallFailed);

    return () => {
      socket.off('call:incoming', onIncomingCall);
      socket.off('call:accepted', onCallAccepted);
      socket.off('call:rejected', onCallRejected);
      socket.off('call:ended', onCallEnded);
      socket.off('call:failed', onCallFailed);
    };
  }, [socket, user, callState, activeCall, webRTC]);

  // Handle Call Recording Events (from ActiveCall)
  useEffect(() => {
    const handleRecording = (e) => {

      const { url, blob, callId } = e.detail;
      if (url) {
        // Save to localStorage or similar so CallsPanel can find it.
        // We use a simple keying strategy: "latest_recording" or map by ID if we had it.
        // Since we don't have the callLog ID yet (it's created on server), we'll save it with a timestamp
        // and CallsPanel will try to attach it to the most recent call.
        console.log("App received recording:", url);

        // Persist for session
        try {
          // Save to localStorage for persistence across reloads
          // We use a simple timestamp key for now, OR the callId if available
          const recs = JSON.parse(localStorage.getItem('call_recordings') || '{}');
          recs[Date.now()] = url;
          if (callId) {
            recs[callId] = url;
          }
          // Also save 'latest' for the immediate call log update
          localStorage.setItem('latest_call_recording', url);
          localStorage.setItem('call_recordings', JSON.stringify(recs));
          // Dispatch update for CallsPanel
          window.dispatchEvent(new Event('recordings_updated'));
        } catch (err) {
          console.error("Failed to save recording ref", err);
        }
      }
    };
    window.addEventListener('call_recording_ready', handleRecording);
    return () => window.removeEventListener('call_recording_ready', handleRecording);
  }, []);

  // Load unseen from localStorage on login and persist on change
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(`unseen_${user.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // Clean up old username-based keys for DMs
          // Valid keys are either:
          // 1. Group/channel IDs (numeric strings or UUIDs)
          // 2. Composite room IDs (format: "id-id" where both parts are numeric)
          const cleaned = {};
          Object.keys(parsed).forEach(key => {
            // Check if it's a composite room ID (contains '-')
            // We relax the !isNaN check because IDs might be alphanumeric/UUIDs
            const isCompositeRoomId = key.includes('-');

            // Check if it's a known group or channel ID
            // We check against the actual lists to be safe
            const isGroupOrChannel = groups.some(g => String(g.id) === key) ||
              channels.some(c => String(c.id) === key);

            // Also keep simple numeric keys if we can't verify against lists yet (fallback)
            const isNumericId = !key.includes('-') && !isNaN(key);

            if (isCompositeRoomId || isGroupOrChannel || isNumericId) {
              cleaned[key] = parsed[key];
            }
            // Otherwise, it's likely an old username-based key, so we skip it
          });

          setUnseenMessages(cleaned);
          // Update localStorage with cleaned data
          localStorage.setItem(`unseen_${user.id}`, JSON.stringify(cleaned));
        }
      }
      // Also load channel alerts when user changes (though initial state handles first load)
      const savedAlerts = localStorage.getItem(`channel_alerts_${user.id}`);
      if (savedAlerts) {
        setChannelAlerts(JSON.parse(savedAlerts));
      }
    } catch (_) { }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    try { localStorage.setItem(`unseen_${user.id}`, JSON.stringify(unseenMessages)); } catch (_) { }
  }, [user?.id, unseenMessages]);

  // Sync unseen state when a room is marked read from Sidebar/menu
  useEffect(() => {
    const onRoomMarkedRead = (e) => {
      try {
        const roomId = e?.detail?.room;
        if (!roomId) return;
        setUnseenMessages((prev) => {
          const next = { ...prev };
          if (next[roomId]) next[roomId] = { ...next[roomId], count: 0 };
          return next;
        });
      } catch (_) { }
    };
    window.addEventListener('room_marked_read', onRoomMarkedRead);
    return () => window.removeEventListener('room_marked_read', onRoomMarkedRead);
  }, []);

  useEffect(() => {
    socket.on("receive_status", (data) => {
      setStatusList((prev) => {
        const idx = prev.findIndex(s => s.userId === data.userId);
        if (idx === -1) return [...prev, data];
        const next = prev.slice();
        // If server sends an item, merge into items array when possible
        const existing = next[idx] || {};
        if (Array.isArray(existing.items) && data && !Array.isArray(data)) {
          next[idx] = { ...existing, items: [...existing.items, data] };
        } else {
          next[idx] = { ...existing, ...data };
        }
        return next;
      });
    });

    socket.on("online_users", (users) => {
      setOnlineUsers(users);
    });

    // Media/docs/links list for current room
    const mediaListHandler = (payload) => {
      try {
        if (!payload || !payload.room) return;
        if (String(payload.room) === String(room)) {
          setMediaSummary({
            media: Array.isArray(payload.media) ? payload.media : [],
            docs: Array.isArray(payload.docs) ? payload.docs : [],
            links: Array.isArray(payload.links) ? payload.links : [],
          });
        }
      } catch (_) { }
    };
    socket.on('media_list', mediaListHandler);

    // Listen for full story list updates
    socket.on("stories_list", (data) => {
      setStatusList(data);
    });
    socket.on("stories_updated", (data) => {
      setStatusList(data);
    });

    socket.on("online_users", (users) => {
      setOnlineUsers(users);
    });

    socket.on("message_notification", (data) => {
      // Use this handler only for DMs; groups/channels are handled in receive_message to avoid double increments
      // But wait, the server sends 'room' (composite ID) for DMs too!
      // We need to distinguish between a Group ID and a DM Room ID.
      // Groups are in the 'groups' list.
      const isGroup = groups.some(g => String(g.id) === String(data.room));
      if (isGroup) return;

      // If it's a DM, the server sends 'room' as the composite ID (e.g. "123-456")
      // We should use that as the key if available, otherwise fallback to author (but Sidebar expects composite ID)
      const key = data.room || data.author || '';
      if (!key) return;

      // Check if sender is blocked
      // data.senderId should be available from server.
      // We check localStorage directly to avoid closure staleness issues with state
      const senderId = data.senderId;
      if (senderId) {
        try {
          // Check individual block key first (used by Sidebar)
          if (localStorage.getItem(`block_contact_${senderId}`) === 'true') return;

          // Check list key
          const listKey = `blocked_users_${user?.id}`;
          const raw = localStorage.getItem(listKey);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list) && list.includes(String(senderId))) return;
          }
        } catch (_) { }
      }

      // Fallback to state check if localStorage failed or for author name
      if (blockedUsers.includes(String(data.senderId || '')) || (data.author && blockedUsers.includes(data.author))) {
        return;
      }

      let isCurrentChat = false;
      if (currentChat) {
        // Check if we are currently chatting with this person
        // For DMs, currentChat.id is the friend's ID.
        // The composite room ID contains the friend's ID.
        if (data.room) {
          isCurrentChat = data.room.includes(String(currentChat.id));
        } else {
          isCurrentChat = (currentChat.username === data.author);
        }
      }

      if (!isCurrentChat) {
        setUnseenMessages((prev) => {
          const current = prev[key] || { count: 0, time: '' };
          return { ...prev, [key]: { count: current.count + 1, time: data.time, timestamp: data.timestamp } };
        });
      }
    });

    socket.on("profile_updated", (updatedUser) => {
      // Update current user if it's me
      if (user && user.id === updatedUser.id) {
        setUser(prev => ({ ...prev, ...updatedUser }));
      }
      // Update current chat if it's the person I'm talking to
      if (currentChat && currentChat.id === updatedUser.id) {
        setCurrentChat(prev => ({ ...prev, ...updatedUser }));
      }
      // Update status list avatars
      setStatusList(prev => prev.map(s => s.userId === updatedUser.id ? { ...s, avatar: updatedUser.avatar, username: updatedUser.username } : s));
    });

    // Group Events
    socket.on("groups_list", (data) => {
      const norm = (arr) => (arr || []).map(m => {
        const id = (m && typeof m === 'object') ? (m.id ?? m._id ?? m) : m;
        const fr = (friends || []).find(f => String(f.id) === String(id));
        const username = fr?.username || (typeof m === 'object' ? (m.username || m.name || String(id)) : String(id));
        const avatar = fr?.avatar || (typeof m === 'object' ? (m.avatar || `https://i.pravatar.cc/150?u=${id}`) : `https://i.pravatar.cc/150?u=${id}`);
        return { id, username, avatar };
      });
      const mapped = (Array.isArray(data) ? data : []).map(g => ({ ...g, members: norm(g.members), isGroup: true }));
      setGroups(mapped);
      // Join group rooms
      (Array.isArray(mapped) ? mapped : []).forEach(group => {
        socket.emit("join_room", group.id);
      });
    });

    // removed duplicate early communities_list handler to avoid wiping icon cache

    // consolidated into the later community_updated handler below

    socket.on("group_removed", (data) => {
      setGroups(prev => prev.filter(g => g.id !== data.groupId));
      if (currentChat?.id === data.groupId) {
        setCurrentChat(null);
      }
    });

    socket.on("admin_only_chat_toggled", (data) => {
      // Update the group's adminOnlyChat property
      setGroups(prev => prev.map(g =>
        g.id === data.groupId ? { ...g, adminOnlyChat: data.enabled } : g
      ));
      // Update current chat if it's the affected group
      if (currentChat?.id === data.groupId) {
        setCurrentChat(prev => ({ ...prev, adminOnlyChat: data.enabled }));
      }
    });

    socket.on("group_created", (newGroup) => {
      setGroups(prev => [...prev, newGroup]);
      socket.emit("join_room", newGroup.id);
    });

    socket.on("added_to_group", (newGroup) => {
      setGroups(prev => [...prev, newGroup]);
      socket.emit("join_room", newGroup.id);
      if (user?.id) socket.emit("get_communities", user.id);
    });

    socket.on("group_joined", (newGroup) => {
      setGroups(prev => [...prev, newGroup]);
      socket.emit("join_room", newGroup.id);
      if (user?.id) socket.emit("get_communities", user.id);
    });

    socket.on("group_updated", (updatedGroup) => {
      // Normalize members to keep avatars/usernames intact
      const norm = (arr) => (arr || []).map(m => {
        const id = (m && typeof m === 'object') ? (m.id ?? m._id ?? m) : m;
        const fr = (friends || []).find(f => String(f.id) === String(id));
        const username = fr?.username || (typeof m === 'object' ? (m.username || m.name || String(id)) : String(id));
        const avatar = fr?.avatar || (typeof m === 'object' ? (m.avatar || `https://i.pravatar.cc/150?u=${id}`) : `https://i.pravatar.cc/150?u=${id}`);
        return { id, username, avatar };
      });
      const mapped = { ...updatedGroup, members: norm(updatedGroup.members), isGroup: true };
      // Update the group in the groups list
      setGroups(prev => prev.map(g =>
        g.id === updatedGroup.id ? mapped : g
      ));
      // Update current chat if it's the updated group; preserve sourceCommunityId to keep selection under community expander
      if (currentChat?.id === updatedGroup.id) {
        setCurrentChat(prev => ({ ...mapped, isGroup: true, sourceCommunityId: prev?.sourceCommunityId, showInfo: prev?.showInfo }));
      }
    });

    // When a new group is created for the user (e.g., added to an announcement group), refresh communities
    socket.on('group_created', (newGroup) => {
      try {
        if (newGroup) {
          // Normalize members to objects like elsewhere
          const norm = (arr) => (arr || []).map(m => {
            const id = (m && typeof m === 'object') ? (m.id ?? m._id ?? m) : m;
            const fr = (friends || []).find(f => String(f.id) === String(id));
            const username = fr?.username || ((m && typeof m === 'object' && (m.username || m.name)) || String(id));
            const avatar = fr?.avatar || ((m && typeof m === 'object' && m.avatar) || `https://i.pravatar.cc/150?u=${id}`);
            return { id, username, avatar };
          });
          const mapped = { ...newGroup, members: norm(newGroup.members), isGroup: true };
          setGroups(prev => {
            const exists = prev.some(g => String(g.id) === String(mapped.id));
            return exists ? prev.map(g => (String(g.id) === String(mapped.id) ? mapped : g)) : [...prev, mapped];
          });
        }
        if (newGroup && (newGroup.isAnnouncementGroup || newGroup.communityId)) {
          socket.emit('get_communities', user?.id);
        }
      } catch (_) { }
    });

    // Community Events
    socket.on("communities_list", (data) => {
      setCommunities(data);
      // Seed localStorage icons to keep Sidebar in sync
      try {
        data.forEach(c => {
          if (c?.id && c?.icon) {
            const key = 'community_icon_' + c.id;
            const prev = localStorage.getItem(key);
            localStorage.setItem(key, c.icon);
            if (prev !== c.icon) {
              try { localStorage.setItem('community_icon_ver_' + c.id, String(Date.now())); } catch (_) { }
            } else {
              // ensure a version exists so cache-busting works after fresh login
              const verKey = 'community_icon_ver_' + c.id;
              const hasVer = localStorage.getItem(verKey);
              if (!hasVer) {
                try { localStorage.setItem(verKey, String(c.createdAt || Date.now())); } catch (_) { }
              }
            }
          }
        });
        window.dispatchEvent(new Event('force_sidebar_refresh'));
      } catch (_) { }
    });

    socket.on("community_created", (newCommunity) => {
      setCommunities(prev => [...prev, newCommunity]);
      // Persist icon so Sidebar reads latest immediately
      try {
        if (newCommunity?.id && newCommunity?.icon) {
          localStorage.setItem('community_icon_' + newCommunity.id, newCommunity.icon);
          try { localStorage.setItem('community_icon_ver_' + newCommunity.id, String(Date.now())); } catch (_) { }
          window.dispatchEvent(new Event('force_sidebar_refresh'));
        }
      } catch (_) { }
      // Ensure list UI is up-to-date
      if (user?.id) {
        socket.emit("get_communities", user.id);
      }
    });

    socket.on("community_updated", (updatedCommunity) => {
      setCommunities(prev => prev.map(c => c.id === updatedCommunity.id ? updatedCommunity : c));
      // Update current chat if it's a community (though we don't chat directly with communities yet)
      if (currentChat?.id === updatedCommunity.id) {
        setCurrentChat({ ...updatedCommunity, showInfo: currentChat.showInfo });
      }
      // Sync icon change into localStorage for Sidebar
      try {
        if (updatedCommunity?.id && updatedCommunity?.icon) {
          const key = 'community_icon_' + updatedCommunity.id;
          const prev = localStorage.getItem(key);
          localStorage.setItem(key, updatedCommunity.icon);
          if (prev !== updatedCommunity.icon) {
            try { localStorage.setItem('community_icon_ver_' + updatedCommunity.id, String(Date.now())); } catch (_) { }
          } else {
            // Ensure a version exists for clients that had none yet
            const verKey = 'community_icon_ver_' + updatedCommunity.id;
            const hasVer = localStorage.getItem(verKey);
            if (!hasVer) {
              try { localStorage.setItem(verKey, String(updatedCommunity.createdAt || Date.now())); } catch (_) { }
            }
          }
          window.dispatchEvent(new Event('force_sidebar_refresh'));
        }
      } catch (_) { }
    });

    socket.on("community_deleted", (data) => {
      setCommunities(prev => prev.filter(c => c.id !== data.communityId));
      if (currentChat?.communityId === data.communityId) {
        setCurrentChat(null);
      }
    });

    socket.on("community_joined", (community) => {
      setCommunities(prev => {
        if (!prev.find(c => c.id === community.id)) {
          return [...prev, community];
        }
        return prev;
      });
    });

    socket.on("community_left", (data) => {
      setCommunities(prev => prev.filter(c => c.id !== data.communityId));
    });

    socket.on("removed_from_community", (data) => {
      setCommunities(prev => prev.filter(c => c.id !== data.communityId));
      alert("You have been removed from a community.");
    });

    socket.on("blocked_from_community", (data) => {
      setCommunities(prev => prev.filter(c => c.id !== data.communityId));
      alert("You have been blocked from a community.");
    });

    socket.on("subgroup_added", (data) => {
      // We might need to re-fetch communities or update the specific community
      // For now, let's just rely on community_updated which should be broadcasted
      // But if not, we can manually update if we had the full community object
      // The server emits subgroup_added with just IDs, so we might want to fetch
      if (user) socket.emit("get_communities", user.id);
    });

    socket.on("subgroup_removed", (data) => {
      if (user) socket.emit("get_communities", user.id);
    });

    // Channel Events
    socket.on("channels_list", (data) => {
      setChannels(data);
    });

    socket.on("channel_created", (newChannel) => {
      setChannels(prev => [newChannel, ...prev]);
      if (user?.id) socket.emit("get_channels", user.id);
    });

    socket.on("channel_updated", (updatedChannel) => {
      // updatedChannel might just be partial updates or full object
      // For now, let's re-fetch to be safe or merge if full object
      // The backend emits { channelId, ...updates } or full object?
      // Checking backend: emits { channelId, settings } or { channelId, membersCount }
      // So we should probably just re-fetch list or carefully merge.
      // Re-fetching is safer for now.
      if (user?.id) socket.emit("get_channels", user.id);
    });

    socket.on("channel_deleted", (data) => {
      setChannels(prev => prev.filter(c => c.id !== data.channelId));
      if (currentChat?.id === data.channelId) {
        setCurrentChat(null);
      }
    });

    socket.on("channel_post_created", (data) => {
      // data: { channelId, post }
      // We might want to update the channel object in state to include the new post preview?
      // Or just let ChatWindow handle fetching posts.
      // But Sidebar might show "last message".
      // For now, let's just re-fetch channels to update any metadata if needed.
      if (user?.id) socket.emit("get_channels", user.id);
    });

    // Reactions on channel posts: alert admins/creator if alert mode is on
    socket.on("channel_post_reacted", (data) => {
      // data: { channelId, postId, userId, emoji, reactions }
      try {
        const ch = channels.find(c => String(c.id) === String(data.channelId));
        if (!ch) return;
        const isCreator = String(ch.createdBy) === String(user?.id);
        const isAdmin = Array.isArray(ch.admins) && ch.admins.map(String).includes(String(user?.id));
        const isSelf = String(data.userId) === String(user?.id);
        if ((isCreator || isAdmin) && !isSelf && currentChat?.id !== data.channelId) {
          // Check alert toggle for this channel
          let alertOn = false;
          try { alertOn = localStorage.getItem(`channel_alert_${data.channelId}`) === 'true'; } catch (_) { }
          if (alertOn) {
            setChannelAlerts(prev => ({ ...prev, [data.channelId]: true }));
          }
        }
      } catch (_) { }
    });

    // Comments on channel posts: alert everyone except author if alert mode is on
    socket.on("channel_comment", (data) => {
      // data: { room (channelId), msgId, comment, userId }
      try {
        const channelId = data.room;

        // Persistence (Background only)
        // If we are in the channel/room, ChatWindow handles persistence.
        // If we are NOT in the room, we must persist here so it's available when we open it.
        // Use 'room' state to check active chat, as currentChat.id might be user ID for DMs.
        if (String(room) !== String(channelId)) {
          try {
            const key = `channel_comments_${channelId}`;
            const raw = localStorage.getItem(key);
            const prev = raw ? JSON.parse(raw) : {};
            const list = Array.isArray(prev[data.msgId]) ? prev[data.msgId] : [];
            // Update or add
            const idx = list.findIndex(c => String(c.userId) === String(data.comment.userId));
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...data.comment };
            } else {
              list.push(data.comment);
            }
            prev[data.msgId] = list;
            localStorage.setItem(key, JSON.stringify(prev));
          } catch (_) { }
        }

        const ch = channels.find(c => String(c.id) === String(channelId));
        if (!ch) return;

        const isSelf = String(data.userId) === String(user?.id);

        // Alert everyone who has alerts enabled for this channel, except the commenter
        // AND only if they are not currently looking at this channel
        if (!isSelf && String(room) !== String(channelId)) {
          let alertOn = false;
          try { alertOn = localStorage.getItem(`channel_alert_${channelId}`) === 'true'; } catch (_) { }

          // If user hasn't explicitly set alerts, default to true for admins/owner?
          // Or just respect the toggle. The user request says "alert admin and show animation and same for users".
          // Assuming users must have enabled alerts or we force it?
          // Existing logic for reactions checks `alertOn`. Let's stick to that but maybe default to true if not set?
          // Actually, let's just use the existing `alertOn` logic.

          if (alertOn) {
            setChannelAlerts(prev => ({ ...prev, [channelId]: true }));
          }
        }
      } catch (_) { }
    });

    socket.on("channel_comment_delete", (data) => {
      try {
        const channelId = data.room;
        if (String(room) !== String(channelId)) {
          const key = `channel_comments_${channelId}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            const prev = JSON.parse(raw);
            const list = Array.isArray(prev[data.msgId]) ? prev[data.msgId] : [];
            prev[data.msgId] = list.filter(c => String(c.id) !== String(data.commentId));
            localStorage.setItem(key, JSON.stringify(prev));
          }
        }
      } catch (_) { }
    });

    // Admin events
    socket.on("channel_admin_added", (data) => {
      if (user?.id) socket.emit("get_channels", user.id);
    });

    socket.on("channel_admin_removed", (data) => {
      if (user?.id) socket.emit("get_channels", user.id);
    });

    socket.on("channel_post_deleted", (data) => {
      // Handled in ChatWindow
    });

    socket.on("channel_post_edited", (data) => {
      // Handled in ChatWindow
    });

    socket.on("channel_user_blocked", (data) => {
      if (user?.id === data.userId) {
        // User was blocked, remove channel from their list
        setChannels(prev => prev.filter(c => c.id !== data.channelId));
        if (currentChat?.id === data.channelId) {
          setCurrentChat(null);
        }
      }
    });

    socket.on("channel_join_request", (data) => {
      // Notify admins
      if (user?.id) socket.emit("get_channels", user.id);
    });

    socket.on("channel_join_approved", (data) => {
      if (user?.id === data.userId) {
        // User's request was approved
        socket.emit("get_channels", user.id);
      }
    });

    socket.on("channel_join_rejected", (data) => {
      if (user?.id === data.userId) {
        // User's request was rejected
        alert("Your join request was rejected.");
      }
    });

    socket.on("channel_followed", (data) => {
      if (user?.id) socket.emit("get_channels", user.id);
    });

    socket.on("channel_settings_updated", (data) => {
      if (user?.id) socket.emit("get_channels", user.id);
    });

    socket.on("channel_unfollowed", (data) => {
      if (user?.id) socket.emit("get_channels", user.id);
    });

    // Handle friend request acceptance - both users join the chat room
    socket.on("friend_request_accepted", (data) => {
      try {
        // Check if this event is relevant to the current user
        const isInvolved = String(data.fromId) === String(user?.id) || String(data.toId) === String(user?.id);
        if (!isInvolved || !data.roomId) return;

        // Join the room so we can send/receive messages
        socket.emit("join_room", data.roomId);

        // Refresh friends list to show the new friend
        if (user?.id) {
          fetchFriends(user.id);
        }
      } catch (_) { }
    });

    // Re-join rooms on reconnect (fixes issue after server restart)
    socket.on("connect", () => {
      if (user) socket.emit("join_room", user.id);
      if (room) socket.emit("join_room", room);
      socket.emit("get_stories"); // Fetch stories on connect
      if (user) {
        socket.emit("get_groups", user.id);
        socket.emit("get_communities", user.id);
        socket.emit("get_channels", user.id);
      }
    });

    // Initial fetch if socket is already connected
    if (socket.connected) {
      if (user?.id) socket.emit("join_room", user.id);
      socket.emit("get_stories");
      if (user?.id) {
        socket.emit("get_groups", user.id);
        socket.emit("get_communities", user.id);
        socket.emit("get_channels", user.id);
      }
    }

    return () => {
      socket.off("receive_status");
      socket.off("online_users");
      socket.off('media_list', mediaListHandler);
      socket.off("stories_list");
      socket.off("stories_updated");
      socket.off("message_notification");
      socket.off("profile_updated");
      socket.off("groups_list");
      socket.off("group_created");
      socket.off("group_updated");
      socket.off("group_removed");
      socket.off("group_removed");
      socket.off("admin_only_chat_toggled");
      socket.off("channels_list");
      socket.off("channel_created");
      socket.off("channel_updated");
      socket.off("channel_deleted");
      socket.off("channel_post_created");
      socket.off("channel_post_reacted");
      socket.off("channel_admin_added");
      socket.off("channel_admin_removed");
      socket.off("channel_post_deleted");
      socket.off("channel_post_edited");
      socket.off("channel_user_blocked");
      socket.off("channel_join_request");
      socket.off("channel_join_approved");
      socket.off("channel_join_rejected");
      socket.off("channel_followed");
      socket.off("channel_unfollowed");
      socket.off("connect");
    };
  }, [socket, currentChat, user, room]);

  // When room changes, join it and request media so socket events (e.g., receive_reaction) reach this client
  useEffect(() => {
    if (!room) return;
    try { socket.emit('join_room', room); } catch (_) { }
    try { socket.emit('get_media', { room }); } catch (_) { }
  }, [socket, room, currentChat?.showInfo]);

  // Keep media up-to-date on new messages and increment unseen for group messages
  useEffect(() => {
    const onReceive = (msg) => {
      try {
        // Check if sender is blocked
        const senderId = msg.userId || msg.authorId;
        if (senderId && localStorage.getItem(`block_contact_${senderId}`) === 'true') {
          return; // Ignore message if blocked
        }

        const msgRoom = msg?.room || msg?.to;
        if (String(msgRoom) === String(room)) {
          socket.emit('get_media', { room });
        }
        // Unseen for groups: increment when message arrives for a group that's not the current chat (and not from self)
        const groupIds = (groups || []).map(g => String(g.id));
        const isGroupMsg = msg && msg.room && groupIds.includes(String(msg.room));
        const isSelf = String(msg.userId || msg.authorId) === String(user?.id);
        if (isGroupMsg && !isSelf) {
          const isCurrentChat = currentChat && String(currentChat.id) === String(msg.room);
          if (!isCurrentChat) {
            const key = String(msg.room);
            const now = Date.now();
            const last = unseenDebounceRef.current[key] || 0;
            if (now - last >= 300) {
              unseenDebounceRef.current[key] = now;
              setUnseenMessages(prev => {
                const current = prev[key] || { count: 0, time: '' };
                return { ...prev, [key]: { count: (current.count || 0) + 1, time: msg.time || '' } };
              });
            }
          }
        }
      } catch (_) { }
    };

    const onReceiveMessage = (data) => {
      // Check if author is blocked
      if (blockedUsers.includes(String(data.userId || data.authorId || ''))) {
        return; // Ignore message from blocked user
      }
      // Also check by username if ID not available (fallback)
      // But better to rely on ID. 
      // If we only have username in data.author, we might need to resolve it.
      // Assuming data.userId is present for DMs as per server code.

      onReceive(data);
    };

    socket.on('receive_message', onReceiveMessage);
    return () => socket.off('receive_message', onReceiveMessage);
  }, [socket, room, groups, currentChat, user?.id]);

  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        fetchFriends(user.id);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const [blockedUsers, setBlockedUsers] = useState([]);

  useEffect(() => {
    if (user?.id) {
      const key = `blocked_users_${user.id}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) setBlockedUsers(JSON.parse(raw));
      } catch (_) { }
    }
  }, [user?.id]);

  const handleBlock = (friendId) => {
    if (!user?.id) return;
    const key = `blocked_users_${user.id}`;
    let current = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) current = JSON.parse(raw);
    } catch (_) { }

    const isBlocked = current.includes(String(friendId));
    let next;
    if (isBlocked) {
      next = current.filter(id => id !== String(friendId));
    } else {
      next = [...current, String(friendId)];
      // Also update the individual block key used by Sidebar for compatibility
      // Sidebar uses: blockKey(friendId) -> "block_contact_FRIENDID"
      try {
        const sidebarKey = `block_contact_${friendId}`;
        localStorage.setItem(sidebarKey, String(!isBlocked));
      } catch (_) { }
    }

    if (socket) {
      socket.emit('block_user', { userId: user.id, blockedId: friendId, block: !isBlocked });
    }

    // Force refresh of Sidebar if needed (Sidebar listens to local storage or props?)
    // Sidebar has its own state but reads from localStorage on mount/update. 
    // We might need to pass blockedUsers to Sidebar or trigger an event.
    window.dispatchEvent(new Event('storage')); // Simple way to notify other components listening to storage
  };

  const [channelAlerts, setChannelAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem(`channel_alerts_${user?.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist channel alerts
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`channel_alerts_${user.id}`, JSON.stringify(channelAlerts));
    }
  }, [channelAlerts, user?.id]);

  // Clear alert when opening channel
  useEffect(() => {
    if (currentChat?.isChannel && channelAlerts[currentChat.id]) {
      setChannelAlerts(prev => {
        const next = { ...prev };
        delete next[currentChat.id];
        return next;
      });
    }
  }, [currentChat, channelAlerts]);

  const startChat = (friend) => {
    // If selecting the same entity and same context, toggle off
    const isSameEntity = currentChat && currentChat.id === friend.id;
    const sameContext = (!currentChat?.sourceCommunityId && !friend.sourceCommunityId) || (currentChat?.sourceCommunityId === friend.sourceCommunityId);
    if (isSameEntity && sameContext) {
      setCurrentChat(null);
      setRoom("");
      return;
    }
    // Ensure info sidebar is expanded by default when selecting a new chat
    setCurrentChat({ ...friend, showInfo: true });
    setViewingStats(false); // Reset stats view
    // Reset unseen count for this friend
    setUnseenMessages((prev) => {
      const newUnseen = { ...prev };

      if (friend.isGroup || friend.isChannel) {
        // For groups/channels, use the ID directly
        if (newUnseen[friend.id]) {
          newUnseen[friend.id] = { ...newUnseen[friend.id], count: 0 };
        }
      } else {
        // For DMs, use the composite room ID
        const roomId = [user.id, friend.id].sort().join('-');
        if (newUnseen[roomId]) {
          newUnseen[roomId] = { ...newUnseen[roomId], count: 0 };
        }
      }

      return newUnseen;
    });

    // Create a unique room ID for the pair (e.g., sorted IDs)
    // If it's a group, use the group ID directly
    // If it's a channel, use the channel ID directly
    const roomId = (friend.isGroup || friend.isChannel) ? friend.id : [user.id, friend.id].sort().join('-');
    setRoom(roomId);
  };

  if (!user) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        {view === 'login' ? (
          <Login onLogin={handleLogin} onSwitchToRegister={() => setView('register')} />
        ) : (
          <Register onRegister={handleLogin} onSwitchToLogin={() => setView('login')} />
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <NavigationRail
        theme={theme}
        toggleTheme={toggleTheme}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userAvatar={user?.avatar}
        hasUnseenStatus={statusList.some(s => s.userId !== user?.id && s.items?.some(i => !i.viewedBy?.includes(user?.id)))}
        unseenMessages={unseenMessages}
        friends={friends}
        groups={groups}
        channels={channels}
        user={user}
      />

      {/* Main content area based on activeTab */}
      <>
        {activeTab === 'chat' && (
          <>
            <Sidebar
              socket={socket}
              user={user}
              statusList={statusList}
              onSelectChat={startChat}
              currentChat={currentChat}
              unseenMessages={unseenMessages}
              onlineUsers={onlineUsers}
              theme={theme}
              toggleTheme={toggleTheme}
              friends={friends}
              groups={groups}
              communities={communities}
              channels={channels}
              channelAlerts={channelAlerts}
            />
            {currentChat && !currentChat.subGroups ? (
              viewingStats && currentChat.isChannel ? (
                <div className="chat-window">
                  <ChannelStats
                    channelId={currentChat.id}
                    onClose={() => setViewingStats(false)}
                    currentUser={user}
                    theme={theme}
                    socket={socket}
                  />
                </div>
              ) : (
                <ChatWindow
                  socket={socket}
                  user={user}
                  username={user.username}
                  room={room}
                  currentChat={currentChat}
                  onlineUsers={onlineUsers}
                  theme={theme}
                  friends={friends}
                  groups={groups}
                  channels={channels}
                  toggleInfo={() => setCurrentChat(prev => ({ ...prev, showInfo: !prev.showInfo }))}
                  // Call Props
                  webRTC={webRTC}
                  isGroupCall={currentChat.isGroup || currentChat.isChannel}
                  callState={callState}
                  activeCall={activeCall}
                  onStartCall={startCall}
                  onEndCall={endCall}
                  onAnswerCall={answerCall}
                  onRejectCall={rejectCall}
                />
              )
            ) : (
              <div className="chat-window" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                {currentChat?.subGroups ? (
                  <>
                    <img src={currentChat.icon} alt={currentChat.name} style={{ width: '100px', height: '100px', borderRadius: '25px', marginBottom: '20px' }} />
                    <h2>{currentChat.name}</h2>
                    <p>Select a group from the sidebar to start chatting.</p>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '4rem', marginBottom: '20px' }}>👋</span>
                    <h2>Welcome, {user.username}!</h2>
                    <p>Select a friend to start chatting.</p>
                  </>
                )}
              </div>
            )}
            {/* Right Sidebar - Info Panels (render wrapper only when content exists) */}
            {currentChat && (
              currentChat.subGroups ? (
                <div className={`right-sidebar ${currentChat.showInfo ? 'open' : ''}`}>
                  <div className="right-sidebar-content">
                    <CommunityInfo
                      community={currentChat}
                      onClose={() => setCurrentChat(prev => ({ ...prev, showInfo: false }))}
                      currentUser={user}
                      socket={socket}
                      groups={groups}
                    />
                  </div>
                </div>
              ) : currentChat.isChannel ? (
                <div className={`right-sidebar ${currentChat.showInfo ? 'open' : ''}`}>
                  <div className="right-sidebar-content">
                    <ChannelInfo
                      channel={currentChat}
                      onClose={() => setCurrentChat(prev => ({ ...prev, showInfo: false }))}
                      currentUser={user}
                      socket={socket}
                      friends={friends}
                      onlineUsers={onlineUsers}
                      onViewStats={() => setViewingStats(true)}
                    />
                  </div>
                </div>
              ) : (currentChat.isGroup || currentChat.isAnnouncementGroup) ? (
                <div className={`right-sidebar ${currentChat.showInfo ? 'open' : ''}`}>
                  <div className="right-sidebar-content">
                    <GroupInfo
                      group={currentChat}
                      onClose={() => setCurrentChat(prev => ({ ...prev, showInfo: false }))}
                      currentUser={user}
                      socket={socket}
                      friends={friends}
                      onlineUsers={onlineUsers}
                      room={room}
                      mediaMessages={[...mediaSummary.media, ...mediaSummary.docs]}
                      links={mediaSummary.links}
                      isBlocked={blockedUsers.includes(String(currentChat.id))}
                      onBlock={() => handleBlock(currentChat.id)}
                      // Call Props
                      webRTC={webRTC}
                      isGroupCall={currentChat.isGroup || currentChat.isChannel}
                      callState={callState}
                      activeCall={activeCall}
                      onStartCall={startCall}
                      onEndCall={endCall}
                      onAnswerCall={answerCall}
                      onRejectCall={rejectCall}
                    />
                  </div>
                </div>
              ) : (
                <div className={`right-sidebar ${currentChat.showInfo ? 'open' : ''}`}>
                  <div className="right-sidebar-content">
                    <ContactInfo
                      user={currentChat}
                      onClose={() => setCurrentChat(prev => ({ ...prev, showInfo: false }))}
                      currentUser={user}
                      socket={socket}
                      room={room}
                      mediaMessages={[...mediaSummary.media, ...mediaSummary.docs]}
                      links={mediaSummary.links}
                      isBlocked={blockedUsers.includes(String(currentChat.id))}
                      onBlock={() => handleBlock(currentChat.id)}
                      onStartCall={startCall}
                    />
                  </div>
                </div>
              )
            )}

            {/* Global Incoming Call Popup */}
            <DraggableCallPopup
              call={callState}
              onAccept={answerCall}
              onReject={rejectCall}
            />
          </>
        )}

        {activeTab === 'status' && (
          <div style={{ flex: 1, background: 'var(--bg-panel)' }}>
            <Stories user={user} socket={socket} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Settings user={user} theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout} socket={socket} />
          </div>
        )}

        {activeTab === 'calls' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <CallsPanel
              user={user}
              socket={socket}
              friends={friends}
              onlineUsers={onlineUsers}
              theme={theme}
              onStartCall={(target) => {
                setActiveTab('chat');
                if (currentChat?.id !== target.id) {
                  startChat(target);
                }
                setTimeout(() => startCall(target, target.isVideo), 100);
              }}
            />
          </div>
        )}
      </>
      {/* Liquid Glass Filter Definition */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <filter id="switcher" primitiveUnits="objectBoundingBox">
          <feImage result="map" width="100%" height="100%" x="0" y="0" href="data:image/webp;base64,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" />

          <feGaussianBlur in="SourceGraphic" stdDeviation="0.01" result="blur" />
          <feDisplacementMap
            id="disp"
            in="blur"
            in2="map"
            scale="20"
            xChannelSelector="R"
            yChannelSelector="G">
          </feDisplacementMap>
        </filter>
      </svg>
    </div>
  );
}

export default App;

