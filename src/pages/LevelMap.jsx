import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Search } from 'lucide-react';
import axios from 'axios';
import ServiceAgreementModal from '../components/ServiceAgreementModal';
import { useCoach } from '../context/CoachContext';

const levelPositions = [
    { top: '1250px', left: '150px' },
    { top: '1100px', left: '300px' },
    { top: '950px', left: '400px' },
    { top: '800px', left: '250px' },
    { top: '650px', left: '350px' },
    { top: '550px', left: '550px' },
    { top: '450px', left: '750px' },
    { top: '300px', left: '850px' },
    { top: '200px', left: '650px' },
    { top: '150px', left: '400px' }
];

const LevelMap = () => {
    const { chapterId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [levels, setLevels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAgreementOpen, setIsAgreementOpen] = useState(false);
    const [chapterTitle, setChapterTitle] = useState('World');
    const { emitCoachEvent, requestCoachMessage } = useCoach();
    const isClay = false;

    const mapContainerRef = React.useRef(null);

    useEffect(() => {
        fetchLevels();
    }, [chapterId]);

    useEffect(() => {
        emitCoachEvent('chapter_opened', {
            route: `/chapter/${chapterId}`,
            chapter_id: Number(chapterId)
        }, { immediate: true });
    }, [chapterId, emitCoachEvent]);

    useEffect(() => {
        if (mapContainerRef.current) {
            mapContainerRef.current.scrollTop = mapContainerRef.current.scrollHeight;
            mapContainerRef.current.scrollLeft = 180;
        }
    }, [levels]);

    const sortedLevels = useMemo(
        () => [...levels].sort((a, b) => a.order_index - b.order_index),
        [levels]
    );

    const fetchLevels = async () => {
        try {
            const res = await axios.get('/api/learner/chapters.php');
            const chapter = res.data.find((c) => c.id === parseInt(chapterId, 10));
            if (chapter) {
                setLevels(chapter.levels || []);
                setChapterTitle(chapter.title);
            }
        } catch (err) {
            console.error('Failed to fetch levels', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSignAgreement = async () => {
        const updatedUser = { ...user, status: 'pending' };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setIsAgreementOpen(false);
    };

    const isUnlocked = (level) => level.is_free || user.status === 'active';

    if (loading) {
        return (
            <div className={`min-h-screen safe-mobile-height flex items-center justify-center px-4 ${isClay ? 'ui-clay-page text-[color:var(--clay-text)]' : 'bg-[#00A5C4] text-white'}`}>
                <p className="text-xl font-black">Loading world map...</p>
            </div>
        );
    }

    return (
        <div className={`h-full w-full relative overflow-hidden flex flex-col font-sans safe-mobile-height ${isClay ? 'ui-clay-page' : ''}`}>
            <ServiceAgreementModal
                isOpen={isAgreementOpen}
                onClose={() => setIsAgreementOpen(false)}
                onSign={handleSignAgreement}
                status={user.status}
                userId={user.id}
            />

            <div className={`absolute inset-0 z-0 ${isClay ? 'bg-[linear-gradient(180deg,#F4F8FF_0%,#ECF2FB_100%)]' : 'bg-[#00A5C4]'}`} />

            <div className="relative z-30 p-3 sm:p-6 lg:p-8 flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 items-start pointer-events-none">
                <div className={`px-4 sm:px-8 lg:px-10 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[2.5rem] pointer-events-auto ${isClay ? 'ui-clay-surface' : 'bg-white/90 backdrop-blur-md shadow-[0_15px_40px_rgba(0,0,0,0.3)] border-4 sm:border-[6px] border-[#00695C]'}`}>
                    <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-black italic tracking-tighter uppercase ${isClay ? 'ui-clay-heading' : 'text-[#00695C]'}`}>
                        {chapterTitle} <span className={isClay ? 'text-[#21A7F1]' : 'text-yellow-500'}>World</span>
                    </h1>
                </div>

                <button
                    onClick={() => navigate('/dashboard')}
                    className={`pointer-events-auto flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 rounded-full font-black text-sm sm:text-lg lg:text-xl transition-all group ${isClay ? 'ui-clay-button-primary' : 'bg-[#00695C] text-white shadow-[0_10px_25px_rgba(0,0,0,0.4)] hover:bg-[#00897B]'}`}
                >
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-transform ${isClay ? 'ui-clay-icon-pocket text-[#21A7F1]' : 'bg-white text-[#00695C] group-hover:rotate-12'}`}>
                        <Search size={18} />
                    </div>
                    BACK TO WORLD
                </button>
            </div>

            <div
                ref={mapContainerRef}
                className="flex-1 relative z-10 overflow-auto scrollbar-hide select-none cursor-grab active:cursor-grabbing pb-24"
            >
                <div className="relative w-[1000px] min-h-[1400px] mx-auto px-2">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-2xl" viewBox="0 0 1000 1400" preserveAspectRatio="xMidYMid slice">
                        <motion.path
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            d="M150,250 Q200,150 400,200 T600,300 Q650,450 450,550 T250,650 Q100,550 150,350 Z"
                            fill="#91C24D"
                            stroke="#7BA641"
                            strokeWidth="6"
                        />
                        <motion.path
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            d="M650,450 Q750,350 900,500 Q1000,700 850,850 Q700,950 550,800 Q450,700 650,450 Z"
                            fill="#91C24D"
                            stroke="#7BA641"
                            strokeWidth="6"
                        />
                        <motion.path
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            d="M250,900 Q400,850 500,950 Q600,1100 450,1250 Q300,1300 150,1150 Q50,1050 250,900 Z"
                            fill="#B3D96B"
                            stroke="#a2c65f"
                            strokeWidth="6"
                        />
                        <path
                            d="M330,420 Q550,550 750,700 T750,450 T400,950"
                            fill="none"
                            stroke="white"
                            strokeWidth="5"
                            strokeDasharray="20 20"
                            className="opacity-40"
                        />
                    </svg>

                    <motion.div
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="absolute top-[1150px] left-[50px] z-50 pointer-events-none"
                    >
                        <div className={`px-8 py-3 rounded-2xl font-black text-2xl shadow-2xl relative ${isClay ? 'ui-clay-button-primary border border-white/70' : 'bg-[#00897B] text-white border-4 border-white'}`}>
                            START HERE
                            <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rotate-45 ${isClay ? 'bg-[#21A7F1] border-b border-r border-white/70' : 'bg-[#00897B] border-b-4 border-r-4 border-white'}`} />
                        </div>
                    </motion.div>

                    {sortedLevels.map((level, idx) => {
                        const pos = levelPositions[idx] || { top: '50%', left: '50%' };
                        const unlocked = isUnlocked(level);

                        return (
                            <motion.div
                                key={level.id}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.4 + (idx * 0.1), type: 'spring' }}
                                style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }}
                                className="absolute z-40 group"
                            >
                                <button
                                    onClick={() => {
                                        if (unlocked) {
                                            navigate(`/level/${level.id}`);
                                        } else {
                                            setIsAgreementOpen(true);
                                            requestCoachMessage('page_view', {
                                                intent: 'locked_content_explainer',
                                                chapter_title: chapterTitle
                                            }, { forceBubble: true });
                                        }
                                    }}
                                    className={`w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full border-4 lg:border-[6px] flex flex-col items-center justify-center shadow-2xl transition-all ${
                                        unlocked
                                            ? isClay ? 'bg-[linear-gradient(135deg,#81c9ff,#21A7F1)] border-white text-white hover:scale-110' : 'bg-[#00897B] border-white text-white hover:scale-110'
                                            : user.status === 'pending'
                                                ? 'bg-amber-500 border-white text-white hover:scale-105'
                                                : isClay ? 'bg-[#d6e0ee] border-white text-[color:var(--clay-text-soft)] grayscale opacity-80' : 'bg-[#00897B] border-slate-400 text-slate-200 grayscale opacity-80'
                                    }`}
                                >
                                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80 leading-none">Level</span>
                                    <span className="text-2xl sm:text-3xl lg:text-4xl font-black mt-[-2px] italic">{idx + 1}</span>
                                    {!unlocked && <Lock size={16} className="mt-1" />}
                                </button>

                                <div className={`absolute -bottom-14 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none transform translate-y-2 group-hover:translate-y-0 z-50 ${isClay ? 'ui-clay-surface' : 'bg-white shadow-xl border-2 border-[#00897B]'}`}>
                                    <p className={`font-black text-xs uppercase italic tracking-tight whitespace-nowrap ${isClay ? 'text-[#21A7F1]' : 'text-[#00897B]'}`}>
                                        {unlocked
                                            ? level.title
                                            : user.status === 'pending'
                                                ? 'Account Under Review'
                                                : 'Unlock with NDIS Plan'}
                                    </p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            <div className="absolute bottom-3 sm:bottom-6 lg:bottom-10 left-3 sm:left-6 lg:left-auto lg:right-10 z-50 pointer-events-none">
                <div className="bg-white/95 backdrop-blur-md p-3 sm:p-5 lg:p-6 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl border-4 border-[#00695C] pointer-events-auto flex items-center gap-3 sm:gap-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-[#00897B] rounded-full flex items-center justify-center text-lg sm:text-xl lg:text-2xl shadow-lg">
                        PK
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-[#00695C] uppercase tracking-widest opacity-60">Status</p>
                        <h3 className="text-base sm:text-xl lg:text-2xl font-black text-[#00695C] italic tracking-tighter uppercase leading-none mt-1">
                            {user.status === 'active' ? 'Super Explorer' : 'New Voyager'}
                        </h3>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LevelMap;
