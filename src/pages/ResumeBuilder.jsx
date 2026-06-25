import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Send, Save, CheckCircle, Download,
    AlertCircle, RefreshCw, FileText
} from 'lucide-react';
import axios from 'axios';

// ─── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
    { key: 'personal',     label: 'About Me'     },
    { key: 'goal',         label: 'Job Goal'      },
    { key: 'skills',       label: 'Skills'        },
    { key: 'experience',   label: 'Experience'    },
    { key: 'education',    label: 'Education'     },
    { key: 'certificates', label: 'Certificates'  },
    { key: 'availability', label: 'Availability'  },
    { key: 'preview',      label: 'Preview'       },
];

// ─── Data normaliser ───────────────────────────────────────────────────────────
// Handles both old flat draft fields and new structured fields from the backend.

const normalizeResumeDraft = (draft) => {
    if (!draft || Object.keys(draft).length === 0) return null;
    const pd = draft.personal_details || {};
    const skills = Array.isArray(draft.skills)
        ? draft.skills
        : (draft.skills ? String(draft.skills).split(',').map(s => s.trim()).filter(Boolean) : []);

    return {
        personal_details: {
            full_name: pd.full_name || draft.personal_name || draft.name || '',
            phone:     pd.phone    || draft.contact_phone  || draft.phone || '',
            email:     pd.email    || draft.contact_email  || draft.email || '',
            suburb:    pd.suburb   || draft.contact_address || draft.suburb || '',
        },
        target_role:          draft.target_role          || draft.job_goal    || '',
        professional_summary: draft.professional_summary || draft.summary     || '',
        skills,
        experience:   Array.isArray(draft.experience)   ? draft.experience   : [],
        education:    Array.isArray(draft.education)     ? draft.education    : [],
        certificates: Array.isArray(draft.certificates)  ? draft.certificates : [],
        availability: draft.availability || '',
        references:   Array.isArray(draft.references)    ? draft.references   : [],
    };
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const TypingDots = () => (
    <div className="flex gap-1 items-center h-4">
        {[0, 1, 2].map(i => (
            <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
            />
        ))}
    </div>
);

const PandaBubble = ({ text }) => (
    <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end gap-2"
    >
        <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-sm flex-shrink-0">
            🐼
        </div>
        <div className="max-w-[85%] bg-white border border-teal-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
            <p className="text-sm text-teal-900 leading-relaxed">{text}</p>
        </div>
    </motion.div>
);

const LearnerBubble = ({ text }) => (
    <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
    >
        <div className="max-w-[85%] bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl rounded-br-sm px-4 py-3 shadow-sm">
            <p className="text-sm text-white leading-relaxed">{text}</p>
        </div>
    </motion.div>
);

const QuickReplyChips = ({ replies, onSelect, disabled }) => (
    <div className="flex flex-wrap gap-2 ml-9 mt-1">
        {replies.map((reply, i) => (
            <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelect(reply)}
                disabled={disabled}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 active:scale-95 text-teal-800 rounded-full text-sm font-semibold border border-amber-200 hover:border-amber-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {reply}
            </motion.button>
        ))}
    </div>
);

const TypingIndicator = () => (
    <div className="flex items-end gap-2">
        <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-sm flex-shrink-0">
            🐼
        </div>
        <div className="bg-white border border-teal-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
            <div className="flex items-center gap-1.5">
                <span className="text-xs text-teal-500 font-medium">Panda is thinking</span>
                <TypingDots />
            </div>
        </div>
    </div>
);

const WelcomeCard = ({ onStart, loading }) => (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center text-4xl mb-5 shadow-inner border-2 border-teal-200/50">
            🐼
        </div>
        <h2 className="text-lg font-bold text-teal-900 mb-2">
            Let's build your resume together!
        </h2>
        <p className="text-sm text-teal-700 mb-1">
            You can type or choose quick reply buttons.
        </p>
        <p className="text-sm text-teal-500 mb-7">
            Panda will make your answers sound professional.
        </p>
        {loading ? (
            <div className="flex items-center gap-2 text-teal-500">
                <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Starting Panda…</span>
            </div>
        ) : (
            <button
                onClick={onStart}
                className="px-8 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-2xl font-bold text-base shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
            >
                Start Resume ✨
            </button>
        )}
    </div>
);

