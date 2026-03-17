import React from 'react';
import { useActivityTimer } from '../context/ActivityTimerProvider';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUiVariant } from '../context/UiVariantContext';

const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0')
    ].join(':');
};

const TimerWidget = () => {
    const { localActiveSeconds, isActive, currentContext } = useActivityTimer();
    const { variant } = useUiVariant('learner');
    const isClay = variant === 'clay';

    const contextLabel = currentContext?.context_type
        ? currentContext.context_type.charAt(0).toUpperCase() + currentContext.context_type.slice(1)
        : 'Dashboard';

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`fixed bottom-3 left-1/2 -translate-x-1/2 lg:translate-x-0 lg:left-auto lg:bottom-auto lg:top-4 lg:right-4 z-[65] flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-full max-w-[calc(100vw-1rem)] ${isClay ? 'ui-clay-surface text-[color:var(--clay-text)] border border-white/60' : 'bg-white/95 backdrop-blur-sm shadow-lg border-2 border-primary-light'}`}
        >
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                className={isClay ? 'text-[#21A7F1]' : 'text-primary'}
            >
                <Clock size={20} />
            </motion.div>
            <div className="flex flex-col leading-tight">
                <span className={`text-[10px] uppercase tracking-widest font-black ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-gray-400'}`}>
                    Active Time
                </span>
                <span className={`font-mono font-bold ${isClay ? 'text-[color:var(--clay-text)]' : 'text-gray-700'}`}>
                    {formatTime(localActiveSeconds)}
                </span>
            </div>
            <div className={`text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-wider ${isClay ? (isActive ? 'ui-clay-chip-success' : 'ui-clay-surface text-[color:var(--clay-text-soft)]') : (isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}`}>
                {isActive ? 'Active' : 'Paused'}
            </div>
            <div className={`text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-wider hidden sm:block ${isClay ? 'ui-clay-surface text-[color:var(--clay-text-soft)]' : 'bg-primary-light/50 text-primary-dark'}`}>
                {contextLabel}
            </div>
        </motion.div>
    );
};

export default TimerWidget;
