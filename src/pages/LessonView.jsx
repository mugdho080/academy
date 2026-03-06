import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, Star, ArrowLeft, CheckCircle, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

import AIFriend from '../components/AIFriend';
import SensoryBackground from '../components/SensoryBackground';
import { useActivityTimer } from '../context/ActivityTimerProvider';

const splitIntoSentences = (text) => {
    if (!text) return [];
    // Split by . ! ? followed by space, or newline
    return text.match(/[^.?!]+[.?!]+(?=\s|$)|[^.?!]+/g)?.map(s => s.trim()).filter(s => s.length > 0) || [text];
};

const LessonView = () => {
    const { levelId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [levelData, setLevelData] = useState(null);
    const [currentLessonIndex, setCurrentLessonIndex] = useState(location.state?.startLessonIndex || 0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

    const [quizSelections, setQuizSelections] = useState({}); // { [quizId]: optionIndex }
    const [quizCorrectness, setQuizCorrectness] = useState({}); // { [quizId]: boolean }
    const [completedLessons, setCompletedLessons] = useState([]);
    const { setCurrentLessonId } = useActivityTimer();

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const res = await axios.get(`/api/learner/fetch_level_content.php?level_id=${levelId}&user_id=${user.id}`);
                if (res.data.error) throw new Error(res.data.error);

                const data = res.data;
                const processedLessons = (data.lessons || []).map(l => ({
                    ...l,
                    structured_content: typeof l.structured_content === 'string' ? JSON.parse(l.structured_content || '{}') : l.structured_content,
                    quizzes: (l.quizzes || []).map(q => ({
                        ...q,
                        options: typeof q.options === 'string' ? JSON.parse(q.options || '[]') : q.options
                    }))
                }));

                setLevelData({ ...data, lessons: processedLessons });
                setCompletedLessons(data.completed_lessons || []);
            } catch (err) {
                console.error("Error:", err);
                setError("Could not load the lesson. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [levelId, user.id]);

    const handleOptionSelect = (quizId, optionIndex) => {
        if (quizCorrectness[quizId]) return; // Already correct

        setQuizSelections(prev => ({
            ...prev,
            [quizId]: optionIndex
        }));
    };

    const checkAnswer = async (quizId, correctAnswerIndex) => {
        const selected = quizSelections[quizId];
        if (selected === undefined) return;

        const isCorrect = selected === parseInt(correctAnswerIndex);

        if (isCorrect) {
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });

            const newCorrectness = { ...quizCorrectness, [quizId]: true };
            setQuizCorrectness(newCorrectness);

            // Check if lesson is fully complete
            const lesson = levelData.lessons[currentLessonIndex];
            const allPassed = lesson.quizzes?.every(q => newCorrectness[q.id]);

            if (allPassed && !completedLessons.includes(lesson.id)) {
                // Mark complete
                try {
                    await axios.post('/api/learner/mark_lesson_completed.php', {
                        user_id: user.id,
                        lesson_id: lesson.id
                    });
                    setCompletedLessons(prev => [...prev, lesson.id]);
                    confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
                } catch (e) {
                    console.error("Failed to mark completed", e);
                }
            }
        }
    };

    if (loading) return (
        <div className="min-h-screen w-full bg-[#00695C] flex items-center justify-center text-white">
            <h1 className="text-2xl font-bold animate-pulse">Loading amazing things...</h1>
        </div>
    );

    if (error || !levelData || !levelData.lessons) return (
        <div className="min-h-screen w-full bg-[#00695C] flex flex-col items-center justify-center p-10 text-center text-white">
            <h1 className="text-3xl font-bold mb-4">Ops! 🐢</h1>
            <button onClick={() => navigate(-1)} className="bg-white text-[#00695C] px-6 py-3 rounded-xl font-bold">Go Back</button>
        </div>
    );

    const lesson = levelData.lessons[currentLessonIndex];

    useEffect(() => {
        if (!lesson?.id) {
            setCurrentLessonId(null);
            return undefined;
        }

        setCurrentLessonId(lesson.id);
        return () => setCurrentLessonId(null);
    }, [lesson?.id, setCurrentLessonId]);

    if (!lesson) return null;

    // Process Content into Tabs (Sentences)
    let contentTabs = [];
    if (lesson.structured_content?.paragraphs) {
        lesson.structured_content.paragraphs.forEach(para => {
            contentTabs.push(...splitIntoSentences(para));
        });
    }
    if (lesson.structured_content?.bullets) {
        contentTabs.push(...lesson.structured_content.bullets);
    }
    if (lesson.mini_activity) contentTabs.push(`Activity: ${lesson.mini_activity}`);
    if (lesson.fun_reminder) contentTabs.push(`Did you know? ${lesson.fun_reminder}`);
    if (contentTabs.length === 0) contentTabs.push(lesson.title);

    const isLessonCompleted = completedLessons.includes(lesson.id);

    return (
        <div className="min-h-screen w-full bg-[#e0f7fa] font-sans text-slate-800 relative overflow-x-hidden flex pb-20">
            <SensoryBackground />

            {/* Main scrollable container wrapper, leaves room for right sidebar */}
            <div className="flex-1 w-full lg:pr-80">
                <div className="max-w-5xl mx-auto px-4 md:px-8 pt-8 relative z-10 transition-all">

                    {/* Header Back Button */}
                    <div className="flex justify-between items-center mb-8">
                        <button
                            onClick={() => navigate(`/level/${levelId}`)}
                            className="bg-white/80 backdrop-blur shadow-md px-6 py-3 rounded-[2rem] font-bold text-[#00695C] flex items-center gap-2 hover:bg-white transition-all transform hover:-translate-x-1"
                        >
                            <ArrowLeft size={20} /> Back to Lesson List
                        </button>

                        {isLessonCompleted && (
                            <div className="bg-green-100 text-green-700 px-6 py-3 rounded-[2rem] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm border-2 border-green-200 animate-bounce">
                                <CheckCircle /> Completed
                            </div>
                        )}
                    </div>

                    <div className="text-center mb-10">
                        <p className="text-[#00897B] font-black tracking-widest uppercase text-sm mb-2">{levelData.level.title}</p>
                        <h1 className="text-4xl md:text-5xl font-black text-[#00695C] italic leading-tight">{lesson.title}</h1>
                    </div>

                    {/* Video Section (Scrollable with page) */}
                    {levelData.level.video_url && (
                        <div className="w-full max-w-3xl mx-auto aspect-video mb-12 rounded-[2.5rem] overflow-hidden shadow-2xl border-[6px] border-white relative bg-black shrink-0">
                            <iframe
                                className="w-full h-full object-cover"
                                src={levelData.level.video_url}
                                title="Lesson Video"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    )}

                    {/* Content Section (Horizontal Tabs - Side wise scrollable) */}
                    <div className="mb-12">
                        <h2 className="text-xl font-black text-[#00695C] ml-4 mb-4 uppercase tracking-widest">Read & Swipe ✨</h2>
                        <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 hide-scrollbar pt-2 px-4 -mx-4">
                            {contentTabs.map((text, i) => (
                                <div key={i} className="snap-center shrink-0 w-[85vw] max-w-md min-h-[300px] h-auto bg-white rounded-[2.5rem] p-8 md:p-10 flex flex-col items-center justify-center shadow-[0_15px_40px_rgba(0,0,0,0.1)] border-[6px] border-white hover:border-yellow-300 transition-colors relative group">
                                    <div className="absolute top-4 left-6 text-6xl font-black text-[#e0f7fa] select-none pointer-events-none transform -rotate-12 group-hover:scale-110 transition-transform">{i + 1}</div>
                                    <p className="text-2xl md:text-3xl font-bold text-[#00695C] text-center leading-relaxed relative z-10">{text}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quizzes Section (Vertical Stack) */}
                    {lesson.quizzes && lesson.quizzes.length > 0 && (
                        <div className="max-w-3xl mx-auto">
                            <h2 className="text-xl font-black text-[#00695C] mb-6 uppercase tracking-widest text-center">Quiz Time! 🧠</h2>
                            <div className="flex flex-col gap-8">
                                {lesson.quizzes.map((quiz, qIdx) => {
                                    const selected = quizSelections[quiz.id];
                                    const isCorrect = quizCorrectness[quiz.id];
                                    const correctIndex = parseInt(quiz.correct_answer);

                                    return (
                                        <div key={quiz.id} className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl border-4 border-white relative">
                                            {/* Status Header Bar inside the card */}
                                            <div className={`absolute top-0 inset-x-0 h-4 rounded-t-[2.1rem] ${isCorrect ? 'bg-green-400' : 'bg-yellow-400'} transition-colors duration-500`}></div>

                                            <div className="mt-4 mb-8">
                                                <span className="text-yellow-500 font-bold uppercase tracking-wider text-sm bg-yellow-50 px-3 py-1 rounded-full">Question {qIdx + 1}</span>
                                                <h3 className="text-2xl font-black text-slate-800 mt-4 leading-snug">{quiz.question}</h3>
                                            </div>

                                            <div className="space-y-4 mb-8">
                                                {quiz.options.map((opt, optIdx) => {
                                                    let stateStyle = "bg-slate-50 border-slate-200 text-slate-600 hover:bg-[#e0f7fa] hover:border-[#00897B]";
                                                    if (isCorrect) {
                                                        if (optIdx === correctIndex) stateStyle = "bg-green-100 border-green-500 text-green-900 font-bold border-4";
                                                        else stateStyle = "opacity-50 grayscale border-2";
                                                    } else if (selected === optIdx) {
                                                        stateStyle = "bg-yellow-100 border-yellow-400 text-yellow-900 font-bold border-4";
                                                    } else {
                                                        stateStyle += " border-2";
                                                    }

                                                    return (
                                                        <button
                                                            key={optIdx}
                                                            onClick={() => handleOptionSelect(quiz.id, optIdx)}
                                                            disabled={isCorrect}
                                                            className={`w-full text-left p-5 rounded-2xl transition-all flex items-center gap-4 ${stateStyle}`}
                                                        >
                                                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 bg-white ${selected === optIdx || (isCorrect && optIdx === correctIndex) ? 'border-current' : 'border-slate-300'}`}>
                                                                {(selected === optIdx || (isCorrect && optIdx === correctIndex)) && <div className="w-4 h-4 bg-current rounded-full" />}
                                                            </div>
                                                            <span className="text-lg font-medium">{opt}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                onClick={() => checkAnswer(quiz.id, quiz.correct_answer)}
                                                disabled={selected === undefined || isCorrect}
                                                className={`w-full py-5 rounded-[2rem] font-black text-xl shadow-lg transition-all transform active:scale-95 border-b-4
                                                ${isCorrect
                                                        ? 'bg-green-500 text-white border-green-700 cursor-default'
                                                        : selected !== undefined
                                                            ? 'bg-[#00897B] text-white hover:bg-[#00695C] border-[#004D40]'
                                                            : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                    }`}
                                            >
                                                {isCorrect ? 'Brilliant! Correct! 🎉' : 'Check My Answer'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Fixed Sidebar for AI Friend Desktop / Floating for mobile */}
            <div className="fixed right-0 top-0 bottom-0 w-80 bg-white/40 backdrop-blur-md border-l border-white/50 shadow-2xl p-4 hidden lg:block z-50">
                <AIFriend context={{
                    chapter: levelData.level.title,
                    lesson: lesson.title,
                    content: contentTabs.join(" ")
                }} />
            </div>

            {/* Mobile AI Friend (Floating) */}
            <div className="lg:hidden fixed bottom-6 right-6 z-50">
                <AIFriend context={{
                    chapter: levelData.level.title,
                    lesson: lesson.title,
                    content: contentTabs.join(" ")
                }} floating={true} />
            </div>

        </div>
    );
};

export default LessonView;
