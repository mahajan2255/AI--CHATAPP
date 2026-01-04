import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSmile, FiSend } from 'react-icons/fi';
import EmojiPicker from 'emoji-picker-react';
import axios from 'axios';

const StoryUploadModal = ({ file, onClose, user, socket, onUploadSuccess }) => {
    const [uploadPreview, setUploadPreview] = useState(null);
    const [caption, setCaption] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [stickers, setStickers] = useState([]); // { id, emoji, x, y }
    const [activeSticker, setActiveSticker] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const previewImgRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    const [isVideo, setIsVideo] = useState(false);

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setUploadPreview(url);
            setIsVideo(file.type.startsWith('video'));
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    const handleAddSticker = (emojiData) => {
        const newSticker = {
            id: Date.now(),
            emoji: emojiData.emoji,
            x: 50, // Center percentage
            y: 50,
        };
        setStickers([...stickers, newSticker]);
        setShowEmojiPicker(false);
    };

    // Simple Drag Logic
    const handleDragStart = (e, id) => {
        if (e.type === 'touchstart') e.stopPropagation(); // prevent scrolling
        setActiveSticker(id);
    };

    const handleDragMove = (e) => {
        if (activeSticker !== null && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            // Clamp values to 0-100 to keep sticker inside
            let x = ((clientX - rect.left) / rect.width) * 100;
            let y = ((clientY - rect.top) / rect.height) * 100;

            setStickers(prev => prev.map(s =>
                s.id === activeSticker ? { ...s, x, y } : s
            ));
        }
    };

    const handleDragEnd = () => {
        setActiveSticker(null);
    };

    const mergeImageAndStickers = async () => {
        if (!previewImgRef.current || !canvasRef.current) return null;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = previewImgRef.current;

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        // Draw Image
        ctx.drawImage(img, 0, 0);

        // Draw Stickers
        // Scale font relative to image width
        const fontSize = canvas.width * 0.15;
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        stickers.forEach(sticker => {
            const x = (sticker.x / 100) * canvas.width;
            const y = (sticker.y / 100) * canvas.height;
            ctx.fillText(sticker.emoji, x, y);
        });

        return new Promise(resolve => {
            canvas.toBlob(blob => {
                resolve(blob);
            }, 'image/jpeg', 0.9);
        });
    };

    const handlePostStory = async () => {
        if (!file || isUploading) return;
        setIsUploading(true);

        let fileToUpload = file;

        // If stickers exist and it's an image, merge them
        if (stickers.length > 0 && !isVideo) {
            try {
                const mergedBlob = await mergeImageAndStickers();
                if (mergedBlob) {
                    fileToUpload = new File([mergedBlob], "story-edited.jpg", { type: "image/jpeg" });
                }
            } catch (err) {
                console.error("Error merging stickers:", err);
            }
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);

        try {
            const response = await axios.post(`http://${window.location.hostname}:3001/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const newItem = {
                url: `http://${window.location.hostname}:3001${response.data.filePath}`,
                type: response.data.type || (fileToUpload.type.startsWith('video') ? 'video' : 'image'),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                duration: 5000,
                caption: caption
            };

            socket.emit('post_story', {
                userId: user.id,
                username: user.username,
                avatar: user.avatar,
                items: [newItem]
            });

            if (onUploadSuccess) onUploadSuccess();
            onClose();
        } catch (error) {
            console.error("Error uploading story:", error);
            alert("Failed to upload story");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="upload-modal" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd}>

            <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                <FiX size={32} />
            </button>

            <div ref={containerRef} style={{ position: 'relative', maxWidth: '90%', maxHeight: '60vh', margin: '20px' }}>
                {uploadPreview && (
                    isVideo ? (
                        <video src={uploadPreview} style={{ maxHeight: '60vh', maxWidth: '100%', borderRadius: '12px', display: 'block' }} controls autoPlay loop muted />
                    ) : (
                        <img ref={previewImgRef} src={uploadPreview} alt="Preview" style={{ maxHeight: '60vh', maxWidth: '100%', borderRadius: '12px', display: 'block' }} />
                    )
                )}

                {/* Stickers Layer */}
                {stickers.map(sticker => (
                    <div key={sticker.id}
                        onMouseDown={(e) => handleDragStart(e, sticker.id)}
                        onTouchStart={(e) => handleDragStart(e, sticker.id)}
                        style={{
                            position: 'absolute',
                            left: `${sticker.x}%`,
                            top: `${sticker.y}%`,
                            transform: 'translate(-50%, -50%)',
                            fontSize: '3rem',
                            cursor: 'move',
                            userSelect: 'none',
                            zIndex: 10
                        }}>
                        {sticker.emoji}
                    </div>
                ))}
            </div>

            {/* Hidden Canvas for Merging */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Controls */}
            <div style={{ width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {!isVideo && (
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}>
                            <FiSmile size={24} />
                        </button>
                    </div>
                )}

                {showEmojiPicker && !isVideo && (
                    <div style={{ position: 'absolute', bottom: '150px', zIndex: 2001 }}>
                        <EmojiPicker onEmojiClick={handleAddSticker} theme="dark" />
                    </div>
                )}

                <input
                    type="text"
                    placeholder="Add a caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    style={{
                        width: '100%', padding: '12px 20px', borderRadius: '24px', border: 'none',
                        background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '1rem', outline: 'none'
                    }}
                />

                <button onClick={handlePostStory} disabled={isUploading} style={{
                    background: isUploading ? '#666' : 'var(--accent-primary)', color: 'white', border: 'none', padding: '12px 32px',
                    borderRadius: '24px', fontSize: '1.1rem', cursor: isUploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}>
                    {isUploading ? 'Sending...' : <><FiSend /> Send Status</>}
                </button>
            </div>
        </div>
    );
};

export default StoryUploadModal;
