import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import Draggable from 'gsap/Draggable';
import './LiquidToggle.css';

gsap.registerPlugin(Draggable);

const LiquidToggle = ({ checked, onChange, disabled = false }) => {
    const toggleRef = useRef(null);
    const isDraggingRef = useRef(false);
    const onChangeRef = useRef(onChange);

    // keep latest onChange without reinitializing Draggable
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // Initialize Draggable once
    useEffect(() => {
        const toggle = toggleRef.current;
        if (!toggle) return;

        // Set initial visual state
        const complete = checked ? 100 : 0;
        toggle.style.setProperty('--complete', complete);
        toggle.setAttribute('aria-pressed', checked);

        const proxy = document.createElement('div');
        const draggable = Draggable.create(proxy, {
            trigger: toggle,
            type: 'x',
            allowNativeTouchScrolling: false,
            minimumMovement: 3,
            onDragStart: function () {
                if (disabled) return false;
                const toggleBounds = toggle.getBoundingClientRect();
                const pressed = toggle.matches('[aria-pressed=true]');
                this.left = toggleBounds.left;
                this.width = Math.max(1, toggleBounds.width);
                this.startComplete = pressed ? 100 : 0;
                toggle.dataset.active = true;
                isDraggingRef.current = true;
            },
            onDrag: function () {
                const px = this.pointerX != null ? this.pointerX : (this.x + this.startX);
                const ratio = (px - this.left) / this.width;
                this.complete = gsap.utils.clamp(0, 100, ratio * 100);
                gsap.set(toggle, { '--complete': this.complete, '--delta': Math.min(Math.abs(this.deltaX || 0), 12) });
            },
            onDragEnd: function () {
                const isChecked = (this.complete || 0) >= 50;
                gsap.fromTo(
                    toggle,
                    { '--complete': this.complete || 0 },
                    {
                        '--complete': isChecked ? 100 : 0,
                        duration: 0.18,
                        ease: 'power2.out',
                        onComplete: () => {
                            gsap.delayedCall(0.05, () => {
                                toggle.dataset.active = false;
                                toggle.setAttribute('aria-pressed', String(isChecked));
                                isDraggingRef.current = false;
                                if (onChangeRef.current && isChecked !== checked) {
                                    onChangeRef.current(isChecked);
                                }
                            });
                        },
                    }
                );
            },
            onPress: function () {
                this.__pressTime = Date.now();
                if ('ontouchstart' in window && navigator.maxTouchPoints > 0) toggle.dataset.active = true;
            },
            onRelease: function () {
                this.__releaseTime = Date.now();
                gsap.set(toggle, { '--delta': 0 });
                if (
                    'ontouchstart' in window &&
                    navigator.maxTouchPoints > 0 &&
                    ((this.startX !== undefined && this.endX !== undefined && Math.abs(this.endX - this.startX) < 4) || this.endX === undefined)
                ) {
                    toggle.dataset.active = false;
                }
                // Click if short press and not dragged
                if ((this.__releaseTime - this.__pressTime) <= 200 && !isDraggingRef.current) {
                    toggleState();
                }
            },
        })[0];

        return () => {
            draggable.kill();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disabled]);

    // Sync external checked changes smoothly when not dragging
    useEffect(() => {
        const toggle = toggleRef.current;
        if (!toggle) return;
        if (isDraggingRef.current) return;
        gsap.to(toggle, {
            '--complete': checked ? 100 : 0,
            duration: 0.2,
            ease: 'power2.out',
            onStart: () => toggle.setAttribute('aria-pressed', String(checked)),
        });
    }, [checked]);

    const toggleState = () => {
        if (disabled) return;
        const toggle = toggleRef.current;
        toggle.dataset.pressed = true;
        toggle.dataset.active = true;

        const pressed = toggle.matches('[aria-pressed=true]');
        const newState = !pressed;

        gsap.to(toggle, {
            '--complete': pressed ? 0 : 100,
            duration: 0.2,
            onComplete: () => {
                gsap.delayedCall(0.05, () => {
                    toggle.dataset.active = false;
                    toggle.dataset.pressed = false;
                    toggle.setAttribute('aria-pressed', String(newState));
                    if (onChangeRef.current) onChangeRef.current(newState);
                });
            },
        });
    };

    return (
        <>
            <button
                ref={toggleRef}
                className="liquid-toggle"
                aria-label="toggle"
                aria-pressed={checked}
                disabled={disabled}
                style={{
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer'
                }}
                onClick={(e) => {
                    // Fallback click toggle in case Draggable didn't fire due to platform quirks
                    if (!isDraggingRef.current) {
                        e.preventDefault();
                        toggleState();
                    }
                }}
            >
                <div className="knockout">
                    <div className="indicator indicator--masked">
                        <div className="mask">
                            {/* Icons removed as per request */}
                        </div>
                    </div>
                </div>
                <div className="indicator__liquid">
                    <div className="shadow"></div>
                    <div className="wrapper">
                        <div className="liquids">
                            <div className="liquid__shadow"></div>
                            <div className="liquid__track"></div>
                        </div>
                    </div>
                    <div className="cover"></div>
                </div>
            </button>

            {/* SVG Filters - Hidden but referenced */}
            <svg className="sr-only" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <filter id="goo">
                        <feGaussianBlur
                            in="SourceGraphic"
                            stdDeviation="2" // Reduced from 13 for smaller scale
                            result="blur"
                        />
                        <feColorMatrix
                            in="blur"
                            type="matrix"
                            values="
                                1 0 0 0 0
                                0 1 0 0 0
                                0 0 1 0 0
                                0 0 0 13 -10
                            "
                            result="goo"
                        />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                    <filter id="remove-black" colorInterpolationFilters="sRGB">
                        <feColorMatrix
                            type="matrix"
                            values="1 0 0 0 0
                                    0 1 0 0 0
                                    0 0 1 0 0
                                    -255 -255 -255 0 1"
                            result="black-pixels"
                        />
                        <feMorphology
                            in="black-pixels"
                            operator="dilate"
                            radius="0.5"
                            result="smoothed"
                        />
                        <feComposite in="SourceGraphic" in2="smoothed" operator="out" />
                    </filter>
                </defs>
            </svg>
        </>
    );
};

export default LiquidToggle;
