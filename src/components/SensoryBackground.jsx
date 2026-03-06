import React from 'react';
import { motion } from 'framer-motion';

const SensoryBackground = () => {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-gradient-to-br from-[#E3F2FD] via-[#E8F5E9] to-[#F3E5F5]">
            {/* Soft floating blobs */}
            <motion.div
                className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-200/40 blur-[80px]"
                animate={{
                    x: [0, 50, 0],
                    y: [0, 30, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-green-200/40 blur-[80px]"
                animate={{
                    x: [0, -40, 0],
                    y: [0, -60, 0],
                    scale: [1.1, 1, 1.1],
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-purple-200/30 blur-[70px]"
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Symmetrical Moving Patterns (Subtle) */}
            <div className="absolute inset-0 opacity-10">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                            <circle cx="50" cy="50" r="1" fill="#4DB6AC" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>
        </div>
    );
};

export default SensoryBackground;
