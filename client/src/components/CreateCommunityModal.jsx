import React, { useState } from 'react';
import { FiX, FiUsers, FiImage, FiLock, FiGlobe, FiLink } from 'react-icons/fi';
import Avatar from './Avatar';

// Local Avatar component removed

function CreateCommunityModal({ isOpen, onClose, onCreate }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState('public');
    const [icon, setIcon] = useState(`https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`);
    const [uploading, setUploading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || uploading) return;

        onCreate({
            name,
            description,
            icon,
            visibility
        });

        // Reset form
        setName('');
        setDescription('');
        setVisibility('public');
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
        }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{
                backgroundColor: 'var(--bg-panel)',
                padding: '24px',
                borderRadius: '16px',
                width: '400px',
                maxWidth: '90%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FiUsers /> Create Community
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <FiX size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                            <Avatar
                                src={icon}
                                alt="Community Icon"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '20px',
                                    objectFit: 'cover',
                                    border: '2px solid var(--accent-color)'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setIcon(`https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`)}
                                style={{
                                    padding: '8px 10px',
                                    borderRadius: '20px',
                                    border: '1px solid var(--border-color)',
                                    background: 'transparent',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
                                }}
                                title="Shuffle icon"
                            >
                                <FiImage size={14} /> Shuffle
                            </button>
                            <label style={{
                                padding: '8px 10px',
                                borderRadius: '20px',
                                border: '1px solid var(--border-color)',
                                background: 'transparent',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
                            }} title="Upload image">
                                <FiImage size={14} /> {uploading ? 'Uploading...' : 'Upload'}
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    style={{ display: 'none' }}
                                    onChange={async (e) => {
                                        const f = e.target.files && e.target.files[0];
                                        if (!f) return;
                                        try {
                                            setUploading(true);
                                            const form = new FormData();
                                            form.append('file', f);
                                            const res = await fetch('http://localhost:3001/upload', {
                                                method: 'POST',
                                                body: form
                                            });
                                            const data = await res.json();
                                            if (data && data.filePath) {
                                                const url = `http://localhost:3001${data.filePath}`;
                                                setIcon(url);
                                            }
                                        } catch (_) {
                                        } finally {
                                            setUploading(false);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Community Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Tech Enthusiasts"
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                fontSize: '1rem'
                            }}
                            autoFocus
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this community about?"
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                minHeight: '80px',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Visibility</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setVisibility('public')}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: `1px solid ${visibility === 'public' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                    backgroundColor: visibility === 'public' ? 'var(--accent-color-alpha)' : 'transparent',
                                    color: visibility === 'public' ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                <FiGlobe />
                                <span style={{ fontSize: '0.8rem' }}>Public</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setVisibility('invite-only')}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: `1px solid ${visibility === 'invite-only' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                    backgroundColor: visibility === 'invite-only' ? 'var(--accent-color-alpha)' : 'transparent',
                                    color: visibility === 'invite-only' ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                <FiLink />
                                <span style={{ fontSize: '0.8rem' }}>Invite Only</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setVisibility('private')}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: `1px solid ${visibility === 'private' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                    backgroundColor: visibility === 'private' ? 'var(--accent-color-alpha)' : 'transparent',
                                    color: visibility === 'private' ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                <FiLock />
                                <span style={{ fontSize: '0.8rem' }}>Private</span>
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!name.trim() || uploading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '12px',
                            border: 'none',
                            backgroundColor: name.trim() && !uploading ? 'var(--accent-color)' : 'var(--border-color)',
                            color: 'white',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: name.trim() && !uploading ? 'pointer' : 'not-allowed',
                            transition: 'background 0.2s'
                        }}
                    >
                        Create Community
                    </button>
                </form>
            </div>
        </div>
    );
}

export default CreateCommunityModal;
