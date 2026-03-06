import React from 'react';
import { motion } from 'framer-motion';

const AnimatedPanda = ({ isSpeaking = false, isListening = false, mood = 'happy', className = "" }) => {
    return (
        <svg viewBox="0 0 100 100" className={`w-full h-full drop-shadow-xl ${className}`}>
            {/* Background context - removed so it can be transparent and use parent's background */}

            {/* Pulsing ring if listening */}
            {isListening && !isSpeaking && (
                <motion.circle
                    cx="50" cy="50" r="48"
                    fill="none" stroke="#22c55e" strokeWidth="3"
                    animate={{ scale: [1, 1.05, 1], opacity: [0, 1, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                />
            )}

            {/* Panda Group - Bobbing slightly when speaking */}
            <motion.g
                animate={isSpeaking ? { y: [0, -2, 0] } : { y: 0 }}
                transition={{ repeat: Infinity, duration: 0.4 }}
            >
                {/* Body/Shoulders */}
                <path d="M 20 85 Q 50 70 80 85 L 90 100 L 10 100 Z" fill="#2d3748" />
                {/* White Belly peeking */}
                <circle cx="50" cy="115" r="28" fill="#ffffff" />

                {/* Ears */}
                <circle cx="22" cy="28" r="14" fill="#2d3748" />
                <circle cx="78" cy="28" r="14" fill="#2d3748" />

                {/* Head - Slightly flattened oval */}
                <ellipse cx="50" cy="52" rx="42" ry="36" fill="#ffffff" stroke="#2d3748" strokeWidth="2.5" />

                {/* Left Eye Patch */}
                <motion.ellipse
                    cx="32" cy="46" rx="10" ry="14"
                    fill="#2d3748"
                    transform="rotate(-20 32 46)"
                />

                {/* Right Eye Patch */}
                <motion.ellipse
                    cx="68" cy="46" rx="10" ry="14"
                    fill="#2d3748"
                    transform="rotate(20 68 46)"
                />

                {/* Left Eyeball & Sparkle (Blinking) */}
                <motion.g animate={{ scaleY: [1, 0.1, 1] }} transition={{ repeat: Infinity, duration: 4, times: [0, 0.05, 0.1] }}>
                    <circle cx="34" cy="44" r="4.5" fill="#ffffff" />
                    <circle cx="36" cy="41" r="1.5" fill="#ffffff" opacity="0.9" />
                </motion.g>

                {/* Right Eyeball & Sparkle (Blinking) */}
                <motion.g animate={{ scaleY: [1, 0.1, 1] }} transition={{ repeat: Infinity, duration: 4, times: [0, 0.05, 0.1] }}>
                    <circle cx="66" cy="44" r="4.5" fill="#ffffff" />
                    <circle cx="64" cy="41" r="1.5" fill="#ffffff" opacity="0.9" />
                </motion.g>

                {/* Nose */}
                <path d="M 47 58 Q 50 61 53 58 Z" fill="#2d3748" />
                <path d="M 50 60 L 50 64" stroke="#2d3748" strokeWidth="1.5" />

                {/* Mouth Open/Smile */}
                {isSpeaking ? (
                    <motion.path
                        animate={{
                            d: [
                                "M 43 64 Q 50 78 57 64 Q 50 82 43 64",
                                "M 44 64 Q 50 88 56 64 Q 50 92 44 64",
                                "M 43 64 Q 50 72 57 64 Q 50 76 43 64"
                            ]
                        }}
                        transition={{ repeat: Infinity, duration: 0.35 }}
                        fill="#ef4444"
                        stroke="#2d3748"
                        strokeWidth="1.5"
                    />
                ) : (
                    <path d="M 43 64 Q 50 72 57 64" fill="none" stroke="#2d3748" strokeWidth="2" strokeLinecap="round" />
                )}

                {/* Blushes */}
                <circle cx="21" cy="56" r="4.5" fill="#fca5a5" opacity="0.6" />
                <circle cx="79" cy="56" r="4.5" fill="#fca5a5" opacity="0.6" />
            </motion.g>
        </svg>
    );
};

export default AnimatedPanda;
