import React, { useRef } from 'react';

const Avatar = ({ src, alt, style, className, ...props }) => {
    const videoRef = useRef(null);
    const cleanSrc = src && (typeof src === 'string') ? src.split('?')[0].toLowerCase() : '';
    const isVideo = cleanSrc.endsWith('.mp4') || cleanSrc.endsWith('.webm') || cleanSrc.endsWith('.mov');

    if (isVideo) {
        return (
            <video
                ref={videoRef}
                src={src}
                muted
                playsInline
                loop
                onMouseEnter={() => videoRef.current?.play()}
                onMouseLeave={() => {
                    if (videoRef.current) {
                        videoRef.current.pause();
                        videoRef.current.currentTime = 0;
                    }
                }}
                style={{ objectFit: 'cover', ...style }}
                className={className}
                {...props}
            />
        );
    }
    return <img src={src} alt={alt} style={style} className={className} {...props} />;
};

export default Avatar;
