import React from 'react';
import AnimatedPanda from './AnimatedPanda';
import { useCoach } from '../context/CoachContext';

const PandaCoachBubble = () => {
    const { bubbleVisible, dismissBubble, panelOpen, setPanelOpen, message } = useCoach();
    const isClay = false;

    if (!bubbleVisible || panelOpen || !message?.message) return null;

    return (
        <div className="fixed right-2 bottom-20 sm:right-4 sm:bottom-20 lg:bottom-5 z-[120]">
            <button
                type="button"
                onClick={() => {
                    setPanelOpen(true);
                    dismissBubble();
                }}
                className="transition-transform hover:scale-105 active:scale-95"
                aria-label="Open Panda Coach panel"
            >
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full p-1.5 shrink-0 shadow-xl ${isClay ? 'ui-clay-inset-surface border border-white/70' : 'bg-[#f2fbf9] border border-[#cde8e2]'}`}>
                    <AnimatedPanda
                        mood={message.mood || 'calm'}
                        isSpeaking={message.animation_state === 'speaking'}
                        isListening={false}
                    />
                </div>
            </button>
        </div>
    );
};

export default PandaCoachBubble;
