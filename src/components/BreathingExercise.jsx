import React, { useState, useEffect } from 'react';

const BreathingExercise = () => {
    const [isBreathing, setIsBreathing] = useState(false);
    const [text, setText] = useState("Tap to Breathe");

    useEffect(() => {
        let interval;
        if (isBreathing) {
            let phase = 'in'; // 'in' or 'out'
            setText("Breathe In...");

            interval = setInterval(() => {
                phase = phase === 'in' ? 'out' : 'in';
                setText(phase === 'in' ? "Breathe In..." : "Breathe Out...");
            }, 4000); // 4 seconds in, 4 seconds out
        } else {
            setText("Tap to Breathe");
        }
        return () => clearInterval(interval);
    }, [isBreathing]);

    return (
        <div
            onClick={() => setIsBreathing(!isBreathing)}
            className="flex flex-col items-center justify-center p-4 cursor-pointer group"
        >
            <div className={`
                w-24 h-24 rounded-full bg-gradient-to-tr from-teal-400 to-teal-200 shadow-xl flex items-center justify-center transition-all duration-[4000ms] ease-in-out relative
                ${isBreathing ? 'scale-125' : 'scale-100 hover:scale-105 active:scale-95'}
            `}>
                <div className={`absolute inset-0 bg-white/30 rounded-full blur-xl transition-all duration-[4000ms] ${isBreathing ? 'opacity-100 scale-150' : 'opacity-0 scale-100'}`} />
            </div>
            <p className="mt-3 text-teal-800 font-bold text-sm uppercase tracking-wider">{text}</p>
            <p className="text-[10px] text-teal-600/60">Tap to start/stop</p>
        </div>
    );
};

export default BreathingExercise;
