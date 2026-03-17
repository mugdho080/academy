import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useUiVariant } from '../context/UiVariantContext';

const SensoryBackground = () => {
    const reduceMotion = useReducedMotion();
    const { variant } = useUiVariant('learner');
    const isClay = variant === 'clay';

    const calmTransition = reduceMotion
        ? { duration: 0 }
        : { duration: 20, repeat: Infinity, ease: "easeInOut" };

    return (
        <div className={`fixed inset-0 z-0 overflow-hidden pointer-events-none ${isClay ? 'bg-[linear-gradient(180deg,#F4F8FF_0%,#ECF2FB_100%)]' : 'bg-gradient-to-br from-[#E3F2FD] via-[#E8F5E9] to-[#F3E5F5]'}`}>
            <motion.div
                className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[55px] sm:blur-[80px] ${isClay ? 'bg-[#a9ccfb]/40 sm:bg-[#a9ccfb]/55' : 'bg-blue-200/30 sm:bg-blue-200/40'}`}
                animate={reduceMotion ? { x: 0, y: 0, scale: 1 } : {
                    x: [0, 50, 0],
                    y: [0, 30, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={calmTransition}
            />
            <motion.div
                className={`absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full blur-[55px] sm:blur-[80px] ${isClay ? 'bg-[#9ed9fa]/34 sm:bg-[#9ed9fa]/48' : 'bg-green-200/30 sm:bg-green-200/40'}`}
                animate={reduceMotion ? { x: 0, y: 0, scale: 1 } : {
                    x: [0, -40, 0],
                    y: [0, -60, 0],
                    scale: [1.1, 1, 1.1],
                }}
                transition={reduceMotion ? { duration: 0 } : { duration: 25, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className={`absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full blur-[50px] sm:blur-[70px] hidden sm:block ${isClay ? 'bg-[#21A7F1]/18 sm:bg-[#21A7F1]/24' : 'bg-purple-200/20 sm:bg-purple-200/30'}`}
                animate={reduceMotion ? { scale: 1, opacity: 0.3 } : {
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={reduceMotion ? { duration: 0 } : { duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className={`absolute inset-0 ${isClay ? 'opacity-[0.08]' : 'opacity-10'}`}>
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                            <circle cx="50" cy="50" r="1" fill={isClay ? '#21A7F1' : '#4DB6AC'} />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>
        </div>
    );
};

export default SensoryBackground;
