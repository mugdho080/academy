import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, Star, Home, ArrowRight, CheckCircle, XCircle, Info, Menu, PlayCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import AIFriend from '../components/AIFriend';

const LessonView = () => {
    const { levelId } = useParams();
    const navigate = useNavigate();
    const [levelData, setLevelData] = useState(null); // { level: {}, lessons: [] }
    const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

    // Quiz State Tracker: { [lessonId]: { [quizId]: selectedOptionIndex } }
    const [quizSelections, setQuizSelections] = useState({});
    // Quiz Result State: { [lessonId]: { checked: boolean, correctCount: number, total: number } }
    const [quizResults, setQuizResults] = useState({});

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const res = await axios.get(`/api/learner/fetch_level_content.php?level_id=${levelId}`);
                if (res.data.error) throw new Error(res.data.error);

                // Parse options and content if they are strings
                const processedLessons = (res.data.lessons || []).map(l => ({
                    ...l,
                    structured_content: typeof l.structured_content === 'string' ? JSON.parse(l.structured_content || '{}') : l.structured_content,
                    quizzes: (l.quizzes || []).map(q => ({
                        ...q,
                        options: typeof q.options === 'string' ? JSON.parse(q.options || '[]') : q.options
                    }))
                }));

                setLevelData({ ...res.data, lessons: processedLessons });
            } catch (err) {
                console.error("Error:", err);
                setError("Could not load the lesson. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [levelId]);

    const handleOptionSelect = (lessonId, quizId, optionIndex) => {
        // If already checked, don't allow changing
        if (quizResults[lessonId]?.checked) return;

        setQuizSelections(prev => ({
            ...prev,
            [lessonId]: {
                ...(prev[lessonId] || {}),
                [quizId]: optionIndex
            }
        }));
    };

    const handleCheckAnswers = async (lessonId) => {
        const lesson = levelData.lessons.find(l => l.id === lessonId);
        if (!lesson) return;

        let correctCount = 0;
        let total = lesson.quizzes.length;
        const selections = quizSelections[lessonId] || {};

        // Calculate score
        lesson.quizzes.forEach(q => {
            const selected = selections[q.id];
            if (selected === parseInt(q.correct_answer)) {
                correctCount++;
            }
        });

        // Update local result state
        setQuizResults(prev => ({
            ...prev,
            [lessonId]: { checked: true, correctCount, total }
        }));

        // Award points if all correct
        if (correctCount === total) {
            try {
                const points = 50; // Bonus for perfect lesson
                await axios.post('/api/learner/update_user_progress.php', {
                    user_id: user.id,
                    points: points
                });
                const updatedUser = { ...user, points: (user.points || 0) + points };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);
            } catch (err) {
                console.error("Points update failed", err);
            }
        }
    };

    if (loading) return (
        <div className="h-screen w-full bg-teal-50 flex items-center justify-center text-teal-800">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                <h1 className="text-xl font-bold animate-pulse">Loading adventure...</h1>
            </div>
        </div>
    );

    if (error) return (
        <div className="h-screen w-full bg-teal-50 flex flex-col items-center justify-center p-10 text-center">
            <h1 className="text-3xl font-bold mb-4 text-red-500">Ops! 🐢</h1>
            <p className="text-xl mb-8 text-gray-600">{error}</p>
            <button onClick={() => navigate(-1)} className="bg-teal-500 text-white px-6 py-3 rounded-xl font-bold">Go Back</button>
        </div>
    );

    if (!levelData || !levelData.lessons) return null;
    const currentLesson = levelData.lessons[currentLessonIndex];

    const isQuizChecked = quizResults[currentLesson.id]?.checked;
    const quizScore = quizResults[currentLesson.id];
    // Check if all questions have been answered to enable Check button
    const allAnswered = currentLesson.quizzes?.every(q => quizSelections[currentLesson.id]?.[q.id] !== undefined);

    return (
        <div className="min-h-screen bg-[#f4f8fa] font-sans text-gray-800 pb-32">

            {/* 1. Header & Navigation */}
            <div className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
                <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-teal-600 font-bold transition">
                        <ChevronLeft size={24} /> Back
                    </button>
                    <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1.5 rounded-full border border-yellow-200">
                        <Star className="text-yellow-500 fill-yellow-500" size={16} />
                        <span className="font-black text-yellow-700 text-sm">{user.points || 0} XP</span>
                    </div>
                </div>

                {/* Horizontal Lesson Selector */}
                <div className="max-w-4xl mx-auto px-4 py-3 overflow-x-auto flex gap-3 scrollbar-hide">
                    {levelData.lessons.map((lesson, idx) => {
                        const isActive = idx === currentLessonIndex;
                        const result = quizResults[lesson.id];
                        const isCompleted = result && result.correctCount === result.total;

                        return (
                            <button
                                key={lesson.id}
                                onClick={() => setCurrentLessonIndex(idx)}
                                className={`flex-shrink-0 px-5 py-3 rounded-2xl text-sm font-bold transition-all border-2 flex flex-col items-start gap-1 min-w-[140px] relative overflow-hidden
                                    ${isActive
                                        ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-md'
                                        : 'bg-white border-gray-100 text-gray-500 hover:border-teal-200 hover:bg-teal-50'
                                    }`}
                            >
                                <span className="text-xs uppercase tracking-wider opacity-60">Lesson {idx + 1}</span>
                                <span className="truncate w-full text-left leading-tight">{lesson.title}</span>
                                {isCompleted && (
                                    <div className="absolute top-2 right-2 text-green-500">
                                        <CheckCircle size={16} className="fill-current" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 pt-8 space-y-8">

                {/* 2. Video Section (Displayed only on the first lesson or if available) */}
                {levelData.level.video_url && (
                    <div className="w-full bg-black rounded-[2rem] overflow-hidden shadow-xl aspect-video border-4 border-white">
                        <iframe
                            className="w-full h-full"
                            src={levelData.level.video_url}
                            title="Level Video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                )}

                {/* 3. Lesson Title & Intro */}
                <div className="text-center space-y-3 pb-4">
                    <span className="bg-teal-100 text-teal-700 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider inline-flex items-center gap-2">
                        Lesson {currentLessonIndex + 1}
                    </span>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight">{currentLesson.title}</h1>
                </div>

                {/* 4. Lesson Content Cards (Placards) */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 space-y-8">
                    {/* Main Content */}
                    <div className="prose prose-lg prose-teal max-w-none text-gray-700">
                        {currentLesson.structured_content?.paragraphs ? (
                            currentLesson.structured_content.paragraphs.map((p, i) => (
                                <p key={i}>{p}</p>
                            ))
                        ) : (
                            <p>{currentLesson.content}</p>
                        )}
                    </div>

                    {/* Bullets */}
                    {currentLesson.structured_content?.bullets && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentLesson.structured_content.bullets.map((b, i) => (
                                <div key={i} className="bg-teal-50 rounded-2xl p-5 flex items-start gap-4 border border-teal-100">
                                    <div className="w-8 h-8 rounded-full bg-teal-200 flex items-center justify-center text-teal-800 font-bold shrink-0">
                                        {i + 1}
                                    </div>
                                    <span className="font-medium text-gray-800">{b.replace(/^[•-]\s*/, '')}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Mini Activity */}
                    {currentLesson.mini_activity && (
                        <div className="bg-yellow-50 rounded-[2rem] p-8 border-2 border-yellow-200 relative overflow-hidden mt-8">
                            <div className="absolute top-0 right-0 bg-yellow-300 text-yellow-900 px-6 py-2 rounded-bl-3xl font-black text-sm uppercase tracking-wide">
                                Activity
                            </div>
                            <h3 className="text-2xl font-black text-yellow-900 mb-3">Try this! 🌟</h3>
                            <p className="text-lg text-yellow-800 font-medium leading-relaxed">{currentLesson.mini_activity}</p>
                        </div>
                    )}

                    {/* Fun Reminder */}
                    {currentLesson.fun_reminder && (
                        <div className="bg-blue-50 rounded-[2rem] p-8 border-2 border-blue-200 relative overflow-hidden flex flex-col md:flex-row items-center md:items-start gap-6 mt-8 text-center md:text-left">
                            <div className="bg-blue-200 p-4 rounded-full text-blue-700 shrink-0">
                                <Info size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-blue-900 mb-2">Did you know?</h3>
                                <p className="text-lg text-blue-800 italic">"{currentLesson.fun_reminder}"</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 5. Quizzes with CHECK ANSWER */}
                {currentLesson.quizzes?.length > 0 && (
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-lg border-2 border-indigo-50 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-3 bg-indigo-500" />

                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-black text-gray-800">Quiz Time! 🧠</h2>
                            <p className="text-gray-500">Answer all questions to complete the lesson.</p>
                        </div>

                        <div className="space-y-10">
                            {currentLesson.quizzes.map((quiz, qIdx) => {
                                const selected = quizSelections[currentLesson.id]?.[quiz.id]; // Index
                                const correctIndex = parseInt(quiz.correct_answer);
                                const isCorrect = selected === correctIndex;

                                return (
                                    <div key={quiz.id} className="space-y-4">
                                        <h3 className="text-lg font-bold text-gray-800 flex gap-3">
                                            <span className="text-indigo-500">Q{qIdx + 1}.</span>
                                            {quiz.question}
                                        </h3>

                                        <div className="space-y-3 pl-4">
                                            {quiz.options.map((opt, optIdx) => {
                                                let cardClass = "bg-white border-2 border-gray-200 hover:border-indigo-200";
                                                let icon = <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;

                                                if (isQuizChecked) {
                                                    // Checked State Logic
                                                    if (optIdx === correctIndex) {
                                                        cardClass = "bg-green-50 border-green-500 ring-1 ring-green-500";
                                                        icon = <CheckCircle className="text-green-600 fill-green-100" size={20} />;
                                                    } else if (selected === optIdx && optIdx !== correctIndex) {
                                                        cardClass = "bg-red-50 border-red-400 opacity-80";
                                                        icon = <XCircle className="text-red-500 fill-red-100" size={20} />;
                                                    } else {
                                                        cardClass = "bg-gray-50 border-gray-100 opacity-50 grayscale";
                                                    }
                                                } else {
                                                    // Selection State Logic
                                                    if (selected === optIdx) {
                                                        cardClass = "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500";
                                                        icon = <div className="w-5 h-5 rounded-full border-4 border-indigo-600 bg-white" />;
                                                    }
                                                }

                                                return (
                                                    <label
                                                        key={optIdx}
                                                        className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${cardClass}`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={`q-${quiz.id}`}
                                                            className="hidden"
                                                            checked={selected === optIdx}
                                                            onChange={() => handleOptionSelect(currentLesson.id, quiz.id, optIdx)}
                                                            disabled={isQuizChecked}
                                                        />
                                                        <div className="shrink-0">{icon}</div>
                                                        <span className={`font-medium ${isQuizChecked && optIdx === correctIndex ? 'text-green-900 font-bold' : 'text-gray-700'}`}>
                                                            {opt}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Action Area */}
                        <div className="mt-10 pt-6 border-t border-gray-100 flex flex-col items-center gap-4">
                            {!isQuizChecked ? (
                                <button
                                    onClick={() => handleCheckAnswers(currentLesson.id)}
                                    disabled={!allAnswered}
                                    className="w-full max-w-sm bg-indigo-600 text-white py-4 rounded-2xl font-black text-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                                >
                                    Check Answers
                                </button>
                            ) : (
                                <div className="text-center space-y-4 w-full">
                                    <div className={`p-4 rounded-xl font-bold text-xl ${quizScore.correctCount === quizScore.total ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                        {quizScore.correctCount === quizScore.total
                                            ? "🎉 Perfect Score! +50 XP"
                                            : `You got ${quizScore.correctCount}/${quizScore.total} correct. Review and try again!`}
                                    </div>

                                    {/* Navigation after check */}
                                    <div className="flex gap-4 justify-center">
                                        {currentLessonIndex < levelData.lessons.length - 1 ? (
                                            <button
                                                onClick={() => {
                                                    setCurrentLessonIndex(currentLessonIndex + 1);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2"
                                            >
                                                Next Lesson <ArrowRight />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => navigate('/learner/dashboard')}
                                                className="bg-yellow-400 text-yellow-900 px-8 py-3 rounded-xl font-black hover:scale-105 flex items-center gap-2"
                                            >
                                                Finish Level <Star className="fill-current" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* AI Friend Floating */}
            <AIFriend context={currentLesson} />

        </div>
    );
};

export default LessonView;
