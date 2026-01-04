import React, { useEffect, useRef, useState } from 'react';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff, FiMinimize2, FiMaximize2 } from 'react-icons/fi';
import Avatar from './Avatar';
import AudioVisualizer from './AudioVisualizer';

const ActiveCall = ({
    localStream,
    remoteStreams,
    connectedPeers,
    isVideoCall,
    isGroupCall,
    isMuted,
    isCameraOff,
    onToggleMute,
    onToggleCamera,

    onEndCall,
    participants,
    theme,
    callId
}) => {
    const localVideoRef = useRef(null);
    const remoteVideoRefs = useRef({});
    const [isMinimized, setIsMinimized] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream?.current) {
            localVideoRef.current.srcObject = localStream.current;
        }
    }, [localStream]);

    // Attach remote streams to video elements
    useEffect(() => {
        if (remoteStreams?.current) {
            Object.entries(remoteStreams.current).forEach(([peerId, stream]) => {
                if (remoteVideoRefs.current[peerId] && stream) {
                    remoteVideoRefs.current[peerId].srcObject = stream;
                }
            });
        }
    }, [remoteStreams, connectedPeers, isMinimized, isVideoCall]);

    // Call duration timer
    useEffect(() => {
        const interval = setInterval(() => {
            setCallDuration(d => d + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const startRecording = () => {
        if (!remoteStreams.current) return;
        // Combine streams if possible, or just record the first remote stream for simplicity in this demo
        // Ideally, we'd use WebAudioAPI to mix local + remote.
        // For this demo, we'll try to record the first available remote stream.
        const peerId = connectedPeers[0];
        const stream = remoteStreams.current[peerId];

        if (!stream) {
            alert("No remote audio to record yet.");
            return;
        }

        try {
            const recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                chunksRef.current = []; // reset
                // In a real app, upload this blob. 
                // We'll create a local URL for the session.
                const url = URL.createObjectURL(blob);
                console.log("Recording ready:", url);
                // We could pass this to a parent or store it.
                // For now, we'll auto-download or just alert (User asked for functionality).
                // Let's attach it to the call object via a callback or just event?
                // We'll trigger a custom event for App.jsx to pick up if we want to save it to the log.
                window.dispatchEvent(new CustomEvent('call_recording_ready', { detail: { url, blob, callId } }));
            };
            recorder.start();
            setIsRecording(true);
            mediaRecorderRef.current = recorder;
        } catch (err) {
            console.error("Recording failed", err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleToggleRecord = () => {
        if (isRecording) stopRecording();
        else startRecording();
    };

    // --- End Helpers ---

    const handleEndCall = () => {
        if (isRecording) stopRecording();
        onEndCall();
    };

    const formatDuration = (secs) => {
        const hours = Math.floor(secs / 3600);
        const mins = Math.floor((secs % 3600) / 60);
        const remainingSecs = secs % 60;
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
    };

    const getPeerInfo = (peerId) => {
        return participants?.find(p => String(p.id) === String(peerId)) || { username: 'User', avatar: null };
    };

    // Calculate grid layout for multiple participants
    const getGridLayout = () => {
        const count = connectedPeers.length;
        if (count === 0) return { columns: 1, rows: 1 };
        if (count === 1) return { columns: 1, rows: 1 };
        if (count === 2) return { columns: 2, rows: 1 };
        if (count <= 4) return { columns: 2, rows: 2 };
        if (count <= 6) return { columns: 3, rows: 2 };
        return { columns: 3, rows: 3 };
    };

    const gridLayout = getGridLayout();

    return (
        <div style={{
            position: 'fixed',
            top: isMinimized ? 'auto' : 0,
            bottom: isMinimized ? '20px' : 0,
            right: isMinimized ? '20px' : 0,
            left: isMinimized ? 'auto' : 0,
            width: isMinimized ? '320px' : '100%',
            height: isMinimized ? '240px' : '100%',
            background: theme === 'dark' ? '#0a0a0a' : '#1a1a1a',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.3s ease',
            borderRadius: isMinimized ? '20px' : '0',
            overflow: 'hidden',
            boxShadow: isMinimized ? '0 10px 40px rgba(0, 0, 0, 0.5)' : 'none'
        }}>
            <style>{`
                @keyframes pulse-rec {
                    0% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(255, 77, 79, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
                }
            `}</style>
            {/* Video Call Grid */}
            {isVideoCall && !isMinimized && (
                <div style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridLayout.columns}, 1fr)`,
                    gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`,
                    gap: '4px',
                    background: '#000',
                    padding: '4px'
                }}>
                    {connectedPeers.map((peerId, index) => {
                        const peerInfo = getPeerInfo(peerId);
                        return (
                            <div key={peerId} style={{
                                position: 'relative',
                                background: '#1a1a1a',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <video
                                    ref={el => remoteVideoRefs.current[peerId] = el}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                                {/* Participant name overlay */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '8px',
                                    left: '8px',
                                    background: 'rgba(0, 0, 0, 0.6)',
                                    backdropFilter: 'blur(8px)',
                                    padding: '4px 12px',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '0.85rem'
                                }}>
                                    {peerInfo.username}
                                </div>
                            </div>
                        );
                    })}

                    {/* No participants placeholder */}
                    {connectedPeers.length === 0 && (
                        <div style={{
                            gridColumn: '1 / -1',
                            gridRow: '1 / -1',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff'
                        }}>
                            <FiVideo size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                            <p style={{ fontSize: '1.1rem', opacity: 0.7 }}>
                                {isGroupCall ? 'Waiting for others to join...' : 'Connecting...'}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Minimized Video Preview */}
            {isVideoCall && isMinimized && (
                <div style={{
                    flex: 1,
                    position: 'relative',
                    background: '#000'
                }}>
                    {connectedPeers[0] && (
                        <video
                            ref={el => remoteVideoRefs.current[connectedPeers[0]] = el}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    )}
                    {connectedPeers.length > 1 && (
                        <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            backdropFilter: 'blur(8px)',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '0.75rem'
                        }}>
                            +{connectedPeers.length - 1}
                        </div>
                    )}
                </div>
            )}

            {/* Audio Call Display */}
            {!isVideoCall && (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '20px'
                }}>
                    {isGroupCall ? (
                        // Group audio call - show participant count
                        <>
                            <div style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.2)',
                                backdropFilter: 'blur(10px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '24px',
                                border: '3px solid rgba(255, 255, 255, 0.3)',
                                fontSize: '2rem',
                                color: '#fff',
                                fontWeight: 'bold'
                            }}>
                                {connectedPeers.length + 1}
                            </div>
                            <h2 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '8px' }}>
                                Group Call
                            </h2>
                            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.95rem', marginBottom: '4px' }}>
                                {connectedPeers.length + 1} participant{connectedPeers.length !== 0 ? 's' : ''}
                            </p>
                            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1rem' }}>
                                {formatDuration(callDuration)}
                            </p>
                        </>
                    ) : (
                        // 1-on-1 audio call
                        <>
                            <div style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.2)',
                                backdropFilter: 'blur(10px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '24px',
                                border: '3px solid rgba(255, 255, 255, 0.3)',
                                overflow: 'hidden'
                            }}>
                                {connectedPeers[0] ? (
                                    <Avatar user={getPeerInfo(connectedPeers[0])} size={120} />
                                ) : (
                                    <FiMic size={48} color="#fff" />
                                )}
                            </div>
                            <h2 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '8px' }}>
                                {connectedPeers[0] ? getPeerInfo(connectedPeers[0]).username : 'Connecting...'}
                            </h2>
                            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1rem', marginBottom: '20px' }}>
                                {formatDuration(callDuration)}
                            </p>

                            {/* Unified Dynamic Island Visualizer */}
                            <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                                <AudioVisualizer
                                    width={300}
                                    height={60}
                                    streams={[
                                        ...(localStream.current ? [{ id: 'local', stream: localStream.current, color: '#4caf50' }] : []),
                                        ...connectedPeers.map(peerId => ({
                                            id: peerId,
                                            stream: remoteStreams.current[peerId],
                                            color: '#ff9800'
                                        })).filter(s => s.stream)
                                    ]}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Local Video (Picture in Picture) - Only for video calls */}
            {isVideoCall && !isMinimized && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    width: '180px',
                    height: '135px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    background: '#000',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                }}>
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transform: 'scaleX(-1)' // Mirror local video
                        }}
                    />
                    {isCameraOff && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: '#333',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <FiVideoOff size={24} color="#fff" />
                        </div>
                    )}
                    <div style={{
                        position: 'absolute',
                        bottom: '6px',
                        left: '6px',
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(8px)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.75rem'
                    }}>
                        You
                    </div>
                </div>
            )}

            {/* Call Info (for minimized mode or top-left overlay) */}
            {!isMinimized && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    color: '#fff',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                    maxWidth: '200px'
                }}>
                    <p style={{ fontSize: '0.9rem', marginBottom: '4px', fontWeight: 600 }}>
                        {isGroupCall ? 'Group Call' : (connectedPeers[0] ? getPeerInfo(connectedPeers[0]).username : 'Connecting...')}
                    </p>
                    <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                        {formatDuration(callDuration)}
                    </p>
                </div>
            )}

            {/* Control Buttons */}
            <div style={{
                position: 'absolute',
                bottom: isMinimized ? '12px' : '40px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '16px',
                padding: '16px 24px',
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(10px)',
                borderRadius: '999px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                zIndex: 100
            }}>
                {/* Minimize/Maximize */}
                <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                >
                    {isMinimized ? <FiMaximize2 size={20} /> : <FiMinimize2 size={20} />}
                </button>

                {/* Mute/Unmute */}
                <button
                    onClick={onToggleMute}
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        border: 'none',
                        background: isMuted ? '#f44336' : 'rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        if (!isMuted) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                        if (!isMuted) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    }}
                >
                    {isMuted ? <FiMicOff size={20} /> : <FiMic size={20} />}
                </button>

                {/* Record Button */}
                <button
                    onClick={handleToggleRecord}
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        border: 'none',
                        background: isRecording ? '#ff4d4f' : 'rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        animation: isRecording ? 'pulse-rec 1.5s infinite' : 'none'
                    }}
                    title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                    <div style={{
                        width: '16px', height: '16px', borderRadius: isRecording ? '2px' : '50%',
                        background: 'currentColor', transition: 'all 0.2s'
                    }} />
                </button>

                {/* Camera On/Off (Video only) */}
                {isVideoCall && (
                    <button
                        onClick={onToggleCamera}
                        style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            border: 'none',
                            background: isCameraOff ? '#f44336' : 'rgba(255, 255, 255, 0.15)',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            if (!isCameraOff) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                        }}
                        onMouseLeave={(e) => {
                            if (!isCameraOff) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                        }}
                    >
                        {isCameraOff ? <FiVideoOff size={20} /> : <FiVideo size={20} />}
                    </button>
                )}

                {/* End Call */}
                <button
                    onClick={handleEndCall}
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        border: 'none',
                        background: '#f44336',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(244, 67, 54, 0.4)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <FiPhoneOff size={20} />
                </button>

            </div>

            {/* Hidden Audio Elements - Always render for reliable audio playback */}
            {
                connectedPeers.map(peerId => (
                    <AudioPeer
                        key={peerId}
                        peerId={peerId}
                        stream={remoteStreams.current[peerId]}
                    />
                ))
            }
        </div >
    );
};

// Subcomponent for reliable audio playback
const AudioPeer = ({ peerId, stream }) => {
    const audioRef = useRef(null);

    useEffect(() => {
        if (audioRef.current && stream) {
            audioRef.current.srcObject = stream;
            // Attempt to play immediately
            audioRef.current.play().catch(e => console.error("Audio play failed:", e));
        }
    }, [stream]);

    return (
        <audio
            ref={audioRef}
            autoPlay
            playsInline
            controls={false}
            style={{ display: 'none' }}
        />
    );
};

export default ActiveCall;
