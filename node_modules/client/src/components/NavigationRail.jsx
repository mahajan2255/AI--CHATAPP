import React from 'react';
import { PiChatCircleDots, PiCirclesThree, PiGear, PiMoon, PiSun, PiPhone } from 'react-icons/pi';

import Avatar from './Avatar';

// Local Avatar component removed

function NavigationRail({ theme, toggleTheme, activeTab, onTabChange, userAvatar, hasUnseenStatus, unseenMessages = {}, friends = [], groups = [], channels = [], user = {} }) {
    const totalUnseen = Object.entries(unseenMessages).reduce((acc, [key, value]) => {
        if (!value?.count) return acc;

        // Check if this key corresponds to a valid chat
        let isValid = false;

        // Check Groups/Channels first (prioritize exact ID match)
        // This handles both numeric IDs and UUIDs (which contain hyphens)
        if (groups.some(g => String(g.id) === String(key)) ||
            channels.some(c => String(c.id) === String(key))) {
            isValid = true;
        }
        // If not a group/channel, check if it's a DM (composite ID)
        else if (key.includes('-')) {
            // Composite room ID for DMs: "id1-id2"
            const [id1, id2] = key.split('-');
            const otherId = String(id1) === String(user?.id) ? id2 : id1;
            isValid = friends.some(f => String(f.id) === String(otherId));
        }

        return isValid ? acc + value.count : acc;
    }, 0);

    return (
        <div className="nav-rail">
            <div
                className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => onTabChange('chat')}
                style={{ position: 'relative' }}
            >
                <PiChatCircleDots size={24} weight={activeTab === 'chat' ? 'fill' : 'regular'} color={activeTab === 'chat' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                {totalUnseen > 0 && (
                    <div
                        className="badge"
                        style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            border: '2px solid var(--nav-rail-bg)',
                            width: 22,
                            height: 22,
                            minWidth: 22,
                            borderRadius: '50%',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            lineHeight: 1,
                            zIndex: 10
                        }}
                    >
                        {totalUnseen > 99 ? '99+' : totalUnseen}
                    </div>
                )}
            </div>
            <div
                className={`nav-item status-item ${activeTab === 'status' ? 'active' : ''}`}
                onClick={() => onTabChange('status')}
                style={{ position: 'relative', borderRadius: '50%', color: activeTab === 'status' ? '#ff3b30' : 'var(--text-secondary)' }}
                title="Status"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden focusable="false" style={{ width: 24, height: 24, display: 'block' }}>
                    {/* Outer ring: 3 equal rounded segments (top, bottom-left, bottom-right) */}
                    <circle
                        cx="12" cy="12" r="10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ strokeWidth: 2, fill: 'none' }}
                        strokeLinecap="round"
                        pathLength="360"
                        /* Three equal segments with equal gaps: (80 on, 40 off) * 3 = 360 */
                        strokeDasharray="80 40"
                        /* Position first segment centered at top */
                        strokeDashoffset="70"
                    />
                    {/* Inner full circle (no divisions) */}
                    <circle
                        cx="12" cy="12" r="5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ strokeWidth: 2, fill: 'none' }}
                        opacity="1"
                    />
                </svg>
                {hasUnseenStatus && (
                    <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '14px', height: '14px', background: 'var(--accent-primary)', borderRadius: '50%', border: '2px solid var(--nav-rail-bg)' }} />
                )}
            </div>
            <div
                className={`nav-item ${activeTab === 'calls' ? 'active' : ''}`}
                onClick={() => onTabChange('calls')}
                title="Calls"
            >
                <PiPhone size={24} weight={activeTab === 'calls' ? 'fill' : 'regular'} color={activeTab === 'calls' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
            </div>
            <div
                className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => onTabChange('settings')}
            >
                <PiGear size={28} weight={activeTab === 'settings' ? 'fill' : 'regular'} color={activeTab === 'settings' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
            </div>

            <div style={{ marginTop: 'auto' }}>
                <div className="nav-item" onClick={toggleTheme}>
                    {theme === 'light' ? <PiMoon size={24} color={'var(--text-secondary)'} /> : <PiSun size={24} color={'var(--text-secondary)'} />}
                </div>
                <div className="nav-item">
                    <Avatar src={userAvatar} alt="Profile" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                </div>
            </div>
        </div>
    );
}

export default NavigationRail;
