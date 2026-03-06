import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Play, Star, CheckCircle } from 'lucide-react';
import SensoryBackground from '../components/SensoryBackground';
import { motion } from 'framer-motion';

const LevelDashboard = () => {
    const { levelId } = useParams();
    const navigate = useNavigate();
    const [levelData, setLevelData] = useState(null);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const res = await axios.get(`/api/learner/fetch_level_content.php?level_id=${levelId}&user_id=${user.id}`);
                const data = res.data;
                if (data.error) throw new Error(data.error);
                setLevelData(data);
            } catch (err) {
                console.error("Failed to load level:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [levelId, user.id]);

    const startLesson = (lessonIndex) => {
        navigate(`/lesson/${levelId}`, { state: { startLessonIndex: lessonIndex } });
    };

    if (loading) return (
        <div className="h-screen w-full bg-[#00A5C4] flex items-center justify-center text-white">
            <h1 className="text-2xl font-bold animate-pulse">Loading Mission...</h1>
        </div>
    );

    if (!levelData) return (
        <div className="h-screen w-full bg-[#3B1B54] flex flex-col items-center justify-center text-white p-10">
            <h1 className="text-4xl font-black italic mb-4">Level Not Found</h1>
            <button onClick={() => navigate(-1)} className="underline">Go Back</button>
        </div>
    );

    const { level = {}, lessons = [] } = levelData;

    return (
        <div className="min-h-screen bg-[#e0f7fa] font-sans text-[#00695C] relative">
            <SensoryBackground />

            {/* Top Bar */}
            <div className="bg-[#00695C] text-white p-6 shadow-xl sticky top-0 z-50 flex justify-between items-center">
                <button
                    onClick={() => navigate(`/chapter/${levelData.level.chapter_id}`)}
                    className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                >
                    <ChevronLeft size={28} />
                    <span className="font-bold uppercase tracking-widest hidden md:inline">Back to Map</span>
                </button>
                <h1 className="text-2xl font-black italic tracking-tighter uppercase">{levelData.level.title}</h1>
                <div className="w-10"></div> {/* Spacer */}
            </div>

            <div className="p-8 max-w-6xl mx-auto relative z-10">

                {/* Main Content Area - Zoomed In Landmass */}
                <div className="bg-white rounded-[3rem] p-10 shadow-2xl border-4 border-[#00695C]/10 min-h-[60vh] relative overflow-hidden">

                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,#00695C_2px,transparent_2px)] [background-size:24px_24px]"></div>

                    <h2 className="text-3xl font-black text-center mb-12 italic text-[#00897B]">Select Your Mission</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {levelData.lessons.map((lesson, idx) => {
                            const isCompleted = levelData.completed_lessons?.includes(lesson.id);

                            return (
                                <motion.div
                                    key={lesson.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    onClick={() => navigate(`/lesson/${levelId}`, { state: { startLessonIndex: idx } })}
                                    className="bg-white rounded-[2rem] p-4 shadow-lg border-[3px] border-[#00695C]/20 hover:border-[#00695C] hover:scale-105 transition-all cursor-pointer group relative"
                                >
                                    {isCompleted && (
                                        <div className="absolute -top-3 -right-3 z-10 bg-green-500 text-white rounded-full p-1 shadow-lg border-2 border-white animate-bounce">
                                            <CheckCircle size={28} />
                                        </div>
                                    )}

                                    <div className="aspect-video bg-indigo-100 rounded-3xl mb-4 overflow-hidden relative">
                                        <div className={`absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center ${isCompleted ? 'bg-gradient-to-br from-green-600 to-green-800' : 'bg-gradient-to-br from-[#00897B] to-[#00695C]'}`}>
                                            <Play className="text-white fill-current w-12 h-12 opacity-80" />
                                        </div>
                                        <div className="absolute bottom-2 right-2 bg-black/40 text-white text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-md">
                                            Lesson {idx + 1}
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-[#00695C] leading-tight line-clamp-2">
                                        {lesson.title}
                                    </h3>

                                    <div className="mt-3 flex items-center justify-between">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                                            {isCompleted ? 'Completed' : 'Start'}
                                        </span>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isCompleted ? 'bg-green-100 text-green-600 group-hover:bg-green-500 group-hover:text-white' : 'bg-[#00695C]/10 text-[#00695C] group-hover:bg-[#00695C] group-hover:text-white'}`}>
                                            <ChevronRight size={16} strokeWidth={3} />
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default LevelDashboard;
