import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Play, Star, CheckCircle } from 'lucide-react';
import SensoryBackground from '../components/SensoryBackground';
import { motion } from 'framer-motion';
import { useCoach } from '../context/CoachContext';
import PageContainer from '../components/layout/PageContainer';

const LevelDashboard = () => {
    const { levelId } = useParams();
    const navigate = useNavigate();
    const [levelData, setLevelData] = useState(null);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const { emitCoachEvent } = useCoach();
    const isClay = false;

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
        const lesson = levelData?.lessons?.[lessonIndex];
        emitCoachEvent('lesson_opened', {
            route: `/lesson/${levelId}`,
            chapter_id: levelData?.level?.chapter_id || null,
            level_id: Number(levelId),
            lesson_id: lesson?.id || null
        }, { immediate: true });
        navigate(`/lesson/${levelId}`, { state: { startLessonIndex: lessonIndex } });
    };

    useEffect(() => {
        emitCoachEvent('level_opened', {
            route: `/level/${levelId}`,
            chapter_id: levelData?.level?.chapter_id || null,
            level_id: Number(levelId)
        }, { immediate: true });
    }, [emitCoachEvent, levelData?.level?.chapter_id, levelId]);

    if (loading) return (
        <div className={`h-screen w-full flex items-center justify-center px-4 ${isClay ? 'ui-clay-page text-[color:var(--clay-text)]' : 'bg-[#00A5C4] text-white'}`}>
            <h1 className="text-2xl font-bold animate-pulse">Loading Mission...</h1>
        </div>
    );

    if (!levelData) return (
        <div className={`h-screen w-full flex flex-col items-center justify-center p-10 ${isClay ? 'ui-clay-page text-[color:var(--clay-text)]' : 'bg-[#3B1B54] text-white'}`}>
            <h1 className="text-4xl font-black italic mb-4">Level Not Found</h1>
            <button onClick={() => navigate(-1)} className={isClay ? 'ui-clay-button-secondary px-4 py-3' : 'underline'}>Go Back</button>
        </div>
    );

    const { level = {}, lessons = [] } = levelData;

    return (
        <div className={`min-h-screen font-sans relative ${isClay ? 'ui-clay-page text-[color:var(--clay-text)]' : 'bg-[#e0f7fa] text-[#00695C]'}`}>
            <SensoryBackground />

            <div className={`px-3 sm:px-6 py-3 sm:py-4 sticky top-0 z-50 flex justify-between items-center gap-3 ${isClay ? 'ui-clay-topbar' : 'bg-[#00695C] text-white shadow-xl'}`}>
                <button
                    onClick={() => navigate(`/chapter/${levelData.level.chapter_id}`)}
                    className={`flex items-center gap-2 transition-colors min-w-0 ${isClay ? 'text-[color:var(--clay-text-soft)] hover:text-[color:var(--clay-text)]' : 'text-white/80 hover:text-white'}`}
                >
                    <ChevronLeft size={24} />
                    <span className="font-bold uppercase tracking-widest hidden md:inline">Back to Map</span>
                </button>
                <h1 className="text-lg sm:text-2xl font-black italic tracking-tighter uppercase text-center break-words">{levelData.level.title}</h1>
                <div className="w-6 sm:w-10"></div> {/* Spacer */}
            </div>

            <PageContainer className="relative z-10 pb-24 lg:pb-10">
                <div className={`rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-8 lg:p-10 min-h-[60vh] relative overflow-hidden ${isClay ? 'ui-clay-surface' : 'bg-white shadow-2xl border-4 border-[#00695C]/10'}`}>
                    <div className={`absolute inset-0 opacity-5 [background-size:24px_24px] ${isClay ? 'bg-[radial-gradient(circle_at_center,#21A7F1_2px,transparent_2px)]' : 'bg-[radial-gradient(circle_at_center,#00695C_2px,transparent_2px)]'}`}></div>

                    <h2 className={`text-2xl sm:text-3xl font-black text-center mb-6 sm:mb-10 italic ${isClay ? 'text-[#21A7F1]' : 'text-[#00897B]'}`}>Select Your Mission</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                        {levelData.lessons.map((lesson, idx) => {
                            const isCompleted = levelData.completed_lessons?.includes(lesson.id);

                            return (
                                <motion.div
                                    key={lesson.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    onClick={() => startLesson(idx)}
                                    className={`rounded-[1.5rem] sm:rounded-[2rem] p-4 hover:scale-[1.02] transition-all cursor-pointer group relative ${isClay ? 'ui-clay-surface ui-clay-interactive' : 'bg-white shadow-lg border-[3px] border-[#00695C]/20 hover:border-[#00695C]'}`}
                                >
                                    {isCompleted && (
                                        <div className="absolute -top-3 -right-3 z-10 bg-green-500 text-white rounded-full p-1 shadow-lg border-2 border-white animate-bounce">
                                            <CheckCircle size={28} />
                                        </div>
                                    )}

                                    <div className={`aspect-video rounded-3xl mb-4 overflow-hidden relative ${isClay ? 'ui-clay-inset-surface' : 'bg-indigo-100'}`}>
                                        <div className={`absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center ${isCompleted ? 'bg-gradient-to-br from-green-600 to-green-800' : 'bg-gradient-to-br from-[#00897B] to-[#00695C]'}`}>
                                            <Play className="text-white fill-current w-12 h-12 opacity-80" />
                                        </div>
                                        <div className="absolute bottom-2 right-2 bg-black/40 text-white text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-md">
                                            Lesson {idx + 1}
                                        </div>
                                    </div>

                                    <h3 className={`text-base sm:text-lg font-bold leading-tight line-clamp-2 ${isClay ? 'ui-clay-heading' : 'text-[#00695C]'}`}>
                                        {lesson.title}
                                    </h3>

                                    <div className="mt-3 flex items-center justify-between">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${isClay ? (isCompleted ? 'text-green-700' : 'text-[color:var(--clay-text-soft)]') : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                                            {isCompleted ? 'Completed' : 'Start'}
                                        </span>
                                        {isCompleted ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startLesson(idx);
                                                }}
                                                className={`px-4 py-1.5 text-[10px] sm:text-xs font-black uppercase rounded-full transition-all hover:scale-105 active:scale-95 z-10 ${isClay ? 'ui-clay-button-warning' : 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 shadow-md border-2 border-yellow-500'}`}
                                            >
                                                Retry
                                            </button>
                                        ) : (
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isClay ? 'ui-clay-icon-pocket text-[#21A7F1]' : 'bg-[#00695C]/10 text-[#00695C] group-hover:bg-[#00695C] group-hover:text-white'}`}>
                                                <ChevronRight size={16} strokeWidth={3} />
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                </div>
            </PageContainer>
        </div>
    );
};

export default LevelDashboard;
