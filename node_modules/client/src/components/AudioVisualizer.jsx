import React, { useEffect, useRef } from 'react';

// Helper to convert hex to rgb
const hexToRgb = (hex) => {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
};

const AudioVisualizer = ({ streams = [], width = 300, height = 100 }) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const audioContextRef = useRef(null);

    // Map to store analysers: { [id]: { analyser, source, colorRgb, dataArray } }
    const sourcesRef = useRef({});

    // Initialize/Update Audio Sources
    useEffect(() => {
        if (!streams.length) return;

        // Init Context if needed
        let ctx = audioContextRef.current;
        if (!ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            ctx = new AudioContext();
            ctx.resume().catch(e => console.error("Audio resume failed", e));
            audioContextRef.current = ctx;
        }

        // Sync streams with sourcesRef
        streams.forEach(({ id, stream, color }) => {
            if (!stream || !stream.active) return;

            if (!sourcesRef.current[id]) {
                try {
                    const analyser = ctx.createAnalyser();
                    analyser.fftSize = 64; // Low bin count for coarse, pill-like bars
                    analyser.smoothingTimeConstant = 0.85; // Very smooth

                    const source = ctx.createMediaStreamSource(stream);
                    source.connect(analyser);

                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);

                    sourcesRef.current[id] = {
                        analyser,
                        source,
                        colorRgb: hexToRgb(color),
                        dataArray
                    };
                } catch (e) {
                    console.error("Error creating source for stream", id, e);
                }
            } else {
                // Update color just in case
                sourcesRef.current[id].colorRgb = hexToRgb(color);
            }
        });

        // Cleanup removed streams
        Object.keys(sourcesRef.current).forEach(existingId => {
            if (!streams.find(s => s.id === existingId)) {
                // Stream removed
                sourcesRef.current[existingId].source.disconnect();
                delete sourcesRef.current[existingId];
            }
        });

    }, [streams]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            // Disconnect all sources
            Object.values(sourcesRef.current).forEach(s => s.source.disconnect());
            sourcesRef.current = {};
        };
    }, []);

    // Animation Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const canvasCtx = canvas.getContext('2d');

        // Settings
        const barCount = 16; // Number of bars to draw
        // We'll create a smoothed amplitude array for the visualization
        const smoothedAmplitudes = new Array(barCount).fill(0);

        const render = () => {
            animationRef.current = requestAnimationFrame(render);

            // Clear
            canvasCtx.clearRect(0, 0, width, height);

            // Calculate combined data
            const activeSources = Object.values(sourcesRef.current);
            if (activeSources.length === 0) return;

            // Gather data
            activeSources.forEach(src => src.analyser.getByteFrequencyData(src.dataArray));

            // Logic:
            // We want 'barCount' bars.
            // Map freq bins to bars. source.dataArray length is 32 (fftSize 64 / 2). 
            // We can just use the first 16 bins or average them.

            const barWidth = (width / barCount) * 0.6; // Spacing
            const gap = (width - barWidth * barCount) / (barCount + 1);
            let x = gap;

            for (let i = 0; i < barCount; i++) {
                let totalAmp = 0;
                let r = 0, g = 0, b = 0;
                let contributors = 0;

                // For this bar index, mix colors
                activeSources.forEach(src => {
                    // Use corresponding bin (maybe slightly shifted logic for better visuals)
                    const binIndex = i; // simple mapping
                    const amp = src.dataArray[binIndex] || 0;

                    if (amp > 10) { // Noise floor
                        totalAmp += amp;
                        const weight = amp; // Use amplitude as weight for color
                        r += src.colorRgb.r * weight;
                        g += src.colorRgb.g * weight;
                        b += src.colorRgb.b * weight;
                        contributors += weight;
                    }
                });

                // Compute final color
                let finalColor = 'rgba(100, 100, 100, 0.2)'; // Idle grey
                if (contributors > 0) {
                    r = Math.round(r / contributors);
                    g = Math.round(g / contributors);
                    b = Math.round(b / contributors);
                    finalColor = `rgb(${r}, ${g}, ${b})`;
                }

                // Average amplitude for height (or sum?)
                // Sum is fine, but clamp it.
                // Smooth it with previous frame? We're doing raw draw here for now.
                // Ideally we store state for smoothing.

                // Scale height
                const maxBarHeight = height * 0.9;
                const value = Math.min(255, totalAmp);
                const barH = (value / 255) * maxBarHeight;
                const minH = 8; // At least a pill dot

                const finalH = Math.max(minH, barH);
                const y = (height - finalH) / 2; // Vertically centered

                // Draw rounded pill
                canvasCtx.fillStyle = finalColor;

                // Add glow if active
                if (value > 20) {
                    canvasCtx.shadowBlur = 15;
                    canvasCtx.shadowColor = finalColor;
                } else {
                    canvasCtx.shadowBlur = 0;
                }

                roundRect(canvasCtx, x, y, barWidth, finalH, barWidth / 2);

                x += barWidth + gap;
            }
        };

        render();

    }, [width, height]); // Re-start loop if dims change? Actually sourcesRef is stable.

    function roundRect(ctx, x, y, w, h, radius) {
        if (w < 2 * radius) radius = w / 2;
        if (h < 2 * radius) radius = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
        ctx.fill();
    }

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{ width: '100%', height: '100%' }}
        />
    );
};

export default AudioVisualizer;
