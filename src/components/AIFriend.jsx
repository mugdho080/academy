import React, { useMemo, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, MessageCircle } from 'lucide-react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import AnimatedPanda from './AnimatedPanda';
import { useCoach } from '../context/CoachContext';

const AIFriend = ({ context, floating = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { message, state, profile, setPanelOpen } = useCoach();
    const isClay = false;

    const contextPrompt = useMemo(() => {
        if (!context) return '';
        return [
            `Current chapter: ${context.chapter || 'Unknown'}.`,
            `Current lesson: ${context.lesson || 'Unknown'}.`,
            `Lesson excerpt: ${(context.content || '').substring(0, 260)}.`,
            `Frustration band: ${context.frustrationBand || 'normal'}.`,
            `Recommended action: ${context.recommendedAction || 'none'}.`
        ].join(' ');
    }, [context]);

    const liveOptions = useMemo(() => ({
        contextPrompt,
        coachMode: 'teaching',
        intent: message?.intent || 'navigation_help',
        sensoryMode: profile?.sensory_mode || 'calm',
        ageBand: context?.ageBand || profile?.age_band || 'age_20_40',
        maxWords: 50
    }), [context?.ageBand, contextPrompt, message?.intent, profile?.age_band, profile?.sensory_mode]);

    const {
        connect,
        disconnect,
        toggleMute,
        isConnected,
        isSpeaking,
        isMuted,
        error
    } = useGeminiLive(liveOptions);

    const toggleConnection = () => {
        if (isConnected) disconnect();
        else connect();
    };

    const PandaAvatar = ({ className }) => (
        <div className={`rounded-full shadow-2xl flex items-center justify-center relative transition-all ${isClay ? 'ui-clay-surface' : isConnected ? 'bg-green-100' : 'bg-white'} ${className}`}>
            <AnimatedPanda
                mood={message?.mood || 'calm'}
                isSpeaking={isSpeaking}
                isListening={isConnected && !isSpeaking}
                className="w-full h-full p-2"
            />
        </div>
    );

    return (
        <div className={`transition-all ${floating ? 'fixed bottom-24 right-3 sm:right-4 z-[100] flex flex-col items-end max-w-[calc(100vw-1rem)]' : 'w-full h-full flex flex-col items-center justify-center'}`}>
            {(isOpen || !floating) && (
                <div className={`flex flex-col animate-slide-up items-center justify-center p-4 sm:p-6 ${floating ? 'w-[min(320px,calc(100vw-1rem))] rounded-2xl sm:rounded-3xl mb-3 sm:mb-4 relative' : 'w-full rounded-[2rem] sm:rounded-[2.5rem] border-0 shrink-0 relative'} ${isClay ? 'ui-clay-overlay-panel' : 'bg-white shadow-2xl'} ${floating && !isClay ? 'border-4 border-[#3B1B54]' : ''}`}>
                    {floating && (
                        <button onClick={() => setIsOpen(false)} className={`absolute top-3 right-3 p-1 rounded ${isClay ? 'text-[color:var(--clay-text-soft)] hover:text-[color:var(--clay-text)]' : 'text-gray-400 hover:text-gray-800'}`}>
                            <X size={20} />
                        </button>
                    )}

                    <h3 className={`text-lg sm:text-xl font-black italic mb-2 sm:mb-3 ${isClay ? 'text-[#21A7F1]' : 'text-[#00695C]'}`}>Panda Coach Voice</h3>
                    <p className={`text-xs text-center mb-4 font-semibold ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-500'}`}>
                        {message?.message || 'I can guide you with short, calm instructions.'}
                    </p>

                    <PandaAvatar className="w-28 h-28 sm:w-36 sm:h-36 mb-4 sm:mb-6" />

                    <div className="flex flex-col items-center gap-3 w-full">
                        <button
                            onClick={toggleConnection}
                            className={`w-full py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 ${isClay ? (isConnected ? 'ui-clay-button-danger' : 'ui-clay-button-primary') : isConnected ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-[#00897B] hover:bg-[#00695C] text-white'}`}
                        >
                            {isConnected ? <MicOff size={24} /> : <Mic size={24} />}
                            {isConnected ? 'End Voice' : 'Start Voice'}
                        </button>

                        {isConnected && (
                            <button onClick={toggleMute} className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors ${isClay ? (isMuted ? 'ui-clay-button-danger' : 'ui-clay-button-secondary') : `border-2 ${isMuted ? 'border-red-500 text-red-500' : 'border-gray-200 text-gray-500'}`}`}>
                                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                {isMuted ? 'Unmute Voice' : 'Mute Voice'}
                            </button>
                        )}

                        <button
                            onClick={() => setPanelOpen(true)}
                            className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 ${isClay ? 'ui-clay-button-secondary' : 'border-2 border-[#00695C]/30 text-[#00695C] hover:bg-[#f2fbf9]'}`}
                        >
                            <MessageCircle size={18} />
                            Open Coach Panel
                        </button>
                    </div>

                    <p className={`mt-4 text-xs font-bold uppercase tracking-widest text-center ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-gray-500'}`}>
                        {error ? <span className="text-red-500">{error}</span> : isConnected ? (isSpeaking ? 'Speaking' : 'Listening') : (state?.frustration_band || 'Ready')}
                    </p>
                </div>
            )}

            {floating && !isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="relative group transition-transform hover:scale-105 active:scale-95"
                >
                    <div className={`absolute right-full mr-2 sm:mr-4 top-1 px-3 py-1.5 rounded-2xl rounded-tr-none whitespace-nowrap hidden sm:block ${isClay ? 'ui-clay-surface' : 'bg-white shadow-lg'}`}>
                        <p className={`font-black text-xs uppercase ${isClay ? 'text-[#21A7F1]' : 'text-[#00695C]'}`}>Panda Coach</p>
                    </div>
                    <PandaAvatar className="w-16 h-16 sm:w-20 sm:h-20" />
                </button>
            )}
        </div>
    );
};

export default AIFriend;
