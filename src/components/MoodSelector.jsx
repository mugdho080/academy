import React, { useState } from 'react';
import { Smile, Frown, Meh, Zap } from 'lucide-react';

const MoodSelector = () => {
    const [selectedMood, setSelectedMood] = useState(null);

    const moods = [
        { id: 'calm', icon: <Meh />, label: 'Calm', color: 'bg-teal-100 text-teal-600' },
        { id: 'happy', icon: <Smile />, label: 'Happy', color: 'bg-yellow-100 text-yellow-600' },
        { id: 'worried', icon: <Frown />, label: 'Worried', color: 'bg-orange-100 text-orange-600' },
        { id: 'excited', icon: <Zap />, label: 'Excited', color: 'bg-purple-100 text-purple-600' },
    ];

    return (
        <div className="flex flex-col items-center gap-4 bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white/40">
            <h3 className="text-teal-800 font-bold text-sm uppercase tracking-wider">How are you feeling?</h3>
            <div className="flex gap-4">
                {moods.map((mood) => (
                    <button
                        key={mood.id}
                        onClick={() => setSelectedMood(mood.id)}
                        className={`
                            flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-300
                            ${selectedMood === mood.id ? `${mood.color} ring-2 ring-offset-2 ring-teal-200 scale-110 shadow-lg` : 'bg-white text-gray-400 hover:bg-gray-50 hover:scale-105 shadow-sm'}
                        `}
                    >
                        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50">
                            {mood.icon}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">{mood.label}</span>
                    </button>
                ))}
            </div>
            {selectedMood && (
                <p className="text-xs text-teal-600 font-medium animate-pulse">Thanks for sharing! 🌿</p>
            )}
        </div>
    );
};

export default MoodSelector;
