import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { Mic, MicOff, Volume2, VolumeX, ArrowLeft, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AICharacter from '../components/AICharacter';
import SensoryBackground from '../components/SensoryBackground';

const AIFriendPage = () => {
    const navigate = useNavigate();
    const { connect, disconnect, toggleMute, isConnected, isSpeaking, isMuted, mood, error, logs } = useGeminiLive({
        coachMode: 'encouragement',
        intent: 'navigation_help',
        sensoryMode: 'calm',
        ageBand: 'age_20_40',
        maxWords: 60
    });
    const isClay = false;
    const toggleConnection = () => {
        if (isConnected) disconnect();
        else connect();
    };

    return (
        <div className={`min-h-screen safe-mobile-height font-sans relative overflow-hidden flex flex-col ${isClay ? 'ui-clay-page text-[color:var(--clay-text)]' : 'bg-[#e0f7fa] text-[#00695C]'}`}>
            <SensoryBackground />

            <header className={`px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between relative z-20 gap-3 ${isClay ? 'ui-clay-topbar' : 'bg-white/85 backdrop-blur-md shadow-sm'}`}>
                <button
                    onClick={() => navigate('/dashboard')}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform ${isClay ? 'ui-clay-button-secondary text-[#21A7F1]' : 'bg-white text-[#00695C] border-2 border-[#00695C]/20'}`}
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className={`text-xl sm:text-3xl md:text-4xl font-black italic tracking-tighter uppercase text-center ${isClay ? 'ui-clay-heading' : 'text-[#00695C]'}`}>My AI Friend</h1>
                <div className="w-11 sm:w-12"></div> {/* Spacer */}
            </header>

            <main className="flex-1 flex flex-col items-center justify-center relative p-3 sm:p-6 z-10">
                <div className="relative w-full max-w-[min(28rem,88vw)] aspect-square mb-5 sm:mb-8">
                    {isSpeaking && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className={`absolute w-64 h-64 rounded-full opacity-10 animate-ping ${isClay ? 'bg-[#21A7F1]' : 'bg-[#00695C]'}`} />
                            <span className={`absolute w-80 h-80 rounded-full opacity-5 animate-ping [animation-delay:0.2s] ${isClay ? 'bg-[#21A7F1]' : 'bg-[#00695C]'}`} />
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={mood}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full h-full flex items-center justify-center"
                        >
                            <AICharacter mood={mood} isSpeaking={isSpeaking} />
                        </motion.div>
                    </AnimatePresence>

                    <div
                        className={`absolute inset-0 rounded-full border-4 opacity-30 ${isClay ? 'border-[#21A7F1]' : 'border-[#00695C]'} ${isConnected ? 'animate-pulse' : 'border-dashed'}`}
                    />
                </div>

                <div className={`w-full max-w-md rounded-[2rem] sm:rounded-[2.5rem] p-4 relative ${isClay ? 'ui-clay-surface' : 'bg-white/90 backdrop-blur-lg shadow-2xl border-4 border-[#00695C]/10'}`}>
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border shadow-sm flex items-center gap-2 ${isClay ? (isConnected ? 'ui-clay-chip-success' : 'ui-clay-chip-danger') : isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        {isConnected ? 'Friend Online' : 'Connecting...'}
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-4">
                        <button
                            onClick={toggleConnection}
                            className={`
                                w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-xl border-4 transition-all transform hover:scale-105 active:scale-95
                                ${isConnected
                                    ? isClay ? 'bg-[#ff8475] border-white text-white animate-pulse shadow-red-200' : 'bg-red-500 border-red-200 text-white animate-pulse shadow-red-200'
                                    : isClay ? 'bg-[linear-gradient(135deg,#81c9ff,#21A7F1)] border-white text-white shadow-sky-200' : 'bg-[#00897B] border-teal-200 text-white shadow-teal-200'
                                }
                            `}
                        >
                            {isConnected ? <MicOff size={40} /> : <Mic size={40} />}
                        </button>
                    </div>

                    <p className={`text-center font-bold mt-4 mb-2 uppercase tracking-wider text-sm ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-[#00695C]/60'}`}>
                        {error ? <span className="text-red-500">{error}</span> : isConnected ? (isSpeaking ? "I'm thinking..." : "I'm listening...") : "Tap to connect!"}
                    </p>
                </div>

                <div className="mt-5 sm:mt-8">
                    <button className={`px-6 sm:px-10 py-3.5 sm:py-5 rounded-3xl font-black text-lg sm:text-2xl hover:scale-105 transition-transform flex items-center gap-3 ${isClay ? 'ui-clay-button-primary' : 'bg-[#00695C] text-white shadow-[0_10px_20px_rgba(0,105,92,0.3)]'}`}>
                        <MessageCircle size={24} />
                        Text Chat
                    </button>
                </div>

            </main>

            <div className="fixed top-20 sm:top-6 right-4 sm:right-6 z-50">
                <button
                    onClick={toggleMute}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 transition-all ${isClay ? (isMuted ? 'ui-clay-button-danger' : 'ui-clay-button-secondary text-[#21A7F1]') : isMuted ? 'bg-red-100 text-red-500 border-red-200' : 'bg-white text-[#00695C] border-[#00695C]/20 hover:bg-gray-50'}`}
                >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
            </div>

            <div className="mt-8 w-full max-w-md bg-black/80 rounded-lg p-4 font-mono text-xs text-green-400 h-40 overflow-y-auto hidden">
                <p className="font-bold text-white mb-2 border-b border-gray-600 pb-1">DEBUG CONSOLE:</p>
                {logs && logs.map((log, i) => (
                    <div key={i} className="mb-1 leading-tight border-l-2 border-gray-600 pl-2">{log}</div>
                ))}
            </div>

        </div>
    );
};

export default AIFriendPage;
