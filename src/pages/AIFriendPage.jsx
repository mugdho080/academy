import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { Mic, MicOff, Volume2, VolumeX, ArrowLeft, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AICharacter from '../components/AICharacter';
import SensoryBackground from '../components/SensoryBackground';

const AIFriendPage = () => {
    const navigate = useNavigate();
    const { connect, disconnect, toggleMute, isConnected, isSpeaking, isMuted, mood, error, logs } = useGeminiLive();
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

    const toggleConnection = () => {
        if (isConnected) disconnect();
        else connect();
    };

    return (
        <div className="min-h-screen bg-[#e0f7fa] font-sans text-[#00695C] relative overflow-hidden flex flex-col">
            <SensoryBackground />

            {/* Header */}
            <header className="p-6 flex items-center justify-between relative z-20 bg-white/80 backdrop-blur-md shadow-sm">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#00695C] shadow-lg border-2 border-[#00695C]/20 hover:scale-110 transition-transform"
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-4xl font-black text-[#00695C] italic tracking-tighter uppercase">My AI Friend</h1>
                <div className="w-12"></div> {/* Spacer */}
            </header>

            {/* Main Interaction Area */}
            <main className="flex-1 flex flex-col items-center justify-center relative p-6 z-10">

                {/* Character Stage */}
                <div className="relative w-full max-w-lg aspect-square mb-8">
                    {/* Ripple/Aura Effect when Talking */}
                    {isSpeaking && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="absolute w-64 h-64 bg-[#00695C] rounded-full opacity-10 animate-ping" />
                            <span className="absolute w-80 h-80 bg-[#00695C] rounded-full opacity-5 animate-ping [animation-delay:0.2s]" />
                        </div>
                    )}

                    {/* The Friend */}
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

                    {/* Connection Status Ring */}
                    <div
                        className={`absolute inset-0 rounded-full border-4 border-[#00695C] opacity-30 ${isConnected ? 'animate-pulse' : 'border-dashed'}`}
                    />
                </div>

                {/* Interaction Controls */}
                <div className="w-full max-w-md bg-white/90 backdrop-blur-lg rounded-[2.5rem] p-4 shadow-2xl border-4 border-[#00695C]/10 relative">

                    {/* Status Indicator */}
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border shadow-sm flex items-center gap-2 ${isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        {isConnected ? 'Friend Online' : 'Connecting...'}
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-4">
                        <button
                            onClick={toggleConnection}
                            className={`
                                w-24 h-24 rounded-full flex items-center justify-center shadow-xl border-4 transition-all transform hover:scale-105 active:scale-95
                                ${isConnected
                                    ? 'bg-red-500 border-red-200 text-white animate-pulse shadow-red-200'
                                    : 'bg-[#00897B] border-teal-200 text-white shadow-teal-200'
                                }
                            `}
                        >
                            {isConnected ? <MicOff size={40} /> : <Mic size={40} />}
                        </button>
                    </div>

                    <p className="text-center font-bold text-[#00695C]/60 mt-4 mb-2 uppercase tracking-wider text-sm">
                        {error ? <span className="text-red-500">{error}</span> : isConnected ? (isSpeaking ? "I'm thinking..." : "I'm listening...") : "Tap to connect!"}
                    </p>
                </div>

                {/* Text Chat Toggle (Optional Future) */}
                <div className="mt-8">
                    <button className="bg-[#00695C] text-white px-10 py-5 rounded-3xl font-black text-2xl shadow-[0_10px_20px_rgba(0,105,92,0.3)] hover:scale-105 transition-transform flex items-center gap-3">
                        <MessageCircle size={28} />
                        Text Chat
                    </button>
                </div>

            </main>

            {/* Mute/Settings Fab */}
            <div className="fixed top-6 right-6 z-50">
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 transition-all ${isMuted ? 'bg-red-100 text-red-500 border-red-200' : 'bg-white text-[#00695C] border-[#00695C]/20 hover:bg-gray-50'}`}
                >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
            </div>

            {/* DEBUG LOGS */}
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
