import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, BookOpen, Play } from 'lucide-react';
import axios from 'axios';
import SensoryBackground from '../components/SensoryBackground';
import AvatarSelector from '../components/AvatarSelector';
import { useCoach } from '../context/CoachContext';
import PageContainer from '../components/layout/PageContainer';
import ActionGroup from '../components/layout/ActionGroup';

const quotes = [
    'You are capable of amazing things.',
    'Every expert was once a beginner.',
    'Your potential is endless.',
    'Believe in yourself, we do.',
    'Learning is a superpower.'
];

const avatarsMap = {
    koala: '??',
    lion: '??',
    fox: '??',
    owl: '??',
    unicorn: '??',
    dragon: '??'
};

const Dashboard = () => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [quoteIndex, setQuoteIndex] = useState(0);
    const [chapters, setChapters] = useState([]);
    const [progressData, setProgressData] = useState({});
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
    const isClay = false;

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
            const [chaptersRes, progressRes] = await Promise.all([
                axios.get('/api/learner/chapters.php'),
                user.id ? axios.get(`/api/learner/get_chapter_progress.php?user_id=${user.id}`) : Promise.resolve({ data: null })
            ]);
            
            setChapters(chaptersRes.data);
            
            if (progressRes.data?.success) {
                const progMap = {};
                progressRes.data.progress.forEach(p => {
                    progMap[p.chapter_id] = p;
                });
                setProgressData(progMap);
            }
        } catch (err) {
            console.error('Failed to fetch chapters or progress', err);
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
            console.error('Failed to update avatar', err);
        }
    };

    return (
        <div className={`h-full w-full relative overflow-auto scrollbar-hide flex flex-col font-sans safe-mobile-height ${isClay ? 'ui-clay-page' : ''}`}>
            <SensoryBackground />

            <AvatarSelector
                isOpen={isAvatarOpen}
                onClose={() => setIsAvatarOpen(false)}
                currentAvatar={user.avatar || 'koala'}
                userPoints={user.points || 0}
                onSelect={handleSelectAvatar}
            />

            <PageContainer className="relative z-10 space-y-6 md:space-y-8 pb-24 lg:pb-10">
                <header className="space-y-4">
                    <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                        <div className="space-y-4">
                            <motion.h1
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className={`text-3xl sm:text-4xl lg:text-5xl font-black italic tracking-tight uppercase leading-tight ${isClay ? 'ui-clay-heading' : 'text-[#3B1B54]'}`}
                            >
                                Hello <span className={isClay ? 'text-[#21A7F1]' : 'text-white drop-shadow-md'}>{user.name || 'Learner'}</span>
                            </motion.h1>

                            <div className={`px-4 sm:px-5 py-3 rounded-2xl max-w-2xl ${isClay ? 'ui-clay-hero text-[color:var(--clay-text)]' : 'bg-[#00695C] text-white shadow-xl border-2 border-white/20'}`}>
                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={quoteIndex}
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 1.02 }}
                                        className="text-base sm:text-lg font-black italic tracking-tight"
                                    >
                                        "{quotes[quoteIndex]}"
                                    </motion.p>
                                </AnimatePresence>
                            </div>

                            <div className="content-card p-4 max-w-2xl">
                                <p className="text-[10px] uppercase tracking-[0.14em] font-black text-slate-400 mb-1">Panda Coach</p>
                                <p className="text-sm sm:text-base font-bold text-[#00695C] leading-snug">
                                    {coachMessage?.message || 'I can help you continue where you left off with one easy step.'}
                                </p>
                                <ActionGroup className="mt-3">
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
                                        className={`px-4 py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider ${isClay ? 'ui-clay-button-primary' : 'bg-[#00695C] text-white'}`}
                                    >
                                        Continue Path
                                    </button>
                                    <button
                                        onClick={() => setPanelOpen(true)}
                                        className={`px-4 py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider ${isClay ? 'ui-clay-button-secondary' : 'bg-white border border-slate-200 text-slate-600'}`}
                                    >
                                        Open Coach
                                    </button>
                                </ActionGroup>
                            </div>
                        </div>

                        <motion.button
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={() => setIsAvatarOpen(true)}
                            className={`p-4 sm:p-5 rounded-[2rem] flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-transform group w-full xl:w-auto ${isClay ? 'ui-clay-surface border border-white/70' : 'bg-white/90 backdrop-blur-md shadow-2xl border-4 border-[#00695C]'}`}
                        >
                            <div className="relative">
                                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-4xl sm:text-5xl shadow-lg border-4 group-hover:rotate-6 transition-transform ${isClay ? 'bg-gradient-to-br from-[#8fd4ff] to-[#21A7F1] border-white text-white' : 'bg-[#00897B] border-white'}`}>
                                    {avatarsMap[user.avatar || 'koala']}
                                </div>
                                <div className={`absolute -bottom-2 -right-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-4 shadow-md ${isClay ? 'bg-[#ffd45a] border-white' : 'bg-yellow-400 border-[#00695C]'}`}>
                                    <Star size={14} fill={isClay ? '#1f6eb3' : '#00695C'} className={isClay ? 'text-[#1f6eb3]' : 'text-[#00695C]'} />
                                </div>
                            </div>
                            <div className="min-w-0 text-left">
                                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-[#00695C] opacity-60'}`}>Your Rank</p>
                                <h3 className={`text-base sm:text-xl font-black italic tracking-tight uppercase ${isClay ? 'text-[#21A7F1]' : 'text-[#00897B]'}`}>Super Discoverer</h3>
                                <div className={`w-full sm:w-56 h-3 rounded-full mt-2 overflow-hidden relative ${isClay ? 'ui-clay-progress-track border border-white/70' : 'bg-gray-200 border border-[#00695C]/10'}`}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, ((user.points || 0) / 1000) * 100)}%` }}
                                        className={`h-full ${isClay ? 'ui-clay-progress-bar' : 'bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]'}`}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-[#00695C] opacity-50'}`}>{user.points || 0} / 1000 XP</span>
                                    </div>
                                </div>
                            </div>
                        </motion.button>
                    </div>
                </header>

                <main className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg rotate-12 flex items-center justify-center shadow-lg ${isClay ? 'ui-clay-icon-pocket text-[#21A7F1]' : 'bg-[#00695C] text-white'}`}>
                            <BookOpen size={22} />
                        </div>
                        <h2 className={`text-2xl sm:text-3xl font-black italic tracking-tight uppercase ${isClay ? 'ui-clay-heading' : 'text-[#00695C]'}`}>Pick a World to Explore</h2>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                            {[1, 2, 3].map((i) => <div key={i} className={`h-52 sm:h-64 animate-pulse rounded-[2rem] ${isClay ? 'ui-clay-surface' : 'bg-white/30'}`} />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                            {chapters.map((chapter) => (
                                <motion.button
                                    key={chapter.id}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => navigate(`/chapter/${chapter.id}`)}
                                    className={`p-5 sm:p-7 rounded-[2rem] sm:rounded-[2.5rem] transition-all text-left group relative overflow-hidden ${isClay ? 'ui-clay-surface ui-clay-interactive border border-white/70' : 'bg-white shadow-[0_20px_50px_rgba(0,0,0,0.12)] border-4 border-white hover:border-[#00897B]'}`}
                                >
                                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-125 transition-transform duration-700">
                                        <Star size={96} fill="currentColor" />
                                    </div>

                                    <div className="text-6xl sm:text-7xl mb-5 transform group-hover:rotate-6 group-hover:scale-105 transition-all duration-300 inline-block">
                                        {chapter.emoji || '??'}
                                    </div>
                                    <h3 className={`text-2xl sm:text-3xl font-black italic tracking-tight uppercase leading-tight mb-3 break-words ${isClay ? 'ui-clay-heading' : 'text-[#00695C]'}`}>
                                        {chapter.title}
                                    </h3>
                                    
                                    {progressData[chapter.id] && progressData[chapter.id].total_lessons > 0 ? (
                                        <div className="mb-4 relative z-10">
                                            <div className={`flex justify-between text-xs font-bold mb-1 ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-[#00695C]'}`}>
                                                <span>{progressData[chapter.id].completed_lessons} / {progressData[chapter.id].total_lessons} Lessons</span>
                                                <span>{progressData[chapter.id].completion_percentage}%</span>
                                            </div>
                                            <div className={`w-full h-2.5 rounded-full overflow-hidden ${isClay ? 'ui-clay-progress-track' : 'bg-[#00695C]/10'}`}>
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progressData[chapter.id].completion_percentage}%` }}
                                                    className={`h-full rounded-full ${isClay ? 'ui-clay-progress-bar' : 'bg-green-500'}`}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mb-4 relative z-10">
                                            <div className={`w-full h-2.5 rounded-full overflow-hidden ${isClay ? 'ui-clay-progress-track' : 'bg-[#00695C]/10'}`} />
                                            <p className={`text-xs font-bold mt-1 ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-400'}`}>0% Completed</p>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mt-2 sm:mt-4 relative z-10 gap-3">
                                        <div className={`px-4 py-2 rounded-2xl font-black text-[11px] tracking-wider uppercase italic ${isClay ? 'ui-clay-button-primary' : 'bg-[#00897B] text-white shadow-lg'}`}>
                                            {chapter.levels?.length || 0} Sections
                                        </div>
                                        <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center shadow-xl transition-colors duration-300 shrink-0 ${isClay ? 'ui-clay-icon-pocket text-[#21A7F1]' : 'bg-yellow-400 group-hover:bg-[#00695C] group-hover:text-white'}`}>
                                            <Play size={22} fill="currentColor" className="ml-0.5" />
                                        </div>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    )}
                </main>
            </PageContainer>
        </div>
    );
};

export default Dashboard;
