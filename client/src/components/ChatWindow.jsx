import React, { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiClock, FiShield, FiBarChart2, FiMusic, FiStar, FiChevronDown, FiBookmark, FiPaperclip, FiSend, FiMoreVertical, FiPhone, FiVideo, FiSearch, FiX, FiSmile, FiMic, FiImage, FiFile, FiDownload, FiShare2, FiCheck, FiPlay, FiPause, FiVolume2, FiVolumeX, FiTrash2, FiCopy, FiCornerUpLeft, FiEdit2, FiStopCircle } from 'react-icons/fi';
import { BsPin, BsPinFill } from 'react-icons/bs';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';

import Avatar from './Avatar';
import ContactInfo from './ContactInfo';
import GroupInfo from './GroupInfo';
import ChannelInfo from './ChannelInfo';
import CallModal from './CallModal';
import ActiveCall from './ActiveCall';
// import { useWebRTC } from '../hooks/useWebRTC';
import redPinJson from './animations/red pin map.json';



const PlacedDoodle = React.memo(({ doodle }) => {
    return (
        <div style={{
            position: 'absolute',
            top: doodle.top,
            left: 0,
            width: doodle.width || '100%',
            height: doodle.height,
            zIndex: 50,
            pointerEvents: 'none',
            userSelect: 'none'
        }}>
            <img
                src={doodle.image}
                alt="doodle"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill',
                    pointerEvents: 'none'
                }}
            />
        </div>
    );
}, (prev, next) => {
    return (
        prev.doodle.id === next.doodle.id &&
        prev.doodle.image === next.doodle.image &&
        prev.doodle.top === next.doodle.top &&
        prev.doodle.width === next.doodle.width &&
        prev.doodle.height === next.doodle.height
    );
});

// Lightweight, theme-aware custom audio player with waveform
const AudioPlayer = ({ src, theme }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [current, setCurrent] = useState(0);
    const [rate, setRate] = useState(1);
    const [dragging, setDragging] = useState(false);

    // Generate random waveform bars (in real app, you'd analyze the audio)
    const [waveformBars] = useState(() => {
        const bars = [];
        for (let i = 0; i < 40; i++) {
            bars.push(Math.random() * 0.7 + 0.3); // Random heights between 0.3 and 1
        }
        return bars;
    });

    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        const onLoaded = () => setDuration(a.duration || 0);
        const onTime = () => setCurrent(a.currentTime || 0);
        const onEnd = () => setIsPlaying(false);
        a.addEventListener('loadedmetadata', onLoaded);
        a.addEventListener('timeupdate', onTime);
        a.addEventListener('ended', onEnd);
        return () => {
            a.removeEventListener('loadedmetadata', onLoaded);
            a.removeEventListener('timeupdate', onTime);
            a.removeEventListener('ended', onEnd);
        };

        // (doodle listeners moved to ChatWindow scope to avoid duplication)
    }, [src]);

    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        if (isPlaying) {
            a.play().catch(() => setIsPlaying(false));
        } else {
            a.pause();
        }
    }, [isPlaying]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.playbackRate = rate;
    }, [rate]);

    const fmt = (t) => {
        if (!isFinite(t)) return '0:00';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const pct = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
    const rates = [0.5, 1, 1.25, 1.5, 2];
    const nextRate = () => {
        const idx = rates.indexOf(rate);
        const n = rates[(idx + 1) % rates.length];
        setRate(n);
    };

    const handleWaveformClick = (e) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
        const ratio = rect.width ? (x / rect.width) : 0;
        if (audioRef.current && isFinite(audioRef.current.duration)) {
            audioRef.current.currentTime = ratio * audioRef.current.duration;
        }
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12, minWidth: 300,
            background: 'transparent',
            border: 'none', borderRadius: 16, padding: '10px 0',
            boxShadow: 'none'
        }}>
            <audio ref={audioRef} src={src} preload="metadata" />
            <button onClick={() => setIsPlaying(p => !p)}
                style={{
                    background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--border-color)', cursor: 'pointer', color: theme === 'dark' ? '#9ec5ff' : '#1e3a8a',
                    transition: 'background 0.2s'
                }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
            >
                {isPlaying ? <FiPause size={18} /> : <FiPlay size={18} />}
            </button>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Waveform visualization */}
                <div
                    onClick={handleWaveformClick}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        height: 40,
                        cursor: 'pointer',
                        padding: '0 4px'
                    }}
                >
                    {waveformBars.map((height, i) => {
                        const barProgress = (i / waveformBars.length) * 100;
                        const isPassed = barProgress <= pct;
                        return (
                            <div
                                key={i}
                                style={{
                                    flex: 1,
                                    height: `${height * 100}%`,
                                    background: isPassed
                                        ? 'linear-gradient(180deg, var(--accent-primary), #60a5fa)'
                                        : theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                    borderRadius: 2,
                                    transition: 'all 0.15s ease',
                                    transform: isPlaying && isPassed ? 'scaleY(1.1)' : 'scaleY(1)',
                                    animation: isPlaying && isPassed ? 'pulse 0.8s ease-in-out infinite' : 'none',
                                    animationDelay: `${i * 0.02}s`
                                }}
                            />
                        );
                    })}
                </div>
                {/* Time display */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    fontVariantNumeric: 'tabular-nums',
                    paddingLeft: 4,
                    paddingRight: 4
                }}>
                    <span>{fmt(current)}</span>
                    <span>{fmt(duration)}</span>
                </div>
            </div>
            <button onClick={nextRate} title="Playback speed"
                style={{
                    background: theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)',
                    border: 'none', borderRadius: 12, padding: '6px 10px',
                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer',
                    transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)'}
            >
                {rate}x
            </button>

        </div >
    );
};

// Simple Markdown Formatter
const formatMessage = (text, linkColor) => {
    if (!text) return text;
    // Bold
    let formatted = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    // Italic
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
    // Strikethrough
    formatted = formatted.replace(/~(.*?)~/g, '<del>$1</del>');
    // Monospace
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
    // Links (http/https)
    const linkAttr = linkColor ? `class="msg-link" style="color:${linkColor}"` : `class="msg-link"`;
    formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, `<a ${linkAttr} href="$1" target="_blank" rel="noopener noreferrer">$1</a>`);
    // Links (www. without protocol)
    formatted = formatted.replace(/(^|\s)(www\.[\w.-]+\.[a-zA-Z]{2,}(?:[\/\w#?&=%+.-]*)?)/g, (m, pre, url) => {
        const safeUrl = `https://${url}`;
        return `${pre}<a ${linkAttr} href="${safeUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    // Bare domains (no protocol, no www)
    formatted = formatted.replace(/(^|\s)((?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:[\/\w#?&=%+.-]*)?)/g, (m, pre, domain) => {
        // Avoid converting emails handled later
        if (/^[\w.+-]+@/.test(domain)) return m;
        const safeUrl = `https://${domain}`;
        return `${pre}<a ${linkAttr} href="${safeUrl}" target="_blank" rel="noopener noreferrer">${domain}</a>`;
    });
    // Emails
    formatted = formatted.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, `<a ${linkAttr} href="mailto:$1" rel="noopener noreferrer">$1</a>`);

    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
};

