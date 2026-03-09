import React from 'react';
import { MessageCircle, X } from 'lucide-react';
import AnimatedPanda from './AnimatedPanda';
import PandaCoachNavigator from './PandaCoachNavigator';
import { useCoach } from '../context/CoachContext';

const PandaCoachBubble = () => {
    const { bubbleVisible, dismissBubble, panelOpen, setPanelOpen, message } = useCoach();

    if (!bubbleVisible || panelOpen || !message?.message) return null;

    return (
        <div className="fixed right-5 bottom-5 z-[120] w-[320px] max-w-[calc(100vw-2rem)]">
            <div className="bg-white rounded-3xl shadow-2xl border border-[#dbe8e6] p-4">
                <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-full bg-[#f2fbf9] border border-[#cde8e2] p-1.5 shrink-0">
                        <AnimatedPanda
                            mood={message.mood || 'calm'}
                            isSpeaking={message.animation_state === 'speaking'}
                            isListening={false}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400 font-black mb-1">
                            Panda Coach
                        </p>
                        <p className="text-sm font-semibold text-slate-700 leading-snug">{message.message}</p>
                        <div className="mt-3">
                            <PandaCoachNavigator compact={true} onAction={dismissBubble} />
                        </div>
                    </div>
                    <button
                        onClick={dismissBubble}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Dismiss coach bubble"
                    >
                        <X size={16} />
                    </button>
                </div>

                <button
                    onClick={() => {
                        setPanelOpen(true);
                        dismissBubble();
                    }}
                    className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#00695C] hover:text-[#004d42]"
                >
                    <MessageCircle size={14} />
                    Open Coach Panel
                </button>
            </div>
        </div>
    );
};

export default PandaCoachBubble;
