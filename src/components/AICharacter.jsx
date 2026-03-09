import React from 'react';
import { motion } from 'framer-motion';
import AnimatedPanda from './AnimatedPanda';

const glowByMood = {
    calm: 'bg-cyan-300/25',
    happy: 'bg-yellow-300/30',
    encouraging: 'bg-emerald-300/25',
    thinking: 'bg-blue-300/25',
    gentle: 'bg-teal-300/25',
    celebrate: 'bg-amber-300/30',
    resting: 'bg-slate-300/25'
};

const AICharacter = ({ mood = 'happy', isSpeaking = false, animationState = 'idle' }) => {
    return (
        <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Soft Glow Background */}
            <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className={`absolute inset-0 ${glowByMood[mood] || glowByMood.happy} blur-3xl rounded-full`}
            />

            {/* Panda Avatar */}
            <div className={`w-full h-full rounded-full shadow-2xl flex items-center justify-center relative transition-all bg-white border-[#00695C]`}>
                <AnimatedPanda isSpeaking={isSpeaking} mood={mood} animationState={animationState} className="w-full h-full p-2" />
            </div>
        </div>
    );
};

export default AICharacter;
