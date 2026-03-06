import React from 'react';
import { useActivityTimer } from '../context/ActivityTimerProvider';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';

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

    const contextLabel = currentContext?.context_type
        ? currentContext.context_type.charAt(0).toUpperCase() + currentContext.context_type.slice(1)
        : 'Dashboard';

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border-2 border-primary-light"
        >
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                className="text-primary"
            >
                <Clock size={20} />
            </motion.div>
            <div className="flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-widest font-black text-gray-400">
                    Active Time
                </span>
                <span className="font-mono font-bold text-gray-700">
                    {formatTime(localActiveSeconds)}
                </span>
            </div>
            <div className={`text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-wider ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {isActive ? 'Active' : 'Paused'}
            </div>
            <div className="text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-wider bg-primary-light/50 text-primary-dark">
                {contextLabel}
            </div>
        </motion.div>
    );
};

export default TimerWidget;
