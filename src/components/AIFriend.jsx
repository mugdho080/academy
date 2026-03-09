import React, { useMemo, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, MessageCircle } from 'lucide-react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import AnimatedPanda from './AnimatedPanda';
import { useCoach } from '../context/CoachContext';

const AIFriend = ({ context, floating = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { message, state, profile, setPanelOpen } = useCoach();

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
        <div className={`rounded-full shadow-2xl flex items-center justify-center relative transition-all ${isConnected ? 'bg-green-100' : 'bg-white'} ${className}`}>
            <AnimatedPanda
                mood={message?.mood || 'calm'}
                isSpeaking={isSpeaking}
                isListening={isConnected && !isSpeaking}
                className="w-full h-full p-2"
            />
        </div>
    );

    return (
        <div className={`transition-all ${floating ? 'fixed bottom-4 right-4 z-[100] flex flex-col items-end' : 'w-full h-full flex flex-col items-center justify-center'}`}>
            {(isOpen || !floating) && (
                <div className={`bg-white shadow-2xl flex flex-col animate-slide-up items-center justify-center p-6 ${floating ? 'w-80 rounded-3xl border-4 border-[#3B1B54] mb-4 relative' : 'w-full rounded-[2.5rem] border-0 shrink-0 relative'}`}>
                    {floating && (
                        <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800">
                            <X size={20} />
                        </button>
                    )}

                    <h3 className="text-xl font-black text-[#00695C] italic mb-3">Panda Coach Voice</h3>
                    <p className="text-xs text-slate-500 text-center mb-4 font-semibold">
                        {message?.message || 'I can guide you with short, calm instructions.'}
                    </p>

                    <PandaAvatar className="w-36 h-36 mb-6" />

                    <div className="flex flex-col items-center gap-3 w-full">
                        <button
                            onClick={toggleConnection}
                            className={`w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 ${isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-[#00897B] hover:bg-[#00695C]'}`}
                        >
                            {isConnected ? <MicOff size={24} /> : <Mic size={24} />}
                            {isConnected ? 'End Voice' : 'Start Voice'}
                        </button>

                        {isConnected && (
                            <button onClick={toggleMute} className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-colors ${isMuted ? 'border-red-500 text-red-500' : 'border-gray-200 text-gray-500'}`}>
                                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                {isMuted ? 'Unmute Voice' : 'Mute Voice'}
                            </button>
                        )}

                        <button
                            onClick={() => setPanelOpen(true)}
                            className="w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 border-[#00695C]/30 text-[#00695C] hover:bg-[#f2fbf9]"
                        >
                            <MessageCircle size={18} />
                            Open Coach Panel
                        </button>
                    </div>

                    <p className="mt-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">
                        {error ? <span className="text-red-500">{error}</span> : isConnected ? (isSpeaking ? 'Speaking' : 'Listening') : (state?.frustration_band || 'Ready')}
                    </p>
                </div>
            )}

            {floating && !isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="relative group transition-transform hover:scale-105 active:scale-95"
                >
                    <div className="absolute right-full mr-4 top-0 bg-white px-4 py-2 rounded-2xl rounded-tr-none shadow-lg whitespace-nowrap">
                        <p className="font-black text-[#00695C] text-xs uppercase">Panda Coach</p>
                    </div>
                    <PandaAvatar className="w-20 h-20" />
                </button>
            )}
        </div>
    );
};

export default AIFriend;