// Extract links from plain text (http/https, www.*, and bare domains)
const extractLinks = (text) => {
    if (!text) return [];
    const urls = new Set();
    // http/https
    (text.match(/https?:\/\/[^\s]+/g) || []).forEach(u => urls.add(u));
    // www.
    (text.match(/(?:^|\s)(www\.[\w.-]+\.[a-zA-Z]{2,}(?:[\/\w#?&=%+.-]*)?)/g) || [])
        .forEach(m => {
            const u = m.trim();
            if (u) urls.add(`https://${u}`);
        });
    // bare domains
    (text.match(/(?:^|\s)((?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:[\/\w#?&=%+.-]*)?)/g) || [])
        .forEach(m => {
            const u = m.trim();
            if (u && !/^[\w.+-]+@/.test(u)) urls.add(`https://${u}`);
        });
    return Array.from(urls);
};

// Deterministic pseudo-random color for name bubbles based on author
const getNameBubbleColor = (author) => {
    if (!author) return 'var(--accent-primary)';
    let hash = 0;
    for (let i = 0; i < author.length; i++) {
        hash = author.charCodeAt(i) + ((hash << 5) - hash);
        hash |= 0; // keep 32-bit
    }
    const hue = Math.abs(hash) % 360; // 0-359
    const saturation = 70;
    const lightness = 45;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const ChatWindow = ({ user, currentChat, socket, isMobile, onBack, room, mediaMessages, links, webRTC, isGroupCall, callState, activeCall, onStartCall, onEndCall, onAnswerCall, onRejectCall, theme, friends = [], groups = [], channels = [], toggleInfo, username, onlineUsers = [] }) => {
    const pinAnimContainerRef = useRef(null);
    const pinAnimInstanceRef = useRef(null);
    const [roleViewportWidth, setRoleViewportWidth] = useState(null);
    const rolesViewportRef = useRef(null);



    // Ensure lottie-web is available, then mount the red pin animation
    useEffect(() => {
        let disposed = false;
        const ensureLottie = () => new Promise((resolve) => {
            if (window && window.lottie && typeof window.lottie.loadAnimation === 'function') return resolve(window.lottie);
            const id = 'lottie-web-player';
            let s = document.getElementById(id);
            if (!s) {
                s = document.createElement('script');
                s.id = id;
                s.src = 'https://unpkg.com/lottie-web/build/player/lottie.min.js';
                s.onload = () => resolve(window.lottie);
                document.head.appendChild(s);
            } else {
                s.addEventListener('load', () => resolve(window.lottie), { once: true });
                // also poll briefly in case it already loaded
                const iv = setInterval(() => {
                    if (window && window.lottie) { clearInterval(iv); resolve(window.lottie); }
                }, 100);
                setTimeout(() => clearInterval(iv), 3000);
            }
        });

        ensureLottie().then((lottie) => {
            if (disposed || !pinAnimContainerRef.current || !lottie) return;
            try {
                pinAnimInstanceRef.current = lottie.loadAnimation({
                    container: pinAnimContainerRef.current,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    animationData: redPinJson,
                    rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true }
                });
            } catch (_) { /* ignore */ }
        });

        return () => {
            disposed = true;
            try { pinAnimInstanceRef.current && pinAnimInstanceRef.current.destroy && pinAnimInstanceRef.current.destroy(); } catch (_) { }
            pinAnimInstanceRef.current = null;
        };
    }, []);

    // Measure first 4 bubbles and set viewport width so only ~4 show at a time (with horizontal scroll)
    useEffect(() => {
        const el = rolesViewportRef.current;
        if (!el) return;
        const recompute = () => {
            try {
                const strip = el.querySelector('.roles-strip');
                if (!strip) return;
                const children = Array.from(strip.querySelectorAll('.role-bubble'));
                let width = 0;
                const gap = 8;
                for (let i = 0; i < children.length && i < 4; i++) {
                    width += children[i].offsetWidth;
                    if (i < 3) width += gap;
                }
                // Fallback width if not measured yet
                if (!width || width < 1) width = 4 * 110 + 3 * gap;
                setRoleViewportWidth(width);
            } catch (_) { }
        };
        const id = requestAnimationFrame(recompute);
        let ro;
        try {
            ro = new ResizeObserver(recompute);
            ro.observe(el);
        } catch (_) { }
        window.addEventListener('resize', recompute);
        return () => {
            cancelAnimationFrame(id);
            window.removeEventListener('resize', recompute);
            try { ro && ro.disconnect(); } catch (_) { }
        };
    }, [currentChat]);
    const [currentMessage, setCurrentMessage] = useState("");
    const [messageList, setMessageList] = useState([]);
    const [file, setFile] = useState(null);
    // const [showContactInfo, setShowContactInfo] = useState(false); // Controlled by parent now

    const [replyTo, setReplyTo] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
    const [showContactInfo, setShowContactInfo] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [viewingStory, setViewingStory] = useState(null);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [headerBlurred, setHeaderBlurred] = useState(false);
    const [gooActive, setGooActive] = useState(false);
    const [isReplyAnimating, setIsReplyAnimating] = useState(false);
    const [isReplyExiting, setIsReplyExiting] = useState(false);
    const [forwardingMessage, setForwardingMessage] = useState(null);
    // Channel comments
    const [showCommentForMsgId, setShowCommentForMsgId] = useState(null);
    const [commentInputByMsg, setCommentInputByMsg] = useState({}); // { [msgId]: string }
    const [inputMode, setInputMode] = useState('normal'); // 'normal' | 'shrinking' | 'reply'
    const [footerAnimStage, setFooterAnimStage] = useState('idle'); // 'idle' | 'expanding'
    const [commentsByMsg, setCommentsByMsg] = useState({}); // { [msgId]: Array<{ id, userId, author, text, ts }>
    const [slotPositions, setSlotPositions] = useState({}); // { [msgId]: [{ top, leftPct }, ...] }
    const [rotateSampleByMsg, setRotateSampleByMsg] = useState({}); // { [msgId]: number[] indices }
    const [rotationVersion, setRotationVersion] = useState(0);
    // Animated input hint state
    // Animated input hint state removed
    // const [hintIndex, setHintIndex] = useState(0); 
    // const [hintPhase, setHintPhase] = useState('reveal'); 
    // const [hintKey, setHintKey] = useState(0); 
    // const hintTexts = [...];
    // Grapheme-safe splitter so emojis render as one unit
    const splitGraphemes = (str) => {
        try {
            if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                return Array.from(seg.segment(str || ''), s => s.segment);
            }
        } catch (_) { }
        return Array.from(str || '');
    };

    // Typing deletion overlay state
    const prevTypedValueRef = useRef('');
    const [delOverlay, setDelOverlay] = useState({ show: false, prev: '', nextLen: 0 });
    // Performance: limit initial render count to unblock entry animations
    const [renderLimit, setRenderLimit] = useState(15);
    const chatBodyRef = useRef(null);
    const [previousScrollHeight, setPreviousScrollHeight] = useState(0);


    useEffect(() => {
        const prev = prevTypedValueRef.current || '';
        const next = currentMessage || '';
        // Tail deletion detection (common case): prev starts with next
        if (prev.length > next.length && prev.startsWith(next)) {
            const nextLen = splitGraphemes(next).length;
            setDelOverlay({ show: true, prev, nextLen });
            // update ref immediately so subsequent keystrokes compare correctly
            prevTypedValueRef.current = next;
            const id = setTimeout(() => setDelOverlay({ show: false, prev: '', nextLen: 0 }), 340);
            return () => clearTimeout(id);
        }
        prevTypedValueRef.current = next;
    }, [currentMessage]);

    // Deferred rendering effect to fix "detach" animation lag
    useEffect(() => {
        // Reset to small limit on chat change for speed
        setRenderLimit(15);

        // After animation clears (approx 600-800ms), render a bit more to fill screen
        // but DO NOT render 10,000 messages instantly as that freezes the UI
        const t = setTimeout(() => {
            if (chatBodyRef.current) {
                setPreviousScrollHeight(chatBodyRef.current.scrollHeight);
            }
            setRenderLimit(prev => Math.max(prev, 30));
        }, 900);

        return () => clearTimeout(t);
    }, [currentChat?.id]);

    // Restore scroll position when we load older messages
    useLayoutEffect(() => {
        if (chatBodyRef.current && previousScrollHeight > 0) {
            const newScrollHeight = chatBodyRef.current.scrollHeight;
            const diff = newScrollHeight - previousScrollHeight;
            if (diff > 0) {
                chatBodyRef.current.scrollTop += diff;
            }
            setPreviousScrollHeight(0);
        }
    }, [renderLimit, previousScrollHeight]);

    // Hint animation effect removed
    /*
    useEffect(() => { ... }, [hintPhase, hintIndex, currentMessage]);
    */
    const [expandedComment, setExpandedComment] = useState(null); // { msgId, commentId }
    const [infoForMsg, setInfoForMsg] = useState(null); // message object to show info modal
    const [expandedAnim, setExpandedAnim] = useState(false);
    const [commentsLoaded, setCommentsLoaded] = useState(false);
    // Dynamic offset for emoji/sticker pickers when info sidebar is open
    const [infoSidebarWidth, setInfoSidebarWidth] = useState(350);
    const [channelPhotoUrl, setChannelPhotoUrl] = useState('');

    // Calling state
    // const [callState, setCallState] = useState(null); 
    // const [activeCall, setActiveCall] = useState(null);
    // const isGroupCall = currentChat?.isGroup || currentChat?.isChannel;

    // WebRTC hook
    // const webRTC = useWebRTC(socket, user, currentChat, isGroupCall);

    useEffect(() => {
        let ro;
        const measure = () => {
            try {
                const el = document.querySelector('.contact-info-sidebar');
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect && rect.width) setInfoSidebarWidth(Math.round(rect.width));
                }
            } catch (_) { }
        };
        // initial measure
        measure();
        // observe sidebar if present
        try {
            const el = document.querySelector('.contact-info-sidebar');
            if (el && 'ResizeObserver' in window) {
                ro = new ResizeObserver(measure);
                ro.observe(el);
            }
        } catch (_) { }
        const onResize = () => measure();
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            try { ro && ro.disconnect(); } catch (_) { }
        };
    }, [showContactInfo, currentChat?.showInfo]);

    // Ensure right sidebar (contact info) opens by default when entering a chat
    useEffect(() => {
        try {
            if (!currentChat) return;
            // If parent-controlled flag exists and is false, toggle to open
            if (currentChat.showInfo === false) {
                typeof toggleInfo === 'function' && toggleInfo();
            }
            // Also reflect locally if used anywhere
            setShowContactInfo(true);
        } catch (_) { }
    }, [currentChat?.id]);



    // Cache channel photo/avatar so non-admin/user side can render the exact admin-set image reliably
    useEffect(() => {
        try {
            if (currentChat?.isChannel && currentChat?.id) {
                const photo = currentChat.photo || currentChat.avatar;
                if (photo) localStorage.setItem('channel_photo_' + currentChat.id, photo);
            }
        } catch (_) { /* ignore */ }
    }, [currentChat?.id, currentChat?.isChannel, currentChat?.photo, currentChat?.avatar]);

    // Hydrate a stable channel photo for use everywhere (header + message avatars)
    useEffect(() => {
        let abort = false;
        const load = async () => {
            if (!currentChat?.isChannel || !currentChat?.id) { setChannelPhotoUrl(''); return; }
            // 1) Try cached immediately
            try {
                const cached = localStorage.getItem('channel_photo_' + currentChat.id);
                if (cached) setChannelPhotoUrl(cached);
            } catch (_) { /* ignore */ }
            // 2) Prefer currentChat.photo if present
            if (currentChat?.photo && !abort) setChannelPhotoUrl(currentChat.photo);
            // 3) Fetch latest from server to ensure user side matches admin
            try {
                const res = await fetch(`http://localhost:3001/channels/${currentChat.id}`);
                if (!res.ok) return;
                const data = await res.json();
                const url = data?.photo || data?.avatar || '';
                if (!abort && url) {
                    setChannelPhotoUrl(url);
                    try { localStorage.setItem('channel_photo_' + currentChat.id, url); } catch (_) { }
                }
                // Also cache creator/admin avatar for user-side post avatars
                try {
                    const creatorId = data?.createdBy || currentChat?.createdBy;
                    const creatorAvatar = (data?.creator && data.creator.avatar)
                        || (data?.owner && data.owner.avatar)
                        || data?.createdByAvatar
                        || (Array.isArray(data?.adminsDetails) ? (data.adminsDetails.find(u => String(u.id) === String(creatorId))?.avatar) : undefined);
                    if (creatorId && creatorAvatar) {
                        localStorage.setItem('user_avatar_' + String(creatorId), creatorAvatar);
                        localStorage.setItem('user_avatar_ver_' + String(creatorId), String(Date.now()));
                    }
                } catch (_) { /* ignore */ }

                // Populate messageList with channel posts
                if (Array.isArray(data.posts)) {
                    const mappedPosts = data.posts.slice().reverse().map(p => ({
                        ...p,
                        message: p.text || '',
                        file: p.imageUrl ? { url: p.imageUrl, type: 'image/jpeg', name: 'image.jpg' } : null,
                        time: new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        room: currentChat.id,
                        isChannelPost: true
                    }));
                    setMessageList(mappedPosts);
                }
            } catch (_) { /* network optional */ }
        };
        load();
        return () => { abort = true; };
    }, [currentChat?.id, currentChat?.isChannel, currentChat?.photo]);

    // Ensure menus close and comments can render when switching/re-entering chats
    useEffect(() => {
        setActiveMenuMessageId(null);
        setExpandedComment(null);
    }, [currentChat?.id]);

    const [confirmForward, setConfirmForward] = useState(null); // { friend, message }
    const [viewingImage, setViewingImage] = useState(null);
    const [viewingImageIndex, setViewingImageIndex] = useState(-1);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showPollCreator, setShowPollCreator] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);

    // Reactions real-time listener (channels, groups, DMs)
    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            const roomId = String(data.room);
            if (String(roomId) !== String(currentChat?.id)) return;
            setMessageList(prev => prev.map(m => String(m.id) === String(data.msgId) ? { ...m, reactions: data.reactions || {} } : m));
        };
        socket.on('receive_reaction', handler);
        return () => { socket.off('receive_reaction', handler); };
    }, [socket, currentChat?.id]);

    // Realtime channel comments listener
    useEffect(() => {
        if (!socket) return;
        const onComment = (data) => {
            try {
                const roomId = String(data.room);
                if (String(roomId) !== String(currentChat?.id)) return;
                const { msgId, comment } = data || {};
                if (!msgId || !comment) return;
                setCommentsByMsg(prev => {
                    const arr = prev[msgId] || [];
                    // avoid duplicates by id
                    if (arr.some(c => String(c.id) === String(comment.id))) return prev;
                    return { ...prev, [msgId]: [...arr, comment] };
                });
            } catch (_) { }
        };
        socket.on('channel_comment', onComment);
        const onDelete = (data) => {
            try {
                const roomId = String(data.room);
                if (String(roomId) !== String(currentChat?.id)) return;
                const { msgId, commentId } = data || {};
                if (!msgId || !commentId) return;
                setCommentsByMsg(prev => {
                    const arr = prev[msgId] || [];
                    const nextArr = arr.filter(c => String(c.id) !== String(commentId));
                    if (nextArr === arr) return prev;
                    return { ...prev, [msgId]: nextArr };
                });
            } catch (_) { }
        };
        socket.on('channel_comment_delete', onDelete);
        return () => { socket.off('channel_comment', onComment); socket.off('channel_comment_delete', onDelete); };
    }, [socket, currentChat?.id]);

    // Track channel views (unique per latest post). Ensure we record on entering channel,
    // after a brief delay (to allow latest post to persist), and on visibility/focus.
    useEffect(() => {
        if (!(currentChat?.isChannel && user?.id)) return;
        let timeoutId;
        const ping = () => fetch(`http://localhost:3001/channels/${currentChat.id}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
        }).catch(() => { });

        // immediate ping on entering channel
        ping();
        // delayed ping to cover race where latest post arrives after mount
        timeoutId = setTimeout(ping, 800);

        // Debounced visibility/focus pings
        let last = 0;
        const DEBOUNCE_MS = 10000;
        const tryPing = () => {
            const now = Date.now();
            if (now - last >= DEBOUNCE_MS) {
                last = now;
                ping();
            }
        };
        const onFocus = () => currentChat?.isChannel && tryPing();
        const onVisibility = () => {
            if (document.visibilityState === 'visible' && currentChat?.isChannel) tryPing();
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [currentChat?.id, currentChat?.isChannel, user?.id]);

    // When messages list updates in a channel, attempt one view ping to ensure the latest post was counted
    useEffect(() => {
        if (!(currentChat?.isChannel && user?.id)) return;
        // If there are messages rendered now, try recording a view once
        const ping = () => fetch(`http://localhost:3001/channels/${currentChat.id}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
        }).catch(() => { });
        const id = setTimeout(ping, 200);
        return () => clearTimeout(id);
    }, [currentChat?.id, currentChat?.isChannel, user?.id, messageList.length]);

    // Persisted channel reactions: fetch channel details and merge post.reactions into messageList
    useEffect(() => {
        let cancelled = false;
        const mergeReactions = async () => {
            if (!currentChat?.isChannel || !currentChat?.id) return;
            try {
                const res = await fetch(`http://localhost:3001/channels/${currentChat.id}`);
                const data = await res.json();
                const posts = Array.isArray(data?.posts) ? data.posts : [];
                if (cancelled || posts.length === 0) return;
                const reactionMap = new Map(posts.map(p => [String(p.id), p.reactions || {}]));
                setMessageList(prev => prev.map(m => {
                    const r = reactionMap.get(String(m.id));
                    if (!r) return m;
                    return { ...m, reactions: r };
                }));
            } catch (_) { /* ignore */ }
        };
        mergeReactions();
        return () => { cancelled = true; };
    }, [currentChat?.id, currentChat?.isChannel, messageList.length]);

    // Determine if current user is blocked in the open channel
    useEffect(() => {
        let cancelled = false;
        const checkBlocked = async () => {
            try {
                if (!(currentChat?.isChannel && currentChat?.id && user?.id)) { setIsBlocked(false); blockedSnapshotRef.current = null; return; }
                const res = await fetch(`http://localhost:3001/channels/${currentChat.id}`);
                const data = await res.json();
                const blockedArr = Array.isArray(data?.blocked) ? data.blocked : [];
                const blocked = blockedArr.map(String).includes(String(user.id));
                if (!cancelled) {
                    setIsBlocked(blocked);
                    if (blocked && !blockedSnapshotRef.current) {
                        // Capture a snapshot of currently visible messages to freeze the timeline (no new posts)
                        try {
                            const base = (messageList || []).filter(m => (m.room && room && m.room === room) || (m.to && currentChat?.id && m.to === currentChat.id));
                            blockedSnapshotRef.current = base.slice();
                        } catch (_) { blockedSnapshotRef.current = null; }
                    }
                }
            } catch (_) {
                if (!cancelled) setIsBlocked(false);
            }
        };
        checkBlocked();
        return () => { cancelled = true; };
    }, [currentChat?.id, currentChat?.isChannel, user?.id, room, messageList.length]);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [reactionsPickerFor, setReactionsPickerFor] = useState(null); // messageId
    const [reactionsPickerPos, setReactionsPickerPos] = useState({ left: 0, top: 0 });
    const [menuVerticalPos, setMenuVerticalPos] = useState('bottom'); // 'top' | 'bottom'
    // Doodle state
    const [isDoodling, setIsDoodling] = useState(false);
    const [penColor, setPenColor] = useState('#ffeb3b');
    const [penWidth, setPenWidth] = useState(3);
    const [penMode, setPenMode] = useState('pen'); // 'pen' | 'erase'
    const canvasRef = useRef(null);
    const canvasWrapRef = useRef(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef(null);
    const [externalFileData, setExternalFileData] = useState(null); // { url, type, name, isSticker? }

    const [giphyResults, setGiphyResults] = useState([]);
    const [giphyTab, setGiphyTab] = useState('gifs'); // 'gifs' | 'stickers'
    const [giphyQuery, setGiphyQuery] = useState('');
    const [giphyLoading, setGiphyLoading] = useState(false);
    const [giphyOffset, setGiphyOffset] = useState(0);
    const [giphyHasMore, setGiphyHasMore] = useState(true);
    const GIPHY_PAGE_SIZE = 24;

    useEffect(() => {
        let attached = false;
        const onDocClick = () => setReactionsPickerFor(null);
        if (reactionsPickerFor) {
            const id = setTimeout(() => {
                document.addEventListener('click', onDocClick);
                attached = true;
            }, 0);
            return () => {
                clearTimeout(id);
                if (attached) document.removeEventListener('click', onDocClick);
            };
        }
        return () => { };
    }, [reactionsPickerFor]);

    const emojiPickerRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
                // Check if click is on the plus button (optional, but good for safety if stopPropagation fails)
                // But since plus button toggles, we might want to let it handle it?
                // If we close here, and plus button also toggles, we might get conflicts.
                // But plus button has stopPropagation, so this listener shouldn't fire for plus button clicks.
                setShowEmojiPicker(false);
            }
        };
        if (showEmojiPicker) {
            // Use setTimeout to avoid catching the opening click if it bubbles (though stopPropagation should prevent it)
            const id = setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
            return () => {
                clearTimeout(id);
                document.removeEventListener('click', handleClickOutside);
            };
        }
    }, [showEmojiPicker]);

    // Mentions (@) state and helpers
    const [showMention, setShowMention] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionList, setMentionList] = useState([]);
    const [mentionIndex, setMentionIndex] = useState(0);
    const inputRef = useRef(null);

    const computeMembers = useCallback(() => {
        const usersMap = new Map();

        // Helper to add user
        const addUser = (u) => {
            if (!u) return;
            // If u is just a string (ID or name), we can't do much for avatar unless we have a lookup.
            // But we want to avoid showing IDs.
            if (typeof u === 'string') {
                // Heuristic: if it looks like a long ID, skip it. 
                // Or just skip strings entirely if we expect objects.
                // Let's assume valid names don't have numbers mixed in a way that looks like UUID/ObjectId, 
                // but simple names are fine.
                // For now, let's skip strings if we want "only group member with their avatar properly".
                // But message authors are strings (names).
                // Let's treat strings as names if they are not super long/complex?
                // Actually, the user complaint is "ids are showing".
                // So let's try to only accept objects with names, OR strings that are clearly names (from messageList).
                return;
            }

            const name = u.username || u.name || u.displayName;
            const id = u.id || u._id || name;
            const avatar = u.avatar || u.profilePic || u.profilePicture;

            if (name && typeof name === 'string') {
                // Filter out 'system' user
                if (name.toLowerCase() === 'system') return;

                // Deduplicate by name or ID
                if (!usersMap.has(name)) {
                    usersMap.set(name, { name, id, avatar });
                }
            }
        };

        try {
            const list = Array.isArray(currentChat?.members) ? currentChat.members : (Array.isArray(currentChat?.participants) ? currentChat.participants : []);
            list.forEach(addUser);
        } catch (_) { }

        // Remove ID-based fallbacks (admins, memberRoles, createdBy) as they cause the issue.

        // Fallback: message authors (usually names)
        try {
            (messageList || []).forEach(m => {
                if (!m) return;
                const inThis = (m.room && room && m.room === room) || (m.to && currentChat?.id && m.to === currentChat.id) || (currentChat?.isChannel && String(m.room) === String(currentChat?.id));
                if (!inThis) return;

                // m.author is usually a name string. m.sender might be an object?
                // If m.author is a name, we can add it, but we won't have an avatar unless we look it up.
                // But it's better than missing them.
                const name = m.author || m.username;
                if (name && typeof name === 'string' && !usersMap.has(name)) {
                    // Check if it looks like an ID? 
                    // Assuming authors are names.
                    usersMap.set(name, { name, id: name, avatar: m.avatar || m.userAvatar });
                }
            });
        } catch (_) { }

        if (username) usersMap.delete(username);

        return Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [currentChat?.members, currentChat?.participants, messageList, room, username, currentChat?.id, currentChat?.isChannel]);

    const updateMentionDetection = useCallback((value, caretPos) => {
        try {
            const upto = typeof caretPos === 'number' ? caretPos : value.length;
            const left = value.slice(0, upto);
            let at = left.lastIndexOf('@');
            if (at === -1) { setShowMention(false); setMentionQuery(''); return; }
            const query = left.slice(at + 1);
            if (/\s/.test(query)) { setShowMention(false); setMentionQuery(''); return; }
            const all = computeMembers();
            const filtered = all.filter(u => u.name.toLowerCase().startsWith(query.toLowerCase()))
                .slice(0, 8);
            setMentionList(filtered);
            setMentionIndex(0);
            setMentionQuery(query);
            setShowMention(true);
        } catch (_) { setShowMention(false); }
    }, [computeMembers]);

    const insertMention = useCallback((name) => {
        try {
            const el = inputRef.current;
            const caret = el ? el.selectionStart : (currentMessage || '').length;
            const value = currentMessage || '';
            const left = value.slice(0, caret);
            const right = value.slice(caret);
            const at = left.lastIndexOf('@');
            if (at === -1) return;
            const prefix = left.slice(0, at);
            const mentionText = `@${name} `;
            const nextVal = prefix + mentionText + right;
            setCurrentMessage(nextVal);
            setShowMention(false);
            setMentionQuery('');
            setTimeout(() => {
                try {
                    if (inputRef.current) {
                        const pos = (prefix + mentionText).length;
                        inputRef.current.focus();
                        inputRef.current.setSelectionRange(pos, pos);
                    }
                } catch (_) { }
            }, 0);
        } catch (_) { }
    }, [currentMessage, setCurrentMessage]);

    // Run mention detection whenever the input value changes, to be robust
    useEffect(() => {
        try {
            const caret = inputRef.current ? inputRef.current.selectionStart : (currentMessage || '').length;
            updateMentionDetection(currentMessage || '', caret);
        } catch (_) { /* noop */ }
    }, [currentMessage, updateMentionDetection]);





    // Reminders (per room) { id, msgId, dueAt, author, text }
    const REMINDER_KEY = (roomId) => `reminders_${roomId}`;
    const loadReminders = (roomId) => {
        try { const raw = localStorage.getItem(REMINDER_KEY(roomId)); return raw ? JSON.parse(raw) : []; } catch (_) { return []; }
    };
    const saveReminders = (roomId, arr) => { try { localStorage.setItem(REMINDER_KEY(roomId), JSON.stringify(arr)); } catch (_) { } };
    const scheduleReminder = (baseMsg, offsetMs) => {
        if (!room || !baseMsg) return;
        const dueAt = Date.now() + offsetMs;
        const entry = {
            id: `${baseMsg.id}_${dueAt}`,
            msgId: baseMsg.id,
            dueAt,
            author: baseMsg.author,
            text: baseMsg.message || (baseMsg.file ? baseMsg.file.name : 'Attachment')
        };
        const all = loadReminders(room);
        all.push(entry);
        saveReminders(room, all);
        // Add system message confirmation locally
        setMessageList(prev => [...prev, {
            id: 'sys_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: 'system',
            message: `Reminder set for "${entry.text.substring(0, 20)}${entry.text.length > 20 ? '...' : ''}" in ${Math.round(offsetMs / 60000)} minutes.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            room: room
        }]);
    };

    // Reminder ticker
    useEffect(() => {
        if (!room) return;
        const tick = () => {
            const all = loadReminders(room);
            const now = Date.now();
            const due = all.filter(r => r.dueAt <= now);
            const rest = all.filter(r => r.dueAt > now);
            if (due.length > 0) {
                saveReminders(room, rest);
                // Post system reminder messages
                due.forEach(r => {
                    const sys = {
                        id: `${r.id}_reminder`,
                        room,
                        author: 'system',
                        type: 'system',
                        message: `Reminder • ${r.author}: ${r.text}`,
                        timestamp: Date.now(),
                        to: currentChat?.id
                    };
                    setMessageList(list => [...list, sys]);
                });
            }
        };
        const iv = setInterval(tick, 15000);
        // also run once on mount
        tick();
        return () => clearInterval(iv);
    }, [room, currentChat?.id]);

    // Voice notes
    const mediaRecorderRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedChunks, setRecordedChunks] = useState([]);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimerRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(null);
    const sourceRef = useRef(null);
    const animationIdRef = useRef(null);
    const recordingCanvasRef = useRef(null);
    const mediaStreamRef = useRef(null);

    // Pinned messages (local persistence per room)
    const [pinnedIds, setPinnedIds] = useState([]);
    const [pinnedSyncedChatId, setPinnedSyncedChatId] = useState(null);
    // Guard to prevent immediate remote overwrites after a local toggle
    // Guard to prevent immediate remote overwrites after a local toggle
    const pinnedGuardUntilRef = useRef(0);
    // Debounce rapid pin/unpin taps to avoid double toggles
    const pinBusyUntilRef = useRef(0);
    const [showPinnedExpanded, setShowPinnedExpanded] = useState(false);
    const [showPinned, setShowPinned] = useState(false);
    // Restart detach animation each time pinned bar is shown
    const [pinAnimKey, setPinAnimKey] = useState(0);
    const [useSmallAttachAnim, setUseSmallAttachAnim] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [isDetaching, setIsDetaching] = useState(false);
    const [headerStretch, setHeaderStretch] = useState(false);
    const [startDetach, setStartDetach] = useState(false);
    const [meshActive, setMeshActive] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    // Cycling through multiple pinned messages
    const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);
    const [replyOverlayVisible, setReplyOverlayVisible] = useState(false);

    // Animation controls for chat header stretch
    const headerControls = useAnimation();

    // Trigger header width stretch when pinned bar attaches
    // Trigger header width stretch when pinned bar attaches
    // REDUNDANT: Conflics with CSS-based headerStretchDetach/Attach. Removed to fix double-glitch.
    /*
    useEffect(() => {
        if (showPinned) {
            headerControls.start({
                width: ["100%", "104%", "97%", "102%", "100%"],
                transition: { duration: 0.7, ease: "easeInOut" }
            });
        }
    }, [showPinned, headerControls]);
    */
    const [pinnedTextKey, setPinnedTextKey] = useState(0);

    // Animation control refs to prevent overlapping animations
    const animationTimersRef = useRef([]);
    const lastAnimationTimeRef = useRef(0);
    const isAnimationBusyRef = useRef(false);

    // High-contrast text while gradient overlay runs for readability
    // High-contrast text while gradient overlay runs for readability
    const [pinHighContrast, setPinHighContrast] = useState(false);

    // Suppress message entry animations on chat switch (initial load)
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Reset initial load state when room/chat changes
    useLayoutEffect(() => {
        setIsInitialLoad(true);
    }, [room, currentChat?.id]);


    const getUIMode = useCallback(() => {
        try {
            const el = document.documentElement;
            const attr = (el.getAttribute('data-theme') || '').toLowerCase();
            if (attr === 'light' || attr === 'dark') return attr;
            if (el.classList.contains('theme-light')) return 'light';
            if (el.classList.contains('theme-dark')) return 'dark';
            return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        } catch (_) { return 'light'; }
    }, []);
    const [uiMode, setUiMode] = useState(() => getUIMode());

    // Performance optimization: disable expensive goo blur when too many messages
    const [useLightweightMode, setUseLightweightMode] = useState(false);

    // Flag to detect if we are just restoring pinned messages (navigating) or adding new ones
    const isRestoringRef = useRef(false);

    // Helper function to clear all pending animation timers
    const clearAllAnimationTimers = useCallback(() => {
        animationTimersRef.current.forEach(timer => clearTimeout(timer));
        animationTimersRef.current = [];
    }, []);

    useEffect(() => { setUiMode(getUIMode()); }, [theme, getUIMode]);
    useEffect(() => {
        const onChange = () => setUiMode(getUIMode());
        try {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            mq.addEventListener && mq.addEventListener('change', onChange);
        } catch (_) { }
        return () => {
            try {
                const mq = window.matchMedia('(prefers-color-scheme: dark)');
                mq.removeEventListener && mq.removeEventListener('change', onChange);
            } catch (_) { }
        };
    }, [getUIMode]);
    const highContrastColor = useMemo(() => (uiMode === 'light' ? '#000000' : '#ffffff'), [uiMode]);
    const highContrastShadow = useMemo(() => (uiMode === 'light' ? '0 1px 2px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.45)'), [uiMode]);
    useEffect(() => {
        let startId, endId;
        if (showPinned && pinnedIds.length > 0) {
            // Sync with gradient overlay fade-in (≈1.05s) and keep longer for readability (~14s)
            startId = setTimeout(() => setPinHighContrast(true), 1050);
            endId = setTimeout(() => setPinHighContrast(false), 14000);
        } else {
            setPinHighContrast(false);
        }
        return () => { clearTimeout(startId); clearTimeout(endId); };
    }, [showPinned, pinnedIds.join('-')]);

    // Stable scope key for pins to avoid switching between room and currentChat.id
    const pinScope = useMemo(() => String(room ?? currentChat?.id ?? ''), [room, currentChat?.id]);

    // Track server-side updates to pinned messages to sync header
    const serverPinnedHash = useMemo(() => {
        if (!currentChat?.pinnedMessages || !Array.isArray(currentChat.pinnedMessages)) return '';
        return currentChat.pinnedMessages.map(String).sort().join(',');
    }, [currentChat?.pinnedMessages]);

    // Reset pinned state when switching chats to prevent animation
    useEffect(() => {
        // Clear all pending animation timers from previous chat
        clearAllAnimationTimers();
        isAnimationBusyRef.current = false;
        lastAnimationTimeRef.current = 0;

        isRestoringRef.current = true;
        // Attempt to load pins from props immediately to prevent flash
        let initialPins = (currentChat?.pinnedMessages && Array.isArray(currentChat.pinnedMessages))
            ? Array.from(new Set(currentChat.pinnedMessages.map(String)))
            : [];

        // Restore from local storage for persistence
        try {
            const local = JSON.parse(localStorage.getItem(`pinned_${pinScope}`));
            if (Array.isArray(local) && local.length > 0) {
                initialPins = Array.from(new Set([...initialPins, ...local]));
            }
        } catch (_) { }
        setPinnedIds(initialPins);
        setPinnedSyncedChatId(pinScope);
        // Sync prev count ref immediately to avoid spurious transitions (e.g. strict mode double-effect)
        prevPinnedCountRef.current = initialPins.length;

        setIsAnimating(false);
        setIsExiting(false);
        setShowPinned(initialPins.length > 0);
        // Only reset guard if we are switching chats (new scope)
        if (pinScope !== pinnedSyncedChatId) {
            pinnedGuardUntilRef.current = 0;
            setPinAnimKey(0);
        }

        // Safety: Clear restoring flag after a delay in case effect doesn't run (e.g. counts match)
        const t = setTimeout(() => { isRestoringRef.current = false; }, 500);
        return () => clearTimeout(t);
    }, [pinScope, serverPinnedHash, clearAllAnimationTimers, pinnedSyncedChatId]);

    // Track previous pinned count to detect unpinning
    const prevPinnedCountRef = useRef(pinnedIds.length);

    useEffect(() => {
        const prevCount = prevPinnedCountRef.current;
        const currentCount = pinnedIds.length;
        prevPinnedCountRef.current = currentCount;

        // Detect restore/navigation phase
        if (isRestoringRef.current) {
            isRestoringRef.current = false;
            // Instantly sync visibility state without animation for now to fix visibility bugs
            if (currentCount > 0) {
                // Slight delay to ensure DOM is ready and scene is captured before detaching (animating)
                // This matches the "Case 1" logic which uses 100ms
                setTimeout(() => {
                    setShowPinned(true);
                    setIsExiting(false); // Detached state
                    setPinAnimKey(1); // Ensure visual state is "entered" (detached)
                    setIsAnimating(true); // Trigger header reaction

                    // Reset animation state after bounce completes
                    const timer = setTimeout(() => {
                        setIsAnimating(false);
                    }, 650);
                    animationTimersRef.current.push(timer);
                }, 50);
            } else {
                setShowPinned(false);
            }
            return;
        }

        // Debouncing: Prevent rapid animation triggers
        const now = Date.now();
        const timeSinceLastAnimation = now - lastAnimationTimeRef.current;

        // If animation is busy and it's been less than 100ms, skip this update
        if (isAnimationBusyRef.current && timeSinceLastAnimation < 100) {
            return;
        }

        // Clear any existing animation timers before starting new ones
        clearAllAnimationTimers();

        // Case 1: First pin (going from 0 to 1+)
        if (currentCount > 0 && prevCount === 0) {
            isAnimationBusyRef.current = true;
            lastAnimationTimeRef.current = now;

            const startTimer = setTimeout(() => {
                setUseSmallAttachAnim(false); // Enable standard attach animation
                setShowPinned(true);

                // Skip Attach, go straight to Detach (Drop Down)
                setIsExiting(false);
                setIsAnimating(true); // Trigger header reaction
                setPinAnimKey((k) => k + 1);

                const timer1 = setTimeout(() => {
                    setIsAnimating(false);
                    isAnimationBusyRef.current = false;
                }, 650);
                animationTimersRef.current.push(timer1);
            }, 100);
            animationTimersRef.current.push(startTimer);

            return () => {
                clearAllAnimationTimers();
                isAnimationBusyRef.current = false;
            };
        }

        // Case 2: Adding a new pin while others exist (count increased and prev > 0)
        else if (currentCount > prevCount && prevCount > 0) {
            // Skip animation if too rapid, but state is already updated so pin still succeeds
            const shouldAnimate = timeSinceLastAnimation >= 50;

            if (!shouldAnimate) {
                // State already updated by togglePin, just skip the animation
                return;
            }

            isAnimationBusyRef.current = true;
            lastAnimationTimeRef.current = now;

            // Play attach animation, then detach again for the new message
            setUseSmallAttachAnim(false); // Ensure we use the correct attach animation (shrink), not small (grow)
            setIsExiting(true);
            setIsAnimating(true);
            headerControls.start({ borderRadius: '15px', transition: { duration: 0.5, ease: 'easeInOut' } });

            const redetachTimer = setTimeout(() => {
                // After attach completes, pause goo
                setIsAnimating(false);

                // Slight delay to ensure clean state before detach starts
                const timer1 = setTimeout(() => {
                    setIsExiting(false);
                    setUseSmallAttachAnim(false); // Reset to normal animation for replacements
                    setPinAnimKey((k) => k + 1);

                    // Restart goo for detach animation
                    const timer2 = setTimeout(() => {
                        setIsAnimating(true);
                        const timer3 = setTimeout(() => {
                            setIsAnimating(false);
                            isAnimationBusyRef.current = false;
                        }, 650);
                        animationTimersRef.current.push(timer3);
                    }, 50);
                    animationTimersRef.current.push(timer2);
                }, 10);
                animationTimersRef.current.push(timer1);
            }, 1150);
            animationTimersRef.current.push(redetachTimer);

            return () => {
                clearAllAnimationTimers();
                isAnimationBusyRef.current = false;
            };
        }

        // Case 3: Unpinned one message (count decreased but still > 0)
        else if (currentCount > 0 && currentCount < prevCount) {
            // Skip animation if too rapid, but state is already updated so unpin still succeeds
            const shouldAnimate = timeSinceLastAnimation >= 50;

            if (!shouldAnimate) {
                // State already updated by togglePin, just skip the animation
                return;
            }

            isAnimationBusyRef.current = true;
            lastAnimationTimeRef.current = now;

            // Play attach animation with goo blur, then detach again for the next message
            setIsExiting(true);
            setUseSmallAttachAnim(false); // Ensure small animation is off for unpin+repin sequence

            setIsAnimating(true);
            headerControls.start({ borderRadius: '15px', transition: { duration: 0.5, ease: 'easeInOut' } });

            const redetachTimer = setTimeout(() => {
                // After attach completes, reset and play detach for next message
                setIsAnimating(false);
                setIsExiting(false);
                setPinAnimKey((k) => k + 1);

                setPinnedTextKey((k) => k + 1);

                const timer1 = setTimeout(() => {
                    setIsAnimating(true);
                    const timer2 = setTimeout(() => {
                        setIsAnimating(false);
                        isAnimationBusyRef.current = false;
                    }, 650);
                    animationTimersRef.current.push(timer2);
                }, 50);
                animationTimersRef.current.push(timer1);
            }, 1150);
            animationTimersRef.current.push(redetachTimer);

            return () => {
                clearAllAnimationTimers();
                isAnimationBusyRef.current = false;
            };
        }

        // Case 4: All messages unpinned (count went to 0)
        else if (currentCount === 0 && prevCount > 0) {
            isAnimationBusyRef.current = true;
            lastAnimationTimeRef.current = now;

            // Play attach animation with goo blur for a smooth exit
            setUseSmallAttachAnim(false); // Ensure standard attach animation
            setIsExiting(true);

            setIsAnimating(true);
            headerControls.start({ borderRadius: '15px', transition: { duration: 0.5, ease: 'easeInOut' } });

            const timer = setTimeout(() => {
                setShowPinned(false);
                setIsExiting(false);
                setIsAnimating(false);
                isAnimationBusyRef.current = false;
            }, 1500);
            animationTimersRef.current.push(timer);

            return () => {
                clearAllAnimationTimers();
                isAnimationBusyRef.current = false;
            };
        }
    }, [pinnedIds.length, clearAllAnimationTimers]);

    // WATCHDOG: Safety mechanism to prevent "sticky" lag
    // If isAnimating stays true for > 2000ms (longer than any valid animation), force reset it.
    useEffect(() => {
        if (!isAnimating) return;

        const watchdog = setTimeout(() => {
            // Force kill animation state if it gets stuck
            setIsAnimating(false);
            isAnimationBusyRef.current = false;
        }, 3500);

        return () => clearTimeout(watchdog);
    }, [isAnimating]);

    // Cycle through pinned messages if there are multiple
    useEffect(() => {
        if (pinnedIds.length > 1) {
            const interval = setInterval(() => {
                setCurrentPinnedIndex((prev) => {
                    const next = (prev + 1) % pinnedIds.length;
                    setPinnedTextKey((k) => k + 1); // Trigger animation
                    return next;
                });
            }, 3000); // Change message every 3 seconds
            return () => clearInterval(interval);
        } else {
            setCurrentPinnedIndex(0);
        }
    }, [pinnedIds.length]);



    // Disable header stretch/detach triggers
    useEffect(() => {
        // no-op: animations removed
    }, [showPinned, isExiting]);

    // Initialize/play the red pin animation when the pill first appears
    useEffect(() => {
        const container = pinAnimContainerRef.current;
        const hasPins = pinnedIds.length > 0;
        if (!hasPins) {
            try {
                if (container) container.style.visibility = 'hidden';
                pinAnimInstanceRef.current && pinAnimInstanceRef.current.stop && pinAnimInstanceRef.current.stop();
            } catch (_) { }
            return;
        }
        if (!container) return; // wait until container is mounted

        const ensureInstance = async () => {
            try {
                const withLottie = (cb) => {
                    const existing = (typeof window !== 'undefined') && window.lottie;
                    if (existing) return cb(existing);
                    // inject script once
                    const id = 'lottie-web-player';
                    let s = document.getElementById(id);
                    if (!s) {
                        s = document.createElement('script');
                        s.id = id;
                        s.src = 'https://unpkg.com/lottie-web/build/player/lottie.min.js';
                        s.onload = () => cb(window.lottie);
                        document.head.appendChild(s);
                    } else if (s && s.onload == null) {
                        s.addEventListener('load', () => cb(window.lottie), { once: true });
                    } else {
                        // as a fallback, poll briefly
                        const iv = setInterval(() => {
                            if (window.lottie) { clearInterval(iv); cb(window.lottie); }
                        }, 100);
                        setTimeout(() => clearInterval(iv), 3000);
                    }
                };

                if (!pinAnimInstanceRef.current) {
                    withLottie((lottie) => {
                        if (!lottie || pinAnimInstanceRef.current) return;
                        pinAnimInstanceRef.current = lottie.loadAnimation({
                            container,
                            renderer: 'svg',
                            loop: true,
                            autoplay: true,
                            animationData: redPinJson,
                            rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
                        });
                        container.style.visibility = 'visible';
                    });
                } else {
                    pinAnimInstanceRef.current.play && pinAnimInstanceRef.current.play();
                    container.style.visibility = 'visible';
                }
            } catch (_) { }
        };
        ensureInstance();
    }, [pinnedIds.length, showPinned]);

    // Slow mode (seconds) and last sent timestamp
    const [slowModeSeconds, setSlowModeSeconds] = useState(0);
    const [lastSentTs, setLastSentTs] = useState(0);

    // Scheduled send
    const [scheduledAt, setScheduledAt] = useState(null);
    // Slow mode UI helpers
    const [showSlowModePanel, setShowSlowModePanel] = useState(false);
    const [nowTick, setNowTick] = useState(Date.now());
    const [highlightedMsgId, setHighlightedMsgId] = useState(null);
    const blockedSnapshotRef = useRef(null);
    const commentRotateTimerRef = useRef(null);

    // Link preview cache: { [url]: { title, description, image, siteName, url } }
    const [linkPreviews, setLinkPreviews] = useState(() => ({}));

    // Helper to check if current user is admin/owner of the chat
    const isUserAdmin = (msg) => {
        const isOwner = String(currentChat?.createdBy) === String(user?.id);
        const isAdmin = (currentChat?.admins || []).some(a => String(a) === String(user?.id));
        return isOwner || isAdmin;
    };

    // Allow comments across channels, groups, and DMs (blocked users cannot unless owner/admin)
    const canCommentOnMessage = (msg) => {
        const isOwner = String(currentChat?.createdBy) === String(user?.id);
        const isAdmin = (currentChat?.admins || []).some(a => String(a) === String(user?.id));
        if (isBlocked && !(isOwner || isAdmin)) return false;
        return true;
    };
    // Rotate displayed comments every 5 seconds if > limit
    useEffect(() => {
        try { if (commentRotateTimerRef.current) clearInterval(commentRotateTimerRef.current); } catch (_) { }
        commentRotateTimerRef.current = setInterval(() => {
            setRotationVersion(v => v + 1);
            setRotateSampleByMsg(prev => {
                const next = { ...prev };
                Object.keys(commentsByMsg || {}).forEach(msgId => {
                    const arr = commentsByMsg[msgId] || [];
                    const limit = 1; // Show only 1 comment at a time
                    if (arr.length <= limit) { next[msgId] = arr.map((_, i) => i); return; }
                    // Cycle through indices: shift by limit
                    const currentIndices = prev[msgId] || [0];
                    const lastIndex = currentIndices[currentIndices.length - 1];
                    // Next set starts after the last one
                    const nextIndices = [(lastIndex + 1) % arr.length];
                    next[msgId] = nextIndices;
                });
                return next;
            });
        }, 5000);
        return () => { try { if (commentRotateTimerRef.current) clearInterval(commentRotateTimerRef.current); } catch (_) { } };
    }, [commentsByMsg, currentChat?.isChannel]);

    const randomPosForComment = (avoidRightSide = false, existingSlots = []) => {
        // Fixed vertical position: Half-in/Half-out (approx -20px)
        const top = -20;

        // Define preferred slots (percentages)
        // Slot 0: Right (85%)
        // Slot 1: Left (15%)
        // Slot 2: Center (50%)
        // Slot 3: Mid-Right (70%)
        // Slot 4: Mid-Left (30%)
        const preferredSlots = [85, 15, 50, 70, 30];

        // Find the first slot that isn't "taken" (too close to an existing slot)
        let bestLeft = 85; // Default to right

        for (let i = 0; i < preferredSlots.length; i++) {
            const candidate = preferredSlots[i];
            let isTaken = false;
            if (existingSlots && existingSlots.length > 0) {
                for (let s of existingSlots) {
                    const sLeft = s.leftPct !== undefined ? s.leftPct : 30;
                    if (Math.abs(sLeft - candidate) < 15) { // 15% buffer
                        isTaken = true;
                        break;
                    }
                }
            }
            if (!isTaken) {
                bestLeft = candidate;
                return { top, leftPct: bestLeft };
            }
        }

        // If all preferred slots taken, find ANY spot with max distance
        let maxDist = -1;
        let bestRandom = 50;
        for (let i = 0; i < 15; i++) {
            const r = 10 + Math.floor(Math.random() * 80);
            let minDist = 100;
            existingSlots.forEach(s => {
                const d = Math.abs((s.leftPct || 30) - r);
                if (d < minDist) minDist = d;
            });
            if (minDist > maxDist) {
                maxDist = minDist;
                bestRandom = r;
            }
        }
        return { top, leftPct: bestRandom };
    };

    const clampPos = (pos, avoidRightSide = false) => {
        if (!pos) return { top: -60, leftPct: 30 };
        let top = pos.top;
        let leftPct = pos.leftPct;
        if (typeof top !== 'number') top = -60;
        if (typeof leftPct !== 'number') leftPct = 30;
        // Free dragging: no clamping
        return { top, leftPct };
    };

    // Delete a comment from a message
    const removeComment = (msgId, commentId) => {
        setCommentsByMsg(prev => {
            const all = Array.isArray(prev[msgId]) ? prev[msgId] : [];
            const next = { ...prev, [msgId]: all.filter(c => String(c.id) !== String(commentId)) };
            return next;
        });
        // Also update rotation indices cache
        setRotateSampleByMsg(prev => {
            const current = commentsByMsg[msgId] || [];
            const newLen = Math.max(0, current.length - 1);
            const limit = currentChat?.isChannel ? 4 : 2;
            const indices = Array.from({ length: newLen }, (_, i) => i).slice(0, limit);
            return { ...prev, [msgId]: indices };
        });
        // Persist and broadcast
        try {
            if (currentChat?.id) {
                const scope = room || currentChat.id;
                const next = { ...(commentsByMsg || {}) };
                next[msgId] = (next[msgId] || []).filter(c => String(c.id) !== String(commentId));
                localStorage.setItem(COMMENTS_KEY(scope), JSON.stringify(next));
                const m = (messageList || []).find(mm => String(mm.id) === String(msgId));
                const key = m ? msgStableKey(m) : `id:${msgId}`;
                const rawByKey = localStorage.getItem(COMMENTS_BY_KEY_KEY(scope));
                const byKey = rawByKey ? (JSON.parse(rawByKey) || {}) : {};
                byKey[key] = (byKey[key] || []).filter(c => String(c.id) !== String(commentId));
                localStorage.setItem(COMMENTS_BY_KEY_KEY(scope), JSON.stringify(byKey));
            }
        } catch (_) { }
        try { socket && socket.emit && socket.emit('channel_comment_delete', { room, msgId, commentId, userId: user?.id }); } catch (_) { }
    };

    // Slot persistence
    const SLOTS_KEY = (scope) => `comment_slots_${scope}`;
    useEffect(() => {
        if (!currentChat?.id) return;
        const scope = room || currentChat.id;
        try {
            const raw = localStorage.getItem(SLOTS_KEY(scope));
            if (raw) setSlotPositions(JSON.parse(raw));
            else setSlotPositions({});
        } catch (_) { setSlotPositions({}); }
    }, [currentChat?.id, room]);

    // Ensure enough slots exist for current comments AND fix overlaps
    useEffect(() => {
        if (!currentChat?.id) return;
        setSlotPositions(prev => {
            const next = { ...prev };
            let changed = false;
            Object.keys(commentsByMsg || {}).forEach(msgId => {
                const count = (commentsByMsg[msgId] || []).length;
                const limit = currentChat?.isChannel ? 4 : 2;
                const needed = Math.min(count, limit);
                let slots = [...(next[msgId] || [])];
                let modified = false;

                // 1. Add needed slots
                if (slots.length < needed) {
                    while (slots.length < needed) {
                        slots.push(randomPosForComment(false, slots));
                    }
                    modified = true;
                }



                // 2. Repulsion pass: ensure no overlaps by nudging (Always run)
                const MIN_DIST = 15;
                for (let pass = 0; pass < 3; pass++) {
                    let moved = false;
                    for (let i = 0; i < slots.length; i++) {
                        for (let j = 0; j < slots.length; j++) {
                            if (i === j) continue;
                            const s1 = slots[i];
                            const s2 = slots[j];

                            // If both manual, allow overlap (user choice)
                            if (s1.manual && s2.manual) continue;

                            const dist = Math.abs(s1.leftPct - s2.leftPct);
                            if (dist < MIN_DIST) {
                                // If s1 is manual, move s2. If s2 is manual, move s1 (handled in next iteration or by symmetry logic below)
                                // If neither manual, move both (existing logic)

                                if (s1.manual) {
                                    // s1 stays, move s2
                                    const dir = s2.leftPct > s1.leftPct ? 1 : -1;
                                    const effectiveDir = (s2.leftPct === s1.leftPct) ? (j > i ? 1 : -1) : dir;
                                    let newLeft = s2.leftPct + (effectiveDir * (MIN_DIST - dist + 2));
                                    if (newLeft < 5) newLeft = 5;
                                    if (newLeft > 95) newLeft = 95;
                                    if (slots[j].leftPct !== newLeft) {
                                        slots[j] = { ...s2, leftPct: newLeft };
                                        moved = true;
                                        modified = true;
                                    }
                                } else if (s2.manual) {
                                    // s2 stays, move s1 (handled when i=j loop runs? No, nested loop. We can move s1 here)
                                    const dir = s1.leftPct > s2.leftPct ? 1 : -1;
                                    const effectiveDir = (s1.leftPct === s2.leftPct) ? (i > j ? 1 : -1) : dir;
                                    let newLeft = s1.leftPct + (effectiveDir * (MIN_DIST - dist + 2));
                                    if (newLeft < 5) newLeft = 5;
                                    if (newLeft > 95) newLeft = 95;
                                    if (slots[i].leftPct !== newLeft) {
                                        slots[i] = { ...s1, leftPct: newLeft };
                                        moved = true;
                                        modified = true;
                                    }
                                } else {
                                    // Neither manual: move s2 away from s1
                                    const dir = s2.leftPct > s1.leftPct ? 1 : -1;
                                    const effectiveDir = (s2.leftPct === s1.leftPct) ? (j > i ? 1 : -1) : dir;
                                    let newLeft = s2.leftPct + (effectiveDir * (MIN_DIST - dist + 2));
                                    if (newLeft < 5) newLeft = 5;
                                    if (newLeft > 95) newLeft = 95;
                                    if (slots[j].leftPct !== newLeft) {
                                        slots[j] = { ...s2, leftPct: newLeft };
                                        moved = true;
                                        modified = true;
                                    }
                                }
                            }
                        }
                    }
                    if (!moved) break;
                }

                if (modified) {
                    next[msgId] = slots;
                    changed = true;
                }
            });
            if (changed) {
                const scope = room || currentChat.id;
                try { localStorage.setItem(SLOTS_KEY(scope), JSON.stringify(next)); } catch (_) { }
                return next;
            }
            return prev;
        });
    }, [commentsByMsg, currentChat?.id, currentChat?.isChannel, room]);

    // Drag slot logic
    const draggingRef = useRef({ active: false, moved: false, msgId: null, slotIndex: -1, startX: 0, startY: 0, startTop: -60, startLeftPct: 30, avoidRight: false });
    const dragRafRef = useRef(null);
    const dragPendingRef = useRef(null);
    const applyDragPending = useCallback(() => {
        dragRafRef.current = null;
        const d = draggingRef.current;
        const next = dragPendingRef.current; if (!d.active || !next) return;
        setSlotPositions(prev => {
            const slots = [...(prev[d.msgId] || [])];
            if (slots[d.slotIndex]) {
                // Mark as manually moved to prevent auto-repulsion
                slots[d.slotIndex] = { ...next, manual: true };
                const nextMap = { ...prev, [d.msgId]: slots };
                const scope = room || currentChat?.id;
                try { if (scope) localStorage.setItem(SLOTS_KEY(scope), JSON.stringify(nextMap)); } catch (_) { }
                return nextMap;
            }
            return prev;
        });
    }, [room, currentChat?.id]);
    const onDragMove = useCallback((e) => {
        const d = draggingRef.current; if (!d.active) return;
        const dx = (e.clientX || 0) - d.startX;
        const dy = (e.clientY || 0) - d.startY;
        if (!d.moved && Math.hypot(dx, dy) > 3) d.moved = true;
        const container = document.querySelector(`[data-msg-id="${d.msgId}"]`);
        const width = container ? container.getBoundingClientRect().width : (document.querySelector('.chat-body')?.getBoundingClientRect().width || 1);
        const next = clampPos({ top: d.startTop + dy, leftPct: d.startLeftPct + (dx / Math.max(1, width)) * 100 }, d.avoidRight);
        dragPendingRef.current = next;
        if (!dragRafRef.current) {
            dragRafRef.current = requestAnimationFrame(applyDragPending);
        }
        e.preventDefault();
    }, [applyDragPending]);
    const onDragEnd = useCallback(() => {
        if (dragRafRef.current) { try { cancelAnimationFrame(dragRafRef.current); } catch (_) { } dragRafRef.current = null; }
        if (draggingRef.current.active) { draggingRef.current.active = false; draggingRef.current.moved = false; }
        try { window.removeEventListener('mousemove', onDragMove); } catch (_) { }
        try { window.removeEventListener('mouseup', onDragEnd); } catch (_) { }
    }, [onDragMove]);
    const startDragComment = (e, msgId, slotIndex, isMe, currentPos) => {
        try { e.preventDefault(); e.stopPropagation(); } catch (_) { }
        const pos = clampPos(currentPos || { top: -60, leftPct: 30 }, !!isMe);
        draggingRef.current = { active: true, moved: false, msgId, slotIndex, startX: e.clientX || 0, startY: e.clientY || 0, startTop: pos.top, startLeftPct: pos.leftPct, avoidRight: !!isMe };
        try { window.addEventListener('mousemove', onDragMove, { passive: false }); } catch (_) { }
        try { window.addEventListener('mouseup', onDragEnd, { once: true }); } catch (_) { }
    };

    // Persist comments per channel
    const COMMENTS_KEY = (channelId) => `channel_comments_${channelId}`; // legacy by messageId
    const COMMENTS_BY_KEY_KEY = (channelId) => `channel_comments_byKey_${channelId}`; // preferred by stable message key

    const msgStableKey = (m) => {
        try {
            // Prefer immutable identifiers
            if (m?.file?.url) return `file:${m.file.url}`;
            if (m?.externalId) return `ext:${m.externalId}`;
            if (m?.uuid) return `uuid:${m.uuid}`;
            if (m?.id) return `id:${m.id}`;
            // Fallback: hash core attributes likely to be stable across reloads
            const author = m?.author || m?.username || '';
            const msg = m?.message || '';
            const created = m?.createdAt || m?.time || '';
            const base = `${author}|${msg}|${created}`;
            return `hash:${btoa(unescape(encodeURIComponent(base))).slice(0, 32)}`;
        } catch (_) { return `id:${m?.id || ''}`; }
    };
    const msgIdByStableKey = React.useMemo(() => {
        const map = {};
        try {
            (messageList || []).forEach(m => { map[msgStableKey(m)] = m.id; });
        } catch (_) { }
        return map;
    }, [messageList]);
    useEffect(() => {
        if (!currentChat?.id) return;
        // For channels, ALWAYS use currentChat.id as the scope/room ID to match App.jsx
        // For DMs/Groups, prefer 'room' if available, else currentChat.id
        const scope = currentChat.isChannel ? currentChat.id : (room || currentChat.id);
        try {
            let rebuilt = {};

            // 1. Load from byKey (preferred for stability)
            const rawByKey = localStorage.getItem(COMMENTS_BY_KEY_KEY(scope));
            if (rawByKey) {
                const obj = JSON.parse(rawByKey) || {};
                Object.entries(obj).forEach(([stableKey, arr]) => {
                    const msgId = msgIdByStableKey[stableKey];
                    if (!msgId) return;
                    rebuilt[msgId] = Array.isArray(arr) ? arr : [];
                });
            }

            // 2. Load from byId (legacy + background updates from App.jsx)
            const rawById = localStorage.getItem(COMMENTS_KEY(scope));
            if (rawById) {
                const parsed = JSON.parse(rawById) || {};
                // Merge into rebuilt
                Object.entries(parsed).forEach(([msgId, arr]) => {
                    if (!Array.isArray(arr)) return;
                    const existing = rebuilt[msgId] || [];
                    // Merge comments, preferring existing (byKey) if conflict? 
                    // Actually, byId might be newer (background update).
                    // Let's merge by ID.
                    const map = new Map();
                    existing.forEach(c => map.set(String(c.id || c.userId), c)); // c.id might be missing for optimistic?
                    arr.forEach(c => {
                        // If comment exists, overwrite or keep? 
                        // If byId is newer, overwrite. But we don't know timestamps.
                        // Let's assume union.
                        map.set(String(c.id || c.userId), c);
                    });
                    rebuilt[msgId] = Array.from(map.values());
                });
            }

            if (Object.keys(rebuilt).length > 0) {
                setCommentsByMsg(rebuilt);
                setCommentsLoaded(true);
            } else {
                setCommentsByMsg({});
                setCommentsLoaded(true);
            }
        } catch (_) { setCommentsByMsg({}); setCommentsLoaded(true); }
    }, [messageList, msgIdByStableKey, currentChat?.id, room]);

    // When messages arrive after mount/re-entry, rebuild comments from byKey store
    useEffect(() => {
        if (!currentChat?.id) return;
        const scope = room || currentChat.id;
        try {
            const rawByKey = localStorage.getItem(COMMENTS_BY_KEY_KEY(scope));
            if (!rawByKey) return;
            const obj = JSON.parse(rawByKey) || {};
            const rebuilt = {};
            Object.entries(obj).forEach(([stableKey, arr]) => {
                const msgId = msgIdByStableKey[stableKey];
                if (!msgId) return;
                rebuilt[msgId] = Array.isArray(arr) ? arr : [];
            });
            if (Object.keys(rebuilt).length > 0) setCommentsByMsg(rebuilt);
        } catch (_) { /* ignore */ }
    }, [messageList, msgIdByStableKey, currentChat?.id, room]);

    useEffect(() => {
        if (!currentChat?.id) return;
        const scope = room || currentChat.id;
        if (!commentsLoaded) return; // avoid overwriting storage before initial load completes
        const hasAny = Object.keys(commentsByMsg || {}).length > 0;
        if (!hasAny) return; // do not overwrite existing storage with empty during mapping window
        try {
            // Save legacy byId
            localStorage.setItem(COMMENTS_KEY(scope), JSON.stringify(commentsByMsg || {}));
        } catch (_) { }
        try {
            // Save preferred byKey mapping using current message list
            const byKey = {};
            Object.entries(commentsByMsg || {}).forEach(([msgId, arr]) => {
                const m = (messageList || []).find(mm => String(mm.id) === String(msgId));
                if (!m) return;
                const key = msgStableKey(m);
                byKey[key] = arr;
            });
            if (Object.keys(byKey).length > 0) {
                localStorage.setItem(COMMENTS_BY_KEY_KEY(scope), JSON.stringify(byKey));
            }
        } catch (_) { }
    }, [commentsByMsg, currentChat?.id, messageList, commentsLoaded, room]);

    const submitComment = (msgId, avoidRightSide = false) => {
        const raw = (commentInputByMsg[msgId] || '').trim();
        if (!raw) return;
        const text = raw.slice(0, 40);
        const myId = String(user?.id || '');
        const mineIdx = (commentsByMsg[msgId] || []).findIndex(c => String(c.userId) === myId);
        let comment;
        if (mineIdx >= 0) {
            // Update existing comment text only
            setCommentsByMsg(prev => {
                const list = Array.isArray(prev[msgId]) ? prev[msgId].slice() : [];
                const old = list[mineIdx];
                if (!old) return prev;
                const updated = { ...old, text, ts: Date.now() };
                list[mineIdx] = updated;
                return { ...prev, [msgId]: list };
            });
            comment = { ...(commentsByMsg[msgId] || [])[mineIdx], text };
        } else {
            const id = `c_${msgId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const existingSlots = slotPositions[msgId] || [];
            const pos = randomPosForComment(avoidRightSide, existingSlots);
            comment = { id, userId: myId, author: username, text, ts: Date.now(), pos };
            setCommentsByMsg(prev => ({ ...prev, [msgId]: [...(prev[msgId] || []), comment] }));
        }
        // Ensure we update position cache with a valid id/pos
        // (Deprecated: positions are now slot-based, but keeping for legacy compatibility if needed)
        try {
            const existingList = commentsByMsg[msgId] || [];
            const existing = mineIdx >= 0 ? existingList[mineIdx] : null;
            const cid = mineIdx >= 0 ? (existing?.id) : comment.id;
            // No longer setting commentPositions here as we use slots
        } catch (_) { }
        setCommentInputByMsg(prev => ({ ...prev, [msgId]: '' }));
        setShowCommentForMsgId(null);
        // Immediate persistence (best-effort)
        try {
            if (currentChat?.id) {
                const scope = room || currentChat.id;
                const next = { ...(commentsByMsg || {}) };
                if (mineIdx >= 0) {
                    const list = Array.isArray(next[msgId]) ? next[msgId].slice() : [];
                    if (list[mineIdx]) list[mineIdx] = { ...list[mineIdx], text: comment.text, ts: comment.ts };
                    next[msgId] = list;
                } else {
                    next[msgId] = [...(next[msgId] || []), comment];
                }
                localStorage.setItem(COMMENTS_KEY(scope), JSON.stringify(next));
                // Also update byKey store
                const m = (messageList || []).find(mm => String(mm.id) === String(msgId));
                const key = m ? msgStableKey(m) : `id:${msgId}`;
                const rawByKey = localStorage.getItem(COMMENTS_BY_KEY_KEY(scope));
                const byKey = rawByKey ? (JSON.parse(rawByKey) || {}) : {};
                if (mineIdx >= 0) {
                    const arr = Array.isArray(byKey[key]) ? byKey[key].slice() : [];
                    const j = arr.findIndex(c => String(c.userId) === myId);
                    if (j >= 0) arr[j] = { ...arr[j], text: comment.text, ts: comment.ts }; else arr.push(comment);
                    byKey[key] = arr;
                } else {
                    byKey[key] = [...(byKey[key] || []), comment];
                }
                localStorage.setItem(COMMENTS_BY_KEY_KEY(scope), JSON.stringify(byKey));
            }
        } catch (_) { }
        try {
            // Ensure the just-added/updated comment appears immediately in samples
            const all = (commentsByMsg[msgId] || []);
            const limit = currentChat?.isChannel ? 4 : 2;
            let newIndex = -1;
            if (mineIdx >= 0) {
                newIndex = all.findIndex(c => String(c.userId) === String(myId));
            } else {
                newIndex = all.length; // optimistic; after state commit it will be at end
            }
            setRotateSampleByMsg(prev => {
                const len = ((prev[msgId] != null) ? (Array.isArray(prev[msgId]) ? prev[msgId].length : 0) : 0);
                const base = Array.from({ length: (all.length + (mineIdx >= 0 ? 0 : 1)) }, (_, i) => i);
                const start = (newIndex >= 0 && newIndex < base.length) ? [newIndex] : [];
                const merged = [...start, ...base.filter(i => i !== newIndex)].slice(0, limit);
                return { ...prev, [msgId]: merged };
            });
        } catch (_) { }
        try {
            // notify room so admins/others see in real time
            socket && socket.emit && socket.emit('channel_comment', { room, msgId, comment });
        } catch (_) { }
    };

    const deleteComment = (msgId, commentId) => {
        setCommentsByMsg(prev => {
            const arr = prev[msgId] || [];
            const nextArr = arr.filter(c => String(c.id) !== String(commentId));
            return { ...prev, [msgId]: nextArr };
        });
        // Immediate persistence (best-effort)
        try {
            if (currentChat?.id) {
                const scope = room || currentChat.id;
                const next = { ...(commentsByMsg || {}) };
                next[msgId] = (next[msgId] || []).filter(c => String(c.id) !== String(commentId));
                localStorage.setItem(COMMENTS_KEY(scope), JSON.stringify(next));
                const m = (messageList || []).find(mm => String(mm.id) === String(msgId));
                const key = m ? msgStableKey(m) : `id:${msgId}`;
                const rawByKey = localStorage.getItem(COMMENTS_BY_KEY_KEY(scope));
                const byKey = rawByKey ? (JSON.parse(rawByKey) || {}) : {};
                byKey[key] = (byKey[key] || []).filter(c => String(c.id) !== String(commentId));
                localStorage.setItem(COMMENTS_BY_KEY_KEY(scope), JSON.stringify(byKey));
            }
        } catch (_) { }
        try { socket && socket.emit && socket.emit('channel_comment_delete', { room, msgId, commentId }); } catch (_) { }
    };

    // --- Calling Features (Props from App.jsx) ---

    // Local duration timer for display ONLY
    const [callDuration, setCallDuration] = useState(0);
    useEffect(() => {
        let interval;
        if (activeCall) {
            interval = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            setCallDuration(0);
        }
        return () => clearInterval(interval);
    }, [activeCall]);

    // Format duration helper
    const formatDuration = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Forward startCall to prop
    const startCall = async (isVideo = false) => {
        if (onStartCall && currentChat) {
            onStartCall(currentChat, isVideo);
        }
    };

    // We keep these wrappers to maintain existing UI buttons that call 'startCall', 'endCall' etc.
    const endCall = onEndCall;
    const answerCall = onAnswerCall;
    const rejectCall = onRejectCall;

    // --- File Upload ---


    const cacheKey = (url) => `link_preview_${encodeURIComponent(url)}`;
    const getCachedPreview = (url) => {
        try { const v = localStorage.getItem(cacheKey(url)); return v ? JSON.parse(v) : null; } catch (_) { return null; }
    };
    const setCachedPreview = (url, data) => {
        try { localStorage.setItem(cacheKey(url), JSON.stringify(data)); } catch (_) { }
        setLinkPreviews(prev => ({ ...prev, [url]: data }));
    };

    const fetchPreview = async (url) => {
        const existing = linkPreviews[url] || getCachedPreview(url);
        if (existing) return existing;
        try {
            const res = await fetch(`http://localhost:3001/link-preview?url=${encodeURIComponent(url)}`);
            if (!res.ok) throw new Error('preview failed');
            const data = await res.json();
            setCachedPreview(url, data);
            return data;
        } catch (_) { return null; }
    };

    // Prefetch previews when messages list updates
    useEffect(() => {
        const urls = Array.from(new Set((messageList || []).flatMap(m => extractLinks(m.message || ''))));
        urls.slice(0, 50).forEach(u => { fetchPreview(u); });
    }, [messageList]);

    // Fallback catalog for when no API key is provided
    const FALLBACK_CATALOG = {
        gifs: [
            { url: 'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif', type: 'image/gif', isSticker: false, tags: ['hello', 'wave'] },
            { url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', type: 'image/gif', isSticker: false, tags: ['party', 'fun'] },
            { url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', type: 'image/gif', isSticker: false, tags: ['loading', 'dots'] },
            { url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', type: 'image/gif', isSticker: false, tags: ['thumbs up'] },
            { url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', type: 'image/gif', isSticker: false, tags: ['dog', 'cute'] },
            { url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif', type: 'image/gif', isSticker: false, tags: ['cat', 'typing'] },
            { url: 'https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif', type: 'image/gif', isSticker: false, tags: ['shrug'] },
            { url: 'https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif', type: 'image/gif', isSticker: false, tags: ['mind blown'] }
        ],
        stickers: [
            { url: 'https://media.giphy.com/media/l4FGuhL4U2WyjdkaY/giphy.gif', type: 'image/gif', isSticker: true, tags: ['ok', 'okay'] },
            { url: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif', type: 'image/gif', isSticker: true, tags: ['clap'] },
            { url: 'https://media.giphy.com/media/MF3pEPhuGCF72/giphy.gif', type: 'image/gif', isSticker: true, tags: ['heart'] },
            { url: 'https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif', type: 'image/gif', isSticker: true, tags: ['wow'] },
            { url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f60a.png', type: 'image/png', isSticker: true, tags: ['smile'] },
            { url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f602.png', type: 'image/png', isSticker: true, tags: ['lol'] },
            { url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44d.png', type: 'image/png', isSticker: true, tags: ['like', 'thumb'] },
            { url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2764.png', type: 'image/png', isSticker: true, tags: ['love', 'heart'] },
            { url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f389.png', type: 'image/png', isSticker: true, tags: ['party', 'tada'] }
        ]
    };

    const scrollRef = useRef(null);
    const prevMsgCountRef = useRef(0);
    const [isNearBottom, setIsNearBottom] = useState(true);

    const hasLoadedHistory = useRef(false);

    // Determine if a message should be shown in the current chat
    // Determine if a message should be shown in the current chat
    const messageBelongs = useCallback((msg) => {
        if (!msg) return false;
        // Primary check: same room
        if (msg.room && room && msg.room === room) return true;
        // Fallback: explicit destination matches current chat id
        if (msg.to && currentChat?.id && msg.to === currentChat.id) return true;
        return false;
    }, [room, currentChat?.id]);

    // Helper function to get date label (Today, Yesterday, or date)
    const getDateLabel = (timestamp) => {
        const messageDate = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const isToday = messageDate.toDateString() === today.toDateString();
        const isYesterday = messageDate.toDateString() === yesterday.toDateString();

        if (isToday) return 'Today';
        if (isYesterday) return 'Yesterday';

        // Check if within the last 7 days
        const diffTime = Math.abs(today - messageDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 7) {
            return messageDate.toLocaleDateString('en-US', { weekday: 'long' });
        }

        return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Helper to check if we should show date separator
    const shouldShowDateSeparator = (currentMsg, previousMsg) => {
        if (!previousMsg) return true;
        const currentDate = new Date(currentMsg.timestamp || Date.now()).toDateString();
        const previousDate = new Date(previousMsg.timestamp || Date.now()).toDateString();
        return currentDate !== previousDate;
    };

    // Filter messages to this chat and search query
    // Filter messages to this chat and search query
    const visibleSource = useMemo(() => (isBlocked && blockedSnapshotRef.current) ? blockedSnapshotRef.current : messageList, [isBlocked, messageList]);
    const baseMessages = useMemo(() => visibleSource.filter(messageBelongs), [visibleSource, messageBelongs]);
    const filteredMessages = useMemo(() => searchQuery
        ? baseMessages.filter(msg => msg.message?.toLowerCase().includes(searchQuery.toLowerCase()))
        : baseMessages, [searchQuery, baseMessages]);

    const handleScroll = useCallback((e) => {
        const { scrollTop, scrollHeight } = e.target;
        // If we represent a "load more" trigger (scrolled to top)
        if (scrollTop < 100 && filteredMessages.length > renderLimit) {
            // We are at the top and have more messages to show
            // Capture scroll height to restore position after render
            setPreviousScrollHeight(scrollHeight);
            // Increase limit by chunk size (e.g. 50)
            setRenderLimit(prev => Math.min(prev + 50, filteredMessages.length));
        }
    }, [filteredMessages.length, renderLimit]);

    const renderedMessages = useMemo(() => {
        if (searchQuery) return filteredMessages;
        // If we have fewer messages than the limit, show all. 
        // Otherwise slice the last 'renderLimit' messages.
        if (filteredMessages.length <= renderLimit) return filteredMessages;
        return filteredMessages.slice(filteredMessages.length - renderLimit);
    }, [filteredMessages, renderLimit, searchQuery]);

    // Disable initial load state after messages are rendered
    useEffect(() => {
        if (renderedMessages.length > 0 && isInitialLoad) {
            // Delay to ensure the initial paint happens without animation
            const t = setTimeout(() => setIsInitialLoad(false), 500);
            return () => clearTimeout(t);
        }
    }, [renderedMessages, isInitialLoad]);

    // Reset initial load state when switching chats to prevent animations


    // Performance: Enable lightweight mode (no goo blur) when message count is high
    useEffect(() => {
        // Threshold: if total messages > 50, use lightweight mode to prevent lag
        const shouldUseLightweight = messageList.length > 50;
        setUseLightweightMode(shouldUseLightweight);
    }, [messageList.length]);




    // Highlight search text in message
    const highlightText = (text, query) => {
        if (!query || !text) return text;
        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === query.toLowerCase()
                ? `<mark style="background: #ffd700; color: #000; padding: 2px 4px; border-radius: 3px;">${part}</mark>`
                : part
        ).join('');
    };

    const onEmojiClick = (emojiData) => {
        setCurrentMessage(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    // GIPHY integration
    const GIPHY_KEY = (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_GIPHY_KEY) || null;
    const fetchGiphy = async (append = false) => {
        setGiphyLoading(true);
        // Fallback mode (no API key): simple client-side search/pagination over built-in catalog
        if (!GIPHY_KEY) {
            try {
                const src = giphyTab === 'stickers' ? FALLBACK_CATALOG.stickers : FALLBACK_CATALOG.gifs;
                const q = (giphyQuery || '').toLowerCase();
                const filtered = q
                    ? src.filter(i => i.tags?.some(t => t.includes(q)))
                    : src;
                const start = append ? giphyOffset : 0;
                const slice = filtered.slice(start, start + GIPHY_PAGE_SIZE);
                const mapped = slice.map(it => ({ url: it.url, type: it.type, isSticker: it.isSticker }));
                setGiphyResults(prev => append ? [...prev, ...mapped] : mapped);
                const newOffset = append ? (start + mapped.length) : mapped.length;
                setGiphyOffset(newOffset);
                setGiphyHasMore(newOffset < filtered.length);
            } finally {
                setGiphyLoading(false);
            }
            return;
        }
        try {
            const isStickers = giphyTab === 'stickers';
            const endpointBase = isStickers ? 'stickers' : 'gifs';
            const hasQuery = giphyQuery && giphyQuery.trim().length > 0;
            const endpoint = hasQuery ? `https://api.giphy.com/v1/${endpointBase}/search` : `https://api.giphy.com/v1/${endpointBase}/trending`;
            const params = new URLSearchParams({
                api_key: GIPHY_KEY,
                limit: String(GIPHY_PAGE_SIZE),
                offset: String(append ? giphyOffset : 0),
                rating: 'pg-13',
                q: hasQuery ? giphyQuery : ''
            });
            const res = await fetch(`${endpoint}?${params.toString()}`);
            const data = await res.json();
            const items = Array.isArray(data.data) ? data.data : [];
            const mapped = items.map(it => {
                const img = (it.images && (it.images.fixed_height_small || it.images.fixed_height || it.images.downsized)) || {};
                const url = img.url || it.images?.original?.url || it.url;
                const isGif = (it.type === 'gif') || (url?.toLowerCase().includes('.gif')) || !isStickers; // stickers are also gifs in giphy
                return {
                    url,
                    type: 'image/gif',
                    isSticker: isStickers || it.type === 'sticker'
                };
            });
            setGiphyResults(prev => append ? [...prev, ...mapped] : mapped);
            const newOffset = append ? (giphyOffset + mapped.length) : mapped.length;
            setGiphyOffset(newOffset);
            setGiphyHasMore(mapped.length === GIPHY_PAGE_SIZE);
        } catch (e) {

        } finally {
            setGiphyLoading(false);
        }
    };

    useEffect(() => {
        if (showStickerPicker) {
            // reset and fetch trending on open
            setGiphyOffset(0);
            setGiphyHasMore(true);
            fetchGiphy(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showStickerPicker, giphyTab]);

    useEffect(() => {
        const delay = setTimeout(() => {
            if (showStickerPicker) {
                setGiphyOffset(0);
                setGiphyHasMore(true);
                fetchGiphy(false);
            }
        }, 300);
        return () => clearTimeout(delay);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [giphyQuery]);

    const sendMessage = async () => {
        if ((currentMessage !== "" || file || externalFileData) && room) {
            // Check if blocked
            if (!currentChat?.isGroup && !currentChat?.isChannel && currentChat?.id) {
                if (localStorage.getItem(`block_contact_${currentChat.id}`) === 'true') {
                    // Optionally show a toast or alert here
                    return;
                }
            }

            // Enforce slow mode locally (bypass for group admins)
            const isGroup = !!currentChat?.isGroup;
            const isUserAdmin = isGroup && Array.isArray(currentChat?.admins) && currentChat.admins.includes(user?.id);
            if (slowModeSeconds > 0 && !(isGroup && isUserAdmin)) {
                const now = Date.now();
                const diff = Math.floor((now - lastSentTs) / 1000);
                if (diff < slowModeSeconds) {
                    return;
                }
            }
            if (editingMessageId) {
                const updatedData = {
                    room,
                    id: editingMessageId,
                    newMessage: currentMessage
                };
                await socket.emit("edit_message", updatedData);

                setMessageList((list) => list.map(msg =>
                    msg.id === editingMessageId ? { ...msg, message: currentMessage, isEdited: true } : msg
                ));
                setEditingMessageId(null);
                setCurrentMessage("");
                return;
            }

            let fileData = null;

            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                try {
                    const response = await fetch('http://localhost:3001/upload', {
                        method: 'POST',
                        body: formData,
                    });
                    const data = await response.json();
                    fileData = {
                        url: `http://localhost:3001${data.filePath}`,
                        type: data.type,
                        name: file.name
                    };
                } catch (error) {

                }
            } else if (externalFileData) {
                fileData = externalFileData;
            }

            const messageData = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                room: room,
                author: username,
                userId: user.id,
                message: currentMessage,
                file: fileData,
                time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
                reactions: {},
                replyTo: replyTo,
                isRead: false,
                status: 'sent',
                justSent: true,
                to: currentChat.id,
                timestamp: Date.now()
            };
            const doSend = async () => {
                await socket.emit("send_message", messageData);
                setMessageList((list) => [...list, messageData]);
                setLastSentTs(Date.now());
                // Fire a lightweight notification so sidebars can update unseen counts
                try {
                    if (currentChat?.isGroup) {
                        socket.emit('send_notification', {
                            room,
                            senderId: user?.id,
                            author: username,
                            time: messageData.time,
                            type: 'message'
                        });

                        // Check for mentions and send specific alerts
                        const mentionRegex = /@(\w+)/g;
                        let match;
                        const mentionedUsers = new Set();
                        while ((match = mentionRegex.exec(currentMessage)) !== null) {
                            mentionedUsers.add(match[1]);
                        }

                        if (mentionedUsers.size > 0) {
                            // Find user IDs for mentioned names
                            const members = currentChat.members || currentChat.participants || [];
                            const admins = currentChat.admins || [];

                            mentionedUsers.forEach(name => {
                                // Simple name matching (case-insensitive)
                                const target = members.find(m => (m.username || m.name || m.displayName || '').toLowerCase() === name.toLowerCase())
                                    || admins.find(a => (typeof a === 'object' && (a.username || a.name || a.displayName || '').toLowerCase() === name.toLowerCase()));

                                // If we have an ID (either object with id or just ID string if we can resolve it differently, 
                                // but here we mostly have objects or IDs. If it's just ID string in members, we can't match name easily unless we have a map.
                                // Assuming members are objects with username/name.

                                if (target && target.id && String(target.id) !== String(user.id)) {
                                    socket.emit('send_notification', {
                                        to: target.id,
                                        senderId: user?.id,
                                        author: username,
                                        time: messageData.time,
                                        type: 'mention',
                                        message: `You were mentioned in ${currentChat.name || 'a group'}`
                                    });
                                }
                            });
                        }

                    } else if (messageData.to) {
                        socket.emit('send_notification', {
                            to: messageData.to,
                            senderId: user?.id,
                            author: username,
                            time: messageData.time,
                            type: 'message'
                        });
                    }
                } catch (_) { /* best-effort */ }
            };
            if (scheduledAt && scheduledAt > Date.now()) {
                const delay = Math.min(scheduledAt - Date.now(), 24 * 60 * 60 * 1000);
                setTimeout(doSend, delay);
            } else {
                await doSend();
            }
            setCurrentMessage("");
            setFile(null);
            setExternalFileData(null);
            setReplyTo(null);
            setScheduledAt(null);

        }
    };

    // Voice notes handlers
    const startRecording = async () => {
        if (isRecording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Setup Web Audio for waveform
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioCtx();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.98;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            source.connect(analyser);
            audioContextRef.current = audioCtx;
            analyserRef.current = analyser;
            dataArrayRef.current = dataArray;
            sourceRef.current = source;
            mediaStreamRef.current = stream;

            // Start canvas draw loop
            const canvas = recordingCanvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const draw = () => {
                    const analyserNode = analyserRef.current;
                    const arr = dataArrayRef.current;
                    if (!analyserNode || !arr) return;
                    analyserNode.getByteTimeDomainData(arr);

                    const dpr = window.devicePixelRatio || 1;
                    const cssWidth = canvas.clientWidth || 260;
                    const cssHeight = canvas.clientHeight || 48;
                    if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
                        canvas.width = cssWidth * dpr;
                        canvas.height = cssHeight * dpr;
                    }
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    const midY = canvas.height / 2;

                    // build smoothed path with quadratic curves
                    const points = [];
                    const samples = 192; // even more points for smoother line
                    const step = Math.floor(arr.length / samples) || 1;
                    const amp = (cssHeight * dpr) * 0.30; // amplitude
                    // moving average window for extra smoothness
                    const windowSize = 5;
                    for (let i = 0; i < arr.length; i += step) {
                        let sum = 0;
                        let count = 0;
                        for (let w = -Math.floor(windowSize / 2); w <= Math.floor(windowSize / 2); w++) {
                            const idx = Math.min(Math.max(i + w, 0), arr.length - 1);
                            sum += arr[idx];
                            count++;
                        }
                        const v = (sum / count - 128) / 128; // -1..1
                        const x = (i / (arr.length - 1)) * canvas.width;
                        const y = midY + v * amp;
                        points.push({ x, y });
                    }
                    if (points.length > 1) {
                        ctx.lineWidth = 1.1 * dpr;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary')?.trim() || '#60a5fa';
                        ctx.shadowColor = ctx.strokeStyle + '55'; // subtle glow
                        ctx.shadowBlur = 4 * dpr;

                        ctx.beginPath();
                        ctx.moveTo(points[0].x, points[0].y);
                        for (let i = 1; i < points.length - 1; i++) {
                            const xc = (points[i].x + points[i + 1].x) / 2;
                            const yc = (points[i].y + points[i + 1].y) / 2;
                            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                        }
                        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }

                    animationIdRef.current = requestAnimationFrame(draw);
                };
                draw();
            }

            const mr = new MediaRecorder(stream);
            mediaRecorderRef.current = mr;
            setRecordedChunks([]);
            setRecordingDuration(0);
            setIsRecording(true);
            mr.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    setRecordedChunks((prev) => [...prev, e.data]);
                }
            };
            mr.onstop = async () => {
                // Cleanup audio resources
                if (animationIdRef.current) {
                    cancelAnimationFrame(animationIdRef.current);
                    animationIdRef.current = null;
                }
                if (audioContextRef.current) {
                    try { await audioContextRef.current.close(); } catch (_) { }
                    audioContextRef.current = null;
                }
                if (mediaStreamRef.current) {
                    try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch (_) { }
                    mediaStreamRef.current = null;
                }
                // Build final blob and send
                const blob = new Blob(recordedChunks, { type: 'audio/webm' });
                try {
                    const fd = new FormData();
                    const fileObj = new File([blob], 'voice-note.webm', { type: 'audio/webm' });
                    fd.append('file', fileObj);
                    const response = await fetch('http://localhost:3001/upload', {
                        method: 'POST',
                        body: fd,
                    });
                    const data = await response.json();
                    setExternalFileData({ url: `http://localhost:3001${data.filePath}`, type: data.type || 'audio/webm', name: 'voice-note.webm' });
                } catch (_) {
                    // Fallback to local blob URL if upload fails
                    const url = URL.createObjectURL(blob);
                    setExternalFileData({ url, type: 'audio/webm', name: 'voice-note.webm' });
                }
                setIsRecording(false);
                clearInterval(recordingTimerRef.current);
                setRecordingDuration(0);
                await sendMessage();
            };
            mr.start();
            recordingTimerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
        } catch (_) {
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        const mr = mediaRecorderRef.current;
        if (mr && isRecording) {
            mr.stop();
        }
    };

    const cancelRecording = () => {
        const mr = mediaRecorderRef.current;
        try { mr && mr.state !== 'inactive' && mr.stop(); } catch (_) { }
        setIsRecording(false);
        setRecordedChunks([]);
        clearInterval(recordingTimerRef.current);
        setRecordingDuration(0);
        // Cleanup audio resources and canvas when cancelling
        if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
            animationIdRef.current = null;
        }
        if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch (_) { }
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch (_) { }
            mediaStreamRef.current = null;
        }
        const canvas = recordingCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const togglePin = (msgId) => {
        console.log('[PIN] togglePin called for msgId:', msgId);

        // Prevent rapid double toggles
        if (Date.now() < (pinBusyUntilRef.current || 0)) {
            console.log('[PIN] BLOCKED - debounce lock active');
            return;
        }
        const isGroup = !!currentChat?.isGroup;

        if (isGroup) {
            const isOwnerMe = String(user?.id) === String(currentChat?.createdBy);
            const myRoleId = (currentChat?.memberRoles || {})[user?.id];
            const myPerms = (currentChat?.rolePermissions || {})[myRoleId] || {};
            const isAdminMe = Array.isArray(currentChat?.admins) && currentChat.admins.some(a => String(a) === String(user?.id));
            const adminFullEnabled = !!(currentChat?.settings && currentChat.settings.adminFullPermissionsEnabled);
            // If adminFull is enabled, any admin has full pin rights regardless of role
            const allow = isOwnerMe || (isAdminMe && adminFullEnabled) || (!!myRoleId && !!myPerms.canPin);

            if (!allow) {
                console.log('[PIN] BLOCKED - no permission');
                return;
            }
        }

        // Set debounce lock to prevent race conditions (short timeout for responsiveness)
        pinBusyUntilRef.current = Date.now() + 800;
        console.log('[PIN] Proceeding with pin/unpin');

        setPinnedIds((prev) => {

            const sid = String(msgId);
            const has = prev.map(String).includes(sid);
            const next = has ? prev.filter(id => String(id) !== sid) : [...new Set([...prev.map(String), sid])];

            try { localStorage.setItem(`pinned_${pinScope}`, JSON.stringify(next)); } catch (_) { }
            // Maintain lightweight pinned summaries for sidebar rendering
            try {
                const msgs = Array.isArray(messageList) ? messageList : [];
                const key = `pinned_summaries_${pinScope}`;
                const raw = localStorage.getItem(key) || '[]';
                let summaries = [];
                try { summaries = JSON.parse(raw); } catch (_) { summaries = []; }
                if (has) {
                    summaries = Array.isArray(summaries) ? summaries.filter(s => String(s.id) !== String(msgId)) : [];
                } else {
                    const msg = msgs.find(m => String(m.id) === String(msgId));
                    if (msg) {
                        const entry = {
                            id: msg.id,
                            author: msg.author,
                            message: msg.message || (msg.file ? (msg.file.name || 'Attachment') : ''),
                            file: msg.file ? { name: msg.file.name } : null,
                        };
                        const exists = Array.isArray(summaries) && summaries.some(s => String(s.id) === String(msgId));
                        if (!exists) summaries = [...(Array.isArray(summaries) ? summaries : []), entry];
                    }
                }
                localStorage.setItem(key, JSON.stringify(summaries));
            } catch (_) { }
            try { window.dispatchEvent(new CustomEvent('pinned_updated', { detail: { room: pinScope, pinnedIds: next } })); } catch (_) { }
            // Broadcast to others
            try { socket.emit('group_pin_update', { room: pinScope, msgId: sid, action: has ? 'unpin' : 'pin', userId: user?.id }); } catch (_) { }
            // Set guard window for remote syncs
            try { pinnedGuardUntilRef.current = Date.now() + 2200; } catch (_) { }

            return next;
        });
    };

    // Schedule helper (simple prompt in minutes)
    const schedulePrompt = () => {
        const minsStr = window.prompt('Send in how many minutes?', '10');
        if (!minsStr) { setScheduledAt(null); return; }
        const mins = parseInt(minsStr, 10);
        if (isNaN(mins) || mins <= 0) { setScheduledAt(null); return; }
        const at = Date.now() + mins * 60 * 1000;
        setScheduledAt(at);
    };



    const toggleMessageMenu = (e, msgId) => {
        e.stopPropagation();
        if (activeMenuMessageId === msgId) {
            setActiveMenuMessageId(null);
            return;
        }
        // Calculate position
        try {
            const rect = e.currentTarget.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            // If space below is tight (< 300px) and space above is better, go up
            if (spaceBelow < 300 && spaceAbove > 300) {
                setMenuVerticalPos('top');
            } else {
                setMenuVerticalPos('bottom');
            }
        } catch (_) {
            setMenuVerticalPos('bottom');
        }
        setActiveMenuMessageId(msgId);
    };

    const handleReaction = async (msgId, emoji) => {
        // Anchor to the reacted message to prevent scroll jumps
        const anchor = typeof document !== 'undefined' ? document.querySelector(`[data-msg-id="${msgId}"]`) : null;
        const beforeTop = anchor ? anchor.getBoundingClientRect().top : null;

        // For channels, groups, and DMs use the same socket flow for reactions
        if (currentChat?.isChannel) {
            const isOwner = String(currentChat?.createdBy) === String(user?.id);
            const isAdmin = Array.isArray(currentChat?.admins) && currentChat.admins.some(a => String(a) === String(user?.id));
            if (currentChat?.settings?.reactions === false && !isOwner && !isAdmin) return;
            const reactionData = { room: currentChat.id, msgId, emoji, user: username };
            socket.emit("message_reaction", reactionData);
        } else {
            const reactionData = { room, msgId, emoji, user: username };
            socket.emit("message_reaction", reactionData);
        }

        // Optimistic local update
        setMessageList(prev => prev.map(m => {
            if (String(m.id) !== String(msgId)) return m;
            const next = { ...m, reactions: { ...(m.reactions || {}) } };
            const arr = Array.isArray(next.reactions[emoji]) ? next.reactions[emoji] : [];
            if (arr.includes(username)) {
                next.reactions[emoji] = arr.filter(u => u !== username);
                if (next.reactions[emoji].length === 0) delete next.reactions[emoji];
            } else {
                next.reactions[emoji] = [...arr, username];
            }
            return next;
        }));

        // On next frame, measure again and compensate scroll by the delta
        if (typeof window !== 'undefined' && beforeTop !== null) {
            requestAnimationFrame(() => {
                const afterTop = anchor ? anchor.getBoundingClientRect().top : null;
                if (afterTop !== null) {
                    const delta = afterTop - beforeTop; // positive if content pushed down
                    if (Math.abs(delta) > 0) {
                        window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
                    }
                }
            });
        }
    };

    // Handle poll vote locally (client-side)
    const handlePollVote = (msgId, optionIndex) => {
        setMessageList(list => list.map(msg => {
            if (msg.id !== msgId || !msg.poll) return msg;
            // Remove this user from all options first
            const updatedOptions = (msg.poll.options || []).map((opt, idx) => {
                const votes = Array.isArray(opt.votes) ? opt.votes.filter(v => v !== username) : [];
                return { ...opt, votes };
            });
            // Add vote to selected option
            const target = updatedOptions[optionIndex];
            if (target) {
                target.votes = [...(target.votes || []), username];
            }
            return { ...msg, poll: { ...msg.poll, options: updatedOptions } };
        }));
        // Optionally emit to server if supported
        try {
            socket.emit('poll_vote', { room, msgId, optionIndex, userId: username });
        } catch (_) { /* no-op if backend doesn't support */ }
    };

    const handleDelete = (msgId) => {
        socket.emit("delete_message", { room, id: msgId, userId: user?.id });
        setMessageList(list => list.filter(msg => msg.id !== msgId));
    };

    const handleDeleteChat = () => {
        if (window.confirm("Are you sure you want to delete this chat?")) {
            socket.emit("delete_chat", { room });
            setMessageList([]);
            setShowContactInfo(false);
        }
    };

    const handleBlock = () => {
        setIsBlocked(!isBlocked);
    };

    const startEdit = (msg) => {
        setEditingMessageId(msg.id);
        setCurrentMessage(msg.message);
        setReplyTo(null);
    };

    useEffect(() => {
        if (room) {
            socket.emit("join_room", room);
        }
        setMessageList([]);
        hasLoadedHistory.current = false;
        setReplyTo(null);
        setEditingMessageId(null);
        setActiveMenuMessageId(null);
        setCurrentMessage("");
        // setShowContactInfo(false); // Reset by parent when chat changes
        setIsBlocked(false);
        // Load pinned ids and slow mode from localStorage for this room
        try {
            const p = localStorage.getItem(`pinned_${pinScope}`);
            const parsedRaw = p ? JSON.parse(p) : [];
            const parsed = Array.isArray(parsedRaw) ? parsedRaw.map(String) : [];
            if (Date.now() < pinnedGuardUntil) {

            } else {
                // Mark as restoring so the animation effect knows not to run
                isRestoringRef.current = true;
                setPinnedIds(parsed);
                // Clear the flag after this render cycle
                setTimeout(() => { isRestoringRef.current = false; }, 0);
            }
        } catch (_) { setPinnedIds([]); }
        try {
            const s = localStorage.getItem(`slow_mode_${room}`);
            setSlowModeSeconds(s ? parseInt(s, 10) : 0);
        } catch (_) { setSlowModeSeconds(0); }
    }, [room]);

    // Doodle: resize canvas to container
    useEffect(() => {
        const resize = () => {
            try {
                const wrap = canvasWrapRef.current;
                const canvas = canvasRef.current;
                if (!wrap || !canvas) return;
                const rect = wrap.getBoundingClientRect();
                const scale = window.devicePixelRatio || 1;
                canvas.width = Math.floor(rect.width * scale);
                canvas.height = Math.floor(rect.height * scale);
                canvas.style.width = rect.width + 'px';
                canvas.style.height = rect.height + 'px';
                const ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);
            } catch (_) { }
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [isDoodling, currentChat?.id, currentChat?.showInfo]);

    const doodleBegin = (x, y) => {
        drawingRef.current = true;
        lastPointRef.current = { x, y };
        try { socket.emit('doodle_begin', { room, userId: user?.id }); } catch (_) { }
    };
    const doodleDraw = (x, y) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const from = lastPointRef.current || { x, y };
        // Set composite for pen/eraser
        ctx.globalCompositeOperation = penMode === 'erase' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = penMode === 'erase' ? 'rgba(0,0,0,1)' : penColor;
        ctx.lineWidth = penWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(x, y); ctx.stroke();
        lastPointRef.current = { x, y };
        try { socket.emit('doodle_draw', { room, userId: user?.id, from, to: { x, y }, color: penColor, width: penWidth, mode: penMode }); } catch (_) { }
    };
    const doodleEnd = () => {
        drawingRef.current = false; lastPointRef.current = null;
        try { socket.emit('doodle_end', { room, userId: user?.id }); } catch (_) { }
    };

    const onCanvasPointerDown = (e) => {
        if (!isDoodling) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
        const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        doodleBegin(x, y);
    };
    const onCanvasPointerMove = (e) => {
        if (!isDoodling || !drawingRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
        const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        doodleDraw(x, y);

        // Handle erasing placed doodles
        if (penMode === 'erase') {
            const scrollContainer = document.querySelector('.chat-body');
            if (!scrollContainer) return;
            const containerRect = scrollContainer.getBoundingClientRect();
            const scrollTop = scrollContainer.scrollTop;

            Object.entries(placedCanvasRefs.current).forEach(([id, canvas]) => {
                if (!canvas) return;
                const doodle = placedDoodles.find(d => String(d.id) === String(id));
                if (!doodle) return;
                // Only allow creator to erase their own doodle
                if (String(doodle.creatorUserId) !== String(user?.id)) return;

                // Calculate position relative to this placed canvas
                // The placed canvas is inside chat-body, at absolute top: doodle.top
                // The main canvas covers the whole window.
                // We need to map the main canvas (x, y) to the placed canvas coordinates.

                // Main canvas (0,0) is window (0,0) usually, but let's be precise:
                // x, y are relative to main canvas (which covers window)

                // Placed canvas is inside chat-body.
                // Placed canvas Y relative to chat-body top is doodle.top.
                // Chat-body top relative to window is containerRect.top.
                // So Placed canvas Y relative to window is containerRect.top + doodle.top - scrollTop (scrolled position).

                // Wait, placed canvas is absolute inside chat-body.
                // So its visual Y on screen is: containerRect.top + doodle.top - scrollTop.

                // Mouse Y on screen is clientY.
                // So Mouse Y relative to placed canvas is: clientY - (containerRect.top + doodle.top - scrollTop).

                const placedY = clientY - (containerRect.top + doodle.top - scrollTop);
                const placedX = clientX - containerRect.left; // Assuming chat-body left aligns with placed canvas left (width 100%)

                const ctx = canvas.getContext('2d');
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(placedX, placedY, penWidth, 0, Math.PI * 2);
                ctx.fill();
                // Broadcast this erase to others
                try { socket.emit('doodle_erase', { room, doodleId: id, x: placedX, y: placedY, radius: penWidth }); } catch (_) { }
            });
        }
    };
    const onCanvasPointerUp = () => { if (!isDoodling) return; doodleEnd(); };

    // Sync pins when updated from sidebar
    useEffect(() => {
        const handler = (e) => {
            const d = e?.detail || {};
            try {
                if (!d.room || String(d.room) !== String(pinScope)) return;
                const p = localStorage.getItem(`pinned_${pinScope}`);
                const incomingRaw = p ? JSON.parse(p) : (Array.isArray(d.pinnedIds) ? d.pinnedIds : []);
                const incoming = Array.isArray(incomingRaw) ? Array.from(new Set(incomingRaw.map(String))) : [];
                if (Date.now() < pinnedGuardUntil) {

                    return;
                }
                setPinnedIds(incoming);
            } catch (_) { /* ignore */ }
        };
        window.addEventListener('pinned_updated', handler);
        return () => window.removeEventListener('pinned_updated', handler);
    }, [pinScope]);

    // Sync slow mode when updated from sidebar
    useEffect(() => {
        const slowHandler = (e) => {
            const d = e?.detail || {};
            if (d.room && d.room === room) {
                const v = Math.max(0, parseInt(d.seconds || 0, 10) || 0);
                setSlowModeSeconds(v);
            }
        };
        window.addEventListener('slow_mode_updated', slowHandler);
        return () => window.removeEventListener('slow_mode_updated', slowHandler);
    }, [room]);

    // Slow mode countdown ticker
    useEffect(() => {
        if (slowModeSeconds > 0) {
            const id = setInterval(() => setNowTick(Date.now()), 1000);
            return () => clearInterval(id);
        }
    }, [slowModeSeconds]);

    useEffect(() => {
        const receiveHandler = (data) => {
            // Check if sender is blocked (by explicit senderId)
            const senderId = data.userId || data.authorId;
            if (senderId && localStorage.getItem(`block_contact_${senderId}`) === 'true') {
                return; // Ignore message if blocked
            }
            // Fallback: if this is a DM and the current contact is blocked, ignore any incoming (non-self) messages
            try {
                const isDM = !currentChat?.isGroup && !currentChat?.isChannel && !!currentChat?.id;
                const isFromMe = (data.author === username) || (String(data.userId) === String(user?.id));
                if (isDM && localStorage.getItem(`block_contact_${currentChat.id}`) === 'true' && !isFromMe) {
                    return;
                }
            } catch (_) { }
            // Only add message if it belongs to this chat
            if (messageBelongs(data)) {
                setMessageList((list) => {
                    // Prevent duplicates (optimistic update vs server broadcast)
                    const exists = list.some(m => m.id === data.id);
                    if (exists) {
                        // If it's our own message echo from server, mark as delivered
                        if (data.author === username) {
                            return list.map(m => m.id === data.id ? { ...m, status: (m.isRead ? 'seen' : 'delivered') } : m);
                        }
                        return list;
                    }
                    // For messages not authored by me, push normally
                    return [...list, data];
                });

                if (data.author !== username) {
                    socket.emit("message_read", { room, id: data.id, user: username });
                }
                try {
                    if (data.type === 'system' && typeof data.message === 'string' && (data.message.includes('turned on disappearing messages') || data.message.includes('turned off disappearing messages'))) {
                        const enabled = data.message.includes('turned on disappearing messages');
                        if (currentChat?.isGroup) {
                            try { localStorage.setItem(`dm_enabled_group_${currentChat.id}`, String(enabled)); } catch (_) { }
                            try { window.dispatchEvent(new CustomEvent('disappearing_state_update', { detail: { scope: 'group', targetId: currentChat.id, enabled } })); } catch (_) { }
                        } else if (currentChat?.id) {
                            const keyBase = currentChat.id || currentChat.username;
                            try { localStorage.setItem(`dm_enabled_contact_${keyBase}`, String(enabled)); } catch (_) { }
                            try { window.dispatchEvent(new CustomEvent('disappearing_state_update', { detail: { scope: 'contact', targetId: currentChat.id, enabled } })); } catch (_) { }
                        }
                    }
                } catch (_) { /* ignore */ }
            }
        };



        const reactionHandler = (data) => {
            setMessageList(list => list.map(msg => {
                if (String(msg.id) === String(data.msgId)) {
                    return { ...msg, reactions: data.reactions || {} };
                }
                return msg;
            }));
        };

        const deleteHandler = (data) => {
            const target = String(data?.id || data?.msgId || data?.postId || '');
            if (!target) return;
            setMessageList(list => list.filter(msg => String(msg.id) !== target));
        };

        const editHandler = (data) => {
            setMessageList(list => list.map(msg =>
                msg.id === data.id ? { ...msg, message: data.newMessage, isEdited: true } : msg
            ));
        };

        const deliveredHandler = (data) => {
            // For DMs, server informs sender that recipient device received the message
            setMessageList(list => list.map(msg => (
                msg.id === data.id ? { ...msg, status: (msg.isRead ? 'seen' : 'delivered') } : msg
            )));
        };

        const readHandler = (data) => {
            setMessageList(list => list.map(msg =>
                msg.id === data.id
                    ? { ...msg, isRead: true, status: 'seen' }
                    : msg
            ));
        };

        const loadHistoryHandler = (history) => {
            // Only consider messages that belong to this chat
            let scoped = Array.isArray(history) ? history.filter((m) => messageBelongs(m)) : [];
            // If DM and contact is blocked, drop messages not authored by me from history as well
            try {
                const isDM = !currentChat?.isGroup && !currentChat?.isChannel && !!currentChat?.id;
                if (isDM && localStorage.getItem(`block_contact_${currentChat.id}`) === 'true') {
                    scoped = scoped.filter(m => (m.author === username) || (String(m.userId) === String(user?.id)));
                }
            } catch (_) { }
            if (!hasLoadedHistory.current) {
                // Normalize status for my messages from history
                const normalized = scoped.map(m => (
                    m.author === username
                        ? { ...m, status: (m.isRead ? 'seen' : 'delivered') }
                        : m
                ));
                setMessageList(normalized);
                hasLoadedHistory.current = true;
            } else {
                // Merge history with existing without losing already displayed messages
                setMessageList(prev => {
                    const map = new Map();
                    prev.forEach(m => map.set(m.id, m));
                    scoped.forEach(m => {
                        if (!map.has(m.id)) {
                            map.set(m.id, m.author === username ? { ...m, status: (m.isRead ? 'seen' : 'delivered') } : m);
                        }
                    });
                    return Array.from(map.values());
                });
            }
            scoped.forEach(msg => {
                if (msg.author !== username && !msg.isRead) {
                    const senderId = msg.userId || msg.authorId;
                    // Skip read ack if sender explicitly blocked OR chat is a blocked DM
                    const isBlockedSender = senderId && localStorage.getItem(`block_contact_${senderId}`) === 'true';
                    const dmBlocked = (!currentChat?.isGroup && !currentChat?.isChannel && currentChat?.id && localStorage.getItem(`block_contact_${currentChat.id}`) === 'true');
                    if (isBlockedSender || dmBlocked) return;
                    socket.emit("message_read", { room, id: msg.id, user: username });
                }
            });
        };

        // Real-time slow mode updates from other users
        const slowModeHandler = (payload) => {
            try {
                if (!payload || !payload.room) return;
                if (String(payload.room) !== String(room)) return;
                const seconds = Math.max(0, parseInt(payload.seconds || 0, 10) || 0);
                setSlowModeSeconds(seconds);
                try { localStorage.setItem(`slow_mode_${room}`, String(seconds)); } catch (_) { }
                try { window.dispatchEvent(new CustomEvent('slow_mode_updated', { detail: { room, seconds } })); } catch (_) { }
            } catch (_) { }
        };

        // Real-time pin updates from other users
        const pinUpdateHandler = (payload) => {
            try {
                if (!payload || !payload.room) return;
                if (String(payload.room) !== String(pinScope)) return;
                const { msgId, action, summary, userId: actorId } = payload;
                const sid = String(msgId);
                // Ignore own echo during guard window
                if (Date.now() < pinnedGuardUntilRef.current) {

                    return;
                }
                setPinnedIds(prev => {
                    const prevNorm = prev.map(String);
                    let next = prevNorm;
                    if (action === 'pin' && !prevNorm.includes(sid)) next = [...prevNorm, sid];
                    if (action === 'unpin') next = prevNorm.filter(id => id !== sid);
                    next = Array.from(new Set(next));
                    // Persist by stable scope
                    try { localStorage.setItem(`pinned_${pinScope}`, JSON.stringify(next)); } catch (_) { }
                    // Update pinned summaries cache as well
                    try {
                        const key = `pinned_summaries_${pinScope}`;
                        const raw = localStorage.getItem(key) || '[]';
                        let summaries = [];
                        try { summaries = JSON.parse(raw); } catch (_) { summaries = []; }
                        if (action === 'unpin') {
                            summaries = Array.isArray(summaries) ? summaries.filter(s => String(s.id) !== sid) : [];
                        } else if (action === 'pin') {
                            let entry = null;
                            const msg = (Array.isArray(messageList) ? messageList : []).find(m => String(m.id) === sid);
                            if (msg) {
                                entry = { id: msg.id, author: msg.author, message: msg.message || (msg.file ? (msg.file.name || 'Attachment') : ''), file: msg.file ? { name: msg.file.name } : null };
                            } else if (summary && summary.id) {
                                entry = { id: summary.id, author: summary.author, message: summary.message, file: summary.file ? { name: summary.file.name } : null };
                            }
                            if (entry) {
                                const exists = Array.isArray(summaries) && summaries.some(s => String(s.id) === sid);
                                if (!exists) summaries = [...(Array.isArray(summaries) ? summaries : []), entry];
                            }
                        }
                        localStorage.setItem(key, JSON.stringify(summaries));
                    } catch (_) { }
                    try { window.dispatchEvent(new CustomEvent('pinned_updated', { detail: { room: pinScope, pinnedIds: next } })); } catch (_) { }
                    return next;
                });
            } catch (_) { }
        };

        const starHandler = (data) => {
            setMessageList(list => list.map(msg =>
                msg.id === data.msgId ? { ...msg, starredBy: data.starredBy } : msg
            ));
        };

        socket.on('group_slow_mode_set', slowModeHandler);
        socket.on('group_pin_update', pinUpdateHandler);
        socket.on('message_starred', starHandler);

        socket.on("receive_message", receiveHandler);

        socket.on("receive_reaction", reactionHandler);
        socket.on("receive_delete_message", deleteHandler);
        // Additional delete aliases to ensure real-time removal
        socket.on("message_deleted", deleteHandler);
        socket.on("delete_message", deleteHandler);
        socket.on("group_message_deleted", deleteHandler);
        socket.on("receive_edit_message", editHandler);
        socket.on('message_delivered', deliveredHandler);
        socket.on("message_read_update", readHandler);
        socket.on("load_messages", loadHistoryHandler);

        // Load comments from server (persistence)
        socket.on("load_comments", (serverComments) => {
            // serverComments: { msgId: [comment1, comment2] }
            if (!serverComments) return;
            setCommentsByMsg(prev => {
                const next = { ...prev };
                Object.entries(serverComments).forEach(([msgId, list]) => {
                    if (Array.isArray(list)) {
                        // Merge with existing? Server is truth for persistence.
                        // But we might have local optimistic updates.
                        // Let's union by ID.
                        const existing = next[msgId] || [];
                        const map = new Map();
                        existing.forEach(c => map.set(String(c.id), c));
                        list.forEach(c => map.set(String(c.id), c));
                        next[msgId] = Array.from(map.values());
                    }
                });

                // Also update localStorage
                const scope = currentChat?.isChannel ? currentChat.id : (room || currentChat?.id);
                if (scope) {
                    try {
                        localStorage.setItem(COMMENTS_KEY(scope), JSON.stringify(next));
                        // Also update byKey if possible (requires messageList which might not be ready yet)
                        // We'll skip byKey update here as it's complex without message objects.
                        // But next time we load, byId (COMMENTS_KEY) will be used.
                    } catch (_) { }
                }
                return next;
            });
        });

        // Realtime comments (all chats)
        const onChannelComment = (payload = {}) => {
            try {
                const scopeRoom = payload.room || payload.channelId || null;
                // Check against room OR currentChat.id (if room is undefined)
                const currentId = currentChat?.isChannel ? currentChat.id : (room || currentChat?.id);
                if (!scopeRoom || String(scopeRoom) !== String(currentId)) return;
                const { msgId, comment } = payload;
                if (!msgId || !comment) return;
                setCommentsByMsg(prev => {
                    const list = Array.isArray(prev[msgId]) ? prev[msgId] : [];
                    // Enforce single comment per user: replace if exists
                    const idx = list.findIndex(c => String(c.userId) === String(comment.userId));
                    let nextList;
                    if (idx >= 0) {
                        nextList = list.slice(); nextList[idx] = { ...list[idx], ...comment };
                    } else {
                        nextList = [...list, comment];
                    }
                    // Persist immediately
                    try {
                        const scope = currentChat?.isChannel ? currentChat.id : (room || currentChat?.id);
                        if (scope) {
                            const nextMap = { ...(prev || {}), [msgId]: nextList };
                            localStorage.setItem(COMMENTS_KEY(scope), JSON.stringify(nextMap));
                            const m = (messageList || []).find(mm => String(mm.id) === String(msgId));
                            const key = m ? msgStableKey(m) : `id:${msgId}`;
                            const rawByKey = localStorage.getItem(COMMENTS_BY_KEY_KEY(scope));
                            const byKey = rawByKey ? (JSON.parse(rawByKey) || {}) : {};
                            const arr = Array.isArray(byKey[key]) ? byKey[key].slice() : [];
                            const j = arr.findIndex(c => String(c.userId) === String(comment.userId));
                            if (j >= 0) arr[j] = { ...arr[j], ...comment }; else arr.push(comment);
                            byKey[key] = arr;
                            localStorage.setItem(COMMENTS_BY_KEY_KEY(scope), JSON.stringify(byKey));
                        }
                    } catch (_) { }
                    return { ...prev, [msgId]: nextList };
                });
            } catch (_) { }
        };

        const onChannelCommentDelete = (payload = {}) => {
            try {
                const scopeRoom = payload.room || payload.channelId || null;
                if (!scopeRoom || String(scopeRoom) !== String(room)) return;
                const { msgId, commentId, userId: cuid } = payload;
                if (!msgId) return;
                setCommentsByMsg(prev => {
                    const list = Array.isArray(prev[msgId]) ? prev[msgId] : [];
                    const nextList = list.filter(c => (commentId ? String(c.id) !== String(commentId) : String(c.userId) !== String(cuid)));
                    // Persist
                    try {
                        const scope = room || currentChat?.id;
                        if (scope) {
                            const nextMap = { ...(prev || {}), [msgId]: nextList };
                            localStorage.setItem(COMMENTS_KEY(scope), JSON.stringify(nextMap));
                            const m = (messageList || []).find(mm => String(mm.id) === String(msgId));
                            const key = m ? msgStableKey(m) : `id:${msgId}`;
                            const rawByKey = localStorage.getItem(COMMENTS_BY_KEY_KEY(scope));
                            const byKey = rawByKey ? (JSON.parse(rawByKey) || {}) : {};
                            byKey[key] = (byKey[key] || []).filter(c => (commentId ? String(c.id) !== String(commentId) : String(c.userId) !== String(cuid)));
                            localStorage.setItem(COMMENTS_BY_KEY_KEY(scope), JSON.stringify(byKey));
                        }
                    } catch (_) { }
                    return { ...prev, [msgId]: nextList };
                });
            } catch (_) { }
        };

        const onChannelPostCreated = (data) => {
            try {
                const post = data.post || data;
                if (!post || !post.id) return;
                const channelId = data.channelId || data.room || post.room;
                if (String(channelId) !== String(room)) return;

                setMessageList(prev => {
                    if (prev.some(m => String(m.id) === String(post.id))) return prev;
                    // Ensure post has necessary fields
                    const msg = {
                        ...post,
                        message: post.message || post.text || '',
                        author: post.author || '',
                        time: post.time || new Date(post.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    };
                    return [...prev, msg];
                });
            } catch (_) { }
        };

        socket.on('channel_post_created', onChannelPostCreated);
        socket.on('channel_comment', onChannelComment);
        socket.on('channel_comment_delete', onChannelCommentDelete);

        // Real-time poll updates from other users (backend optional)
        const pollUpdateHandler = (data) => {
            setMessageList(list => list.map(msg => {
                if (!msg.poll) return msg;
                if (data && data.id && data.poll && msg.id === data.id) {
                    return { ...msg, poll: data.poll };
                }
                if (data && data.msgId && Array.isArray(data.options) && msg.id === data.msgId) {
                    const updated = (msg.poll.options || []).map((opt, idx) => ({
                        ...opt,
                        votes: Array.isArray(data.options[idx]?.votes) ? data.options[idx].votes : (opt.votes || [])
                    }));
                    return { ...msg, poll: { ...msg.poll, options: updated } };
                }
                return msg;
            }));
        };

        socket.on('poll_vote_update', pollUpdateHandler);
        socket.on('poll_update', pollUpdateHandler);

        // Background sync: handle notifications even if chat isn't open
        const notificationHandler = (data) => {
            try {
                if (!data || data.type !== 'system' || typeof data.message !== 'string') return;
                const isOn = data.message.includes('turned on disappearing messages');
                const isOff = data.message.includes('turned off disappearing messages');
                if (!isOn && !isOff) return;
                const enabled = isOn;
                // Determine scope and target
                const isGroupScope = data.room && (String(data.room).startsWith('group-') || (typeof data.to === 'string' && String(data.to).startsWith('group-')));
                if (isGroupScope) {
                    const groupId = data.room; // server uses room as group id
                    try { localStorage.setItem(`dm_enabled_group_${groupId}`, String(enabled)); } catch (_) { }
                    try { window.dispatchEvent(new CustomEvent('disappearing_state_update', { detail: { scope: 'group', targetId: groupId, enabled } })); } catch (_) { }
                } else {
                    // DM: target is the other user id in 'to' or parse from room if needed
                    const targetId = data.to || null;
                    const keyBase = targetId || data.room; // fallback to room-based
                    try { localStorage.setItem(`dm_enabled_contact_${keyBase}`, String(enabled)); } catch (_) { }
                    try { window.dispatchEvent(new CustomEvent('disappearing_state_update', { detail: { scope: 'contact', targetId: targetId, enabled } })); } catch (_) { }
                }
            } catch (_) { /* ignore */ }
        };
        socket.on('message_notification', notificationHandler);

        // Removed local disappearing_toggle system message appender

        // Doodle realtime handlers (define in-scope so cleanup can reference)
        const onDoodleBegin = (payload) => {
            try {
                if (!payload || String(payload.room) !== String(room)) return;
                // ensure canvas exists
                const canvas = canvasRef.current; if (!canvas) return;
            } catch (_) { }
        };
        const onDoodleDraw = (payload) => {
            try {
                if (!payload || String(payload.room) !== String(room)) return;
                const { from, to, color = '#ffeb3b', width = 3, mode = 'pen' } = payload;
                const canvas = canvasRef.current; if (!canvas) return;
                const ctx = canvas.getContext('2d');
                ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
                ctx.strokeStyle = mode === 'erase' ? 'rgba(0,0,0,1)' : color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
            } catch (_) { }
        };
        const onDoodleEnd = () => { /* no-op */ };
        const onDoodleClear = (payload) => {
            try {
                if (!payload || String(payload.room) !== String(room)) return;
                const canvas = canvasRef.current; if (!canvas) return;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            } catch (_) { }
        };
        socket.on('doodle_begin', onDoodleBegin);
        socket.on('doodle_draw', onDoodleDraw);
        socket.on('doodle_end', onDoodleEnd);
        socket.on('doodle_clear', onDoodleClear);

        socket.on('message_notification', notificationHandler);

        // Handle channel reaction updates
        const channelReactionHandler = (data) => {
            setMessageList(list => list.map(msg => {
                if (String(msg.id) === String(data.postId)) {
                    return { ...msg, reactions: data.reactions || {} };
                }
                return msg;
            }));
        };
        socket.on('channel_post_reacted', channelReactionHandler);

        return () => {
            socket.off('group_slow_mode_set', slowModeHandler);
            socket.off('group_pin_update', pinUpdateHandler);
            socket.off('doodle_begin', onDoodleBegin);
            socket.off('doodle_draw', onDoodleDraw);
            socket.off('doodle_end', onDoodleEnd);
            socket.off('doodle_clear', onDoodleClear);
            socket.off("receive_message", receiveHandler);

            socket.off("receive_reaction", reactionHandler);
            socket.off("receive_delete_message", deleteHandler);
            socket.off("message_deleted", deleteHandler);
            socket.off("delete_message", deleteHandler);
            socket.off("group_message_deleted", deleteHandler);
            socket.off("receive_edit_message", editHandler);
            socket.off("message_read_update", readHandler);
            socket.off("load_messages", loadHistoryHandler);
            socket.off('poll_vote_update', pollUpdateHandler);
            socket.off('poll_update', pollUpdateHandler);
            socket.off('message_notification', notificationHandler);
            socket.off('channel_post_reacted', channelReactionHandler);
            socket.off('channel_comment', onChannelComment);
            socket.off('channel_comment_delete', onChannelCommentDelete);
        };
    }, [socket, username, room, currentChat?.id, currentChat?.name]);

    // Record a unique view for the latest post when a new channel post is created while viewing this channel
    useEffect(() => {
        if (!socket) return;
        const onChannelPostCreated = (payload) => {
            try {
                if (!payload) return;
                const channelId = payload.channelId || payload.room || payload.id || currentChat?.id;
                if (!channelId) return;
                // If we are currently viewing this channel
                if (currentChat?.isChannel && String(currentChat.id) === String(channelId)) {
                    // 1. Record view if user is logged in
                    if (user?.id) {
                        fetch(`http://localhost:3001/channels/${channelId}/view`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: user.id })
                        }).catch(() => { });
                    }

                    // 2. Add message to list if not already present
                    const post = payload.post || payload;
                    if (post && post.id) {
                        setMessageList(prev => {
                            if (prev.some(m => String(m.id) === String(post.id))) return prev;
                            const file = post.imageUrl ? { url: post.imageUrl, type: 'image/jpeg', name: 'image.jpg' } : (post.file || null);
                            const newMsg = {
                                ...post,
                                message: post.message ?? post.text ?? '',
                                file,
                                room: channelId,
                                time: new Date(post.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                isChannelPost: true
                            };
                            return [...prev, newMsg];
                        });
                    }
                }
            } catch (_) { }
        };
        const onChannelPostDeleted = (payload) => {
            try {
                if (!payload) return;
                const channelId = payload.channelId || payload.room || currentChat?.id;
                const postId = payload.postId || payload.id || payload.msgId;
                if (!channelId || !postId) return;
                if (!(currentChat?.isChannel && String(currentChat.id) === String(channelId))) return;
                setMessageList(prev => prev.filter(m => String(m.id) !== String(postId)));
            } catch (_) { }
        };
        // Creation aliases (backend may vary)
        socket.on('channel_post_created', onChannelPostCreated);
        socket.on('channel_post', onChannelPostCreated);
        socket.on('post_created', onChannelPostCreated);
        socket.on('new_channel_post', onChannelPostCreated);
        // Deletion aliases
        socket.on('channel_post_deleted', onChannelPostDeleted);
        socket.on('post_deleted', onChannelPostDeleted);
        socket.on('channel_post_removed', onChannelPostDeleted);
        return () => {
            socket.off('channel_post_created', onChannelPostCreated);
            socket.off('channel_post', onChannelPostCreated);
            socket.off('post_created', onChannelPostCreated);
            socket.off('channel_post_deleted', onChannelPostDeleted);
            socket.off('post_deleted', onChannelPostDeleted);
            socket.off('channel_post_removed', onChannelPostDeleted);
        };
    }, [socket, currentChat?.id, currentChat?.isChannel, user?.id]);

    useEffect(() => {
        socket.on("chat_deleted", (deletedRoom) => {
            if (deletedRoom === room) {
                setMessageList([]);
            }
        });
        return () => {
            socket.off("chat_deleted");
        }
        prevIsDoodlingRef.current = now;
    }, [isDoodling, socket, room, user?.id]);

    // Listen for group metadata on join
    useEffect(() => {
        const metaHandler = (data) => {
            if (data.id === room) {
                if (data.settings && data.settings.slowMode !== undefined) {
                    setSlowModeSeconds(data.settings.slowMode);
                    try { localStorage.setItem(`slow_mode_${room}`, String(data.settings.slowMode)); } catch (_) { }
                    try { window.dispatchEvent(new CustomEvent('slow_mode_updated', { detail: { room, seconds: data.settings.slowMode } })); } catch (_) { }
                }
                if (Array.isArray(data.pinnedMessages)) {
                    const arr = Array.from(new Set(data.pinnedMessages.map(String)));
                    if (Date.now() >= pinnedGuardUntil) {
                        // Mark as restoring to prevent animation on initial socket sync
                        isRestoringRef.current = true;
                        setPinnedIds(arr);
                        setTimeout(() => { isRestoringRef.current = false; }, 0);
                    } else {

                    }
                    try { localStorage.setItem(`pinned_${room}`, JSON.stringify(arr)); } catch (_) { }
                    try { window.dispatchEvent(new CustomEvent('pinned_updated', { detail: { room, pinnedIds: arr } })); } catch (_) { }
                }
            }
        };
        socket.on('group_meta', metaHandler);
        return () => socket.off('group_meta', metaHandler);
    }, [room, socket]);

    // Track whether user is near bottom to decide auto-scroll
    useEffect(() => {
        const el = document.querySelector('.chat-body');
        if (!el) return;
        const onScroll = () => {
            try {
                const delta = el.scrollHeight - (el.scrollTop + el.clientHeight);
                setIsNearBottom(delta < 120);
            } catch (_) { }
        };
        onScroll();
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [currentChat?.id]);

    // Only auto-scroll when new messages append (not on reaction updates)
    useEffect(() => {
        const count = messageList.length;
        const added = count > prevMsgCountRef.current;
        const last = count > 0 ? messageList[count - 1] : null;
        prevMsgCountRef.current = count;
        if (!added) return; // ignore edits/reactions
        const isOwn = last && last.author === username;
        if (isOwn || isNearBottom) {
            // Use smooth scroll for iOS-style "slide up" effect (only after initial load)
            requestAnimationFrame(() => {
                scrollRef.current?.scrollIntoView({ behavior: isInitialLoad ? 'auto' : 'smooth', block: 'end' });
            });
        }
    }, [messageList, isNearBottom, username, isInitialLoad]);

    // Trigger reply bar gooey animation when reply is set/cleared
    // Track if we were already replying to prevent re-animation on switch
    const wasReplyingRef = useRef(false);

    // Trigger reply bar gooey animation when reply is set/cleared
    useEffect(() => {
        if (replyTo) {
            // Only trigger animation if we weren't already replying (fresh open)
            if (!wasReplyingRef.current) {
                // RESET: Stop any ongoing exit animation immediately
                setIsReplyExiting(false);
                setIsReplyAnimating(false);
                setFooterAnimStage('idle');

                // Step 1: Shrink input (Transition is 0.4s)
                setInputMode('shrinking');

                // Step 2: Trigger Reply Detach
                // Trigger very early (120ms) for immediate response
                setTimeout(() => {
                    setIsReplyAnimating(true);
                    setIsReplyExiting(false);
                }, 120);

                // Step 3: Settle Input (Expand back & Down)
                // Bounce back quickly (250ms)
                setTimeout(() => {
                    setInputMode('reply');
                }, 250);
            }
            wasReplyingRef.current = true;
        } else if (isReplyAnimating || wasReplyingRef.current) {
            // Multi-stage attach animation when reply is cleared
            setIsReplyExiting(true);
            setInputMode('normal'); // Return to normal width/radius immediately

            // Stage 1a: Start Gooey attach/merge (lasts 400ms total)

            // Stage 2a: Start Expanding Width ONLY (at 200ms)
            setTimeout(() => {
                setFooterAnimStage('expanding_width');
            }, 200);

            // Stage 2b: Start Pulling Up Continuous (at 300ms)
            // Starts just 100ms after width expansion for a very integrated "lift" feel
            setTimeout(() => {
                setFooterAnimStage('fully_expanded');
            }, 300);

            // Stage 1b: Finish Gooey attach/merge
            setTimeout(() => {
                setIsReplyAnimating(false);
                setIsReplyExiting(false);
            }, 500); // Extended finish time

            // Stage 3: Contract width + Push Down (return to idle)
            // Even earlier return: Pull-up starts 300ms.
            // Trigger return at 650ms for hyper-aggressive bounce.
            setTimeout(() => {
                setFooterAnimStage('idle');
            }, 650);

            // Cleanup
            const timer = setTimeout(() => {
                // Ensure state is clean
                setFooterAnimStage('idle');
            }, 1100);

            wasReplyingRef.current = false;
            return () => clearTimeout(timer);
        }
    }, [replyTo]);

    // Image gallery helpers
    useEffect(() => {
        let timer;
        if (viewingStory) {
            timer = setTimeout(() => {
                setViewingStory(null);
            }, 10000);
        }
        return () => clearTimeout(timer);
    }, [viewingStory]);

    // Image gallery helpers
    const imageMessages = messageList.filter(m => m && m.file && m.file.type && m.file.type.startsWith('image'));
    const openImageAt = (fileUrl) => {
        const idx = imageMessages.findIndex(m => m.file.url === fileUrl);
        setViewingImageIndex(idx);
        setViewingImage(idx >= 0 ? imageMessages[idx].file : null);
    };
    const stepImage = (delta) => {
        if (imageMessages.length === 0 || viewingImageIndex < 0) return;
        let ni = (viewingImageIndex + delta + imageMessages.length) % imageMessages.length;
        setViewingImageIndex(ni);
        setViewingImage(imageMessages[ni].file);
    };
    useEffect(() => {
        if (!viewingImage) return;
        const onKey = (e) => {
            if (e.key === 'ArrowRight') stepImage(1);
            if (e.key === 'ArrowLeft') stepImage(-1);
            if (e.key === 'Escape') setViewingImage(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [viewingImage, viewingImageIndex, imageMessages.length]);

    // Placed doodles overlay state
    const [placedDoodles, setPlacedDoodles] = useState([]);
    const placedCanvasRefs = useRef({});

    // Optimize doodle rendering by slicing to match message limit
    // This prevents rendering 100s of off-screen canvases
    const visibleDoodles = useMemo(() => {
        // If showing all messages (or search), show all doodles
        if (searchQuery || filteredMessages.length <= renderLimit) return placedDoodles;
        // Heuristic: Slice doodles similarly to messages. 
        // Since doodles are typically sparse, we might want to be more generous,
        // but slicing the last N where N = renderLimit is a safe performance baseline.
        // If renderLimit increases on scroll, this increases too.
        return placedDoodles.slice(Math.max(0, placedDoodles.length - renderLimit));
    }, [placedDoodles, renderLimit, searchQuery, filteredMessages.length]);

    // Doodle placement: fix at current viewport position and scroll with messages
    const handlePlaceDoodle = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const scrollContainer = document.querySelector('.chat-body');
        if (!scrollContainer) return;
        const image = canvas.toDataURL('image/png');
        const rect = canvas.getBoundingClientRect();
        const displayHeight = Math.round(rect.height);
        const newDoodle = {
            id: Date.now().toString() + '_' + Math.random().toString(36).slice(2),
            image,
            top: scrollContainer.scrollTop,
            width: Math.round(rect.width),
            height: displayHeight,
            height: displayHeight,
            creatorUserId: user?.id,
            room: room // Critical: tag with current room to prevent leakage
        };
        setPlacedDoodles(prev => [...prev, newDoodle]);
        try { socket.emit('doodle_place', { room, doodle: newDoodle }); } catch (_) { }
        // Clear the drawing canvas locally and exit doodle mode (do not broadcast clear here)
        try { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); } catch (_) { }
        justPlacedDoodleRef.current = true;
        setIsDoodling(false);
    };

    const clearMainCanvas = () => {
        try {
            const c = canvasRef.current; if (!c) return;
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, c.width, c.height);
        } catch (_) { }
    };

    // Clear placed doodles and canvas when switching rooms
    useEffect(() => {
        setPlacedDoodles([]);
        const canvas = canvasRef.current;
        if (canvas) {
            try {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            } catch (_) { }
        }
    }, [room]);

    // Realtime sync for placed doodles
    useEffect(() => {
        if (!socket) return;
        const onPlace = (payload = {}) => {
            try {
                if (!payload.room || String(payload.room) !== String(room)) return;
                const d = payload.doodle; if (!d || !d.id) return;
                setPlacedDoodles(prev => prev.some(x => x.id === d.id) ? prev : [...prev, d]);
                // Remove transient strokes from the main canvas to avoid duplicate (fixed) doodle
                clearMainCanvas();
            } catch (_) { }
        };
        const onErase = (payload = {}) => {
            try {
                if (!payload.room || String(payload.room) !== String(room)) return;
                const { doodleId, x, y, radius } = payload;
                const c = placedCanvasRefs.current[doodleId];
                if (!c) return;
                const ctx = c.getContext('2d');
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(x, y, radius || 6, 0, Math.PI * 2);
                ctx.fill();
            } catch (_) { }
        };
        const onRemove = (payload = {}) => {
            try {
                if (!payload.room || String(payload.room) !== String(room)) return;
                const { doodleId } = payload; if (!doodleId) return;
                setPlacedDoodles(prev => prev.filter(d => d.id !== doodleId));
                try { delete placedCanvasRefs.current[doodleId]; } catch (_) { }
            } catch (_) { }
        };
        const onClear = (payload = {}) => {
            try {
                if (!payload.room || String(payload.room) !== String(room)) return;
                const targetUserId = payload.userId;
                if (!targetUserId) return;
                // Remove all doodles created by this user in this room
                setPlacedDoodles(prev => {
                    return prev.filter(d => String(d.creatorUserId) !== String(targetUserId));
                });
                // Also clear transient main canvas drawings
                clearMainCanvas();
            } catch (_) { }
        };
        const onLoadDoodles = (doodles = []) => {
            try {
                // Filter incoming doodles to only those belonging to this room
                const filtered = doodles.filter(d => String(d.room) === String(room));

                setPlacedDoodles(prev => {
                    // Create a map of existing doodles by ID
                    const prevMap = new Map(prev.map(p => [p.id, p]));
                    // Add incoming doodles, overwriting existing ones (server authority)
                    filtered.forEach(d => prevMap.set(d.id, d));
                    // Convert back to array
                    return Array.from(prevMap.values());
                });
            } catch (_) { }
        };
        socket.on('doodle_place', onPlace);
        socket.on('doodle_erase', onErase);
        socket.on('doodle_remove', onRemove);
        socket.on('doodle_clear', onClear);
        socket.on('load_doodles', onLoadDoodles);
        if (room) socket.emit('get_doodles', room);
        return () => {
            socket.off('doodle_place', onPlace);
            socket.off('doodle_erase', onErase);
            socket.off('doodle_remove', onRemove);
            socket.off('doodle_clear', onClear);
            socket.off('load_doodles', onLoadDoodles);
        };
    }, [socket, room]);

    return (
        <div className="chat-window" style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}>
            {/* SVG Goo Filters for liquid detachment effect */}
            <svg width="0" height="0" style={{ position: "absolute" }}>
                <defs>
                    {/* Original complex goo filter – now stronger & smoother */}
                    <filter
                        id="goo"
                        x="-35%"
                        y="-35%"
                        width="170%"
                        height="170%"
                        colorInterpolationFilters="sRGB"
                    >
                        {/* Noise pattern used to add stretchy organic wobble */}
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.45"
                            numOctaves="1"
                            seed="2"
                            result="noise"
                        />
                        {/* Distort the blurred mesh – slightly reduced for smoothness */}
                        <feDisplacementMap
                            in="SourceGraphic"
                            in2="noise"
                            scale="10"               // was 14 → smoother, less jagged
                            xChannelSelector="R"
                            yChannelSelector="G"
                            result="distort"
                        />
                        {/* Deep blur → thicker goo neck */}
                        <feGaussianBlur in="distort" stdDeviation="20" result="blur" />  {/* was 16 */}

                        {/* Stronger alpha boost to hold the mesh longer & thicker */}
                        <feColorMatrix
                            in="blur"
                            type="matrix"
                            values="
          1 0 0 0 0
          0 1 0 0 0
          0 0 1 0 0
          0 0 0 30 -12   <!-- was 25 -10 -->
        "
                            result="goo"
                        />

                        {/* Extra softening for smoother edge */}
                        <feGaussianBlur in="goo" stdDeviation="1.75" result="softGoo" /> {/* was 1.25 */}

                        {/* Blend back over original */}
                        <feBlend in="softGoo" in2="SourceGraphic" mode="normal" />
                    </filter>

                    {/* Enhanced gooey effect filter - matching gooey-search-main */}
                    <filter id="goo-effect">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
                        <feColorMatrix
                            in="blur"
                            type="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 32 -16"
                            result="goo"
                        />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>

                    {/* Stronger gooey effect for dark mode */}
                    <filter id="goo-effect-dark">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
                        <feColorMatrix
                            in="blur"
                            type="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -12"
                            result="goo"
                        />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                </defs>
            </svg>

            {/* GPU SHADER WARMUP: Invisible element to force browser to pre-compile the expensive #goo-effect shader on mount */}
            <div style={{ position: 'absolute', width: 1, height: 1, opacity: 0.001, pointerEvents: 'none', filter: 'url(#goo-effect)', zIndex: -1000, willChange: 'transform, filter', transform: 'translate3d(0,0,0)' }} />

            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                backgroundColor: theme === 'dark' ? '#0f0f0f' : '#f0f2f5',
                backgroundImage: theme === 'dark' ? 'url("/assets/dark-chat-bg.png")' : 'url("/assets/light-chat-bg.png")',
                backgroundSize: '400px',
                backgroundPosition: 'center',
                backgroundRepeat: 'repeat',
                transition: 'background-image 0.5s ease',
                position: 'relative' // Added for doodle canvas overlay
            }}>
                {/* Goo container - optimized for 60fps */}
                <div className={`goo-stack ${theme === 'dark' ? 'dark-mode' : ''} ${meshActive ? 'mesh-active' : ''} ${isAnimating ? 'active' : ''} ${isExiting ? 'exiting' : ''}`} style={{
                    position: 'absolute',
                    top: 0,
                    left: '24px',
                    right: currentChat?.showInfo ? '374px' : '24px',
                    zIndex: 1500,
                    filter: useLightweightMode ? 'none' : 'url(#goo-effect)',
                    transition: 'right 0.3s ease',
                    willChange: 'transform, filter',
                    transform: 'translate3d(0, 0, 0)'
                }}>
                    <div
                        className={`chat-header`}
                        style={{ position: 'relative', padding: '10px 0' }}
                    >
                        <motion.div className="chat-header-pill" animate={headerControls} style={{ marginTop: '14px', height: '68px', borderRadius: '15px' }}>
                            {/* Glass background layer for gooey effect */}
                            <div className="chat-header-pill-glass" />

                            {/* Gradient reflection effect - subtle glow at bottom border */}


                            {/* Light white sweep overlay during goo blur */}
                            <div className="light-sweep-overlay" style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: 0,
                                height: '200px',
                                background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0) 100%)',
                                pointerEvents: 'none',
                                zIndex: 2,
                                opacity: 0,
                                backdropFilter: 'none',
                                WebkitBackdropFilter: 'none',
                                filter: 'none'
                            }} />

                            {headerBlurred && <div className="chat-header-blur-overlay" />}
                        </motion.div>
                    </div>

                    {/* Pinned Messages Bar - inside goo-stack for liquid effect */}
                    {(showPinned || isExiting) && (
                        <div key={pinAnimKey} className={`card-main ${pinAnimKey > 0 ? 'anim-enter' : ''} ${isExiting ? 'exiting' : ''} ${isDetaching ? 'detaching' : ''} ${useSmallAttachAnim ? 'small-anim' : ''}`} style={{
                            width: '100%',
                            height: '68px', /* Matched to chat-header-pill */
                            borderRadius: '15px',
                            background: 'var(--pinned-bg)',
                            border: 'none',
                            backdropFilter: 'none',
                            position: 'absolute',
                            left: 0,
                            top: '47px',
                            transformOrigin: 'bottom center',
                            transform: 'translateY(0px)',
                            opacity: isExiting ? 1 : 0,
                            visibility: isExiting ? 'visible' : 'hidden',
                            filter: 'none',
                            zIndex: 10,
                            willChange: 'transform, opacity',
                            backfaceVisibility: 'hidden',
                            transformStyle: 'preserve-3d',
                            WebkitFontSmoothing: 'antialiased',
                            WebkitTransform: 'translateZ(0)',
                            cursor: 'pointer'
                        }}
                            onAnimationStart={(e) => { e.currentTarget.style.visibility = 'visible'; }}
                            onClick={() => {
                                const currentPinId = pinnedIds[currentPinnedIndex];
                                const el = document.querySelector(`[data-msg-id="${currentPinId}"]`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}>
                            <div className="card-main-frost" style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '15px',
                                background: 'transparent',
                                backdropFilter: 'none',
                                WebkitBackdropFilter: 'none',
                                border: 'none',
                                boxShadow: 'var(--pinned-inner-shadow)',
                                pointerEvents: 'none',
                                opacity: 0
                            }} />

                            <div className="card-main-inner" style={{
                                position: 'relative',
                                zIndex: 2,
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px 16px', /* Matched to chat-header-pill-content */
                                borderRadius: '15px',
                                height: '100%',
                                transition: 'none',
                                overflow: 'hidden' // Ensure gradient doesn't spill if border-radius mismatch
                            }}>
                                {/* Animated gradient overlay moved inside to sit on top of inner bg */}
                                <div className="pinned-gradient-overlay" style={{
                                    position: 'absolute',
                                    inset: 0,
                                    pointerEvents: 'none',
                                    zIndex: 0
                                }}>
                                    <div className="gradient-shape" style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: '0%',
                                        height: '0%',
                                        borderRadius: '0 0 80% 80%',
                                        filter: 'blur(12px)'
                                    }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Header Content - OUTSIDE goo-stack to prevent blur */}
                <div className={`chat-header-content-container ${meshActive ? 'mesh-active' : ''} ${isAnimating ? 'active' : ''}`} style={{
                    position: 'absolute',
                    top: 0,
                    left: '24px',
                    right: currentChat?.showInfo ? '374px' : '24px',
                    zIndex: 1501, /* Higher than goo-stack */
                    pointerEvents: 'none', /* Let clicks pass through to background */
                    transition: 'right 0.3s ease'
                }}>
                    {/* Pinned Messages Content Overlay - OUTSIDE goo-stack */}
                    {(showPinned || isExiting) && (
                        <div key={pinAnimKey} className={`card-main ${pinAnimKey > 0 ? 'anim-enter' : ''} ${isExiting ? 'exiting' : ''} ${isDetaching ? 'detaching' : ''} ${useSmallAttachAnim ? 'small-anim' : ''}`} style={{
                            width: '100%',
                            height: '68px',
                            borderRadius: '15px',
                            background: 'transparent', // Transparent background
                            border: 'none',
                            boxShadow: 'none', // No shadow
                            backdropFilter: 'none',
                            position: 'absolute',
                            left: 0,
                            top: '55px',
                            transformOrigin: 'bottom center',
                            transform: 'translateY(0px)',
                            opacity: 0,
                            visibility: 'hidden',
                            filter: 'none', // No filter
                            zIndex: 10,
                            willChange: 'transform, opacity',
                            cursor: 'pointer',
                            pointerEvents: 'auto' // Re-enable pointer events for clicks
                        }}
                            onAnimationStart={(e) => { e.currentTarget.style.visibility = 'visible'; }}
                            onClick={() => {
                                const currentPinId = pinnedIds[currentPinnedIndex];
                                const el = document.querySelector(`[data-msg-id="${currentPinId}"]`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}>
                            <div className="card-main-inner" style={{
                                position: 'relative',
                                zIndex: 2,
                                display: 'flex',
                                alignItems: 'center',
                                padding: '6px 16px 20px 16px',
                                borderRadius: '15px',
                                height: '100%',
                                transition: 'none',
                                overflow: 'visible'
                            }}>
                                <div className="pinned-content pinned-icon" style={{ marginRight: '12px', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                                    <div style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                                        <BsPinFill size={18} />
                                    </div>
                                </div>
                                <div className="pinned-content" style={{ flex: 1, overflow: 'visible', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0px', paddingTop: '0px', position: 'relative', zIndex: 1 }}>
                                    <div className="pinned-label" style={{ fontSize: '0.75rem', color: pinHighContrast ? highContrastColor : 'var(--accent-primary)', fontWeight: 'bold', textShadow: pinHighContrast ? highContrastShadow : 'none', letterSpacing: pinHighContrast ? '0.2px' : undefined }}>
                                        Pinned Message {pinnedIds.length > 1 ? `(${currentPinnedIndex + 1}/${pinnedIds.length})` : ''}
                                    </div>
                                    <div key={pinnedTextKey} className="pinned-message-text pinned-preview" style={{
                                        fontSize: '0.95rem',
                                        color: pinHighContrast ? highContrastColor : 'var(--text-primary)',
                                        position: 'relative',
                                        paddingTop: '2px',
                                        paddingBottom: '4px',
                                        textShadow: pinHighContrast ? (uiMode === 'light' ? '0 1px 2px rgba(0,0,0,0.25)' : '0 1px 3px rgba(0,0,0,0.55)') : 'none'
                                    }}>
                                        <div style={{
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            position: 'relative',
                                            zIndex: 1
                                        }}>
                                            {(() => {
                                                const currentPinId = pinnedIds[currentPinnedIndex];
                                                const msg = messageList.find(m => m.id === currentPinId);
                                                if (!msg) return 'Loading...';
                                                const rawText = msg.file ? `📎 ${msg.file.name || 'Attachment'}` : msg.message;
                                                // Split into characters for staggered blur animation
                                                const chars = splitGraphemes(rawText);
                                                return chars.map((char, i) => (
                                                    <span
                                                        key={i}
                                                        className="pinned-char"
                                                        style={{
                                                            animationDelay: `${i * 0.015}s`, // Fast ripple 
                                                            minWidth: char === ' ' ? '4px' : 'auto'
                                                        }}
                                                    >
                                                        {char === ' ' ? '\u00A0' : char}
                                                    </span>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="pinned-content pinned-arrow" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                    <FiChevronDown size={20} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="chat-header" style={{ position: 'relative', padding: '10px 0' }}>
                        <div style={{ marginTop: '14px', padding: '0 20px 0 10px', height: '68px', display: 'flex', alignItems: 'center' }}>
                            <div className="chat-header-pill-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', transition: 'none', opacity: 1, pointerEvents: 'auto', flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={toggleInfo}>
                                    <div style={{ position: 'relative' }}>
                                        {(() => {
                                            if (currentChat?.isGroup) {
                                                try {
                                                    const mode = localStorage.getItem('group_avatar_mode_' + currentChat.id) || 'stack';
                                                    if (mode === 'single') {
                                                        const url = localStorage.getItem('group_avatar_' + currentChat.id);
                                                        if (url) {
                                                            return <Avatar src={url} alt={currentChat.name} className="avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />;
                                                        }
                                                    }
                                                    // Stack mode
                                                    return (
                                                        <div style={{ position: 'relative', width: '48px', height: '48px' }}>
                                                            {currentChat.members.slice(0, 3).map((member, i) => (
                                                                <Avatar
                                                                    key={member.id || member}
                                                                    src={typeof member === 'object' ? member.avatar : `https://i.pravatar.cc/150?u=${member}`}
                                                                    alt="Member"
                                                                    style={{
                                                                        width: '34px',
                                                                        height: '34px',
                                                                        borderRadius: '50%',
                                                                        position: 'absolute',
                                                                        left: `${i * 12}px`,
                                                                        top: '50%',
                                                                        transform: 'translateY(-50%)',
                                                                        border: '2px solid var(--bg-panel)',
                                                                        zIndex: 3 - i,
                                                                        objectFit: 'cover'
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                    );
                                                } catch (_) { }
                                            }
                                            // Non-group or fallback
                                            let cached = '';
                                            try { cached = currentChat?.id ? (localStorage.getItem('channel_photo_' + currentChat.id) || '') : ''; } catch (_) { cached = ''; }
                                            const fallback = `https://i.pravatar.cc/150?u=channel_${currentChat?.id || currentChat?.name || 'default'}`;
                                            const src = channelPhotoUrl || currentChat?.photo || cached || currentChat?.avatar || fallback;
                                            return <Avatar src={src} alt="User" className="avatar" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallback; }} style={{ width: '48px', height: '48px', borderRadius: '50%' }} />;
                                        })()}
                                        {currentChat?.isGroup
                                            ? (() => {
                                                const anyOnline = (currentChat?.members || []).some(m => {
                                                    const id = (m && typeof m === 'object') ? (m.id ?? m._id ?? m) : m;
                                                    return Array.isArray(onlineUsers) && onlineUsers.some(u => String(u) === String(id));
                                                });
                                                return (
                                                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', background: anyOnline ? 'var(--status-online)' : '#ff6b6b', borderRadius: '50%', border: '3px solid var(--bg-panel)', animation: anyOnline ? 'pulseGreen 1.2s ease-in-out infinite' : 'pulseRed 1.2s ease-in-out infinite', zIndex: 10 }}></div>
                                                );
                                            })()
                                            : (
                                                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', background: onlineUsers.includes(currentChat?.id) ? 'var(--status-online)' : '#ff6b6b', borderRadius: '50%', border: '3px solid var(--bg-panel)', animation: onlineUsers.includes(currentChat?.id) ? 'pulseGreen 1.2s ease-in-out infinite' : 'pulseRed 1.2s ease-in-out infinite', zIndex: 10 }}></div>
                                            )
                                        }
                                    </div>
                                </div>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {/* Row 1: Name with pills on the right */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6, width: '100%', minWidth: 0 }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', lineHeight: 1, color: theme === 'dark' ? '#fff' : '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                            {(() => {
                                                const name = currentChat?.username || currentChat?.name || "Select a Chat";
                                                return name.length > 5 ? name.substring(0, 5) + "..." : name;
                                            })()}
                                        </h3>

                                        {/* Pills on the right side of name */}
                                        <div className="chat-header-pills" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', flexShrink: 0 }}>
                                            {(() => {
                                                const scope = String(room ?? currentChat?.id ?? '');
                                                const isSynced = pinnedSyncedChatId === scope;
                                                const count = isSynced ? pinnedIds.length : new Set(currentChat?.pinnedMessages || []).size;

                                                if (count > 0) {
                                                    return (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ padding: '2px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                                <BsPinFill size={12} fill="currentColor" color="var(--accent-primary)" />
                                                                Pinned {count}
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            {(() => {
                                                const starredCount = messageList.filter(m => m.starredBy && m.starredBy.includes(user?.id)).length;
                                                if (starredCount > 0) {
                                                    return (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ padding: '2px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                                <FiStar size={12} fill="currentColor" color="var(--accent-primary)" />
                                                                Starred {starredCount}
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            {currentChat?.isGroup && (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ padding: '2px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: slowModeSeconds > 0 ? '#22c55e' : 'var(--border-color)', boxShadow: slowModeSeconds > 0 ? '0 0 0 0 rgba(34,197,94,0.7)' : 'none', animation: slowModeSeconds > 0 ? 'pulseGreen 1.2s ease-in-out infinite' : 'none' }}></span>
                                                        Slow Mode {slowModeSeconds > 0 ? `${slowModeSeconds}s` : 'Off'}
                                                    </span>
                                                </div>
                                            )}
                                            {currentChat?.isChannel && currentChat?.settings?.reactions === false && (
                                                <span style={{ padding: '2px 6px', background: 'var(--pill-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', backdropFilter: 'blur(8px)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                                    Reactions Off
                                                </span>
                                            )}
                                            {currentChat?.isChannel && currentChat?.settings?.forwarding === false && (
                                                <span style={{ padding: '2px 6px', background: 'var(--pill-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', backdropFilter: 'blur(8px)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                                    Forwarding Off
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 2: Members/typing and roles */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'nowrap', overflow: 'hidden' }}>
                                            <span style={{ fontSize: '0.8rem', color: theme === 'dark' ? '#fff' : '#000', whiteSpace: 'nowrap' }}>
                                                {currentChat?.isGroup ? `${(Array.isArray(currentChat?.members) ? currentChat.members.length : 0)} members` : (currentChat?.about || 'Online')}
                                            </span>

                                            {currentChat?.isGroup && Array.isArray(currentChat?.roles) && (() => {
                                                const roles = Array.isArray(currentChat.roles) ? currentChat.roles : [];
                                                const memberRoles = currentChat.memberRoles || {};
                                                const members = Array.isArray(currentChat.members) ? currentChat.members : [];
                                                // Build a normalized set of current member IDs
                                                const memberIdSet = new Set(members.map(m => String((m && typeof m === 'object') ? (m.id ?? m._id ?? m) : m)));
                                                const byRole = roles.map(r => {
                                                    // Get all member IDs explicitly assigned to this role
                                                    let assignedIds = Object.entries(memberRoles || {})
                                                        .filter(([mid, rid]) => String(rid) === String(r.id))
                                                        .map(([mid]) => String(mid));

                                                    // Special handling for Owner role: always include creator
                                                    if (String(r.name).toLowerCase() === 'owner' || String(r.id) === 'owner') {
                                                        if (currentChat.createdBy) {
                                                            assignedIds.push(String(currentChat.createdBy));
                                                        }
                                                    }

                                                    // Keep only those who are actually in current members
                                                    const uniqueIds = Array.from(new Set(assignedIds.filter(id => memberIdSet.has(String(id)))));

                                                    const count = uniqueIds.length;
                                                    const onlineCount = uniqueIds.filter(id => Array.isArray(onlineUsers) && onlineUsers.some(u => String(u) === String(id))).length;
                                                    return { ...r, count, onlineCount };
                                                }).filter(x => x.count > 0);
                                                if (byRole.length === 0) return null;
                                                return (
                                                    <div style={{ position: 'relative', flexShrink: 1, minWidth: 0 }}>
                                                        <style>{`
                                                        @keyframes pulseGreen { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); } 70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
                                                        @keyframes pulseRed { 0% { box-shadow: 0 0 0 0 rgba(255,77,79,0.7); } 70% { box-shadow: 0 0 0 8px rgba(255,77,79,0); } 100% { box-shadow: 0 0 0 0 rgba(255,77,79,0); } }
                                                        @keyframes bumpUp { 0% { transform: translateY(0); } 50% { transform: translateY(-2px); } 100% { transform: translateY(0); } }
                                                        @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                                                    `}</style>
                                                        <div
                                                            ref={rolesViewportRef}
                                                            className="role-pills-viewport"
                                                            style={{
                                                                overflowX: 'auto',
                                                                overflowY: 'hidden',
                                                                maxWidth: '100%',
                                                                width: roleViewportWidth ? roleViewportWidth + 'px' : 'auto'
                                                            }}
                                                        >
                                                            <div className="roles-strip" style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                                                                {byRole.map(r => (
                                                                    <div className="role-bubble" key={r.id} title={`${r.name}${r.count > 1 ? ` • ${r.count}` : ''}`} style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                        padding: '3px 8px', borderRadius: 16,
                                                                        background: 'var(--pill-bg)',
                                                                        border: '1px solid var(--border-color)',
                                                                        backdropFilter: 'blur(8px)',
                                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                                        whiteSpace: 'nowrap', maxWidth: 220
                                                                    }} onMouseDown={(e) => { e.stopPropagation(); }}>
                                                                        <span style={{ fontWeight: 700, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', color: r.color || 'var(--text-primary)' }}>{r.name}{r.count > 1 ? ` (${r.count})` : ''}</span>
                                                                        <span style={{
                                                                            width: 6, height: 6, borderRadius: '50%',
                                                                            background: r.onlineCount > 0 ? '#22c55e' : '#ff4d4f',
                                                                            boxShadow: r.onlineCount > 0 ? '0 0 0 0 rgba(34,197,94,0.7)' : '0 0 0 0 rgba(255,77,79,0.7)',
                                                                            animation: `${r.onlineCount > 0 ? 'pulseGreen' : 'pulseRed'} 1.2s ease-in-out infinite`
                                                                        }} />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons - rightmost end, outside goo-stack to avoid blur */}
                            <div style={{
                                position: 'absolute',
                                right: '20px',
                                top: '56%',
                                transform: 'translateY(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                zIndex: 10,
                                pointerEvents: 'auto'
                            }}>
                                <button
                                    onClick={() => onStartCall(currentChat, false)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme === 'dark' ? '#fff' : '#000', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                    <FiPhone size={20} />
                                </button>
                                <button
                                    onClick={() => onStartCall(currentChat, true)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme === 'dark' ? '#fff' : '#000', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                    <FiVideo size={20} />
                                </button>
                                <button
                                    onClick={() => setShowSearch(!showSearch)}
                                    style={{ background: showSearch ? 'var(--accent-light)' : 'none', border: 'none', cursor: 'pointer', color: showSearch ? 'var(--accent-primary)' : (theme === 'dark' ? '#fff' : '#000'), display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' }}
                                    onMouseEnter={(e) => !showSearch && (e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')}
                                    onMouseLeave={(e) => !showSearch && (e.currentTarget.style.background = 'none')}
                                >
                                    <FiSearch size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Goo animation styles */}


                {/* Search Bar */}
                {showSearch && (
                    <div style={{ padding: '12px 30px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FiSearch size={18} color="var(--text-secondary)" />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ flex: 1, background: 'var(--bg-input)', border: 'none', borderRadius: '8px', padding: '8px 12px', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-family)' }}
                            autoFocus
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                <FiX size={18} />
                            </button>
                        )}
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {searchQuery && `${filteredMessages.length} result${filteredMessages.length !== 1 ? 's' : ''}`}
                        </span>
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    flex: 1,
                    overflow: 'hidden'
                }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        {/* Pinned Messages Bar now handled by goo-stack above */}

                        <div className="chat-body" ref={chatBodyRef} onScroll={handleScroll} style={{
                            position: 'relative',
                            flex: 1, display: 'flex', flexDirection: 'column',
                            background: 'transparent',
                            paddingTop: pinnedIds.length > 0 ? '150px' : '90px', // Adjusted for pinned bar
                            paddingBottom: '20px', // Reset to minimal padding (spacer handles the rest)
                            // Keep a small gutter when info is collapsed so right messages shift a bit left
                            paddingRight: currentChat?.showInfo ? '380px' : '25px',
                            contain: 'layout style',
                            // Removed transform/transition to fix Canvas flickering issues
                            opacity: 1,
                            transform: 'none',
                            pointerEvents: 'auto',
                        }}>



                            <>
                                {/* Placed Doodles Overlay (fixed in scroll flow) */}
                                {visibleDoodles.map(doodle => (
                                    <PlacedDoodle key={doodle.id} doodle={doodle} />
                                ))}

                                {/* Messages List with Layout Animation */}
                                <AnimatePresence initial={false} mode="popLayout" key={currentChat?.id}>
                                    {renderedMessages.map((messageContent, index) => {
                                        const isMe = username === messageContent.author;
                                        const previousMsg = index > 0 ? renderedMessages[index - 1] : null;
                                        const showDateSeparator = shouldShowDateSeparator(messageContent, previousMsg);

                                        // Compute sender display name and role (for groups)
                                        const senderName = isMe
                                            ? 'You'
                                            : (currentChat?.isAnnouncementGroup ? 'Admin' : messageContent.author);
                                        let senderRoleName = null;
                                        let senderRoleColor = null;
                                        if ((currentChat?.isGroup || currentChat?.isAnnouncementGroup) && Array.isArray(currentChat?.members)) {
                                            const member = currentChat.members.find(m => m.username === messageContent.author || m.id === messageContent.author);
                                            const memberRoles = currentChat.memberRoles || {};
                                            const roleId = member && memberRoles[member.id];
                                            const roles = Array.isArray(currentChat.roles) ? currentChat.roles : [];
                                            if (roleId) {
                                                const role = roles.find(r => r.id === roleId);
                                                if (role) {
                                                    senderRoleName = role.name;
                                                    senderRoleColor = role.color;
                                                }
                                            }
                                        }

                                        return (
                                            <motion.div
                                                key={messageContent.id ?? index}
                                                // layout="position" removed for performance optimization
                                                initial={isInitialLoad ? false : { opacity: 0, y: 20, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={isInitialLoad ? { transition: { duration: 0 } } : { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                                transition={isInitialLoad ? { duration: 0 } : { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                                                style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
                                            >
                                                {/* Date Separator */}
                                                {showDateSeparator && (
                                                    <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0 10px', position: 'relative' }}>
                                                        <div style={{ flex: 1, height: '2px', background: 'var(--text-primary)', opacity: 0.3 }}></div>
                                                        <div style={{ background: 'var(--accent-primary)', padding: '6px 16px', borderRadius: '16px', fontSize: '0.75rem', color: '#ffffff', fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', margin: '0 12px' }}>
                                                            {getDateLabel(messageContent.timestamp || Date.now())}
                                                        </div>
                                                        <div style={{ flex: 1, height: '2px', background: 'var(--text-primary)', opacity: 0.3 }}></div>
                                                    </div>
                                                )}

                                                {/* System Message - Centered like Date Separator */}
                                                {messageContent.type === 'system' ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0', position: 'relative' }}>
                                                        <div style={{ background: 'rgba(128, 128, 128, 0.3)', padding: '6px 16px', borderRadius: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', margin: '0 auto' }}>
                                                            {messageContent.message}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className={`message-container ${(currentChat?.isAnnouncementGroup || currentChat?.isChannel) ? 'centered' : (isMe ? 'me' : 'other')}`} style={{
                                                        position: 'relative',
                                                        zIndex: activeMenuMessageId === messageContent.id ? 1000 : 'auto',
                                                        alignItems: 'flex-end'
                                                    }}>

                                                        <div className="message-wrapper" data-msg-id={messageContent.id} style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: (currentChat?.isAnnouncementGroup || currentChat?.isChannel) ? 'center' : (isMe ? 'flex-end' : 'flex-start'),
                                                            marginLeft: (!(currentChat?.isAnnouncementGroup || currentChat?.isChannel) && !isMe) ? '90px' : '0',
                                                            marginRight: (!(currentChat?.isAnnouncementGroup || currentChat?.isChannel) && isMe) ? '90px' : '0'
                                                        }}>

                                                            {/* Forwarded Indicator */}
                                                            {messageContent.isForwarded && (
                                                                <div style={{
                                                                    fontSize: '0.7rem', color: 'var(--text-secondary)',
                                                                    fontStyle: 'italic', marginBottom: '4px',
                                                                    display: 'flex', alignItems: 'center', gap: '4px'
                                                                }}>
                                                                    <FiShare2 size={12} /> Forwarded
                                                                </div>
                                                            )}

                                                            {/* Reply Context */}
                                                            {messageContent.replyTo && (
                                                                <div style={{
                                                                    background: (() => {
                                                                        const hasLink = extractLinks(messageContent.replyTo.message || '').length > 0;
                                                                        if (hasLink) {
                                                                            if (username === messageContent.author) {
                                                                                return theme === 'light' ? '#eceff3' : '#383838ff';
                                                                            } else {
                                                                                return theme === 'light' ? '#ffffff' : '#383838ff';
                                                                            }
                                                                        }
                                                                        return (username === messageContent.author)
                                                                            ? (theme === 'dark' ? '#272727ff' : '#dededeff')
                                                                            : 'var(--accent-primary)';
                                                                    })(),
                                                                    color: (() => {
                                                                        const hasLink = extractLinks(messageContent.replyTo.message || '').length > 0;
                                                                        if (hasLink) {
                                                                            return (theme === 'light') ? 'var(--text-primary)' : '#FFFFFF';
                                                                        }
                                                                        return (username === messageContent.author)
                                                                            ? (theme === 'dark' ? 'var(--msg-sent-text)' : 'var(--text-primary)')
                                                                            : '#FFFFFF';
                                                                    })(),
                                                                    padding: '8px', borderRadius: '8px', marginBottom: '4px'
                                                                }}>
                                                                    <div style={{ fontWeight: 'bold', fontSize: '0.7rem' }}>{messageContent.replyTo.author}</div>
                                                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{messageContent.replyTo.message}</div>
                                                                </div>
                                                            )}

                                                            {/* Story Context */}
                                                            {messageContent.storyContext && (
                                                                <div className="story-preview-card" onClick={() => {

                                                                    setViewingStory(messageContent.storyContext);
                                                                }} style={{
                                                                    width: '120px',
                                                                    height: '180px',
                                                                    borderRadius: '12px',
                                                                    marginBottom: '8px',
                                                                    position: 'relative',
                                                                    overflow: 'hidden',
                                                                    backgroundImage: `url(${messageContent.storyContext.imageUrl})`,
                                                                    backgroundSize: 'cover',
                                                                    backgroundPosition: 'center',
                                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                                                    cursor: 'pointer'
                                                                }}>
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: '8px',
                                                                        left: '8px',
                                                                        background: 'rgba(0,0,0,0.6)',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.6rem',
                                                                        color: 'white',
                                                                        fontWeight: 'bold',
                                                                        backdropFilter: 'blur(4px)'
                                                                    }}>
                                                                        Story
                                                                    </div>
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        bottom: '0',
                                                                        left: '0',
                                                                        right: '0',
                                                                        background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                                                        padding: '20px 8px 8px',
                                                                        color: 'white'
                                                                    }}>
                                                                        <div style={{ fontSize: '0.7rem', fontWeight: '500' }}>Replying to story</div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Sender/Receiver Name & Role - bubbles above message */}
                                                            <div style={{
                                                                alignSelf: currentChat?.isAnnouncementGroup ? 'center' : (isMe ? 'flex-end' : 'flex-start'),
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                marginBottom: '6px',
                                                                position: 'relative',
                                                                zIndex: 3
                                                            }}>
                                                                {(() => {
                                                                    return (
                                                                        <div style={{
                                                                            position: 'relative',
                                                                            zIndex: 3,
                                                                            fontSize: '0.65rem',
                                                                            backgroundColor: getNameBubbleColor(isMe ? (username || 'You') : (messageContent.author || 'User')),
                                                                            color: '#FFFFFF',
                                                                            padding: '2px 8px',
                                                                            borderRadius: '10px',
                                                                            fontWeight: '600',
                                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                                            whiteSpace: 'nowrap'
                                                                        }}>
                                                                            {senderName}
                                                                        </div>
                                                                    );
                                                                })()}
                                                                {(() => {
                                                                    if (!currentChat?.isGroup) return null;
                                                                    const creatorId = currentChat?.createdBy;
                                                                    if (!creatorId) return null;
                                                                    const isCreatorSender = (messageContent.authorId && String(messageContent.authorId) === String(creatorId))
                                                                        || ((currentChat.members || []).find(m => String(m.id) === String(creatorId))?.username === messageContent.author);
                                                                    if (!isCreatorSender) return null;
                                                                    return (
                                                                        <span style={{
                                                                            position: 'relative',
                                                                            zIndex: 3,
                                                                            fontSize: '0.6rem',
                                                                            fontWeight: 700,
                                                                            padding: '2px 8px',
                                                                            borderRadius: '999px',
                                                                            background: 'var(--accent-primary)',
                                                                            color: '#ffffff',
                                                                            letterSpacing: 0.2,
                                                                            boxShadow: '0 0 8px rgba(255,255,255,0.25)'
                                                                        }}>Creator</span>
                                                                    );
                                                                })()}
                                                                {(() => {
                                                                    if (!senderRoleName) return null;
                                                                    if (currentChat?.isGroup) {
                                                                        const creatorId = currentChat?.createdBy;
                                                                        if (creatorId) {
                                                                            const creatorMember = (currentChat.members || []).find(m => String(m.id) === String(creatorId));
                                                                            const isCreatorSender = (messageContent.authorId && String(messageContent.authorId) === String(creatorId))
                                                                                || (creatorMember && creatorMember.username === messageContent.author);
                                                                            if (isCreatorSender) return null; // hide role chip for creator
                                                                        }
                                                                    }
                                                                    return (
                                                                        <div style={{
                                                                            position: 'relative',
                                                                            zIndex: 3,
                                                                            fontSize: '0.6rem',
                                                                            fontWeight: 500,
                                                                            padding: '2px 8px',
                                                                            borderRadius: '999px',
                                                                            backgroundColor: senderRoleColor || 'rgba(255,229,143,0.9)',
                                                                            color: '#000',
                                                                            whiteSpace: 'nowrap',
                                                                            maxWidth: 80,
                                                                            overflow: 'hidden',
                                                                            textOverflow: 'ellipsis'
                                                                        }}>
                                                                            {senderRoleName}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>

                                                            {delOverlay.show && delOverlay.prev && (
                                                                <div
                                                                    className="typing-delete"
                                                                    style={{
                                                                        position: 'absolute',
                                                                        top: 0,
                                                                        left: 0,
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        pointerEvents: 'none',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        padding: '12px 16px',
                                                                        fontSize: '0.95rem',
                                                                        fontFamily: "system-ui, -apple-system, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI', Roboto, sans-serif",
                                                                        whiteSpace: 'pre',
                                                                        overflow: 'hidden',
                                                                        color: theme === 'dark' ? 'white' : 'var(--text-primary)',
                                                                        zIndex: 2
                                                                    }}
                                                                >
                                                                    {splitGraphemes(delOverlay.prev).map((char, index) => {
                                                                        const isDeleted = index >= (delOverlay.nextLen || 0);
                                                                        return (
                                                                            <span
                                                                                key={`del-${index}-${char}`}
                                                                                style={isDeleted ? {
                                                                                    display: 'inline-block',
                                                                                    animation: 'charPopOut 320ms cubic-bezier(0.22, 1, 0.36, 1) forwards'
                                                                                } : { visibility: 'hidden' }}
                                                                            >
                                                                                {char === ' ' ? '\u00A0' : char}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}



                                                            <div className={`message-bubble ${messageContent.justSent ? 'animate-delivered' : ''} ${messageContent.file?.type?.startsWith('image') ? 'image-message' : ''} ${extractLinks(messageContent.message || '').length > 0 ? 'link-message' : ''}`} style={{
                                                                position: 'relative',
                                                                overflow: 'visible',
                                                                group: 'message-actions',
                                                                marginTop: '0',
                                                                zIndex: 4,
                                                                outline: highlightedMsgId === messageContent.id ? '2px solid var(--accent-primary)' : 'none',
                                                                boxShadow: highlightedMsgId === messageContent.id ? '0 0 0 3px rgba(91,150,247,0.35)' : undefined,
                                                                background: (
                                                                    messageContent.file?.type?.startsWith('image') || messageContent.poll
                                                                        ? 'transparent'
                                                                        : (
                                                                            isMe
                                                                                ? (theme === 'light' ? '#eceff3' : '#383838ff')
                                                                                : 'var(--accent-primary)'
                                                                        )
                                                                ),
                                                                color: (
                                                                    (isMe && !(messageContent.file?.type?.startsWith('image') || messageContent.poll))
                                                                        ? '#ffffff'
                                                                        : (
                                                                            (extractLinks(messageContent.message || '').length > 0 && !isMe)
                                                                                ? (theme === 'light' ? 'var(--text-primary)' : '#ffffff')
                                                                                : (!isMe ? '#ffffff' : undefined)
                                                                        )
                                                                ),
                                                                transition: 'background-color 300ms ease',
                                                                padding: (messageContent.file?.type?.startsWith('image') || messageContent.poll) ? '0' : undefined,
                                                                boxShadow: (messageContent.file?.type?.startsWith('image') || messageContent.poll)
                                                                    ? 'none'
                                                                    : (theme === 'dark' ? '0 4px 12px rgba(0,0,0,0.35)' : '0 4px 12px rgba(0,0,0,0.06)')
                                                            }}>
                                                                {/* Avatar - Absolute Positioned */}
                                                                {(!currentChat?.isAnnouncementGroup) && (
                                                                    <Avatar
                                                                        src={(() => {
                                                                            if (isMe) return user?.avatar || `https://i.pravatar.cc/150?u=user_${user?.id || user?.username || 'me'}`;

                                                                            // 1. If message has specific avatar (e.g., server provided admin avatar on the post), use it
                                                                            if (messageContent.avatar) return messageContent.avatar;

                                                                            // 2. Group member avatar
                                                                            if (currentChat?.isGroup) {
                                                                                const mem = currentChat.members.find(m => m.username === messageContent.author);
                                                                                return (mem?.avatar) || `https://i.pravatar.cc/150?u=member_${mem?.id || mem?.username || messageContent.author || 'member'}`;
                                                                            }

                                                                            // 3. Channel post: prefer admin (creator) profile avatar over channel avatar
                                                                            let adminAv = '';
                                                                            try { if (currentChat?.createdBy) adminAv = localStorage.getItem('user_avatar_' + String(currentChat.createdBy)) || ''; } catch (_) { adminAv = ''; }
                                                                            if (adminAv) return adminAv;

                                                                            // 4. Channel fallback (cached/channel photo)
                                                                            let cached = '';
                                                                            try { cached = currentChat?.id ? (localStorage.getItem('channel_photo_' + currentChat.id) || '') : ''; } catch (_) { cached = ''; }
                                                                            return channelPhotoUrl || currentChat?.photo || cached || currentChat?.avatar || `https://i.pravatar.cc/150?u=channel_${currentChat?.id || currentChat?.name || 'channel'}`;
                                                                        })()}
                                                                        alt="avatar"
                                                                        onError={(e) => {
                                                                            // For video, we might need a different approach, but for now reset to img if video fails? 
                                                                            // Actually, if video fails, it might be an image URL that ends in mp4? Unlikely.
                                                                            // If it's a video element, e.currentTarget is the video.
                                                                            // We can try to replace src with fallback.
                                                                            // But if it's a video tag, setting src to an image won't work well if we don't swap the tag.
                                                                            // However, our Avatar component decides based on src extension.
                                                                            // If we change src to a non-video URL, it won't re-render as img unless we force update.
                                                                            // For simplicity, let's just try to set the src to fallback.
                                                                            // If it was a video and fails, we might be stuck. 
                                                                            // But let's assume valid extensions mean valid types.
                                                                            // Fallback logic:
                                                                            const fallback = currentChat?.isGroup
                                                                                ? `https://i.pravatar.cc/150?u=member_${messageContent.author || 'member'}`
                                                                                : `https://i.pravatar.cc/150?u=channel_${currentChat?.id || currentChat?.name || 'channel'}`;
                                                                            if (e.currentTarget.src !== fallback) {
                                                                                e.currentTarget.src = fallback;
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '50%',
                                                                            transform: 'translateY(-50%)',
                                                                            left: isMe ? 'auto' : '-84px',
                                                                            right: isMe ? '-84px' : 'auto',
                                                                            width: '45px',
                                                                            height: '45px',
                                                                            borderRadius: '50%',
                                                                            border: '2px solid var(--border-color)',
                                                                            objectFit: 'cover',
                                                                            boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
                                                                        }}
                                                                        zIndex={0}
                                                                    />
                                                                )}
                                                                {messageContent.file && (
                                                                    <div className="message-attachment" style={{ marginBottom: messageContent.file.type.startsWith('image') ? '0' : '8px' }}>
                                                                        {messageContent.file.type.startsWith('image') ? (
                                                                            <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }} onClick={() => openImageAt(messageContent.file.url)}>
                                                                                <img src={messageContent.file.url} alt="attachment" style={{ maxWidth: currentChat?.isAnnouncementGroup ? '450px' : '250px', maxHeight: currentChat?.isAnnouncementGroup ? '450px' : '250px', borderRadius: '12px', display: 'block', objectFit: 'cover' }} />
                                                                                {!(messageContent.message && messageContent.message.trim()) && (
                                                                                    <div style={{
                                                                                        position: 'absolute', bottom: '6px', right: '6px',
                                                                                        background: 'rgba(0,0,0,0.6)', color: '#fff',
                                                                                        padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem',
                                                                                        display: 'flex', alignItems: 'center', gap: '4px'
                                                                                    }}>
                                                                                        {messageContent.time}
                                                                                        {isMe && (
                                                                                            <span style={{ display: 'inline-flex', alignItems: 'center', color: (messageContent.status === 'seen' ? '#25D366' : '#fff') }}>
                                                                                                {messageContent.status === 'sent' ? (
                                                                                                    <FiCheck size={14} />
                                                                                                ) : (
                                                                                                    <>
                                                                                                        <FiCheck size={14} strokeWidth={3} style={{ marginRight: '-6px' }} />
                                                                                                        <FiCheck size={14} strokeWidth={3} />
                                                                                                    </>
                                                                                                )}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ) : messageContent.file.type.startsWith('video') ? (
                                                                            <video src={messageContent.file.url} controls style={{ maxWidth: '100%', borderRadius: '12px' }} />
                                                                        ) : messageContent.file.type.startsWith('audio') ? (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '260px' }}>
                                                                                <AudioPlayer src={messageContent.file.url} theme={theme} />
                                                                                <a href={messageContent.file.url} download target="_blank" rel="noopener noreferrer" style={{
                                                                                    background: theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.08)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit', transition: 'background 0.2s'
                                                                                }}
                                                                                    onMouseEnter={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.15)'}
                                                                                    onMouseLeave={(e) => e.currentTarget.style.background = theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.08)'}
                                                                                >
                                                                                    <FiDownload size={18} />
                                                                                </a>
                                                                            </div>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: '200px' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}>
                                                                                    <span style={{ background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiFile size={20} /></span>
                                                                                    <span style={{ textDecoration: 'underline', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }} onClick={() => window.open(messageContent.file.url, '_blank')}>
                                                                                        {messageContent.file.name}
                                                                                    </span>
                                                                                </div>
                                                                                <a href={messageContent.file.url} download target="_blank" rel="noopener noreferrer" style={{
                                                                                    background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit', transition: 'background 0.2s'
                                                                                }}
                                                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.2)'}
                                                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
                                                                                >
                                                                                    <FiDownload size={18} />
                                                                                </a>
                                                                            </div>
                                                                        )
                                                                        }
                                                                    </div>
                                                                )}

                                                                {/* Caption/Text below media: if image/gif and message text present */}
                                                                {messageContent.file && (messageContent.file.type.startsWith('image') || messageContent.file.type.includes('gif')) && (messageContent.message && messageContent.message.trim()) && (
                                                                    <div className="caption-bubble" style={{
                                                                        marginTop: '8px',
                                                                        borderRadius: '12px',
                                                                        padding: '10px 12px',
                                                                        background: (!isMe) ? '#4949eeff' : '#383838ff',
                                                                        color: '#FFFFFF'
                                                                    }}>
                                                                        <div>
                                                                            {searchQuery ? (
                                                                                <span dangerouslySetInnerHTML={{ __html: highlightText(messageContent.message, searchQuery) }} />
                                                                            ) : (
                                                                                formatMessage(messageContent.message, isMe ? '#001a4d' : undefined)
                                                                            )}
                                                                        </div>
                                                                        {/* Footer: time/read/star inside caption bubble */}
                                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '6px', gap: '4px' }}>
                                                                            {messageContent.starredBy && messageContent.starredBy.includes(user?.id) && (
                                                                                <FiStar size={10} fill="currentColor" style={{ color: 'var(--accent-primary)', marginRight: '2px' }} />
                                                                            )}
                                                                            <div style={{ fontSize: '0.7rem', opacity: 0.7, textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                {messageContent.isEdited && <span style={{ fontStyle: 'italic', marginRight: '4px' }}>(edited)</span>}
                                                                                {messageContent.time}
                                                                                {isMe && (
                                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', color: (messageContent.status === 'seen' ? '#25D366' : '#fff') }}>
                                                                                        {messageContent.status === 'sent' ? (
                                                                                            <FiCheck size={14} />
                                                                                        ) : (
                                                                                            <>
                                                                                                <FiCheck size={14} strokeWidth={3} style={{ marginRight: '-6px' }} />
                                                                                                <FiCheck size={14} strokeWidth={3} />
                                                                                            </>
                                                                                        )}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {messageContent.poll ? (
                                                                    (() => {
                                                                        const opts = messageContent.poll.options || [];
                                                                        const counts = opts.map(o => (Array.isArray(o.votes) ? o.votes.length : 0));
                                                                        const total = counts.reduce((a, b) => a + b, 0);
                                                                        const userVotedIdx = opts.findIndex(o => Array.isArray(o.votes) && o.votes.includes(username));
                                                                        return (
                                                                            <div style={{ border: 'none', borderRadius: '18px', padding: '12px', background: theme === 'dark' ? 'var(--bg-panel)' : '#dededeff', minWidth: '240px' }}>
                                                                                <div style={{ fontWeight: 700, marginBottom: '10px' }}>{messageContent.poll.question}</div>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                                    {opts.map((opt, idx) => {
                                                                                        const c = counts[idx];
                                                                                        const pctNum = total > 0 ? (c / total) * 100 : 0;
                                                                                        const pct = Math.round(pctNum);
                                                                                        const isSelected = userVotedIdx === idx;
                                                                                        return (
                                                                                            <div key={idx} onClick={() => handlePollVote(messageContent.id, idx)}
                                                                                                style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', whiteSpace: 'nowrap', border: `1px solid ${color}`, boxShadow: '0 2px 5px rgba(0,0,0,0.1)', borderRadius: '999px', padding: '6px 10px', backgroundClip: 'padding-box', isolation: 'isolate' }}>
                                                                                                <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '999px', background: (theme === 'dark') ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', pointerEvents: 'none', willChange: 'backdrop-filter, -webkit-backdrop-filter, opacity', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }} />
                                                                                                <div style={{ position: 'relative', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)' }}>
                                                                                                    <span style={{ fontWeight: isSelected ? 700 : 500 }}>{typeof opt === 'string' ? opt : opt.text}</span>
                                                                                                    <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{pct}%</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                                <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                                                    {total} vote{total === 1 ? '' : 's'} · Tap an option to vote
                                                                                </div>
                                                                                {/* Time & Read Receipt & Star */}
                                                                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '4px', gap: '4px' }}>
                                                                                    {messageContent.starredBy && messageContent.starredBy.includes(user?.id) && (
                                                                                        <FiStar size={10} fill="currentColor" style={{ color: 'var(--accent-primary)', marginRight: '2px' }} />
                                                                                    )}
                                                                                    <div style={{ fontSize: '0.7rem', opacity: 0.7, textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                        {messageContent.isEdited && <span style={{ fontStyle: 'italic', marginRight: '4px' }}>(edited)</span>}
                                                                                        {messageContent.time}
                                                                                        {isMe && (
                                                                                            <span style={{ display: 'inline-flex', alignItems: 'center', color: (messageContent.status === 'seen' ? '#25D366' : '#ccc') }}>
                                                                                                {messageContent.status === 'sent' ? (
                                                                                                    <FiCheck size={14} style={{ color: '#ccc' }} />
                                                                                                ) : (
                                                                                                    <>
                                                                                                        <FiCheck size={14} strokeWidth={3} style={{ marginRight: '-6px', color: '#25D366' }} />
                                                                                                        <FiCheck size={14} strokeWidth={3} style={{ color: '#25D366' }} />
                                                                                                    </>
                                                                                                )}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()
                                                                ) : (
                                                                    // If this is an image/gif with caption, we already rendered the text bubble above
                                                                    !(
                                                                        messageContent.file &&
                                                                        (messageContent.file.type.startsWith('image') || messageContent.file.type.includes('gif')) &&
                                                                        (messageContent.message && messageContent.message.trim())
                                                                    ) && (
                                                                        searchQuery ? (
                                                                            <span dangerouslySetInnerHTML={{ __html: highlightText(messageContent.message, searchQuery) }} />
                                                                        ) : (
                                                                            formatMessage(messageContent.message, isMe ? '#001a4d' : undefined)
                                                                        )
                                                                    )
                                                                )}
                                                                {(() => {
                                                                    const urls = extractLinks(messageContent.message || '');
                                                                    if (urls.length === 0) return null;
                                                                    const url = urls[0];
                                                                    const pv = linkPreviews[url] || getCachedPreview(url);
                                                                    if (!pv || (!pv.title && !pv.description && !pv.image)) return null;
                                                                    return (
                                                                        <a href={pv.url || url} target="_blank" rel="noopener noreferrer" style={{
                                                                            display: 'flex', gap: '10px', alignItems: 'stretch', textDecoration: 'none', color: 'inherit',
                                                                            marginTop: '8px',
                                                                            border: 'none', outline: 'none',
                                                                            borderRadius: '12px', overflow: 'hidden',
                                                                            background: 'transparent',
                                                                            maxWidth: '420px',
                                                                            maxHeight: '140px'
                                                                        }}>
                                                                            {pv.image && (
                                                                                <div style={{ width: '84px', minWidth: '84px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                    <img src={pv.image} alt={pv.title || 'preview'} style={{ width: '84px', height: '84px', objectFit: 'cover' }} />
                                                                                </div>
                                                                            )}
                                                                            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                                                {pv.siteName && <div style={{ fontSize: '0.7rem', color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : '#666', marginBottom: '2px' }}>{pv.siteName}</div>}
                                                                                {pv.title && <div style={{ fontWeight: 700, fontSize: '0.9rem', color: theme === 'dark' ? '#ffffff' : '#000000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pv.title}</div>}
                                                                                {pv.description && <div style={{ fontSize: '0.8rem', color: theme === 'dark' ? 'rgba(255,255,255,0.75)' : '#333333', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{pv.description}</div>}
                                                                                {!pv.title && !pv.description && <div style={{ fontSize: '0.8rem', color: theme === 'dark' ? 'rgba(255,255,255,0.75)' : '#000000' }}>{url}</div>}
                                                                            </div>
                                                                        </a>
                                                                    );
                                                                })()}
                                                                {messageContent.isEdited && <span style={{ fontSize: '0.6rem', opacity: 0.6, marginLeft: '4px' }}>(edited)</span>}

                                                                {!messageContent.file?.type?.startsWith('image') && !messageContent.poll && (
                                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '4px', gap: '4px' }}>
                                                                        <div style={{ fontSize: '0.7rem', opacity: 0.7, textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            {messageContent.time}
                                                                            {isMe && (
                                                                                <span style={{ display: 'inline-flex', alignItems: 'center', color: (messageContent.status === 'seen' ? '#25D366' : 'inherit') }}>
                                                                                    {messageContent.status === 'sent' ? (
                                                                                        <FiCheck size={14} />
                                                                                    ) : (
                                                                                        <>
                                                                                            <FiCheck size={14} strokeWidth={3} style={{ marginRight: '-6px' }} />
                                                                                            <FiCheck size={14} strokeWidth={3} />
                                                                                        </>
                                                                                    )}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* 3-Dots Menu Button - Between avatar and bubble */}
                                                                <div className={`message-menu-btn filter-btn ${activeMenuMessageId === messageContent.id ? 'active' : ''}`} onClick={(e) => toggleMessageMenu(e, messageContent.id)} style={{
                                                                    position: 'absolute',
                                                                    top: 'calc(50% + 1px)',
                                                                    transform: 'translateY(-50%)',
                                                                    // Place on avatar side, halfway between avatar and bubble edge
                                                                    left: isMe ? 'auto' : '-36px',
                                                                    right: isMe ? '-36px' : 'auto',
                                                                    cursor: 'pointer',
                                                                    padding: '4px',
                                                                    borderRadius: '50%',
                                                                    color: !isMe && theme === 'light' ? '#000000' : 'var(--text-primary)',
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    zIndex: (activeMenuMessageId === messageContent.id ? 200000 : 199000),
                                                                    opacity: 0.8,
                                                                    transition: 'opacity 0.2s'
                                                                }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                                                >
                                                                    <FiMoreVertical size={18} strokeWidth={2.5} />
                                                                </div>

                                                                {/* Forward Arrow Button */}
                                                                {(() => {
                                                                    const isOwner = String(currentChat?.createdBy) === String(user?.id);
                                                                    const isAdmin = (currentChat?.admins || []).some(a => String(a) === String(user?.id));
                                                                    const canForward = (!currentChat?.isChannel) || (currentChat?.settings?.forwarding !== false) || isOwner || isAdmin;
                                                                    return canForward;
                                                                })() && (
                                                                        <div className="forward-btn" onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const isOwner = String(currentChat?.createdBy) === String(user?.id);
                                                                            const isAdmin = (currentChat?.admins || []).some(a => String(a) === String(user?.id));
                                                                            const canForward = (!currentChat?.isChannel) || (currentChat?.settings?.forwarding !== false) || isOwner || isAdmin;
                                                                            if (!canForward) return;
                                                                            setForwardingMessage(messageContent);
                                                                        }} style={{
                                                                            position: 'absolute',
                                                                            top: '50%',
                                                                            transform: 'translateY(-50%)',
                                                                            right: isMe ? 'auto' : '-35px',
                                                                            left: isMe ? '-35px' : 'auto',
                                                                            cursor: 'pointer',
                                                                            padding: '4px',
                                                                            opacity: 0.6,
                                                                            transition: 'opacity 0.2s'
                                                                        }}
                                                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                                                        >
                                                                            <FiShare2 size={16} />
                                                                        </div>
                                                                    )}

                                                                {/* Dropdown Menu */}
                                                                {activeMenuMessageId === messageContent.id && (
                                                                    <>
                                                                        <style>{`
                                                                    .msg-menu-anim { 
                                                                        transform-origin: ${isMe ? 'top right' : 'top left'}; 
                                                                        animation: menuReveal 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards; 
                                                                        will-change: transform, opacity, filter; 
                                                                    }
                                                                    @keyframes menuReveal { 
                                                                        0% { 
                                                                            opacity: 0; 
                                                                            transform: scale(0.92) translateY(-4px); 
                                                                            filter: blur(4px);
                                                                        } 
                                                                        100% { 
                                                                            opacity: 1; 
                                                                            transform: scale(1) translateY(0); 
                                                                            filter: blur(0px);
                                                                        } 
                                                                    }
                                                                    
                                                                    /* Smooth fade-out on close */
                                                                    .msg-menu-close { 
                                                                        animation: menuClose 150ms cubic-bezier(0.4, 0, 1, 1) forwards; 
                                                                    }
                                                                    @keyframes menuClose { 
                                                                        0% { 
                                                                            opacity: 1; 
                                                                            transform: scale(1) translateY(0); 
                                                                            filter: blur(0px);
                                                                        } 
                                                                        100% { 
                                                                            opacity: 0; 
                                                                            transform: scale(0.95) translateY(-2px); 
                                                                            filter: blur(2px);
                                                                        } 
                                                                    }
                                                                    
                                                                    /* Standard simple menu animation */
                                                                    
                                                                    /* Reaction emoji hover states */
                                                                    .reaction-emoji {
                                                                        cursor: pointer;
                                                                        font-size: 1.2rem;
                                                                        padding: 6px 8px;
                                                                        borderRadius: 8px;
                                                                        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                                                                        display: inline-flex;
                                                                        align-items: center;
                                                                        justify-content: center;
                                                                    }
                                                                    .reaction-emoji:hover {
                                                                        background: rgba(128, 128, 128, 0.15);
                                                                        transform: scale(1.1);
                                                                    }
                                                                    .reaction-emoji:active {
                                                                        transform: scale(0.95);
                                                                    }
                                                                    
                                                                    /* button fill overlay for filter-btn used above */
                                                                    .filter-btn{ position: relative; overflow: hidden; }
                                                                    .filter-btn::after{ content:''; position:absolute; left:0; right:0; top:0; height:0%; background: currentColor; opacity:0.18; border-radius: 999px; pointerEvents:none; }
                                                                    .filter-btn.active::after{ animation: filterFillDown 260ms ease-out forwards; }
                                                                    @keyframes filterFillDown { from{height:0%} to{height:100%} }
                                                                    /* Hide scrollbar for message dropdown */
                                                                    .message-dropdown::-webkit-scrollbar { display: none; }
                                                                    .message-dropdown { -ms-overflow-style: none; scrollbar-width: none; }
                                                                `}</style>
                                                                        <div className="message-dropdown menu-animate" style={{
                                                                            position: 'absolute',
                                                                            top: menuVerticalPos === 'bottom' ? '35px' : 'auto',
                                                                            bottom: menuVerticalPos === 'top' ? '10px' : 'auto',
                                                                            right: isMe ? '0' : 'auto',
                                                                            left: isMe ? 'auto' : '0',
                                                                            background: 'var(--bg-panel)',
                                                                            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                                                                            zIndex: 200100,
                                                                            borderRadius: '12px',
                                                                            overflow: 'visible',
                                                                            overflowY: 'auto',
                                                                            minWidth: '140px',
                                                                            maxWidth: '220px',
                                                                            maxHeight: '260px',
                                                                            border: '1px solid var(--border-color)'
                                                                        }}>
                                                                            {/* Comment (all chats) */}
                                                                            {!isBlocked && (() => {
                                                                                const mine = (commentsByMsg[messageContent.id] || []).find(c => String(c.userId) === String(user?.id));
                                                                                const hasMine = !!mine;
                                                                                return (
                                                                                    <div
                                                                                        style={{ padding: '8px 12px', fontSize: '0.9rem', cursor: hasMine ? 'pointer' : (canCommentOnMessage(messageContent) ? 'pointer' : 'not-allowed'), display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', transition: 'background 0.2s', opacity: hasMine ? 1 : (canCommentOnMessage(messageContent) ? 1 : 0.5) }}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            if (hasMine) {
                                                                                                setExpandedComment({ msgId: messageContent.id, commentId: mine.id });
                                                                                                setActiveMenuMessageId(null);
                                                                                                requestAnimationFrame(() => setExpandedAnim(true));
                                                                                                return;
                                                                                            }
                                                                                            if (!canCommentOnMessage(messageContent)) return;
                                                                                            setShowCommentForMsgId(messageContent.id);
                                                                                            setActiveMenuMessageId(null);
                                                                                            setTimeout(() => {
                                                                                                try { const el = document.getElementById(`comment_input_${messageContent.id}`); el && el.focus(); } catch (_) { }
                                                                                            }, 50);
                                                                                        }}
                                                                                    >
                                                                                        {hasMine ? 'View my comment' : 'Comment'}
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                            {(!(currentChat?.isChannel) || isUserAdmin(messageContent)) && (
                                                                                <div style={{ padding: '8px 12px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', transition: 'background 0.2s' }} onClick={() => { if (!replyTo) setReplyOverlayVisible(false); setReplyTo(messageContent); setActiveMenuMessageId(null); }}>
                                                                                    <FiCornerUpLeft size={14} /> Reply
                                                                                </div>
                                                                            )}
                                                                            {/* Pin visible if: owner OR (has role and canPin) OR (admin with no role). In DMs: always true */}
                                                                            {(() => {
                                                                                // In channels: only admins/owner can see Pin
                                                                                if (currentChat?.isChannel) {
                                                                                    return isUserAdmin(messageContent);
                                                                                }
                                                                                const isGroup = !!(currentChat?.isGroup || currentChat?.isAnnouncementGroup);
                                                                                if (!isGroup) return true;
                                                                                const isOwnerMe = String(user?.id) === String(currentChat?.createdBy);
                                                                                const myRoleId = (currentChat?.memberRoles || {})[user?.id];
                                                                                const myPerms = (currentChat?.rolePermissions || {})[myRoleId] || {};
                                                                                const isAdminMe = Array.isArray(currentChat?.admins) && currentChat.admins.some(a => String(a) === String(user?.id));
                                                                                return isOwnerMe || (myRoleId ? !!myPerms.canPin : isAdminMe);
                                                                            })() && (
                                                                                    <div style={{ padding: '8px 12px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', transition: 'background 0.2s' }} onClick={(e) => { e.stopPropagation(); togglePin(messageContent.id); setActiveMenuMessageId(null); }}>
                                                                                        <FiBookmark size={14} /> {pinnedIds.map(String).includes(String(messageContent.id)) ? 'Unpin' : 'Pin'}
                                                                                    </div>
                                                                                )}
                                                                            <div style={{ padding: '8px 12px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', transition: 'background 0.2s' }} onClick={() => {
                                                                                const isStarred = messageContent.starredBy && messageContent.starredBy.includes(user?.id);
                                                                                socket.emit('star_message', { room, msgId: messageContent.id, action: isStarred ? 'unstar' : 'star', userId: user?.id });
                                                                                setActiveMenuMessageId(null);
                                                                            }}>
                                                                                <FiStar size={14} fill={messageContent.starredBy && messageContent.starredBy.includes(user?.id) ? "currentColor" : "none"} />
                                                                                {messageContent.starredBy && messageContent.starredBy.includes(user?.id) ? 'Unstar' : 'Star'}
                                                                            </div>

                                                                            {/* Info (delivery/read receipts) – only for my own messages */}
                                                                            {isMe && (
                                                                                <div
                                                                                    style={{ padding: '8px 12px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', transition: 'background 0.2s' }}
                                                                                    onClick={() => {

                                                                                        const latest = (messageList || []).find(m => String(m.id) === String(messageContent.id)) || messageContent;
                                                                                        setInfoForMsg(latest);
                                                                                        setActiveMenuMessageId(null);
                                                                                    }}
                                                                                >
                                                                                    <FiBarChart2 size={14} /> Info
                                                                                </div>
                                                                            )}
                                                                            <div style={{ borderTop: '1px solid var(--border-color)', margin: '6px 0' }}></div>
                                                                            <div style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Remind me:</div>
                                                                            <div style={{ padding: '6px 12px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', transition: 'background 0.2s' }} onClick={() => { scheduleReminder(messageContent, 10 * 60 * 1000); setActiveMenuMessageId(null); }}>
                                                                                in 10 minutes
                                                                            </div>
                                                                            <div style={{ padding: '6px 12px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', transition: 'background 0.2s' }} onClick={() => { scheduleReminder(messageContent, 60 * 60 * 1000); setActiveMenuMessageId(null); }}>
                                                                                in 1 hour
                                                                            </div>
                                                                            <div style={{ padding: '6px 12px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', transition: 'background 0.2s' }} onClick={() => { scheduleReminder(messageContent, 24 * 60 * 60 * 1000); setActiveMenuMessageId(null); }}>
                                                                                tomorrow
                                                                            </div>
                                                                            {isMe && (
                                                                                <>
                                                                                    <div style={{ padding: '8px 12px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', transition: 'background 0.2s' }} onClick={() => { startEdit(messageContent); setActiveMenuMessageId(null); }}>
                                                                                        <FiEdit2 size={14} /> Edit
                                                                                    </div>
                                                                                    {(() => {
                                                                                        // Show Delete if: author OR DM OR owner OR role canDeleteMessages OR admin (admins always allowed to delete in groups)
                                                                                        const isGroup = !!(currentChat?.isGroup || currentChat?.isAnnouncementGroup);
                                                                                        const isOwnerMe = isGroup && String(user?.id) === String(currentChat?.createdBy);
                                                                                        const myRoleId = (currentChat?.memberRoles || {})[user?.id];
                                                                                        const myPerms = (currentChat?.rolePermissions || {})[myRoleId] || {};
                                                                                        const isAdminMe = isGroup && Array.isArray(currentChat?.admins) && currentChat.admins.some(a => String(a) === String(user?.id));
                                                                                        const allow = isMe || (!isGroup) || isOwnerMe || (!!isGroup && (!!myPerms.canDeleteMessages || isAdminMe));
                                                                                        return allow ? (
                                                                                            <div style={{ padding: '8px 12px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff6b6b', borderRadius: '8px', transition: 'background 0.2s' }} onClick={() => { handleDelete(messageContent.id, user?.id); setActiveMenuMessageId(null); }}>
                                                                                                <FiTrash2 size={14} /> Delete
                                                                                            </div>
                                                                                        ) : null;
                                                                                    })()}
                                                                                </>
                                                                            )}
                                                                            {(() => {
                                                                                const isOwner = String(currentChat?.createdBy) === String(user?.id);
                                                                                const isAdmin = (currentChat?.admins || []).some(a => String(a) === String(user?.id));
                                                                                return ((!currentChat?.isChannel) || (currentChat?.settings?.reactions !== false) || isOwner || isAdmin) && !isBlocked;
                                                                            })() && (
                                                                                    <>
                                                                                        <div style={{ borderTop: '1px solid var(--border-color)', margin: '6px 0' }}></div>
                                                                                        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                                                                            <span className="reaction-emoji" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleReaction(messageContent.id, '👍'); setActiveMenuMessageId(null); }}>👍</span>
                                                                                            <span className="reaction-emoji" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleReaction(messageContent.id, '❤️'); setActiveMenuMessageId(null); }}>❤️</span>
                                                                                            <span className="reaction-emoji" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleReaction(messageContent.id, '😂'); setActiveMenuMessageId(null); }}>😂</span>
                                                                                            <span className="reaction-emoji" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleReaction(messageContent.id, '😮'); setActiveMenuMessageId(null); }}>😮</span>
                                                                                            <span className="reaction-emoji" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleReaction(messageContent.id, '😢'); setActiveMenuMessageId(null); }}>😢</span>
                                                                                            <span className="reaction-emoji" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleReaction(messageContent.id, '🔥'); setActiveMenuMessageId(null); }}>🔥</span>
                                                                                            <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); try { const r = e.currentTarget.getBoundingClientRect(); const left = Math.max(8, Math.min(window.innerWidth - 320, r.left)); const top = Math.max(8, Math.min(window.innerHeight - 360, r.bottom + 6)); setReactionsPickerPos({ left, top }); } catch (_) { } setReactionsPickerFor(messageContent.id); }} title="More reactions" style={{ border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '8px', padding: '6px 10px', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s ease', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(128, 128, 128, 0.12)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>+ More</button>
                                                                                        </div>
                                                                                    </>
                                                                                )}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {/* Comments: Input bubble (enabled for channel, group, and DM) */}
                                                            {showCommentForMsgId === messageContent.id && (
                                                                <div style={{ position: 'absolute', top: '-70px', left: isMe ? 'auto' : '60px', right: isMe ? '60px' : 'auto', pointerEvents: 'auto', zIndex: 200500 }}>
                                                                    <div className="liquid-glass" style={{ position: 'relative', width: '280px', borderRadius: '999px', padding: '10px 12px', color: 'var(--text-primary)' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', borderRadius: 999, padding: '6px 10px' }}>
                                                                                <input id={`comment_input_${messageContent.id}`} value={commentInputByMsg[messageContent.id] || ''} onChange={(e) => setCommentInputByMsg(p => ({ ...p, [messageContent.id]: e.target.value.slice(0, 40) }))} placeholder="Write a comment (max 40)" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)' }} />
                                                                            </div>
                                                                            <button onClick={() => submitComment(messageContent.id, isMe)} style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '999px', padding: '8px 12px', cursor: 'pointer', fontWeight: 600 }}>Send</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Comments: Display bubbles (channel/group/DM) */}
                                                            {!viewingImage && activeMenuMessageId !== messageContent.id && (commentsByMsg[messageContent.id]?.length > 0) && (
                                                                <div style={{ position: 'relative', height: 0, zIndex: 6, pointerEvents: activeMenuMessageId ? 'none' : 'auto' }}>
                                                                    {(() => {
                                                                        const all = commentsByMsg[messageContent.id] || [];
                                                                        const amChannel = !!currentChat?.isChannel;
                                                                        // Build rotating sample indices (existing timer updates rotateSampleByMsg)
                                                                        const indices = rotateSampleByMsg[messageContent.id] || [0]; // Only show 1 comment
                                                                        const samples = indices.map(i => all[i]).filter(Boolean);

                                                                        // Show only 1 comment at a time
                                                                        const toRender = samples.slice(0, 1);
                                                                        const slots = slotPositions[messageContent.id] || [];
                                                                        const totalComments = (commentsByMsg[messageContent.id] || []).length;
                                                                        const limit = 1;
                                                                        const shouldAnimate = totalComments > limit;
                                                                        return toRender.map((c, i) => {
                                                                            const slotPos = slots[i] || { top: -60, leftPct: 30 };
                                                                            const pos = clampPos(slotPos, isMe);
                                                                            let userColor = getNameBubbleColor(c.author || c.userId || 'user');
                                                                            // Try to find role color if in a group
                                                                            if ((currentChat?.isGroup || currentChat?.isAnnouncementGroup) && Array.isArray(currentChat?.members)) {
                                                                                const m = currentChat.members.find(mem => mem.username === c.author || String(mem.id) === String(c.userId));
                                                                                if (m) {
                                                                                    const rId = (currentChat.memberRoles || {})[m.id];
                                                                                    const role = (currentChat.roles || []).find(r => r.id === rId);
                                                                                    if (role && role.color) userColor = role.color;
                                                                                }
                                                                            }

                                                                            const short = (c.text || '').length > 10 ? (c.text || '').slice(0, 10) + '…' : (c.text || '');
                                                                            const chars = short.split('');
                                                                            return (
                                                                                <div key={shouldAnimate ? `${c.id}_${rotationVersion}` : c.id}
                                                                                    className="comment-bubble-animate liquid-glass"
                                                                                    style={{
                                                                                        position: 'relative',
                                                                                        marginTop: `${pos.top}px`,
                                                                                        left: `${pos.leftPct}%`,
                                                                                        pointerEvents: 'auto',
                                                                                        whiteSpace: 'nowrap',
                                                                                        transition: 'all 300ms ease',
                                                                                        cursor: 'grab',
                                                                                        borderRadius: '999px',
                                                                                        padding: '6px 10px',
                                                                                        display: 'inline-flex',
                                                                                        alignItems: 'center',
                                                                                        gap: 6,
                                                                                        color: userColor,
                                                                                        background: theme === 'light' ? 'rgba(0,0,0,0.12)' : undefined,
                                                                                        fontWeight: theme === 'light' ? 600 : 400
                                                                                    }}
                                                                                    onMouseDown={(e) => startDragComment(e, messageContent.id, i, isMe, slotPos)}
                                                                                    onClick={() => { if (draggingRef.current.moved) return; setExpandedComment({ msgId: messageContent.id, commentId: c.id }); requestAnimationFrame(() => setExpandedAnim(true)); }}
                                                                                >
                                                                                    {/* Character-by-character animated text with motion blur */}
                                                                                    <span style={{ fontSize: '0.85rem', display: 'inline-flex' }}>
                                                                                        {chars.map((char, charIdx) => (
                                                                                            <span
                                                                                                key={charIdx}
                                                                                                style={{
                                                                                                    display: 'inline-block',
                                                                                                    animation: shouldAnimate ? `charSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${charIdx * 0.03}s both` : 'none'
                                                                                                }}
                                                                                            >
                                                                                                {char}
                                                                                            </span>
                                                                                        ))}
                                                                                    </span>
                                                                                    {/* Delete button */}
                                                                                    <button title="Delete comment" onClick={(e) => { e.stopPropagation(); removeComment(messageContent.id, c.id); }}
                                                                                        style={{ position: 'absolute', top: '-8px', right: '-8px', width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.4)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                                                                                        ×
                                                                                    </button>
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </div>
                                                            )}

                                                            {/* Enlarge comment modal for all chats (non-admin or non-channel) */}
                                                            {expandedComment && expandedComment.msgId === messageContent.id && (!currentChat?.isChannel || !isUserAdmin(messageContent)) && (() => {
                                                                const all = commentsByMsg[messageContent.id] || [];
                                                                const target = all.find(c => String(c.id) === String(expandedComment.commentId));
                                                                if (!target) return null;
                                                                const close = () => { setExpandedAnim(false); setTimeout(() => setExpandedComment(null), 200); };
                                                                const borderColor = getNameBubbleColor(target.author || target.userId || 'user');
                                                                return (
                                                                    <div onClick={close} style={{ position: 'absolute', inset: 0, zIndex: 13000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 'inherit', backdropFilter: expandedAnim ? 'blur(8px)' : 'blur(0px)', WebkitBackdropFilter: expandedAnim ? 'blur(8px)' : 'blur(0px)', background: expandedAnim ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0)', transition: 'backdrop-filter 200ms ease, -webkit-backdrop-filter 200ms ease, background 200ms ease, opacity 200ms ease', opacity: expandedAnim ? 1 : 0.001 }}>
                                                                        <div onClick={(e) => e.stopPropagation()} className="liquid-glass" style={{ maxWidth: '80%', border: `2px solid ${borderColor}`, borderRadius: '16px', padding: '12px 18px', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 8, transform: expandedAnim ? 'scale(1)' : 'scale(0.94)', opacity: expandedAnim ? 1 : 0.001, transition: 'transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 180ms ease' }}>
                                                                            <div style={{ display: 'block', maxWidth: '70vw', lineHeight: 1.35, maxHeight: '40vh', overflowY: 'auto', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                                                                <span style={{ fontSize: '0.95rem' }}>{target.text}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Admin expanded comment modal */}
                                                            {currentChat?.isChannel && !viewingImage && !activeMenuMessageId && isUserAdmin(messageContent) && expandedComment && expandedComment.msgId === messageContent.id && (() => {
                                                                const all = commentsByMsg[messageContent.id] || [];
                                                                const target = all.find(c => String(c.id) === String(expandedComment.commentId));
                                                                if (!target) return null;
                                                                const closeModal = () => { setExpandedAnim(false); setTimeout(() => setExpandedComment(null), 240); };
                                                                return (
                                                                    <div onClick={closeModal} style={{ position: 'absolute', inset: 0, zIndex: 13000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 'inherit', backdropFilter: expandedAnim ? 'blur(8px)' : 'blur(0px)', WebkitBackdropFilter: expandedAnim ? 'blur(8px)' : 'blur(0px)', background: expandedAnim ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0)', transition: 'backdrop-filter 200ms ease, -webkit-backdrop-filter 200ms ease, background 200ms ease, opacity 200ms ease', opacity: expandedAnim ? 1 : 0.001 }}>
                                                                        <div onClick={(e) => e.stopPropagation()} className="liquid-glass" style={{ maxWidth: '80%', borderRadius: '999px', padding: '12px 18px', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 8, transform: expandedAnim ? 'scale(1)' : 'scale(0.88)', opacity: expandedAnim ? 1 : 0.001, transition: 'transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 180ms ease' }}>
                                                                            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{target.author}:</span>
                                                                            <div style={{ display: 'block', maxWidth: '60vw', lineHeight: 1.2, maxHeight: '2.4em', overflowY: 'hidden', overflowX: 'auto', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                                                                <span style={{ fontSize: '0.95rem' }}>{target.text}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Reactions Display */}
                                                            {messageContent.reactions && Object.values(messageContent.reactions).some(u => Array.isArray(u) && u.length > 0) && (
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        marginTop: '-10px',
                                                                        marginLeft: isMe ? '0' : '10px',
                                                                        marginRight: isMe ? '10px' : '0',
                                                                        position: 'relative',
                                                                        zIndex: activeMenuMessageId === messageContent.id ? 0 : 5,
                                                                        visibility: activeMenuMessageId === messageContent.id ? 'hidden' : 'visible',
                                                                        pointerEvents: activeMenuMessageId === messageContent.id ? 'none' : 'auto',

                                                                        // 🔥 fully transparent pill with strong background blur

                                                                        padding: '4px 10px',
                                                                        borderRadius: '999px',
                                                                        color: theme === 'light' ? '#000' : 'var(--text-primary)',
                                                                        background: theme === 'light' ? 'rgba(0,0,0,0.12)' : undefined,
                                                                        fontSize: '0.8rem',
                                                                        fontWeight: theme === 'light' ? 600 : 400,
                                                                        cursor: 'pointer',
                                                                    }}
                                                                    className="liquid-glass"
                                                                >
                                                                    {Object.entries(messageContent.reactions)
                                                                        .filter(([_, users]) => Array.isArray(users) && users.length > 0)
                                                                        .map(([emoji]) => (
                                                                            <span key={emoji}>{emoji}</span>
                                                                        ))}
                                                                    <span
                                                                        style={{
                                                                            fontSize: '0.7rem',
                                                                            color: 'var(--text-secondary)',
                                                                            marginLeft: '2px',
                                                                        }}
                                                                    >
                                                                        {Object.values(messageContent.reactions).reduce(
                                                                            (acc, users) => acc + ((users || []).length || 0),
                                                                            0
                                                                        )}
                                                                    </span>
                                                                </div>

                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                                }
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                                <div ref={scrollRef} style={{ height: replyTo ? '240px' : '100px', flexShrink: 0 }} />
                            </>


                        </div >
                        <div className="blur-fade-bottom" style={{ pointerEvents: 'none' }} />
                        <div className="blur-fade-top" style={{ pointerEvents: 'none', zIndex: 15 }} />
                    </div >

                    {/* Doodle Canvas Overlay - Full Window */}
                    < div ref={canvasWrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: isDoodling ? 'auto' : 'none', zIndex: 9999, touchAction: 'none' }}>
                        <canvas
                            ref={canvasRef}
                            onPointerDown={onCanvasPointerDown}
                            onPointerMove={onCanvasPointerMove}
                            onPointerUp={onCanvasPointerUp}
                            onPointerLeave={onCanvasPointerUp}
                            style={{ width: '100%', height: '100%', cursor: isDoodling ? 'crosshair' : 'default', background: 'transparent', touchAction: 'none' }}
                        />
                    </div >
                    {isDoodling && (
                        <div style={{
                            position: 'absolute',
                            left: currentChat?.showInfo ? 'calc((100% - 350px) / 2)' : '50%',
                            transform: 'translateX(-50%)',
                            bottom: '100px',
                            zIndex: 10000,
                            background: 'rgba(30,30,30,0.9)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            padding: '10px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            transition: 'left 0.3s ease'
                        }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                                Color
                                <input type="color" value={penColor} onChange={(e) => setPenColor(e.target.value)} style={{ width: 28, height: 28, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, background: 'transparent', padding: 0 }} />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                                Size
                                <input type="range" min={1} max={20} value={penWidth} onChange={(e) => setPenWidth(parseInt(e.target.value, 10) || 3)} />
                            </label>
                            <button onClick={() => setPenMode('pen')} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: penMode === 'pen' ? 'var(--accent-primary)' : 'transparent', color: '#fff', cursor: 'pointer' }}>Pen</button>
                            <button onClick={() => setPenMode('erase')} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: penMode === 'erase' ? 'var(--accent-primary)' : 'transparent', color: '#fff', cursor: 'pointer' }}>Eraser</button>
                            <button onClick={handlePlaceDoodle} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer' }}>Place</button>
                            <button onClick={() => { try { const c = canvasRef.current; if (c) { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); } socket.emit('doodle_clear', { room, userId: user?.id }); } catch (_) { } }} style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Clear</button>
                            <button onClick={() => setIsDoodling(false)} style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Close</button>
                        </div>
                    )}

                    {/* Goo-stack wrapper for reply bar + chat input gooey animation */}
                    {(() => {
                        const isAnnouncement = currentChat?.isAnnouncementGroup;
                        const isAdminOnlyGroup = currentChat?.isGroup && currentChat?.adminOnlyChat;
                        const isChannel = currentChat?.isChannel;
                        const isUserAdmin = (currentChat?.admins?.includes(user?.id)) || (String(currentChat?.createdBy) === String(user?.id));
                        const isAdminRestricted = isAnnouncement || isAdminOnlyGroup || isChannel;
                        const canSendMessage = !isAdminRestricted || isUserAdmin;
                        const bans = currentChat?.isGroup ? (currentChat?.bans || {}) : {};
                        const until = bans[user?.id];
                        const banned = (until === -1) || (typeof until === 'number' && until > Date.now());

                        // Hide goo bar if user is banned, blocked, or restricted
                        if (banned) return null;
                        if (isChannel && isBlocked && !isUserAdmin) return null;
                        if (!canSendMessage && ((isChannel || isAdminOnlyGroup) && !isUserAdmin)) return null;

                        return (
                            <div
                                className={`reply-goo-stack active ${uiMode === 'dark' ? 'dark-mode' : ''}`}
                                style={{
                                    position: 'absolute',
                                    left: '10px',
                                    right: currentChat?.showInfo ? '360px' : '10px',
                                    bottom: '24px',
                                    pointerEvents: 'none',
                                    transition: 'right 0.3s ease',
                                    zIndex: 1500,
                                    filter: (replyTo || isReplyAnimating || isReplyExiting) ? `url(#goo-effect${uiMode === 'dark' ? '-dark' : ''})` : 'none',
                                    height: replyTo ? '208px' : '72px' // Accommodate both bars (72+75) + 0px gap + 62px detach
                                }}
                            >
                                {/* Reply Bar - Goo Layer (for gooey effect) */}
                                {(replyTo || isReplyExiting) && (
                                    <div
                                        className={`reply-bar-goo ${isReplyAnimating && !isReplyExiting ? 'anim-enter' : ''} ${isReplyExiting ? 'anim-exit' : ''}`}
                                        style={{
                                            position: 'absolute',
                                            bottom: '25px', // Moved up to 38px (10px above input)
                                            left: '0px',
                                            right: '0px',
                                            height: '52px',
                                            background: 'var(--pinned-bg)',
                                            borderRadius: '10px', // Changed to 15px as requested
                                            border: 'none', // Removed border to fix black line
                                            backdropFilter: 'blur(12px)',
                                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                                            pointerEvents: 'auto',
                                            zIndex: 10,
                                            // Keep visible during both enter and exit animations
                                            opacity: (isReplyAnimating || isReplyExiting) ? 1 : 0,
                                            transform: 'none',
                                            transition: 'opacity 0.1s'
                                        }}
                                        onAnimationStart={() => setReplyOverlayVisible(true)}
                                        onAnimationEnd={() => {
                                            // Only hide overlay if we are truly exiting
                                            if (isReplyExiting) {
                                                setTimeout(() => setReplyOverlayVisible(false), 60);
                                            }
                                        }}
                                    />
                                )}

                                {/* Chat Input - Goo Layer (for gooey effect) */}
                                <div
                                    className={`input-goo ${isReplyAnimating && !isReplyExiting ? 'anim-stretch' : ''} ${isReplyExiting ? 'anim-exit' : ''}`}
                                    style={{
                                        position: 'absolute',
                                        bottom: '18px',
                                        // Match the actual input bar's visual width (footer has 20px padding)
                                        left: (isReplyAnimating || inputMode !== 'shrinking') ? '0px' : '20px',
                                        right: (isReplyAnimating || inputMode !== 'shrinking') ? '0px' : '20px',
                                        height: '52px',
                                        background: 'var(--pinned-bg)',
                                        borderRadius: '15px',
                                        border: 'none',
                                        backdropFilter: 'blur(20px)',
                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                                        pointerEvents: 'auto',
                                        zIndex: 5,
                                        transform: (() => {
                                            if (footerAnimStage === 'bump_down') return 'translateY(-4px) scaleX(1)';
                                            if (footerAnimStage === 'expanding_width') return 'translateY(0) scaleX(1.05)';
                                            if (footerAnimStage === 'fully_expanded') return 'translateY(-10px) scaleX(1.05)';
                                            return 'translateY(0) scaleX(1)';
                                        })(),
                                        willChange: 'transform',
                                        transition: 'left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), right 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.8s cubic-bezier(0.2, 0.9, 0.1, 1)'
                                    }} />
                            </div>
                        );
                    })()}

                    {/* Reply Bar Content Overlay - Above Goo Filter */}
                    {
                        (replyTo && replyOverlayVisible) && (
                            <div style={{
                                position: 'absolute',
                                left: '24px',
                                right: currentChat?.showInfo ? '374px' : '24px',
                                bottom: '100px', // Align with reply bar at 17px + inner padding
                                height: '75px',
                                pointerEvents: 'none',
                                zIndex: 2001,
                                transition: 'right 0.3s ease',
                                filter: 'none !important',
                                willChange: 'transform',
                                opacity: 0 // Start hidden, let animation reveal it
                            }}
                                className={`reply-content ${isReplyAnimating && !isReplyExiting ? 'anim-enter' : ''} ${isReplyExiting ? 'exiting' : ''}`}
                            >
                                <div style={{
                                    padding: '12px 16px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    height: '100%',
                                    pointerEvents: 'auto'
                                }}>
                                    <div style={{ flex: 1, filter: 'none !important' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                                            Replying to {replyTo.author}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                                            {replyTo.message}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setReplyTo(null)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: theme === 'dark' ? '#ffffff' : '#000000',
                                            pointerEvents: 'auto',
                                            filter: 'none !important',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <FiX />
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    {/* Edit Preview */}
                    {
                        editingMessageId && (
                            <div style={{
                                padding: '8px 16px', background: 'var(--bg-secondary)', borderLeft: '4px solid var(--accent-primary)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>Editing Message</div>
                                </div>
                                <button onClick={() => { setEditingMessageId(null); setCurrentMessage(""); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><FiX /></button>
                            </div>
                        )
                    }

                    {/* Conditional Chat Footer */}
                    {
                        (() => {


                            // Determine if sending is restricted to admins
                            // Determine if sending is restricted to admins
                            const isAnnouncement = currentChat?.isAnnouncementGroup;
                            const isAdminOnlyGroup = currentChat?.isGroup && currentChat?.adminOnlyChat;
                            const isChannel = currentChat?.isChannel;

                            // Check if user is admin or creator
                            const isUserAdmin = (currentChat?.admins?.includes(user?.id)) || (String(currentChat?.createdBy) === String(user?.id));

                            const isAdminRestricted = isAnnouncement || isAdminOnlyGroup || isChannel;
                            const canSendMessage = !isAdminRestricted || isUserAdmin;

                            const bans = currentChat?.isGroup ? (currentChat?.bans || {}) : {};
                            const until = bans[user?.id];
                            const banned = (until === -1) || (typeof until === 'number' && until > Date.now());
                            if (banned) {
                                const remainingMs = until === -1 ? null : Math.max(0, until - Date.now());
                                const remainingMin = remainingMs == null ? null : Math.ceil(remainingMs / 60000);
                                return (
                                    <div className="chat-footer" style={{
                                        position: 'absolute', bottom: 0, left: 0, right: '0',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px',
                                        background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', zIndex: 100, transition: 'right 0.3s ease'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            <FiClock size={18} />
                                            <span>{remainingMin == null ? 'You are banned permanently' : `You are banned for ${remainingMin} minutes`}</span>
                                        </div>
                                    </div>
                                );
                            }

                            // Blocked user UX for channels: show notice and prevent composing
                            if (isChannel && isBlocked && !isUserAdmin) {
                                return (
                                    <div className="chat-footer" style={{
                                        position: 'absolute', bottom: 0, left: 0, right: '0',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px',
                                        background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', zIndex: 100, transition: 'right 0.3s ease'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            <FiShield size={18} />
                                            <span>You are blocked by admin</span>
                                        </div>
                                    </div>
                                );
                            }

                            if (!canSendMessage) {
                                // For channels and admin-only groups: remove footer entirely for non-admins
                                if ((isChannel || isAdminOnlyGroup) && !isUserAdmin) return null;
                                // For other admin-restricted contexts (e.g., announcement groups), show notice
                                return (
                                    <div className="chat-footer" style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: '0',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        padding: '20px',
                                        background: 'var(--bg-secondary)',
                                        borderTop: '1px solid var(--border-color)',
                                        zIndex: 100,
                                        transition: 'right 0.3s ease'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            color: 'var(--text-secondary)',
                                            fontSize: '0.9rem'
                                        }}>
                                            <FiShield size={20} />
                                            <span>Only admins can send messages</span>
                                        </div>
                                    </div>
                                );
                            }

                            // Compute role-based permissions in this chat (for groups) with owner override
                            const isGroup = !!currentChat?.isGroup;
                            const isOwnerMe = isGroup && String(user?.id) === String(currentChat?.createdBy);
                            const myRoleId = (currentChat?.memberRoles || {})[user?.id];
                            const myPerms = (currentChat?.rolePermissions || {})[myRoleId] || {};
                            const isAdminMe = isGroup && Array.isArray(currentChat?.admins) && currentChat.admins.some(a => String(a) === String(user?.id));
                            const adminFullEnabled = !!(currentChat?.settings && currentChat.settings.adminFullPermissionsEnabled);
                            const adminHasFull = isAdminMe && adminFullEnabled;
                            const allowSendMedia = isGroup ? (isOwnerMe || adminHasFull || (!!myRoleId && !!myPerms.canSendMedia)) : true;
                            const allowCreatePolls = isGroup ? (isOwnerMe || adminHasFull || (!!myRoleId && !!myPerms.canCreatePolls)) : true;

                            // Show normal input area
                            return (
                                <div className={`chat-footer ${isReplyAnimating && !isReplyExiting ? 'footer-content anim-blur' : ''}`} style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: '0',
                                    background: 'transparent',
                                    padding: '0 20px 20px 20px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    zIndex: 300000,
                                    transition: 'right 0.3s ease, padding-top 0.36s cubic-bezier(0.22, 1, 0.36, 1)',
                                    paddingTop: showMention ? Math.min(240, Math.max(1, (mentionList && mentionList.length) ? mentionList.length : 3) * 44) + 12 : 0
                                }}>
                                    {showEmojiPicker && (
                                        <div
                                            ref={emojiPickerRef}
                                            className="emoji-picker-anim"
                                            style={{
                                                position: 'absolute',
                                                bottom: 'calc(100% + 10px)',
                                                left: '12px',
                                                zIndex: 200500,
                                                pointerEvents: 'auto',
                                                border: '2px solid var(--border-color)',
                                                borderRadius: '30px',
                                                overflow: 'hidden',
                                                background: theme === 'dark' ? 'transparent' : 'transparent',
                                                boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
                                            }}
                                        >
                                            <EmojiPicker onEmojiClick={onEmojiClick} theme={theme === 'dark' ? 'dark' : 'light'} />
                                        </div>
                                    )}
                                    {showStickerPicker && createPortal(
                                        <div style={{ position: 'fixed', bottom: '90px', right: currentChat?.showInfo ? `${infoSidebarWidth + 20}px` : '20px', zIndex: 100000, background: 'rgba(30,30,30,0.95)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', width: '420px', maxWidth: '90vw' }}>
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                                <button onClick={() => setGiphyTab('gifs')} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: giphyTab === 'gifs' ? 'var(--accent-primary)' : 'transparent', color: 'white', cursor: 'pointer' }}>GIFs</button>
                                                <button onClick={() => setGiphyTab('stickers')} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: giphyTab === 'stickers' ? 'var(--accent-primary)' : 'transparent', color: 'white', cursor: 'pointer' }}>Stickers</button>
                                                <input value={giphyQuery} onChange={e => setGiphyQuery(e.target.value)} placeholder={giphyTab === 'stickers' ? 'Search stickers' : 'Search GIFs'} style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'white' }} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 56px)', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                                                {giphyResults.map((item, idx) => (
                                                    <div key={idx} onClick={() => {
                                                        setExternalFileData({ url: item.url, type: item.type, name: item.isSticker ? 'sticker.gif' : 'gif.gif', isSticker: item.isSticker });
                                                        setShowStickerPicker(false);
                                                        sendMessage();
                                                    }} style={{ width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <img src={item.url} alt="st" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                ))}
                                                {giphyLoading && <div style={{ gridColumn: '1 / -1', color: 'white', textAlign: 'center', padding: '8px' }}>Loading...</div>}
                                                {!giphyLoading && giphyResults.length === 0 && <div style={{ gridColumn: '1 / -1', color: 'white', textAlign: 'center', padding: '8px' }}>No results</div>}
                                            </div>
                                            {giphyHasMore && (
                                                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                                                    <button disabled={giphyLoading} onClick={() => fetchGiphy(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'white', cursor: 'pointer' }}>
                                                        {giphyLoading ? 'Loading...' : 'Load more'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>,
                                        document.body
                                    )}
                                    {/* Floating footer with input and actions - Content Overlay */}
                                    <div style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0',
                                        position: 'absolute',
                                        left: inputMode === 'shrinking' ? '30px' : '10px',
                                        right: currentChat?.showInfo
                                            ? (inputMode === 'shrinking' ? '380px' : '360px')
                                            : (inputMode === 'shrinking' ? '30px' : '10px'),
                                        bottom: '39.2px', // Moved down to 33px
                                        background: 'transparent',
                                        borderRadius: '15px',
                                        padding: '0',
                                        filter: 'none !important',
                                        transform: (() => {
                                            if (footerAnimStage === 'bump_down') return 'translateY(-4px) scaleX(1)';
                                            if (footerAnimStage === 'expanding_width') return 'translateY(0) scaleX(1.05)';
                                            if (footerAnimStage === 'fully_expanded') return 'translateY(-10px) scaleX(1.05)';
                                            return inputMode === 'shrinking' ? 'translateY(-15px)' : 'translateY(0)';
                                        })(),
                                        transition: 'right 0.3s ease, left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.8s cubic-bezier(0.2, 0.9, 0.1, 1)',
                                        willChange: 'transform',
                                        zIndex: 201 // Above goo layer
                                    }}>
                                        <style>{`
                                      .hint-container{ position:absolute; left:0; right:0; bottom:50%; transform: translateY(50%); pointer-events:none; height:auto; overflow:visible; }
                                      .hint-text{ display:inline-flex; align-items:center; gap:6px; font-size:0.95rem; font-weight: var(--font-weight-regular); white-space:nowrap; color:${theme === "dark" ? "#fff" : "var(--text-secondary)"}; font-family: system-ui, -apple-system, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI', Roboto, sans-serif; }
                                      .hint-reveal{ animation: none; filter: none; }
                                      .hint-enter{ animation: hintEnter 800ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                                      .hint-exit{ animation: hintExit 1200ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                                      .hint-chars{ display:inline-flex; gap:0px; }
                                      .hint-char{ opacity:0; transform: translateY(16px); filter: blur(8px); display:inline-block; }
                                      .hint-char.reveal{ animation: hintCharIn 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                                      .hint-stack{ position: relative; display: inline-block; height: 1.2em; }
                                      .hint-layer{ position: absolute; left: 0; top: 0; }
                                      @keyframes hintReveal{ 0%{ opacity:0; } 100%{ opacity:1; } }
                                      @keyframes hintEnter{ 0%{ transform: translateY(25px); opacity:0; filter: blur(18px);} 100%{ transform: translateY(0); opacity:1; filter: blur(0);} }
                                      @keyframes hintExit{ 0%{ transform: translateY(0); opacity:1; filter: blur(0);} 100%{ transform: translateY(-25px); opacity:0; filter: blur(18px);} }
                                      @keyframes hintCharIn{ 0%{ opacity:0; transform: translateY(16px); filter: blur(8px);} 60%{ opacity:0.6; filter: blur(4px);} 100%{ opacity:1; transform: translateY(0); filter: blur(0);} }
                                      @keyframes charPopIn{ 
                                          0% { opacity: 0; transform: translateY(25px); filter: blur(18px); } 
                                          40% { opacity: 0.5; filter: blfur(12px); } 
                                          70% { opacity: 0.8; filter: blur(5px); } 
                                          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
                                      }
                                      @keyframes charPopOut{
                                          0% { opacity: 1; transform: translateY(0); filter: blur(0); }
                                          100% { opacity: 0; transform: translateY(-14px); filter: blur(10px); }
                                      }
                                      /* Mentions panel animation (unique keyframes to avoid conflicts) */
                                      /* Mentions panel animation (unique keyframes to avoid conflicts) */
                                      .mention-menu-anim { 
                                          transform-origin: bottom center; 
                                          animation: mentionMenuReveal 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards; 
                                          will-change: transform, opacity, filter, max-height, padding; 
                                          overflow: hidden;
                                      }
                                      .mention-menu-anim > * { opacity: 0; animation: mentionFadeUp 700ms ease-out forwards; }
                                      @keyframes mentionMenuReveal { 
                                          0% { 
                                              opacity: 0; 
                                              transform: translateY(20px) scale(0.96); 
                                              filter: blur(20px);
                                              max-height: 0;
                                              padding-top: 0;
                                              padding-bottom: 0;
                                          } 
                                          100% { 
                                              opacity: 1; 
                                              transform: translateY(0) scale(1); 
                                              filter: blur(0);
                                              max-height: 240px;
                                              padding-top: 8px;
                                              padding-bottom: 0;
                                          } 
                                      }
                                      @keyframes mentionFadeUp { 
                                          0% { opacity: 0; transform: translateY(25px); filter: blur(18px);} 
                                          40% { opacity: 0.3; filter: blur(12px);} 
                                          60% { opacity: 0.6; filter: blur(8px);}
                                          70% { opacity: 0.8; filter: blur(5px);} 
                                          100% { opacity: 1; transform: translateY(0); filter: blur(0);}
                                      }
                                      
                                    `}</style>

                                        {showMention && mentionList.length > 0 && (
                                            <div className="mention-menu-anim" style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px',
                                                maxHeight: '220px',
                                                overflowY: 'auto',
                                                padding: '8px 8px 0 8px',
                                                borderBottom: '1px solid var(--border-color)'
                                            }}>
                                                {mentionList.map((user, i) => (
                                                    <div
                                                        key={user.name}
                                                        onClick={() => insertMention(user.name)}
                                                        style={{
                                                            padding: '8px 12px',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            background: i === mentionIndex ? 'var(--accent-primary)' : 'transparent',
                                                            color: i === mentionIndex ? 'white' : 'var(--text-primary)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            transition: 'background 0.2s',
                                                            animationDelay: `${150 + (i * 150)}ms` // Slower staggered delay (start after container begins)
                                                        }}
                                                        onMouseEnter={() => setMentionIndex(i)}
                                                    >
                                                        {user.avatar ? (
                                                            <img src={user.avatar} alt={user.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <div style={{
                                                                width: '32px', height: '32px', borderRadius: '50%',
                                                                background: getNameBubbleColor(user.name),
                                                                color: 'white', fontSize: '1rem', fontWeight: 'bold',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}>
                                                                {user.name.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>{user.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', width: '100%', position: 'relative' }}>
                                            {showAttachMenu && (allowSendMedia || allowCreatePolls) && (
                                                <>
                                                    <style>{`
                                                .attach-menu-anim { transform-origin: top left; animation: menuReveal 360ms ease-out forwards, menuClip 520ms ease-out forwards; will-change: transform, opacity, clip-path, filter; }
                                                @keyframes menuReveal { 0% { opacity: 0; transform: translateY(8px) scale(0.9); filter: blur(80px);} 100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0);} }
                                                @keyframes menuClip { 0% { clip-path: circle(0% at 0% 100%);} 100% { clip-path: circle(160% at 0% 100%);} }
                                                .attach-menu-anim > * { opacity: 0; animation: fadeUp 320ms ease-out forwards; will-change: transform, opacity; }
                                                .attach-menu-anim > *:nth-child(1) { animation-delay: 60ms; }
                                                .attach-menu-anim > *:nth-child(2) { animation-delay: 120ms; }
                                                .attach-menu-anim > *:nth-child(3) { animation-delay: 180ms; }
                                                .attach-menu-anim > *:nth-child(4) { animation-delay: 240ms; }
                                                .attach-menu-anim > *:nth-child(5) { animation-delay: 300ms; }
                                                .attach-menu-anim > *:nth-child(6) { animation-delay: 360ms; }
                                                @keyframes fadeUp { 0% { opacity: 0; transform: translateY(8px);} 100% { opacity: 1; transform: translateY(0);} }
                                                .filter-btn{ position: relative; overflow: hidden; }
                                                .filter-btn::after{ content:''; position:absolute; left:0; right:0; top:0; height:0%; background: currentColor; opacity:0.18; border-radius: 999px; pointer-events:none; }
                                                .filter-btn.active::after{ animation: filterFillDown 360ms ease-out forwards; }
                                                @keyframes filterFillDown { from{height:0%} to{height:100%} }
                                                .emoji-picker-anim { opacity: 0; transform: translateY(10px) scale(0.98); filter: blur(20px); animation: pickerReveal 360ms cubic-bezier(0.22, 1, 0.36, 1) forwards; will-change: transform, opacity, filter; }
                                                @keyframes pickerReveal { 0% { opacity: 0; transform: translateY(10px) scale(0.98); filter: blur(20px);} 100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0);} }
                                            `}</style>
                                                    <div className="attach-menu-anim" style={{
                                                        position: 'absolute', bottom: '50px', left: '0',
                                                        background: theme === 'dark' ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)',
                                                        borderRadius: '16px',
                                                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)', padding: '8px',
                                                        display: 'flex', flexDirection: 'column', gap: '4px',
                                                        minWidth: '160px', zIndex: 2000,
                                                        animation: 'none',
                                                        border: '1px solid rgba(255,255,255,0.1)'
                                                    }}>
                                                        {allowSendMedia && (
                                                            <label
                                                                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s' }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <FiImage size={18} color="#4CAF50" />
                                                                <span style={{ fontSize: '0.9rem', color: theme === 'dark' ? 'white' : 'var(--text-primary)' }}>Image</span>
                                                                <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files[0]); setShowAttachMenu(false); }} style={{ display: 'none' }} />
                                                            </label>
                                                        )}
                                                        {allowSendMedia && (
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s' }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <FiMusic size={18} color="#E91E63" />
                                                                <span style={{ fontSize: '0.9rem', color: theme === 'dark' ? 'white' : 'var(--text-primary)' }}>Audio</span>
                                                                <input type="file" accept="audio/*" onChange={(e) => { setFile(e.target.files[0]); setShowAttachMenu(false); }} style={{ display: 'none' }} />
                                                            </label>)}
                                                        {allowSendMedia && (
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s' }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <FiFile size={18} color="#2196F3" />
                                                                <span style={{ fontSize: '0.9rem', color: theme === 'dark' ? 'white' : 'var(--text-primary)' }}>Document</span>
                                                                <input type="file" accept="*" onChange={(e) => { setFile(e.target.files[0]); setShowAttachMenu(false); }} style={{ display: 'none' }} />
                                                            </label>)}
                                                        {allowSendMedia && (
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s' }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <FiImage size={18} color="#9C27B0" />
                                                                <span style={{ fontSize: '0.9rem', color: theme === 'dark' ? 'white' : 'var(--text-primary)' }}>GIF</span>
                                                                <input type="file" accept="image/gif" onChange={(e) => { setFile(e.target.files[0]); setShowAttachMenu(false); }} style={{ display: 'none' }} />
                                                            </label>)}
                                                        <div onClick={() => { setShowStickerPicker((v) => !v); setShowAttachMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <FiSmile size={18} color="#FF9800" />
                                                            <span style={{ fontSize: '0.9rem', color: 'white' }}>Stickers</span>
                                                        </div>
                                                        {/* Doodle toggle */}
                                                        <div onClick={() => { setIsDoodling(d => !d); setShowAttachMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <FiEdit2 size={18} color="#FFEB3B" />
                                                            <span style={{ fontSize: '0.9rem', color: 'white' }}>{isDoodling ? 'Stop Doodle' : 'Doodle'}</span>
                                                        </div>
                                                        {allowCreatePolls && (
                                                            <div onClick={() => { setShowPollCreator(true); setShowAttachMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s' }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <FiBarChart2 size={18} color="#FFC107" />
                                                                <span style={{ fontSize: '0.9rem', color: 'white' }}>Poll</span>
                                                            </div>)}
                                                    </div>
                                                </>
                                            )}
                                            {(allowSendMedia || allowCreatePolls) && (
                                                <div onClick={() => setShowAttachMenu(!showAttachMenu)} className={`filter-btn ${showAttachMenu ? 'active' : ''}`} style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '50%', transition: 'background 0.2s' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <FiPaperclip size={20} />
                                                </div>)}
                                            {/* Emoji picker button */}
                                            <div onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(v => !v); }} className="filter-btn" style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '50%', transition: 'background 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <FiSmile size={20} />
                                            </div>

                                            {isRecording ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <canvas ref={recordingCanvasRef} style={{ width: '320px', height: '36px', background: 'transparent', borderRadius: '8px' }} />
                                                    </div>
                                                    <button onClick={stopRecording} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <FiStopCircle size={20} /> Stop ({Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')})
                                                    </button>
                                                    <button onClick={cancelRecording} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', cursor: 'pointer', padding: '6px 10px' }}>Cancel</button>
                                                </div>
                                            ) : (
                                                <div className="input-wrapper" style={{ background: 'transparent', boxShadow: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', transition: 'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1)', flex: 1 }}>
                                                    <div className="input-container" style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                                                        {/* Mirror div for animation */}
                                                        {/* Typing mirror removed to fix typing issue */}

                                                        <input
                                                            type="text"
                                                            className="chat-input"
                                                            value={currentMessage}
                                                            placeholder={isBlocked ? "You blocked this contact" : "Enter your message"}
                                                            ref={inputRef}
                                                            onChange={(e) => { try { setCurrentMessage(e.target.value); } catch (_) { } try { updateMentionDetection(e.target.value, e.target.selectionStart); } catch (_) { } }}
                                                            onKeyDown={(e) => {
                                                                // Eager trigger when typing '@'
                                                                if (e.key === '@' || (e.shiftKey && e.key === '2')) {
                                                                    const el = e.currentTarget;
                                                                    const caret = el.selectionStart;
                                                                    const val = e.currentTarget.value;
                                                                    // Simulate value after keypress
                                                                    const next = val.slice(0, caret) + '@' + val.slice(caret);
                                                                    setTimeout(() => updateMentionDetection(next, caret + 1), 0);
                                                                }
                                                                if (!showMention) return;
                                                                if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % Math.max(1, mentionList.length)); }
                                                                else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => (i - 1 + Math.max(1, mentionList.length)) % Math.max(1, mentionList.length)); }
                                                                else if (e.key === 'Enter' || e.key === 'Tab') { if (mentionList[mentionIndex]) { e.preventDefault(); insertMention(mentionList[mentionIndex]); } }
                                                                else if (e.key === 'Escape') { setShowMention(false); }
                                                            }}
                                                            onPaste={(e) => {
                                                                try {
                                                                    const txt = e.clipboardData?.getData('text') || '';
                                                                    extractLinks(txt).forEach(u => fetchPreview(u));
                                                                    updateMentionDetection((currentMessage || '') + txt, (currentMessage || '').length + txt.length);
                                                                } catch (_) { }
                                                            }}
                                                            onKeyPress={(event) => { if (event.key === "Enter" && !isBlocked) { if (showMention) { event.preventDefault(); } else { sendMessage(); } } }}
                                                            disabled={isBlocked}
                                                            style={{
                                                                background: 'transparent',
                                                                color: theme === 'dark' ? 'white' : 'var(--text-primary)',
                                                                caretColor: theme === 'dark' ? 'white' : 'var(--text-primary)',
                                                                position: 'relative',
                                                                zIndex: 2,
                                                                width: '100%',
                                                                padding: '12px 16px', // Ensure padding matches mirror
                                                                fontSize: '0.95rem',
                                                                border: 'none',
                                                                outline: 'none'
                                                            }}
                                                        />

                                                        {/* Hint Animation (only when empty) */}
                                                        {/* Hint Animation removed */}
                                                    </div>
                                                    {file && <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginRight: '8px' }}>File selected</span>}
                                                    {/* Removed duplicate smile icon since we have the plus button now, or we can keep it if user wants both. 
                                                The requirement was "plus button ... emoji picker should open". 
                                                I will keep the existing smile icon as well but maybe it's redundant. 
                                                Actually, usually the plus button is for attachments and smile for emojis. 
                                                But the user specifically said "When a 'plus button' ... is clicked, an emoji picker should open".
                                                So I will use the plus button for the emoji picker as requested.
                                                I will remove the old smile icon to avoid confusion or keep it? 
                                                The user said "implement emoji picker functionality... When a 'plus button' is clicked".
                                                I'll keep the smile icon as a secondary way or remove it if it conflicts. 
                                                Let's comment it out or remove it to be clean. 
                                                Wait, the user might mean the plus button opens a menu which HAS the emoji picker? 
                                                "When a 'plus button' ... is clicked, an emoji picker should open". This is specific.
                                                I will remove the old smile icon to strictly follow "plus button -> emoji picker".
                                            */}
                                                    {/* <span onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ fontSize: '1.2rem', color: theme === 'light' ? '#000' : 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FiSmile size={20} /></span> */}
                                                </div>
                                            )}
                                            <div onClick={isRecording ? undefined : startRecording} style={{ cursor: isRecording ? 'not-allowed' : 'pointer', color: 'var(--accent-primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '50%', transition: 'background 0.2s' }}
                                                onMouseEnter={(e) => !isRecording && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <FiMic size={20} />
                                            </div>
                                            {(() => { const remaining = Math.max(0, slowModeSeconds - Math.floor((Date.now() - lastSentTs) / 1000)); return remaining; })() > 0 && (
                                                <div style={{ marginRight: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Wait {Math.max(0, slowModeSeconds - Math.floor((Date.now() - lastSentTs) / 1000))}s</div>
                                            )}

                                            <button onClick={sendMessage} className="btn" disabled={isBlocked || (Math.max(0, slowModeSeconds - Math.floor((Date.now() - lastSentTs) / 1000)) > 0)} style={{
                                                background: (isBlocked || (Math.max(0, slowModeSeconds - Math.floor((Date.now() - lastSentTs) / 1000)) > 0)) ? 'var(--text-secondary)' : 'var(--accent-primary)', color: 'white', border: 'none',
                                                width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: (isBlocked || (Math.max(0, slowModeSeconds - Math.floor((Date.now() - lastSentTs) / 1000)) > 0)) ? 'not-allowed' : 'pointer', boxShadow: (isBlocked || (Math.max(0, slowModeSeconds - Math.floor((Date.now() - lastSentTs) / 1000)) > 0)) ? 'none' : '0 4px 10px rgba(91, 150, 247, 0.3)',
                                                flexShrink: 0
                                            }}>
                                                <FiSend size={18} style={{ marginLeft: '-2px' }} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    }

                </div>


                {
                    false && (
                        <div />
                    )
                }

                {/* Interactive Story Preview Modal */}
                {
                    viewingStory && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(15px)',
                            zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: 'fadeIn 0.3s ease'
                        }} onClick={() => setViewingStory(null)}>
                            <div style={{
                                position: 'relative', width: '350px', height: '600px',
                                borderRadius: '20px', overflow: 'hidden',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                animation: 'ios-zoom-in 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'
                            }} onClick={e => e.stopPropagation()}>
                                <img src={viewingStory.imageUrl} alt="Story" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{
                                    position: 'absolute', top: '20px', right: '20px',
                                    background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '8px',
                                    cursor: 'pointer', color: 'white', display: 'flex'
                                }} onClick={() => setViewingStory(null)}>
                                    <FiX size={20} />
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Forward Message Modal */}
                {
                    (() => {
                        if (!forwardingMessage) return false;
                        const isChannel = !!currentChat?.isChannel;
                        const isOwner = String(currentChat?.createdBy) === String(user?.id);
                        const isAdmin = (currentChat?.admins || []).some(a => String(a) === String(user?.id));
                        const canForward = (!isChannel) || (currentChat?.settings?.forwarding !== false) || isOwner || isAdmin;
                        return canForward;
                    })() && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
                            zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: 'fadeIn 0.3s ease'
                        }} onClick={() => setForwardingMessage(null)}>
                            <div style={{
                                background: 'var(--bg-panel)', borderRadius: '16px', width: '90%', maxWidth: '400px',
                                maxHeight: '70vh', display: 'flex', flexDirection: 'column',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                            }} onClick={e => e.stopPropagation()}>
                                {/* Header */}
                                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Forward Message</h3>
                                    <div onClick={() => setForwardingMessage(null)} style={{ cursor: 'pointer', padding: '4px' }}>
                                        <FiX size={24} color="var(--text-primary)" />
                                    </div>
                                </div>

                                {/* Chat List */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                                    {friends && friends.length > 0 ? friends.map(friend => (
                                        <div key={friend.id} onClick={() => {
                                            setConfirmForward({ friend, message: forwardingMessage });
                                        }} style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            padding: '12px', borderRadius: '12px', cursor: 'pointer',
                                            transition: 'background 0.2s',
                                            background: 'transparent'
                                        }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                            <img src={friend.avatar || "https://i.pravatar.cc/150?img=1"} alt={friend.username}
                                                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{friend.username}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{friend.lastMessage || 'Click to forward'}</div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                                            No chats available
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Confirmation Modal */}
                {
                    confirmForward && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
                            zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: 'fadeIn 0.2s ease'
                        }} onClick={() => setConfirmForward(null)}>
                            <div style={{
                                background: 'var(--bg-panel)', borderRadius: '16px', width: '90%', maxWidth: '320px',
                                padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                                transform: 'scale(1)', animation: 'popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }} onClick={e => e.stopPropagation()}>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', textAlign: 'center' }}>Forward to {confirmForward.friend.username}?</h3>

                                <div style={{
                                    padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px',
                                    fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic',
                                    maxHeight: '100px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical'
                                }}>
                                    "{confirmForward.message.text || confirmForward.message.message || 'Attachment'}"
                                </div>

                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                    <button onClick={() => setConfirmForward(null)} style={{
                                        flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                        fontWeight: '600', cursor: 'pointer', fontSize: '1rem'
                                    }}>Cancel</button>
                                    <button onClick={() => {
                                        // Check if forwarding is disabled for channels
                                        if (currentChat?.isChannel && currentChat?.settings?.forwarding === false) {
                                            const isAdmin = (currentChat?.admins || []).includes(String(user?.id));
                                            const isCreator = String(currentChat?.createdBy) === String(user?.id);
                                            if (!isAdmin && !isCreator) {
                                                alert('Forwarding is disabled for this channel');
                                                setConfirmForward(null);
                                                setForwardingMessage(null);
                                                return;
                                            }
                                        }

                                        const { friend, message } = confirmForward;

                                        // Check if blocked
                                        if (!friend?.isGroup && !friend?.isChannel && friend?.id) {
                                            if (localStorage.getItem(`block_contact_${friend.id}`) === 'true') {
                                                alert("You cannot forward messages to a blocked user.");
                                                return;
                                            }
                                        }
                                        const roomId = [user.id, friend.id].sort().join('-');

                                        const forwardedMsg = {
                                            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                                            room: roomId,
                                            author: user.username,
                                            message: message.text || message.message,
                                            time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
                                            file: message.file,
                                            isForwarded: true,
                                            to: friend.id,
                                            postId: message.postId || undefined // Add postId if it exists in the original message
                                        };

                                        socket.emit('send_message', forwardedMsg);

                                        // Track share if forwarding from a channel
                                        const postId = message.postId || message.id;
                                        if (currentChat?.isChannel && postId) {

                                            fetch(`http://localhost:3001/channels/${currentChat.id}/posts/${postId}/forward`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    userId: user.id,
                                                    targetChatId: friend.id,
                                                    targetType: friend.isGroup ? 'group' : 'user'
                                                })
                                            })
                                                .then(res => res.json())

                                                .catch(() => { });
                                        } else {

                                        }

                                        setConfirmForward(null);
                                        setForwardingMessage(null);
                                    }} style={{
                                        flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                                        background: 'var(--accent-primary)', color: 'white',
                                        fontWeight: '600', cursor: 'pointer', fontSize: '1rem'
                                    }}>Send</button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Message Info Modal */}
                {
                    infoForMsg && (
                        <div
                            style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                                zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                animation: 'fadeIn 0.2s ease'
                            }}
                            onClick={() => setInfoForMsg(null)}
                        >
                            <div
                                style={{
                                    background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 16,
                                    width: '92%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 16px 50px rgba(0,0,0,0.35)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Message info</h3>
                                    <button onClick={() => setInfoForMsg(null)} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        <FiX size={20} />
                                    </button>
                                </div>

                                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

                                    {currentChat?.isGroup && (() => {

                                        const norm = (v) => {
                                            if (!v) return '';
                                            if (typeof v === 'object') {
                                                return String(v.id ?? v._id ?? v.username ?? v.name ?? '');
                                            }
                                            return String(v);
                                        };
                                        const authorId = norm(infoForMsg.authorId || infoForMsg.author);
                                        const membersAll = Array.isArray(currentChat?.members) ? currentChat.members : [];
                                        const members = membersAll.filter(m => norm(m) !== authorId);
                                        const deliveredArrRaw = Array.isArray(infoForMsg.deliveredTo) ? infoForMsg.deliveredTo : [];
                                        const seenArrRaw = Array.isArray(infoForMsg.seenBy) ? infoForMsg.seenBy : [];
                                        // Build sets including both ids and usernames where available
                                        const deliveredSet = new Set(deliveredArrRaw.flatMap(v => {
                                            const id = norm(v);
                                            if (typeof v === 'object') {
                                                const u = String(v.username ?? v.name ?? '');
                                                return u ? [id, u] : [id];
                                            }
                                            return [id];
                                        }));
                                        const seenSet = new Set(seenArrRaw.flatMap(v => {
                                            const id = norm(v);
                                            if (typeof v === 'object') {
                                                const u = String(v.username ?? v.name ?? '');
                                                return u ? [id, u] : [id];
                                            }
                                            return [id];
                                        }));
                                        // Fallback: if no delivered list provided, consider delivered to all members except author when message exists
                                        const deliveredSetEffective = deliveredSet.size === 0
                                            ? new Set(members.map(m => norm(m)))
                                            : deliveredSet;
                                        // Delivered section should include users who are delivered but NOT seen
                                        const inDelivered = members.filter(m => {
                                            const id = norm(m);
                                            const uname = String(m.username ?? m.name ?? '');
                                            const isDelivered = deliveredSetEffective.has(id) || deliveredSetEffective.has(uname);
                                            const isSeen = seenSet.has(id) || seenSet.has(uname);
                                            return isDelivered && !isSeen;
                                        });
                                        // Seen section includes only seen users
                                        const inSeen = members.filter(m => {
                                            const id = norm(m);
                                            const uname = String(m.username ?? m.name ?? '');
                                            return seenSet.has(id) || seenSet.has(uname);
                                        });
                                        const Row = ({ m, idx }) => {
                                            const id = m.id ?? m._id ?? m.username;
                                            const name = m.username || m.name || String(id);
                                            // Check multiple avatar properties and handle both object and string types
                                            const avatarSrc = typeof m === 'object'
                                                ? (m.profilePicture || m.avatar || `https://i.pravatar.cc/150?u=${id}`)
                                                : `https://i.pravatar.cc/150?u=${m}`;
                                            const isOnline = (onlineUsers || []).some(u => String(u) === String(id));
                                            return (
                                                <div key={String(id) + '-' + idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-color)', borderRadius: 12, padding: '8px 10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <Avatar
                                                            src={avatarSrc}
                                                            alt={name}
                                                            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                                                            onError={(e) => {
                                                                e.currentTarget.onerror = null;
                                                                e.currentTarget.src = `https://i.pravatar.cc/150?u=${id}`;
                                                            }}
                                                        />
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{name}</span>
                                                            <span style={{ color: isOnline ? 'var(--status-online)' : 'var(--text-secondary)', fontSize: '0.75rem' }}>{isOnline ? 'online' : 'offline'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        };
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Delivered to</div>
                                                    {inDelivered.length > 0 ? (
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                                                            {inDelivered.map((m, idx) => <Row key={(m.id || m._id || m.username) + '-d'} m={m} idx={idx} />)}
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No recipients</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Seen by</div>
                                                    {inSeen.length > 0 ? (
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                                                            {inSeen.map((m, idx) => <Row key={(m.id || m._id || m.username) + '-s'} m={m} idx={idx} />)}
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No viewers</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {!currentChat?.isGroup && !currentChat?.isChannel && (() => {
                                        // Direct message: show the other participant
                                        // Assume currentChat carries the other user's info
                                        const other = currentChat || {};
                                        const otherId = String(other.id ?? other._id ?? other.username ?? other.name ?? '');
                                        const otherName = other.username || other.name || otherId || 'User';
                                        const otherAvatar = other.profilePicture || other.avatar || `https://i.pravatar.cc/150?u=${otherId}`;
                                        // Delivered if message exists; Seen if status is 'seen'
                                        const dmDelivered = true;
                                        const dmSeen = String(infoForMsg.status || '').toLowerCase() === 'seen';
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Delivered to</div>
                                                    {dmDelivered ? (
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-color)', borderRadius: 12, padding: '8px 10px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                    <Avatar src={otherAvatar} alt={otherName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://i.pravatar.cc/150?u=${otherId}`; }} />
                                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{otherName}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No recipients</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Seen by</div>
                                                    {dmSeen ? (
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-color)', borderRadius: 12, padding: '8px 10px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                    <Avatar src={otherAvatar} alt={otherName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://i.pravatar.cc/150?u=${otherId}`; }} />
                                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{otherName}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No viewers</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    )
                }

                <style>{`
                .message-bubble { border-radius: 12px !important; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); background-clip: padding-box; isolation: isolate; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
                @keyframes textWipe {
                    0% { clip-path: inset(0 100% 0 0); }
                    100% { clip-path: inset(0 0 0 0); }
                }

                /* Sender (me) bubbles - keep theme-matching solid colors; blur is applied via .message-bubble */
                [data-theme='dark'] .message-container.me .message-bubble { background-color: #383838ff !important; color: #ffffff !important; }
                [data-theme='light'] .message-container.me .message-bubble {    border-color: var(--border-color) !important; }
                /* Receiver (other) bubbles - keep theme accent solid color; blur is applied via .message-bubble */
                [data-theme='dark'] .message-container.other .message-bubble { background-color: var(--accent-primary) !important; color: #FFFFFF !important; }
                [data-theme='light'] .message-container.other .message-bubble { background-color: var(--accent-primary) !important; color: #FFFFFF !important; }
                /* Link messages follow the same glass backgrounds */
                .message-container.other .message-bubble.link-message { background-color: inherit !important; color: inherit !important; }
                .message-container.me .message-bubble.link-message { background-color: inherit !important; color: inherit !important; }
                [data-theme='light'] .message-container.me .message-bubble a,
                [data-theme='light'] .message-container.me .message-bubble a:visited { color: #001a4d !important; }
                /* Light mode override for sender image caption bubble: slightly dark white */
                [data-theme='light'] .message-container.me .caption-bubble { background-color: #f0f2f5 !important; color: var(--text-primary) !important; }
                /* Receiver link messages also use theme accent */
                [data-theme='light'] .message-container.other .message-bubble.link-message { background-color: var(--accent-primary) !important; color: #ffffff !important; }
                [data-theme='light'] .message-container.other .caption-bubble { background-color: var(--accent-primary) !important; color: #ffffff !important; }
                [data-theme='dark'] .message-container.other .caption-bubble { background-color: var(--accent-primary) !important; color: #ffffff !important; }
                .message-bubble:hover .message-menu-btn { display: block !important; }
                .message-dropdown div:hover { background: var(--bg-secondary); }
                .message-container.other .message-bubble a, .message-container.other .message-bubble a:visited { color: #001a4d !important; }
                .message-container.me .message-bubble a, .message-container.me .message-bubble a:visited { color: #ffffff !important; }
                /* Dark mode: use bright blue for all link text (override inline & other rules) */
                [data-theme='dark'] .message-bubble .msg-link,
                [data-theme='dark'] .message-bubble .msg-link:visited,
                [data-theme='dark'] .message-bubble a,
                [data-theme='dark'] .message-bubble a:visited { color: #60a5fa !important; }
                /* Dark mode: explicitly override left-side link color to bright blue */
                [data-theme='dark'] .message-container.other .message-bubble a,
                [data-theme='dark'] .message-container.other .message-bubble a:visited,
                [data-theme='dark'] .message-container.other .message-bubble .msg-link { color: #60a5fa !important; }
                @keyframes pulseGreen { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7);} 70% { box-shadow: 0 0 0 8px rgba(34,197,94,0);} 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0);} }
                @keyframes fluid-send {
                    0% { background-color: var(--bg-secondary); box-shadow: 0 0 0 2px var(--accent-primary); transform: scale(0.98); filter: blur(80px); }
                    50% { box-shadow: 0 0 0 4px rgba(73, 73, 238, 0.3); transform: scale(1.01); filter: blur(40px); }
                    100% { background-color: var(--accent-primary); box-shadow: 0 0 0 0px transparent; transform: scale(1); filter: blur(0); }
                }
                .animate-delivered { animation: fluid-send 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
                .tick-read { transform: scale(1.2); }
                .image-message { padding: 0 !important; background: transparent !important; box-shadow: none !important; border: none !important; }
                .message-container.me .image-message, .message-container.other .image-message { background: transparent !important; box-shadow: none !important; border: none !important; }
                .image-message img { border: 1px solid rgba(255,255,255,0.1); }
                /* Force three dots menu to black for received messages in light mode */
                [data-theme='light'] .message-container.other .message-menu-btn {
                    color: #000000 !important;
                }
                /* Force message dropdown menu text to black in light mode */
                [data-theme='light'] .message-dropdown,
                [data-theme='light'] .message-dropdown div {
                    color: #000000 !important;
                }
                @keyframes ios-zoom-in {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
                {/* Image Preview Modal */}
                {/* Poll Creator Modal */}
                {
                    showPollCreator && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)',
                            zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: 'fadeIn 0.2s ease'
                        }} onClick={() => setShowPollCreator(false)}>
                            <div style={{
                                background: 'var(--bg-panel)', width: '90%', maxWidth: '400px',
                                borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                                display: 'flex', flexDirection: 'column', gap: '16px'
                            }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Create Poll</h3>
                                    <button onClick={() => setShowPollCreator(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><FiX size={24} /></button>
                                </div>

                                <input
                                    type="text"
                                    placeholder="Ask a question..."
                                    value={pollQuestion}
                                    onChange={(e) => setPollQuestion(e.target.value)}
                                    style={{
                                        padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                                        background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none'
                                    }}
                                />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Options</label>
                                    {pollOptions.map((option, index) => (
                                        <input
                                            key={index}
                                            type="text"
                                            placeholder={`Option ${index + 1}`}
                                            value={option}
                                            onChange={(e) => {
                                                const newOptions = [...pollOptions];
                                                newOptions[index] = e.target.value;
                                                setPollOptions(newOptions);
                                            }}
                                            style={{
                                                padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)',
                                                background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
                                            }}
                                        />
                                    ))}
                                    {pollOptions.length < 5 && (
                                        <button onClick={() => setPollOptions([...pollOptions, ''])} style={{
                                            textAlign: 'left', background: 'none', border: 'none', color: 'var(--accent-primary)',
                                            cursor: 'pointer', padding: '4px 0', fontSize: '0.9rem', fontWeight: '500'
                                        }}>
                                            + Add Option
                                        </button>
                                    )}
                                </div>

                                <button onClick={async () => {
                                    // Check if blocked
                                    if (!currentChat?.isGroup && !currentChat?.isChannel && currentChat?.id) {
                                        if (localStorage.getItem(`block_contact_${currentChat.id}`) === 'true') {
                                            return;
                                        }
                                    }
                                    const validOptions = pollOptions.filter(opt => opt.trim() !== '');
                                    if (pollQuestion.trim() && validOptions.length >= 2) {
                                        const pollData = {
                                            question: pollQuestion.trim(),
                                            options: validOptions.map(opt => ({ text: opt.trim(), votes: [] })),
                                            allowMultiple: false
                                        };
                                        const messageData = {
                                            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                                            room: room,
                                            author: username,
                                            message: '',
                                            file: null,
                                            poll: pollData,
                                            time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
                                            reactions: {},
                                            replyTo: null,
                                            isRead: false,
                                            justSent: true,
                                            to: currentChat.id,
                                            timestamp: Date.now()
                                        };
                                        await socket.emit('send_message', messageData);
                                        setMessageList((list) => [...list, messageData]);
                                        setShowPollCreator(false);
                                        setPollQuestion('');
                                        setPollOptions(['', '']);
                                    } else {
                                        alert('Please enter a question and at least 2 options.');
                                    }
                                }} style={{
                                    background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '12px',
                                    borderRadius: '12px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', marginTop: '8px'
                                }}>
                                    Create Poll
                                </button>
                            </div>
                        </div>
                    )
                }
                {
                    viewingImage && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.9)', zIndex: 10000,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: 'fadeIn 0.2s ease'
                        }} onClick={() => setViewingImage(null)}>
                            <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={e => e.stopPropagation()}>
                                <img src={viewingImage.url} alt="Full Preview" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />

                                <div style={{
                                    position: 'absolute', top: '-50px', right: '0', display: 'flex', gap: '16px'
                                }}>
                                    <a href={viewingImage.url} download target="_blank" rel="noopener noreferrer" style={{
                                        background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '50%', color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)'
                                    }}>
                                        <FiDownload size={24} />
                                    </a>
                                    <button onClick={() => setViewingImage(null)} style={{
                                        background: 'rgba(255,255,255,0.1)', border: 'none', padding: '10px', borderRadius: '50%', color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)'
                                    }}>
                                        <FiX size={24} />
                                    </button>
                                </div>

                                {/* Prev/Next Controls */}
                                {imageMessages.length > 1 && (
                                    <>
                                        <button onClick={() => stepImage(-1)} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.65)', border: 'none', padding: '14px', borderRadius: '50%', color: 'white', cursor: 'pointer', fontSize: '22px', lineHeight: 1, boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>&lt;</button>
                                        <button onClick={() => stepImage(1)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.65)', border: 'none', padding: '14px', borderRadius: '50%', color: 'white', cursor: 'pointer', fontSize: '22px', lineHeight: 1, boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>&gt;</button>
                                    </>
                                )}
                            </div>
                        </div>
                    )
                }
                {
                    reactionsPickerFor && createPortal(
                        <div
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                                position: 'fixed',
                                left: reactionsPickerPos.left,
                                top: reactionsPickerPos.top,
                                zIndex: 200500,
                                background: theme === 'dark' ? '#1f2937' : '#ffffff',
                                border: '1px solid var(--border-color)',
                                borderRadius: 12,
                                boxShadow: '0 8px 20px rgba(0,0,0,0.35)'
                            }}
                        >
                            <EmojiPicker
                                theme={theme === 'dark' ? 'dark' : 'light'}
                                onEmojiClick={(emojiData) => {
                                    try {
                                        const em = emojiData?.emoji || emojiData?.unified || '';
                                        if (em) handleReaction(reactionsPickerFor, em);
                                    } catch (_) { }
                                    setReactionsPickerFor(null);
                                }}
                            />
                        </div>, document.body)
                }

                {/* Call Modal */}
                {createPortal(
                    <AnimatePresence>
                        {callState && (
                            <CallModal
                                callState={callState}
                                callerInfo={callState.caller}
                                isVideoCall={callState.isVideo}
                                isGroupCall={isGroupCall}
                                onAnswer={answerCall}
                                onReject={rejectCall}
                                onCancel={endCall}
                                theme={theme}
                            />
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* Active Call Interface */}
                {activeCall && createPortal(
                    <ActiveCall
                        localStream={webRTC.localStream}
                        remoteStreams={webRTC.remoteStreams}
                        connectedPeers={webRTC.connectedPeers}
                        isVideoCall={activeCall.isVideo}
                        isGroupCall={isGroupCall}
                        isMuted={webRTC.isMuted}
                        isCameraOff={webRTC.isCameraOff}
                        onToggleMute={webRTC.toggleMute}
                        onToggleCamera={webRTC.toggleCamera}
                        onEndCall={endCall}
                        participants={isGroupCall ? (currentChat?.members || []) : [currentChat || {}]}
                        theme={theme}
                        callId={activeCall.id}
                    />,
                    document.body
                )}

            </div >
        </div >

    );
}

export default ChatWindow;