const ErrorCard = ({ message, onRetry }) => (
    <div className="m-2 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertCircle size={16} className="text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700 mb-1">Panda had trouble connecting</p>
            <p className="text-xs text-red-600 mb-3 leading-relaxed">{message}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold transition-colors"
                >
                    <RefreshCw size={12} />
                    Try Again
                </button>
            )}
        </div>
    </div>
);

// ─── Resume Preview ────────────────────────────────────────────────────────────

const PreviewSection = ({ title, isEmpty, placeholder, children }) => (
    <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{title}</h3>
            <div className="flex-1 h-px bg-gray-100" />
        </div>
        {isEmpty ? (
            <p className="text-xs text-gray-300 italic">{placeholder}</p>
        ) : children}
    </div>
);

const ResumeLivePreview = ({ draft }) => {
    const d = normalizeResumeDraft(draft) || {};
    const hasName = Boolean(d.personal_details?.full_name);

    return (
        <div className="max-w-[700px] mx-auto p-4 sm:p-6">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                {/* Resume header band */}
                <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-6 sm:px-8 py-6 text-white">
                    {hasName ? (
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                            {d.personal_details.full_name}
                        </h1>
                    ) : (
                        <h1 className="text-lg font-normal opacity-40 italic">
                            Your name will appear here
                        </h1>
                    )}
                    {d.target_role && (
                        <p className="text-teal-100 text-sm mt-1 font-medium">{d.target_role}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-xs text-teal-200">
                        {d.personal_details?.email  && <span>{d.personal_details.email}</span>}
                        {d.personal_details?.phone  && <span>{d.personal_details.phone}</span>}
                        {d.personal_details?.suburb && <span>{d.personal_details.suburb}</span>}
                    </div>
                </div>

                <div className="px-6 sm:px-8 py-6">
                    <PreviewSection
                        title="Professional Summary"
                        isEmpty={!d.professional_summary}
                        placeholder="Panda will write a short professional summary here"
                    >
                        <p className="text-sm text-gray-700 leading-relaxed">{d.professional_summary}</p>
                    </PreviewSection>

                    <PreviewSection
                        title="Skills"
                        isEmpty={!d.skills?.length}
                        placeholder="Skills you choose will appear here"
                    >
                        <div className="flex flex-wrap gap-1.5">
                            {d.skills?.map((skill, i) => (
                                <span
                                    key={i}
                                    className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-semibold border border-teal-100"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </PreviewSection>

                    <PreviewSection
                        title="Experience"
                        isEmpty={!d.experience?.length}
                        placeholder="Your work experience will appear here"
                    >
                        <div className="space-y-3">
                            {d.experience?.map((exp, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-baseline gap-2">
                                        <span className="font-semibold text-sm text-gray-800">{exp.role}</span>
                                        {exp.dates && <span className="text-xs text-gray-400 flex-shrink-0">{exp.dates}</span>}
                                    </div>
                                    {exp.organization && (
                                        <div className="text-xs text-teal-600 font-medium mb-1">{exp.organization}</div>
                                    )}
                                    {exp.duties && (
                                        <ul className="space-y-0.5">
                                            {(Array.isArray(exp.duties) ? exp.duties : [exp.duties]).map((duty, j) => (
                                                <li key={j} className="text-xs text-gray-600 pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-teal-400">
                                                    {duty}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </PreviewSection>

                    <PreviewSection
                        title="Education & Training"
                        isEmpty={!d.education?.length}
                        placeholder="Your education will appear here"
                    >
                        <div className="space-y-2">
                            {d.education?.map((edu, i) => (
                                <div key={i} className="flex justify-between items-start gap-2">
                                    <div>
                                        <div className="text-sm font-semibold text-gray-800">
                                            {edu.qualification || edu.degree}
                                        </div>
                                        <div className="text-xs text-gray-500">{edu.institution || edu.school}</div>
                                    </div>
                                    <span className="text-xs text-gray-400 flex-shrink-0">{edu.year || edu.dates}</span>
                                </div>
                            ))}
                        </div>
                    </PreviewSection>

                    <PreviewSection
                        title="Certificates"
                        isEmpty={!d.certificates?.length}
                        placeholder="Certificates will appear here"
                    >
                        <ul className="space-y-1">
                            {d.certificates?.map((cert, i) => (
                                <li key={i} className="text-xs text-gray-600 pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-teal-400">
                                    {typeof cert === 'string' ? cert : cert.title || cert.name}
                                </li>
                            ))}
                        </ul>
                    </PreviewSection>

                    <PreviewSection
                        title="Availability"
                        isEmpty={!d.availability}
                        placeholder="Your availability will appear here"
                    >
                        <p className="text-sm text-gray-700">{d.availability}</p>
                    </PreviewSection>

                    <PreviewSection
                        title="References"
                        isEmpty={!d.references?.length}
                        placeholder="References will appear here"
                    >
                        <div className="space-y-2">
                            {d.references?.map((ref, i) => (
                                <div key={i}>
                                    <div className="text-sm font-semibold text-gray-800">{ref.name}</div>
                                    {ref.role    && <div className="text-xs text-gray-500">{ref.role}</div>}
                                    {ref.contact && <div className="text-xs text-teal-600">{ref.contact}</div>}
                                </div>
                            ))}
                        </div>
                    </PreviewSection>
                </div>
            </div>

            <p className="text-center text-xs text-teal-400 mt-4 italic">
                Start answering Panda's questions and watch your resume come to life!
            </p>
        </div>
    );
};

// ─── Step progress strip ───────────────────────────────────────────────────────

const StepStrip = ({ currentStepKey }) => {
    const idx = STEPS.findIndex(s => s.key === currentStepKey);
    return (
        <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar px-1">
            {STEPS.map((step, i) => {
                const done    = idx >= 0 && i < idx;
                const active  = i === idx;
                return (
                    <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                            active ? 'bg-teal-600 text-white shadow-sm' :
                            done   ? 'bg-teal-100 text-teal-600' :
                                     'bg-gray-100 text-gray-400'
                        }`}>
                            {done && <CheckCircle size={10} />}
                            <span>{step.label}</span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className={`w-3 h-px ${done ? 'bg-teal-300' : 'bg-gray-200'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Main component ────────────────────────────────────────────────────────────

const ResumeBuilder = () => {
    const navigate = useNavigate();
    const [session,     setSession]     = useState(null);
    const [messages,    setMessages]    = useState([]);
    const [inputText,   setInputText]   = useState('');
    const [loading,     setLoading]     = useState(false);
    const [sending,     setSending]     = useState(false);
    const [error,       setError]       = useState('');
    const [resumeTitle, setResumeTitle] = useState('My First Resume');
    const [savedId,     setSavedId]     = useState(null);
    const [started,     setStarted]     = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef       = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, sending]);

    const getErrorMessage = (err, defaultMsg) => {
        if (err.response?.status === 401) return 'Please log in again so Panda can help you.';
        if (err.response?.status === 404) return 'Panda Builder route is missing. Please check deployment.';
        if (err.response?.status === 503 && err.response?.data?.error === 'AI_NOT_CONFIGURED')
            return 'Panda is not ready yet. Please ask an admin to check the AI setup.';
        if (err.response?.status === 429 || err.response?.data?.error === 'AI_QUOTA_EXCEEDED')
            return 'Panda reached the AI service, but the Gemini quota is exhausted. Please try again later.';
        if (err.response?.status === 500) return 'Panda had trouble thinking. Please try again.';
        return err.response?.data?.message || defaultMsg;
    };

    const startSession = async () => {
        setStarted(true);
        setLoading(true);
        setError('');
        try {
            const res = await axios.post('/api/learner/resume-builder/start');
            setSession(res.data.session);
            setMessages([{
                id: Date.now(),
                sender: 'panda',
                text: res.data.reply,
                quickReplies: res.data.quickReplies,
                isReady: res.data.is_ready_to_preview,
            }]);
        } catch (err) {
            console.error('Failed to start session', err);
            setError(getErrorMessage(err, 'Could not connect to Panda. Please try again later.'));
            setStarted(false);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async (text) => {
        if (!text.trim() || sending) return;

        setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text }]);
        setInputText('');
        setSending(true);
        setError('');

        try {
            const res = await axios.post('/api/learner/resume-builder/message', { answer: text });
            setSession(prev => ({
                ...prev,
                current_step: res.data.next_step,
                draft_resume: res.data.draft,
            }));
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                sender: 'panda',
                text: res.data.reply,
                quickReplies: res.data.quickReplies,
                isReady: res.data.is_ready_to_preview,
            }]);
        } catch (err) {
            console.error('Failed to send message', err);
            setError(getErrorMessage(err, 'Panda had trouble thinking. Please try again.'));
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const saveResume = async () => {
        if (!session?.draft_resume) return;
        setSending(true);
        try {
            const res = await axios.post('/api/learner/resume-builder', {
                title: resumeTitle,
                target_role: session.draft_resume.target_role || 'General',
                template_key: 'simple',
                resume_data: session.draft_resume,
            });
            setSavedId(res.data.resumeId);
            setMessages(prev => [...prev, {
                id: Date.now(),
                sender: 'panda',
                text: 'Your resume has been saved! You earned some Panda XP! You can now download it as a PDF.',
            }]);
        } catch (err) {
            console.error('Failed to save resume', err);
            setError('Could not save resume. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const downloadPDF = () => {
        if (!savedId) return;
        window.open(`/api/learner/resume-builder/${savedId}/pdf?template=simple`, '_blank');
    };

    const draft   = session?.draft_resume || {};
    const lastMsg = messages[messages.length - 1];
    const isReady = Boolean(lastMsg?.isReady);
    const showQuickReplies =
        lastMsg?.sender === 'panda' &&
        Array.isArray(lastMsg?.quickReplies) &&
        lastMsg.quickReplies.length > 0;

    const stepKey    = session?.current_step || null;
    const stepIndex  = stepKey ? STEPS.findIndex(s => s.key === stepKey) : -1;
    const stepNumber = stepIndex >= 0 ? stepIndex + 1 : null;

    // progress bar width (0-100)
    const progressPct = stepNumber ? Math.round((stepNumber / STEPS.length) * 100) : 0;

    return (
        <div className="flex flex-col bg-gradient-to-br from-teal-50 via-cyan-50 to-teal-50 h-[calc(100vh-64px)] lg:h-screen">

            {/* ── TOP HEADER ── */}
            <header className="flex-shrink-0 bg-white border-b border-teal-100 shadow-sm z-10">
                <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5">
                    {/* Back */}
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors flex-shrink-0"
                        aria-label="Go back to dashboard"
                    >
                        <ArrowLeft size={17} />
                    </button>

                    {/* Title + subtitle */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-sm sm:text-base font-bold text-teal-900 leading-tight truncate">
                            My Resume with Panda
                        </h1>
                        <p className="text-[11px] text-teal-500 leading-tight hidden sm:block">
                            Answer simple questions — Panda builds your resume.
                        </p>
                    </div>

                    {/* Step chip */}
                    {stepNumber && (
                        <div className="hidden sm:flex items-center gap-1.5 text-xs text-teal-700 font-semibold bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100 flex-shrink-0">
                            Step {stepNumber} of {STEPS.length}
                        </div>
                    )}

                    {/* Save status */}
                    {savedId ? (
                        <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-100 flex-shrink-0">
                            <CheckCircle size={12} />
                            <span className="hidden sm:inline">Saved</span>
                        </div>
                    ) : started && Object.keys(draft).length > 0 ? (
                        <span className="text-[11px] text-amber-500 font-medium hidden md:block flex-shrink-0">
                            Not saved yet
                        </span>
                    ) : null}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {isReady && !savedId && (
                            <button
                                onClick={saveResume}
                                disabled={sending}
                                title="Save your resume"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-teal-900 rounded-xl font-bold text-xs transition-colors disabled:opacity-50 shadow-sm"
                            >
                                <Save size={13} />
                                <span className="hidden sm:inline">Save</span>
                            </button>
                        )}
                        {savedId && (
                            <button
                                onClick={downloadPDF}
                                title="Download PDF"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
                            >
                                <Download size={13} />
                                <span className="hidden sm:inline">PDF</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-teal-50">
                    <div
                        className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all duration-700 ease-out"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>

                {/* Step strip (scrollable on mobile) */}
                {started && stepKey && (
                    <div className="px-3 sm:px-4 py-2 border-t border-teal-50 overflow-x-auto">
                        <StepStrip currentStepKey={stepKey} />
                    </div>
                )}
            </header>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3 lg:p-4 overflow-hidden">

                {/* ── LEFT: PANDA CHAT PANEL ── */}
                <div className="w-full lg:w-[400px] xl:w-[440px] flex-shrink-0 flex flex-col min-h-0">
                    <div className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl shadow-md border border-teal-100 overflow-hidden">

                        {/* Panda status bar */}
                        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-teal-50 bg-gradient-to-r from-teal-50/80 to-cyan-50/80">
                            <div className="w-9 h-9 rounded-full bg-white shadow-sm border-2 border-teal-100 flex items-center justify-center text-lg flex-shrink-0">
                                🐼
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-teal-800 leading-tight">Panda</p>
                                <p className="text-[11px] text-teal-400 leading-tight">
                                    {sending ? 'Thinking…' : started ? 'Ready to help' : 'Waiting to start'}
                                </p>
                            </div>
                            {sending && (
                                <div className="w-4 h-4 border-2 border-teal-300 border-t-teal-600 rounded-full animate-spin flex-shrink-0" />
                            )}
                        </div>

                        {/* Messages area */}
                        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
                            {!started ? (
                                <WelcomeCard onStart={startSession} loading={false} />
                            ) : loading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-teal-400">
                                    <div className="w-7 h-7 border-2 border-teal-300 border-t-teal-600 rounded-full animate-spin" />
                                    <p className="text-sm font-medium">Starting Panda…</p>
                                </div>
                            ) : (
                                <>
                                    <AnimatePresence initial={false}>
                                        {messages.map((msg, idx) => (
                                            <React.Fragment key={msg.id}>
                                                {msg.sender === 'panda' ? (
                                                    <PandaBubble text={msg.text} />
                                                ) : (
                                                    <LearnerBubble text={msg.text} />
                                                )}
                                                {/* Quick replies — only for the latest panda message */}
                                                {msg.sender === 'panda' &&
                                                    idx === messages.length - 1 &&
                                                    showQuickReplies && (
                                                    <QuickReplyChips
                                                        replies={msg.quickReplies}
                                                        onSelect={sendMessage}
                                                        disabled={sending}
                                                    />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </AnimatePresence>

                                    {sending && <TypingIndicator />}

                                    {error && (
                                        <ErrorCard
                                            message={error}
                                            onRetry={() => {
                                                setError('');
                                                if (messages.length === 0) startSession();
                                            }}
                                        />
                                    )}

                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Input row — shown once session has started */}
                        {started && !loading && (
                            <div className="flex-shrink-0 px-3 py-2.5 border-t border-teal-50 bg-gray-50/60">
                                <form
                                    onSubmit={(e) => { e.preventDefault(); sendMessage(inputText); }}
                                    className="flex gap-2"
                                >
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        disabled={sending}
                                        placeholder="Type your answer…"
                                        className="flex-1 rounded-xl px-3.5 py-2.5 text-sm bg-white border border-teal-100 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all text-teal-900 placeholder-teal-300 disabled:opacity-60"
                                    />
                                    <button
                                        type="submit"
                                        disabled={sending || !inputText.trim()}
                                        aria-label="Send message"
                                        className="w-10 h-10 flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
                                    >
                                        <Send size={15} />
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT: RESUME LIVE PREVIEW ── */}
                <div className="flex-1 min-h-0 flex flex-col min-w-0">
                    {/* Preview header */}
                    <div className="flex-shrink-0 flex items-center justify-between mb-2.5 px-1">
                        <div>
                            <p className="text-[10px] font-bold text-teal-500 uppercase tracking-widest">Live Preview</p>
                            <input
                                type="text"
                                value={resumeTitle}
                                onChange={(e) => setResumeTitle(e.target.value)}
                                className="text-sm font-bold text-teal-800 bg-transparent border-b border-transparent focus:border-teal-400 focus:outline-none transition-colors max-w-[200px]"
                                placeholder="Resume Title"
                            />
                        </div>
                        {/* Mobile-only save/download buttons */}
                        <div className="flex gap-2 lg:hidden">
                            {isReady && !savedId && (
                                <button
                                    onClick={saveResume}
                                    disabled={sending}
                                    className="w-9 h-9 flex items-center justify-center bg-amber-400 hover:bg-amber-500 text-teal-900 rounded-xl font-bold transition-colors disabled:opacity-50 shadow-sm"
                                    title="Save resume"
                                >
                                    <Save size={15} />
                                </button>
                            )}
                            {savedId && (
                                <button
                                    onClick={downloadPDF}
                                    className="w-9 h-9 flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-colors shadow-sm"
                                    title="Download PDF"
                                >
                                    <Download size={15} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable preview area */}
                    <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl">
                        <ResumeLivePreview draft={draft} />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ResumeBuilder;
