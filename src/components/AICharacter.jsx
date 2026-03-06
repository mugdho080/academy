import React from 'react';
import { motion } from 'framer-motion';
import AnimatedPanda from './AnimatedPanda';

const AICharacter = ({ mood = 'happy', isSpeaking = false }) => {
    return (
        <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Soft Glow Background */}
            <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="absolute inset-0 bg-yellow-400/20 blur-3xl rounded-full"
            />

            {/* Panda Avatar */}
            <div className={`w-full h-full rounded-full shadow-2xl flex items-center justify-center relative transition-all bg-white border-[#00695C]`}>
                <AnimatedPanda isSpeaking={isSpeaking} className="w-full h-full p-2" />
            </div>
        </div>
    );
};

export default AICharacter;
