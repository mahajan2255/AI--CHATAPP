import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiPhoneOff, FiVideo } from 'react-icons/fi';
import Lottie from 'lottie-react';
import incomingCallAnim from './animations/incoming call.json';
import videoCallAnim from './animations/Calling video icon.json';
import Avatar from './Avatar';

const DraggableCallPopup = ({ call, onAccept, onReject }) => {
    // call: { caller: { id, username, avatar }, isVideo, type: 'incoming' }

    if (!call || call.type !== 'incoming') return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -50, x: 0, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                drag
                dragConstraints={{ left: -window.innerWidth + 300, right: 0, top: 0, bottom: window.innerHeight - 200 }}
                dragElastic={0.1}
                whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
                style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    zIndex: 9999,
                    width: '300px',
                    background: 'var(--bg-popup)', // Check theme var?
                    backgroundColor: 'rgba(28, 28, 30, 0.95)', // Fallback dark
                    backdropFilter: 'blur(12px)',
                    borderRadius: '16px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden',
                    cursor: 'grab'
                }}
            >
                {/* Header / content */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>

                    <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {/* Lottie Animation */}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '150px', height: '150px', zIndex: 0, pointerEvents: 'none' }}>
                            <Lottie
                                animationData={call.isVideo ? videoCallAnim : incomingCallAnim}
                                loop={true}
                                style={{ width: '100%', height: '100%' }}
                            />
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', zIndex: 2 }}>
                        <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>{call.caller.username}</h3>
                        <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                            Incoming {call.isVideo ? 'Video' : 'Audio'} Call...
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', marginTop: '8px', zIndex: 2 }}>
                        <button
                            onClick={onReject}
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                border: 'none',
                                background: '#ff4d4f',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'transform 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                        >
                            <FiPhoneOff size={22} />
                        </button>

                        <button
                            onClick={onAccept}
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                border: 'none',
                                background: '#52c41a',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'transform 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                        >
                            {call.isVideo ? <FiVideo size={22} /> : <FiPhone size={22} />}
                        </button>
                    </div>

                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default DraggableCallPopup;
