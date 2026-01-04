import React, { useEffect, useState } from 'react';
import { FiPhone, FiPhoneOff, FiVideo, FiX } from 'react-icons/fi';
import Avatar from './Avatar';

const CallModal = ({ callState, onAnswer, onReject, onCancel, callerInfo, isVideoCall, isGroupCall, theme }) => {
    const [seconds, setSeconds] = useState(0);
    const { type, caller } = callState || {};

    // Timer for call duration
    useEffect(() => {
        if (type === 'outgoing' || type === 'ringing') {
            const interval = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [type]);

    const formatTime = (secs) => {
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
    };

    if (!callState) return null;

    const isIncoming = type === 'incoming';
    const isOutgoing = type === 'outgoing';
    const displayName = caller?.username || callerInfo?.username || 'Unknown';
    const displayAvatar = caller?.avatar || callerInfo?.avatar;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            animation: 'fadeIn 0.3s ease'
        }}>
            <div style={{
                background: theme === 'dark' ? '#1e1e1e' : '#ffffff',
                borderRadius: '24px',
                padding: '40px',
                maxWidth: '400px',
                width: '90%',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
                border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                animation: 'slideUp 0.3s ease'
            }}>
                {/* Call Icon */}
                <div style={{
                    width: '80px',
                    height: '80px',
                    margin: '0 auto 20px',
                    borderRadius: '50%',
                    background: isVideoCall ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: isIncoming ? 'pulse 1.5s infinite' : 'none',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
                }}>
                    {isVideoCall ? <FiVideo size={36} color="#fff" /> : <FiPhone size={36} color="#fff" />}
                </div>

                {/* Caller Avatar */}
                {displayAvatar && (
                    <Avatar
                        src={displayAvatar}
                        alt={displayName}
                        style={{
                            width: '100px',
                            height: '100px',
                            margin: '0 auto 16px',
                            border: '4px solid var(--accent-primary)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                        }}
                    />
                )}

                {/* Caller Name */}
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '8px'
                }}>
                    {displayName}
                </h2>

                {/* Call Status */}
                <p style={{
                    fontSize: '1rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '24px'
                }}>
                    {isIncoming && `Incoming ${isVideoCall ? 'video' : 'audio'} call...`}
                    {isOutgoing && `${isGroupCall ? 'Starting' : 'Calling'}... ${formatTime(seconds)}`}
                </p>

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    justifyContent: 'center',
                    marginTop: '32px'
                }}>
                    {isIncoming && (
                        <>
                            {/* Answer Button */}
                            <button
                                onClick={onAnswer}
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: '#4CAF50',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <FiPhone size={24} />
                            </button>

                            {/* Reject Button */}
                            <button
                                onClick={onReject}
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: '#f44336',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(244, 67, 54, 0.4)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <FiPhoneOff size={24} />
                            </button>
                        </>
                    )}

                    {isOutgoing && (
                        <button
                            onClick={onCancel}
                            style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                border: 'none',
                                background: '#f44336',
                                color: '#ffffff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(244, 67, 54, 0.4)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <FiX size={24} />
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
            `}</style>
        </div>
    );
};

export default CallModal;
