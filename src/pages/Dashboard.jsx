import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, BookOpen, Play, Clock } from 'lucide-react';
import axios from 'axios';
import SensoryBackground from '../components/SensoryBackground';
import AvatarSelector from '../components/AvatarSelector';
import { useCoach } from '../context/CoachContext';

const quotes = [
    "You are capable of amazing things! ✨",
    "Every expert was once a beginner. 🌟",
    "Your potential is endless! 🌈",
    "Believe in yourself, we do! 💖",
    "Learning is a superpower! 🦸‍♂️"
];

const avatarsMap = {
    koala: '🐨', lion: '🦁', fox: '🦊', owl: '🦉', unicorn: '🦄', dragon: '🐲'
};

const Dashboard = () => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [quoteIndex, setQuoteIndex] = useState(0);
    const [chapters, setChapters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAvatarOpen, setIsAvatarOpen] = useState(false);
    const welcomedRef = useRef(false);
    const navigate = useNavigate();
    const {
        recommendation,
        message: coachMessage,
        requestCoachMessage,
        emitCoachEvent,
        setPanelOpen
    } = useCoach();

    useEffect(() => {
        const timer = setInterval(() => {
            setQuoteIndex((prev) => (prev + 1) % quotes.length);
        }, 6000);

        fetchChapters();
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (welcomedRef.current) return;
        welcomedRef.current = true;
        emitCoachEvent('session_resume', { route: '/dashboard' }, { immediate: true });
        requestCoachMessage('session_resume', { intent: 'welcome' }, { forceBubble: true, force: true });
    }, [emitCoachEvent, requestCoachMessage]);

    const fetchChapters = async () => {
        try {
            const response = await axios.get('/api/learner/chapters.php');
            setChapters(response.data);
        } catch (err) {
            console.error("Failed to fetch chapters", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAvatar = async (avatarId) => {
        try {
            const res = await axios.post('/api/learner/update_user_progress.php', {
                user_id: user.id,
                avatar: avatarId
            });
            if (res.data.success) {
                const updatedUser = { ...user, avatar: avatarId };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);
            }
        } catch (err) {
            console.error("Failed to update avatar", err);
        }
    };

    return (
        <div className="h-full w-full relative overflow-auto scrollbar-hide flex flex-col font-sans">

            <AvatarSelector
                isOpen={isAvatarOpen}
                onClose={() => setIsAvatarOpen(false)}
                currentAvatar={user.avatar || 'koala'}
                userPoints={user.points || 0}
                onSelect={handleSelectAvatar}
            />

            {/* Welcome Area */}
            <header className="relative z-10 p-10 pt-12">
                <div className="flex justify-between items-end">
                    <div>
                        <motion.h1
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="text-5xl font-black text-[#3B1B54] italic tracking-tighter uppercase leading-none"
                        >
                            G'day <span className="text-white drop-shadow-md">{user.name}!</span> 👋
                        </motion.h1>

                        <div className="mt-6 flex items-center gap-4">
                            <div className="bg-[#00695C] text-white px-6 py-3 rounded-2xl shadow-xl border-2 border-white/20">
                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={quoteIndex}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 1.1 }}
                                        className="text-lg font-black italic tracking-tight"
                                    >
                                        "{quotes[quoteIndex]}"
                                    </motion.p>
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="mt-4 bg-white/90 border border-white rounded-2xl shadow-lg p-4 max-w-xl">
                            <p className="text-[10px] uppercase tracking-[0.14em] font-black text-slate-400 mb-1">
                                Panda Coach
                            </p>
                            <p className="text-sm font-bold text-[#00695C] leading-snug">
                                {coachMessage?.message || 'I can help you continue where you left off with one easy step.'}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    onClick={() => {
                                        if (recommendation?.recommended_route) {
                                            navigate(recommendation.recommended_route, {
                                                state: recommendation?.recommended_lesson_id
                                                    ? { recommendedLessonId: recommendation.recommended_lesson_id }
                                                    : undefined
                                            });
                                        }
                                    }}
                                    className="px-3 py-1.5 rounded-full bg-[#00695C] text-white text-xs font-black uppercase tracking-wider"
                                >
                                    Continue Path
                                </button>
                                <button
                                    onClick={() => setPanelOpen(true)}
                                    className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-wider"
                                >
                                    Open Coach
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* AI Avatar / Progress Summary */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        onClick={() => setIsAvatarOpen(true)}
                        className="bg-white/90 backdrop-blur-md p-6 rounded-[3rem] shadow-2xl border-4 border-[#00695C] flex items-center gap-6 cursor-pointer hover:scale-105 transition-transform group"
                    >
                        <div className="relative">
                            <div className="w-20 h-20 bg-[#00897B] rounded-full flex items-center justify-center text-5xl shadow-lg border-4 border-white group-hover:rotate-12 transition-transform">
                                {avatarsMap[user.avatar || 'koala']}
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-[#00695C] shadow-md group-hover:scale-110 transition-transform">
                                <Star size={18} fill="#00695C" className="text-[#00695C]" />
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00695C] opacity-50">Your Rank</p>
                            <h3 className="text-xl font-black text-[#00897B] italic tracking-tighter uppercase">SUPER DISCOVERER</h3>
                            <div className="w-64 h-3 bg-gray-200 rounded-full mt-2 overflow-hidden border border-[#00695C]/10 relative">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (user.points / 1000) * 100)}%` }}
                                    className="h-full bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]"
                                />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-[8px] font-black text-[#00695C] opacity-40 uppercase tracking-widest">{user.points || 0} / 1000 XP</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </header>

            <main className="relative z-10 flex-1 p-10">
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 bg-[#00695C] rounded-lg rotate-12 flex items-center justify-center text-white shadow-lg">
                        <BookOpen size={24} />
                    </div>
                    <h2 className="text-3xl font-black text-[#00695C] italic tracking-tighter uppercase">Pick a World to Explore</h2>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {[1, 2, 3].map(i => <div key={i} className="h-72 bg-white/20 animate-pulse rounded-[3rem]" />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 pb-20">
                        {chapters.map((chapter) => (
                            <motion.div
                                key={chapter.id}
                                whileHover={{ y: -15, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(`/chapter/${chapter.id}`)}
                                className="bg-white p-8 rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border-[6px] border-white hover:border-[#00897B] transition-all cursor-pointer group relative overflow-hidden"
                            >
                                {/* Decorative background pattern */}
                                <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-150 transition-transform duration-1000">
                                    <Star size={100} fill="currentColor" />
                                </div>

                                <div className="text-8xl mb-6 transform group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 drop-shadow-xl inline-block">
                                    {chapter.emoji || '🤖'}
                                </div>
                                <h3 className="text-3xl font-black text-[#00695C] italic tracking-tighter uppercase leading-none mb-3">
                                    {chapter.title}
                                </h3>

                                <div className="flex items-center justify-between mt-8 relative z-10">
                                    <div className="bg-[#00897B] text-white px-5 py-2 rounded-2xl font-black text-xs tracking-widest uppercase italic shadow-lg">
                                        {chapter.levels?.length || 0} SECTIONS
                                    </div>
                                    <div className="w-14 h-14 bg-yellow-400 rounded-[1.2rem] flex items-center justify-center shadow-xl group-hover:bg-[#00695C] group-hover:text-white transition-colors duration-300">
                                        <Play size={28} fill="currentColor" className="ml-1" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>

        </div>
    );
};

export default Dashboard;
