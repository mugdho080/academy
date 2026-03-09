import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Search, ChevronLeft } from 'lucide-react';
import axios from 'axios';
import ServiceAgreementModal from '../components/ServiceAgreementModal';
import { useCoach } from '../context/CoachContext';

const LevelMap = () => {
    const { chapterId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [levels, setLevels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAgreementOpen, setIsAgreementOpen] = useState(false);
    const [chapterTitle, setChapterTitle] = useState("World");
    const { emitCoachEvent, requestCoachMessage } = useCoach();

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

    // Scroll to the bottom ("Start Here") on load
    useEffect(() => {
        if (mapContainerRef.current) {
            mapContainerRef.current.scrollTop = mapContainerRef.current.scrollHeight;
        }
    }, [levels]);

    const fetchLevels = async () => {
        try {
            const res = await axios.get('/api/learner/chapters.php');
            const chapter = res.data.find(c => c.id === parseInt(chapterId));
            if (chapter) {
                setLevels(chapter.levels || []);
                setChapterTitle(chapter.title);
            }
        } catch (err) {
            console.error("Failed to fetch levels", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSignAgreement = async () => {
        try {
            await axios.post('/api/admin/update_status.php', { user_id: user.id, status: 'pending' });
            const updatedUser = { ...user, status: 'pending' };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser);
            setIsAgreementOpen(false);
        } catch (err) {
            alert("Failed to submit agreement");
        }
    };

    const isUnlocked = (level) => {
        if (level.is_free) return true;
        if (user.status === 'active') return true;
        return false;
    };

    return (
        <div className="h-full w-full relative overflow-hidden flex flex-col font-sans">
            <ServiceAgreementModal
                isOpen={isAgreementOpen}
                onClose={() => setIsAgreementOpen(false)}
                onSign={handleSignAgreement}
                status={user.status}
                userId={user.id}
            />

            {/* Ocean (Teal) */}
            <div className="absolute inset-0 bg-[#00A5C4] z-0" />

            {/* Header / Title Banner */}
            <div className="relative z-30 p-8 flex justify-between items-start pointer-events-none">
                <div className="bg-white/90 backdrop-blur-md px-10 py-4 rounded-[2.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.3)] border-[6px] border-[#00695C] pointer-events-auto">
                    <h1 className="text-4xl font-black text-[#00695C] italic tracking-tighter uppercase">
                        {chapterTitle} <span className="text-yellow-500">World</span>
                    </h1>
                </div>

                <button
                    onClick={() => navigate('/dashboard')}
                    className="pointer-events-auto flex items-center gap-3 bg-[#00695C] text-white px-8 py-4 rounded-full font-black text-xl shadow-[0_10px_25px_rgba(0,0,0,0.4)] hover:bg-[#00897B] transition-all transform hover:-translate-y-1 active:translate-y-0 group"
                >
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#00695C] group-hover:rotate-12 transition-transform">
                        <Search size={20} />
                    </div>
                    BACK TO WORLD
                </button>
            </div>

            {/* Map Area */}
            <div ref={mapContainerRef} className="flex-1 relative z-10 overflow-auto scrollbar-hide select-none cursor-grab active:cursor-grabbing">
                <div className="relative w-full min-h-[1400px]">

                    {/* SVG Continents */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-2xl" viewBox="0 0 1000 1400" preserveAspectRatio="xMidYMid slice">
                        {/* Continent 1 */}
                        <motion.path
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            d="M150,250 Q200,150 400,200 T600,300 Q650,450 450,550 T250,650 Q100,550 150,350 Z"
                            fill="#91C24D"
                            stroke="#7BA641"
                            strokeWidth="6"
                        />
                        {/* Continent 2 */}
                        <motion.path
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            d="M650,450 Q750,350 900,500 Q1000,700 850,850 Q700,950 550,800 Q450,700 650,450 Z"
                            fill="#91C24D"
                            stroke="#7BA641"
                            strokeWidth="6"
                        />
                        {/* Continent 3 */}
                        <motion.path
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            d="M250,900 Q400,850 500,950 Q600,1100 450,1250 Q300,1300 150,1150 Q50,1050 250,900 Z"
                            fill="#B3D96B"
                            stroke="#a2c65f"
                            strokeWidth="6"
                        />

                        {/* Progression Path */}
                        <path
                            d="M330,420 Q550,550 750,700 T750,450 T400,950"
                            fill="none"
                            stroke="white"
                            strokeWidth="5"
                            strokeDasharray="20 20"
                            className="opacity-40"
                        />
                    </svg>

                    {/* Decorations */}
                    <motion.div animate={{ y: [0, -30, 0] }} transition={{ repeat: Infinity, duration: 5 }} className="absolute top-[15%] left-[65%] z-20 text-9xl select-none">🐬</motion.div>
                    <motion.div animate={{ x: [0, 60, 0] }} transition={{ repeat: Infinity, duration: 10 }} className="absolute bottom-[10%] right-[15%] z-20 text-9xl select-none">🐢</motion.div>

                    <div className="absolute top-[65%] left-[8%] z-20 flex gap-2 select-none">
                        <span className="text-7xl animate-bounce">🐧</span>
                        <span className="text-7xl animate-bounce [animation-delay:0.2s]">🐧</span>
                        <span className="text-7xl animate-bounce [animation-delay:0.4s]">🐧</span>
                    </div>

                    {/* Start Banner */}
                    <motion.div
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="absolute top-[1150px] left-[50px] z-50 pointer-events-none"
                    >
                        <div className="bg-[#00897B] text-white px-8 py-3 rounded-2xl font-black text-2xl shadow-2xl border-4 border-white relative">
                            START HERE!
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-[#00897B] rotate-45 border-b-4 border-r-4 border-white" />
                        </div>
                    </motion.div>

                    {/* Level Badges */}
                    {[...levels].sort((a, b) => a.order_index - b.order_index).map((level, idx) => {
                        const coords = [
                            { top: '1250px', left: '150px' },  // Level 1 (Start)
                            { top: '1100px', left: '300px' },  // Level 2
                            { top: '950px', left: '400px' },   // Level 3
                            { top: '800px', left: '250px' },   // Level 4
                            { top: '650px', left: '350px' },   // Level 5
                            { top: '550px', left: '550px' },   // Level 6
                            { top: '450px', left: '750px' },  // Level 7
                            { top: '300px', left: '850px' },   // Level 8
                            { top: '200px', left: '650px' },   // Level 9
                            { top: '150px', left: '400px' },   // Level 10 (End)
                        ];

                        // Ensure we don't crash if we have > 10 levels
                        const pos = coords[idx] || { top: '50%', left: '50%' };

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
                                    className={`
                                        w-28 h-28 rounded-full border-[6px] flex flex-col items-center justify-center shadow-2xl transition-all
                                        ${unlocked
                                            ? 'bg-[#00897B] border-white text-white hover:scale-110'
                                            : user.status === 'pending'
                                                ? 'bg-amber-500 border-white text-white hover:scale-105'
                                                : 'bg-[#00897B] border-slate-400 text-slate-200 grayscale opacity-80'
                                        }
                                    `}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none">Level</span>
                                    <span className="text-4xl font-black mt-[-4px] italic">{idx + 1}</span>
                                    {!unlocked && <Lock size={20} className="mt-1" />}
                                </button>

                                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-white px-5 py-2 rounded-2xl shadow-xl border-2 border-[#00897B] opacity-0 group-hover:opacity-100 transition-all pointer-events-none transform translate-y-2 group-hover:translate-y-0 z-50">
                                    <p className="font-black text-xs text-[#00897B] uppercase italic tracking-tighter whitespace-nowrap">
                                        {unlocked
                                            ? level.title
                                            : user.status === 'pending'
                                                ? "Account Under Review 🕒"
                                                : "Unlock with NDIS Plan 🔐"}
                                    </p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Status Radar */}
            <div className="absolute bottom-10 right-10 z-50 pointer-events-none">
                <div className="bg-white/95 backdrop-blur-md p-6 rounded-[2.5rem] shadow-2xl border-4 border-[#00695C] pointer-events-auto flex items-center gap-5">
                    <div className="w-16 h-16 bg-[#00897B] rounded-full flex items-center justify-center text-3xl shadow-lg">
                        🦁
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-[#00695C] uppercase tracking-widest opacity-60">Status</p>
                        <h3 className="text-2xl font-black text-[#00695C] italic tracking-tighter uppercase leading-none mt-1">
                            {user.status === 'active' ? 'Super Explorer' : 'New Voyager'}
                        </h3>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default LevelMap;
