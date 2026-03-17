import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';

import AIFriend from '../components/AIFriend';
import SensoryBackground from '../components/SensoryBackground';
import { useActivityTimer } from '../context/ActivityTimerProvider';
import { useCoach } from '../context/CoachContext';
import PageContainer from '../components/layout/PageContainer';
import ActionGroup from '../components/layout/ActionGroup';
import { useUiVariant } from '../context/UiVariantContext';

const splitIntoSentences = (text) => {
    if (!text) return [];
    return text.match(/[^.?!]+[.?!]+(?=\s|$)|[^.?!]+/g)?.map((s) => s.trim()).filter(Boolean) || [text];
};

const LessonView = () => {
    const { levelId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [levelData, setLevelData] = useState(null);
    const [currentLessonIndex, setCurrentLessonIndex] = useState(location.state?.startLessonIndex || 0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

    const [quizSelections, setQuizSelections] = useState({});
    const [quizCorrectness, setQuizCorrectness] = useState({});
    const [completedLessons, setCompletedLessons] = useState([]);

    const { setCurrentLessonId } = useActivityTimer();
    const { emitCoachEvent, requestCoachMessage, state: coachState, recommendation, profile } = useCoach();
    const { variant } = useUiVariant('learner');
    const isClay = variant === 'clay';

    const contentScrollerRef = React.useRef(null);
    const lastScrollLeftRef = React.useRef(0);
    const lastSwipeEventRef = React.useRef(0);
    const lessonCoachLoadedRef = React.useRef(null);
    const recommendedLessonId = Number(location.state?.recommendedLessonId || 0) || null;

    const syncUserPoints = (totalPoints) => {
        if (!Number.isFinite(totalPoints)) return;
        const updatedUser = { ...user, points: Number(totalPoints) };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
    };

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const res = await axios.get(`/api/learner/fetch_level_content.php?level_id=${levelId}&user_id=${user.id}`);
                if (res.data.error) throw new Error(res.data.error);

                const data = res.data;
                const processedLessons = (data.lessons || []).map((l) => {
                    let structured = l.structured_content;
                    if (typeof structured === 'string' && structured.trim().startsWith('{')) {
                        try {
                            structured = JSON.parse(structured);
                        } catch (_) {
                            structured = {};
                        }
                    } else if (typeof structured === 'string') {
                        structured = { paragraphs: [structured] };
                    }

                    return {
                        ...l,
                        structured_content: structured || {},
                        quizzes: (l.quizzes || []).map((q) => {
                            let opts = q.options;
                            if (typeof opts === 'string' && opts.trim().startsWith('[')) {
                                try {
                                    opts = JSON.parse(opts);
                                } catch (_) {
                                    opts = [];
                                }
                            }
                            return { ...q, options: Array.isArray(opts) ? opts : [] };
                        })
                    };
                });

                setLevelData({ ...data, lessons: processedLessons });
                setCompletedLessons(data.completed_lessons || []);
            } catch (err) {
                console.error('Error:', err);
                setError('Could not load the lesson. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [levelId, user.id]);

    const lesson = levelData?.lessons?.[currentLessonIndex];

    const contentTabs = useMemo(() => {
        if (!lesson) return [];

        const nextTabs = [];
        if (lesson.structured_content?.paragraphs) {
            lesson.structured_content.paragraphs.forEach((para) => {
                nextTabs.push(...splitIntoSentences(para));
            });
        }
        if (lesson.structured_content?.bullets) nextTabs.push(...lesson.structured_content.bullets);
        if (lesson.mini_activity) nextTabs.push(`Activity: ${lesson.mini_activity}`);
        if (lesson.fun_reminder) nextTabs.push(`Did you know? ${lesson.fun_reminder}`);
        if (nextTabs.length === 0) nextTabs.push(lesson.title);

        return nextTabs;
    }, [lesson]);

    const isLessonCompleted = lesson ? completedLessons.includes(lesson.id) : false;
    const lessonCount = levelData?.lessons?.length || 0;
    const progressPercent = lessonCount > 0 ? Math.round(((currentLessonIndex + 1) / lessonCount) * 100) : 0;

    const goToLesson = (nextIndex) => {
        if (!levelData?.lessons?.[nextIndex]) return;
        setCurrentLessonIndex(nextIndex);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleOptionSelect = (quizId, optionIndex) => {
        if (quizCorrectness[quizId]) return;

        setQuizSelections((prev) => ({
            ...prev,
            [quizId]: optionIndex
        }));

        emitCoachEvent('quiz_option_selected', {
            route: location.pathname,
            chapter_id: levelData?.level?.chapter_id || null,
            level_id: Number(levelId),
            lesson_id: lesson?.id || null,
            payload_json: { quiz_id: quizId, option_index: optionIndex }
        });
    };

    const checkAnswer = async (quizId, correctAnswerIndex) => {
        const selected = quizSelections[quizId];
        if (selected === undefined) return;

        const isCorrect = selected === parseInt(correctAnswerIndex, 10);

        if (isCorrect) {
            emitCoachEvent('quiz_answer_correct', {
                route: location.pathname,
                chapter_id: levelData?.level?.chapter_id || null,
                level_id: Number(levelId),
                lesson_id: lesson?.id || null,
                payload_json: { quiz_id: quizId }
            }, { immediate: true });

            try {
                const quizRes = await axios.post('/api/learner/submit_quiz_answer.php', {
                    user_id: user.id,
                    quiz_id: quizId,
                    is_correct: true,
                    lesson_id: lesson?.id || null,
                    level_id: Number(levelId),
                    chapter_id: levelData?.level?.chapter_id || null
                });
                syncUserPoints(quizRes?.data?.total_points);
            } catch (quizErr) {
                console.error('Failed to submit quiz answer', quizErr);
            }

            confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });

            const newCorrectness = { ...quizCorrectness, [quizId]: true };
            setQuizCorrectness(newCorrectness);

            const allPassed = lesson?.quizzes?.every((q) => newCorrectness[q.id]);
            if (allPassed && lesson && !completedLessons.includes(lesson.id)) {
                try {
                    const completionRes = await axios.post('/api/learner/mark_lesson_completed.php', {
                        user_id: user.id,
                        lesson_id: lesson.id,
                        is_recommended: recommendedLessonId ? lesson.id === recommendedLessonId : false
                    });
                    syncUserPoints(completionRes?.data?.total_points);
                    setCompletedLessons((prev) => [...prev, lesson.id]);
                    emitCoachEvent('lesson_completed', {
                        route: location.pathname,
                        chapter_id: levelData?.level?.chapter_id || null,
                        level_id: Number(levelId),
                        lesson_id: lesson.id,
                        payload_json: { lesson_title: lesson.title }
                    }, { immediate: true });
                    requestCoachMessage('lesson_completed', {
                        intent: 'completion_celebration',
                        lesson_id: lesson.id,
                        lesson_title: lesson.title
                    }, { forceBubble: true });
                    confetti({ particleCount: 180, spread: 90, origin: { y: 0.5 } });
                } catch (e) {
                    console.error('Failed to mark completed', e);
                }
            }
        } else {
            try {
                await axios.post('/api/learner/submit_quiz_answer.php', {
                    user_id: user.id,
                    quiz_id: quizId,
                    is_correct: false,
                    lesson_id: lesson?.id || null,
                    level_id: Number(levelId),
                    chapter_id: levelData?.level?.chapter_id || null
                });
            } catch (quizErr) {
                console.error('Failed to submit incorrect quiz attempt', quizErr);
            }

            emitCoachEvent('quiz_answer_incorrect', {
                route: location.pathname,
                chapter_id: levelData?.level?.chapter_id || null,
                level_id: Number(levelId),
                lesson_id: lesson?.id || null,
                payload_json: { quiz_id: quizId }
            }, { immediate: true });
            requestCoachMessage('quiz_answer_incorrect', {
                intent: 'mistake_reassurance',
                lesson_id: lesson?.id || null,
                lesson_title: lesson?.title
            }, { forceBubble: true });
        }
    };

    useEffect(() => {
        if (!lesson?.id) {
            setCurrentLessonId(null);
            return undefined;
        }
        if (lessonCoachLoadedRef.current === lesson.id) return undefined;

        lessonCoachLoadedRef.current = lesson.id;
        setCurrentLessonId(lesson.id);

        emitCoachEvent('lesson_opened', {
            route: location.pathname,
            chapter_id: levelData?.level?.chapter_id || null,
            level_id: Number(levelId),
            lesson_id: lesson.id,
            payload_json: { lesson_title: lesson.title }
        }, { immediate: true });

        requestCoachMessage('lesson_opened', {
            intent: 'navigation_help',
            chapter_title: levelData?.level?.chapter_title,
            level_title: levelData?.level?.title,
            lesson_title: lesson.title,
            lesson_id: lesson.id
        });

        return () => setCurrentLessonId(null);
    }, [
        emitCoachEvent,
        lesson?.id,
        lesson?.title,
        levelData?.level?.chapter_id,
        levelData?.level?.chapter_title,
        levelData?.level?.title,
        levelId,
        location.pathname,
        requestCoachMessage,
        setCurrentLessonId
    ]);

    useEffect(() => {
        const scroller = contentScrollerRef.current;
        if (!scroller) return undefined;

        const onScroll = () => {
            const now = Date.now();
            if (now - lastSwipeEventRef.current < 1500) return;

            const current = scroller.scrollLeft;
            const previous = lastScrollLeftRef.current;
            const delta = current - previous;
            lastScrollLeftRef.current = current;

            if (Math.abs(delta) < 50) return;
            const type = delta > 0 ? 'lesson_swipe_next' : 'lesson_swipe_prev';
            emitCoachEvent(type, {
                route: location.pathname,
                chapter_id: levelData?.level?.chapter_id || null,
                level_id: Number(levelId),
                lesson_id: lesson?.id || null,
                payload_json: { delta_x: delta }
            });
            lastSwipeEventRef.current = now;
        };

        scroller.addEventListener('scroll', onScroll, { passive: true });
        return () => scroller.removeEventListener('scroll', onScroll);
    }, [emitCoachEvent, lesson?.id, levelData?.level?.chapter_id, levelId, location.pathname]);

    if (loading) {
        return (
            <div className={`min-h-screen w-full flex items-center justify-center px-4 ${isClay ? 'ui-clay-page text-[color:var(--clay-text)]' : 'bg-[#00695C] text-white'}`}>
                <h1 className="text-xl sm:text-2xl font-bold animate-pulse">Loading lesson...</h1>
            </div>
        );
    }

    if (error || !levelData || !levelData.lessons) {
        return (
            <div className={`min-h-screen w-full flex flex-col items-center justify-center p-6 text-center gap-4 ${isClay ? 'ui-clay-page text-[color:var(--clay-text)]' : 'bg-[#00695C] text-white'}`}>
                <h1 className="text-2xl sm:text-3xl font-bold">Oops, lesson unavailable</h1>
                <button onClick={() => navigate(-1)} className={`px-6 py-3 rounded-xl font-bold ${isClay ? 'ui-clay-button-secondary' : 'bg-white text-[#00695C]'}`}>
                    Go Back
                </button>
            </div>
        );
    }

    if (!lesson) return null;

    return (
        <div className={`min-h-screen w-full font-sans text-slate-800 relative overflow-x-hidden pb-24 lg:pb-8 ${isClay ? 'ui-clay-page' : 'bg-[#e0f7fa]'}`}>
            <SensoryBackground />

            <div className="w-full lg:pr-80">
                <PageContainer className="relative z-10 space-y-5 sm:space-y-6 pb-28 lg:pb-10">
                    <div className="content-card p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <button
                                onClick={() => navigate(`/level/${levelId}`)}
                                className={`px-4 py-3 rounded-2xl font-bold flex items-center gap-2 w-full sm:w-auto justify-center ${isClay ? 'ui-clay-button-secondary text-[color:var(--clay-text)]' : 'bg-white shadow-md text-[#00695C]'}`}
                            >
                                <ArrowLeft size={18} /> Back to Lesson List
                            </button>

                            {isLessonCompleted && (
                                <div className={`px-4 py-2.5 rounded-2xl font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm ${isClay ? 'ui-clay-chip-success' : 'bg-green-100 text-green-700 border-2 border-green-200'}`}>
                                    <CheckCircle size={18} /> Completed
                                </div>
                            )}
                        </div>

                        <div className="mt-4">
                            <p className={`font-black tracking-widest uppercase text-xs sm:text-sm mb-2 break-words ${isClay ? 'text-[#21A7F1]' : 'text-[#00897B]'}`}>{levelData.level.title}</p>
                            <h1 className={`text-2xl sm:text-3xl lg:text-5xl font-black italic leading-tight break-words ${isClay ? 'ui-clay-heading' : 'text-[#00695C]'}`}>{lesson.title}</h1>
                            <p className={`mt-2 text-sm font-semibold ${isClay ? 'ui-clay-text-soft' : 'text-slate-600'}`}>Lesson {currentLessonIndex + 1} of {lessonCount}</p>
                        </div>

                        <div className={`mt-3 h-3 rounded-full overflow-hidden ${isClay ? 'ui-clay-progress-track border border-white/70' : 'bg-[#d4ece8] border border-[#b7dcd6]'}`}>
                            <div className={`h-full transition-all ${isClay ? 'ui-clay-progress-bar' : 'bg-[#00897B]'}`} style={{ width: `${progressPercent}%` }} />
                        </div>
                    </div>

                    {levelData.level.video_url && (
                        <div className={`w-full max-w-4xl mx-auto aspect-video rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden relative bg-black ${isClay ? 'ui-clay-surface' : 'shadow-2xl border-4 sm:border-[6px] border-white'}`}>
                            <iframe
                                className="w-full h-full"
                                src={levelData.level.video_url}
                                title="Lesson Video"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    )}

                    <section className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className={`text-lg sm:text-xl font-black uppercase tracking-wide ${isClay ? 'ui-clay-heading' : 'text-[#00695C]'}`}>Read and Swipe</h2>
                            <p className={`text-xs sm:text-sm font-semibold ${isClay ? 'ui-clay-text-soft' : 'text-slate-500'}`}>Swipe cards or use lesson buttons below</p>
                        </div>
                        <div ref={contentScrollerRef} className="flex overflow-x-auto snap-x snap-mandatory gap-4 sm:gap-5 pb-3 hide-scrollbar pt-1 px-1">
                            {contentTabs.map((text, i) => (
                                <article
                                    key={i}
                                    className={`snap-center shrink-0 w-[88vw] sm:w-[75vw] md:w-[62vw] lg:w-[46vw] max-w-xl min-h-[220px] sm:min-h-[280px] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-7 flex flex-col items-center justify-center relative ${isClay ? 'ui-clay-surface' : 'bg-white shadow-[0_12px_30px_rgba(0,0,0,0.09)] border-4 border-white'}`}
                                >
                                    <div className={`absolute top-3 left-4 text-5xl sm:text-6xl font-black select-none pointer-events-none ${isClay ? 'text-[#cfe4ff]' : 'text-[#e0f7fa]'}`}>{i + 1}</div>
                                    <p className={`text-lg sm:text-2xl md:text-3xl font-bold text-center leading-relaxed relative z-10 break-words ${isClay ? 'ui-clay-heading' : 'text-[#00695C]'}`}>{text}</p>
                                </article>
                            ))}
                        </div>
                    </section>

                    {lesson.quizzes && lesson.quizzes.length > 0 && (
                        <section className="max-w-4xl mx-auto w-full space-y-5 sm:space-y-6">
                            <h2 className={`text-xl sm:text-2xl font-black uppercase tracking-wide text-center ${isClay ? 'ui-clay-heading' : 'text-[#00695C]'}`}>Quiz Time</h2>
                            <div className="flex flex-col gap-5 sm:gap-6">
                                {lesson.quizzes.map((quiz, qIdx) => {
                                    const selected = quizSelections[quiz.id];
                                    const isCorrect = quizCorrectness[quiz.id];
                                    const correctIndex = parseInt(quiz.correct_answer, 10);

                                    return (
                                        <article key={quiz.id} className={`rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-7 relative ${isClay ? 'ui-clay-surface' : 'bg-white shadow-xl border-4 border-white'}`}>
                                            <div className={`absolute top-0 inset-x-0 h-3 rounded-t-[1.4rem] sm:rounded-t-[1.8rem] ${isCorrect ? 'bg-green-400' : isClay ? 'bg-[#21A7F1]' : 'bg-yellow-400'} transition-colors`} />

                                            <div className="mt-3 mb-5">
                                                <span className={`font-bold uppercase tracking-wider text-xs px-3 py-1 rounded-full ${isClay ? 'ui-clay-button-secondary text-[#21A7F1]' : 'text-yellow-600 bg-yellow-50'}`}>Question {qIdx + 1}</span>
                                                <h3 className={`text-xl sm:text-2xl font-black mt-3 leading-snug break-words ${isClay ? 'ui-clay-heading' : 'text-slate-800'}`}>{quiz.question}</h3>
                                            </div>

                                            <div className="space-y-3 sm:space-y-4 mb-5">
                                                {quiz.options.map((opt, optIdx) => {
                                                    let stateStyle = isClay ? 'ui-clay-button-secondary text-[color:var(--clay-text)]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-[#e0f7fa] hover:border-[#00897B]';
                                                    if (isCorrect) {
                                                        if (optIdx === correctIndex) stateStyle = 'bg-green-100 border-green-500 text-green-900 font-bold border-4';
                                                        else stateStyle = 'opacity-50 grayscale border-2';
                                                    } else if (selected === optIdx) {
                                                        stateStyle = isClay ? 'ui-clay-button-primary text-white border-transparent' : 'bg-yellow-100 border-yellow-400 text-yellow-900 font-bold border-4';
                                                    } else {
                                                        stateStyle += isClay ? ' border border-white/70' : ' border-2';
                                                    }

                                                    return (
                                                        <button
                                                            key={optIdx}
                                                            onClick={() => handleOptionSelect(quiz.id, optIdx)}
                                                            disabled={isCorrect}
                                                            className={`w-full text-left px-4 py-3.5 sm:p-5 rounded-2xl transition-all flex items-center gap-3 sm:gap-4 ${stateStyle}`}
                                                        >
                                                            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${isClay ? 'bg-white/80' : 'bg-white'} ${selected === optIdx || (isCorrect && optIdx === correctIndex) ? 'border-current' : 'border-slate-300'}`}>
                                                                {(selected === optIdx || (isCorrect && optIdx === correctIndex)) && <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-current rounded-full" />}
                                                            </div>
                                                            <span className="text-base sm:text-lg font-medium break-words">{opt}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                onClick={() => checkAnswer(quiz.id, quiz.correct_answer)}
                                                disabled={selected === undefined || isCorrect}
                                                className={`w-full py-4 sm:py-5 rounded-2xl font-black text-lg sm:text-xl shadow-lg transition-all transform active:scale-95 border-b-4 ${
                                                    isCorrect
                                                        ? 'bg-green-500 text-white border-green-700 cursor-default'
                                                        : selected !== undefined
                                                            ? isClay ? 'bg-[linear-gradient(135deg,#81c9ff,#21A7F1)] text-white border-[#0E90D1]' : 'bg-[#00897B] text-white hover:bg-[#00695C] border-[#004D40]'
                                                            : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                }`}
                                            >
                                                {isCorrect ? 'Brilliant, correct!' : 'Check My Answer'}
                                            </button>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    <div className="sticky bottom-20 lg:bottom-6 z-20">
                        <div className="content-card p-3 sm:p-4">
                            <ActionGroup className="justify-between">
                                <button
                                    onClick={() => goToLesson(Math.max(0, currentLessonIndex - 1))}
                                    disabled={currentLessonIndex === 0}
                                    className={`px-4 sm:px-5 py-3 rounded-2xl font-black disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 ${isClay ? 'ui-clay-button-secondary' : 'bg-white border border-slate-200 text-slate-700'}`}
                                >
                                    <ChevronLeft size={18} /> Previous Lesson
                                </button>
                                <button
                                    onClick={() => goToLesson(Math.min(lessonCount - 1, currentLessonIndex + 1))}
                                    disabled={currentLessonIndex >= lessonCount - 1}
                                    className={`px-4 sm:px-5 py-3 rounded-2xl font-black disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 ${isClay ? 'ui-clay-button-primary' : 'bg-[#00695C] text-white'}`}
                                >
                                    Next Lesson <ChevronRight size={18} />
                                </button>
                            </ActionGroup>
                        </div>
                    </div>
                </PageContainer>
            </div>

            <div className={`fixed right-0 top-0 bottom-0 w-80 p-4 hidden lg:block z-50 ${isClay ? 'ui-clay-overlay-panel' : 'bg-white/40 backdrop-blur-md border-l border-white/50 shadow-2xl'}`}>
                <AIFriend context={{
                    chapter: levelData.level.title,
                    lesson: lesson.title,
                    content: contentTabs.join(' '),
                    chapterId: levelData.level.chapter_id || null,
                    levelId: Number(levelId),
                    lessonId: lesson.id,
                    frustrationBand: coachState?.frustration_band || 'normal',
                    recommendedAction: recommendation?.recommended_route || null,
                    ageBand: profile?.age_band || 'age_20_40'
                }} />
            </div>

            <div className="lg:hidden fixed bottom-28 right-3 sm:right-4 z-50">
                <AIFriend
                    context={{
                        chapter: levelData.level.title,
                        lesson: lesson.title,
                        content: contentTabs.join(' '),
                        chapterId: levelData.level.chapter_id || null,
                        levelId: Number(levelId),
                        lessonId: lesson.id,
                        frustrationBand: coachState?.frustration_band || 'normal',
                        recommendedAction: recommendation?.recommended_route || null,
                        ageBand: profile?.age_band || 'age_20_40'
                    }}
                    floating={true}
                />
            </div>
        </div>
    );
};

export default LessonView;
