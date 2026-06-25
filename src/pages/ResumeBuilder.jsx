import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Save, CheckCircle, FileText, Download } from 'lucide-react';
import axios from 'axios';
import SensoryBackground from '../components/SensoryBackground';
import AICharacter from '../components/AICharacter';

const ResumeBuilder = () => {
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [resumeTitle, setResumeTitle] = useState('My First Resume');
    const [savedId, setSavedId] = useState(null);
    const messagesEndRef = useRef(null);

    const isClay = false;

    useEffect(() => {
        startSession();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, session?.draft_resume, loading, sending]);

    const getErrorMessage = (err, defaultMsg) => {
        if (err.response?.status === 401) return 'Please log in again so Panda can help you.';
        if (err.response?.status === 404) return 'Panda Builder route is missing. Please check deployment.';
        if (err.response?.status === 503 && err.response?.data?.error === 'AI_NOT_CONFIGURED') {
            return 'Panda is not ready yet. Please ask an admin to check the AI setup.';
        }
        if (err.response?.status === 429 || err.response?.data?.error === 'AI_QUOTA_EXCEEDED') {
            return 'Panda reached the AI service, but the Gemini quota is exhausted. Please try again later.';
        }
        if (err.response?.status === 500) return 'Panda had trouble thinking. Please try again.';
        return err.response?.data?.message || defaultMsg;
    };

    const startSession = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.post('/api/learner/resume-builder/start');
            setSession(res.data.session);
            
            // Use backend-provided initial greeting
            setMessages([{
                id: Date.now(),
                sender: 'panda',
                text: res.data.reply,
                quickReplies: res.data.quickReplies,
                isReady: res.data.is_ready_to_preview
            }]);
        } catch (err) {
            console.error('Failed to start session', err);
            setError(getErrorMessage(err, 'Could not connect to Panda. Please try again later.'));
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async (text) => {
        if (!text.trim() || sending) return;

        const userMsg = { id: Date.now(), sender: 'user', text };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setSending(true);
        setError('');

        try {
            const res = await axios.post('/api/learner/resume-builder/message', { answer: text });
            
            setSession(prev => ({
                ...prev,
                current_step: res.data.next_step,
                draft_resume: res.data.draft
            }));

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                sender: 'panda',
                text: res.data.reply,
                quickReplies: res.data.quickReplies,
                isReady: res.data.is_ready_to_preview
            }]);

        } catch (err) {
            console.error('Failed to send message', err);
            setError(getErrorMessage(err, 'Panda had trouble thinking. Please try again.'));
        } finally {
            setSending(false);
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
                resume_data: session.draft_resume
            });
            setSavedId(res.data.resumeId);
            setMessages(prev => [...prev, {
                id: Date.now(),
                sender: 'panda',
                text: "Your resume has been saved! You earned some Panda XP! You can now download it as a PDF."
            }]);
        } catch (err) {
            console.error('Failed to save resume', err);
            setError('Could not save resume.');
        } finally {
            setSending(false);
        }
    };

    const downloadPDF = () => {
        if (!savedId) return;
        window.open(`/api/learner/resume-builder/${savedId}/pdf?template=simple`, '_blank');
    };

    const draft = session?.draft_resume || {};
    const isReady = messages[messages.length - 1]?.isReady || false;

    return (
        <div className={`h-full w-full relative flex flex-col md:flex-row font-sans ${isClay ? 'ui-clay-page text-[color:var(--clay-text)]' : 'bg-[#e0f7fa] text-[#00695C]'}`}>
            <SensoryBackground />

            {/* Chat Panel */}
            <div className={`flex flex-col w-full md:w-1/2 lg:w-5/12 h-full z-10 ${isClay ? 'border-r border-white/30' : 'border-r-4 border-[#00695C]/10'}`}>
                <header className={`px-4 py-4 flex items-center gap-3 relative z-20 ${isClay ? 'ui-clay-topbar border-b border-white/30' : 'bg-white/85 backdrop-blur-md shadow-sm border-b-2 border-[#00695C]/10'}`}>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className={`w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 transition-transform ${isClay ? 'ui-clay-button-secondary text-[#21A7F1]' : 'bg-[#00897B] text-white'}`}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className={`text-xl font-black italic tracking-tighter uppercase ${isClay ? 'ui-clay-heading' : 'text-[#00695C]'}`}>Resume Builder</h1>
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                    {messages.map((msg, idx) => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                            {msg.sender === 'panda' && idx === messages.length - 1 && (
                                <div className="w-16 h-16 mb-2">
                                    <AICharacter mood="happy" isSpeaking={false} />
                                </div>
                            )}
                            <div className={`max-w-[85%] rounded-3xl p-4 shadow-md ${
                                msg.sender === 'user' 
                                ? (isClay ? 'bg-[#21A7F1] text-white rounded-br-sm' : 'bg-[#00897B] text-white rounded-br-sm') 
                                : (isClay ? 'bg-white text-[color:var(--clay-text)] rounded-bl-sm' : 'bg-white text-[#00695C] border-2 border-[#00695C]/20 rounded-bl-sm')
                            }`}>
                                <p className="font-bold text-sm md:text-base leading-snug">{msg.text}</p>
                            </div>

                            {msg.quickReplies && msg.quickReplies.length > 0 && idx === messages.length - 1 && (
                                <div className="flex flex-wrap gap-2 mt-3 w-full max-w-[85%]">
                                    {msg.quickReplies.map((qr, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => sendMessage(qr)}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-transform hover:scale-105 ${isClay ? 'bg-white/80 border border-white text-[#21A7F1]' : 'bg-yellow-300 text-[#00695C] hover:bg-yellow-400'}`}
                                        >
                                            {qr}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {sending && (
                        <div className="flex items-start">
                             <div className={`max-w-[85%] rounded-3xl p-4 shadow-md ${isClay ? 'bg-white/50 text-[color:var(--clay-text-soft)] rounded-bl-sm' : 'bg-white/50 text-[#00695C]/60 rounded-bl-sm border border-dashed border-[#00695C]/30'}`}>
                                <p className="font-bold text-sm italic animate-pulse">Panda is thinking...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-100 border-2 border-red-300 text-red-700 p-3 rounded-xl text-sm font-bold text-center">
                            {error}
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className={`absolute bottom-0 left-0 right-0 md:right-1/2 lg:right-7/12 p-4 z-20 ${isClay ? 'bg-white/20 backdrop-blur-xl border-t border-white/40' : 'bg-white/80 backdrop-blur-md border-t-2 border-[#00695C]/10'}`}>
                    <form 
                        onSubmit={(e) => { e.preventDefault(); sendMessage(inputText); }}
                        className="flex gap-2"
                    >
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            disabled={sending}
                            placeholder="Type your answer here..."
                            className={`flex-1 rounded-2xl px-4 py-3 font-bold text-sm focus:outline-none transition-all ${isClay ? 'bg-white border-2 border-white/50 focus:border-[#21A7F1]' : 'bg-gray-50 border-2 border-[#00695C]/20 focus:border-[#00897B]'}`}
                        />
                        <button 
                            type="submit"
                            disabled={sending || !inputText.trim()}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform ${inputText.trim() && !sending ? 'hover:scale-105 active:scale-95' : 'opacity-50'} ${isClay ? 'bg-[#21A7F1] text-white shadow-md' : 'bg-[#00897B] text-white shadow-md'}`}
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            </div>

            {/* Preview Panel */}
            <div className={`hidden md:flex flex-col w-1/2 lg:w-7/12 h-full z-10 bg-white/40 backdrop-blur-md ${isClay ? '' : 'border-l-4 border-white'}`}>
                 <header className={`px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-20 ${isClay ? 'ui-clay-surface border-b border-white/30 m-4 rounded-2xl' : 'bg-white shadow-sm border-b-2 border-[#00695C]/10'}`}>
                    <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${isClay ? 'text-[#21A7F1]' : 'text-[#00897B]'}`}>Live Preview</p>
                        <input 
                            type="text" 
                            value={resumeTitle}
                            onChange={(e) => setResumeTitle(e.target.value)}
                            className={`text-2xl font-black italic tracking-tighter uppercase bg-transparent border-b-2 focus:outline-none transition-colors ${isClay ? 'ui-clay-heading border-transparent focus:border-[#21A7F1]' : 'text-[#00695C] border-transparent focus:border-[#00897B]'}`}
                            placeholder="Resume Title"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {isReady && !savedId && (
                            <button 
                                onClick={saveResume}
                                disabled={sending}
                                className={`flex items-center gap-2 px-6 py-3 rounded-full font-black text-sm transition-transform hover:scale-105 shadow-xl ${isClay ? 'bg-green-400 text-white border-2 border-green-300' : 'bg-yellow-400 text-[#00695C] border-2 border-yellow-300'}`}
                            >
                                <Save size={18} /> SAVE
                            </button>
                        )}
                        {savedId && (
                            <>
                                <div className={`flex items-center gap-2 px-4 py-3 rounded-full font-black text-sm shadow-xl ${isClay ? 'bg-green-100 text-green-700' : 'bg-green-500 text-white'}`}>
                                    <CheckCircle size={18} /> SAVED!
                                </div>
                                <button 
                                    onClick={downloadPDF}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-full font-black text-sm transition-transform hover:scale-105 shadow-xl ${isClay ? 'bg-[#21A7F1] text-white border-2 border-sky-300' : 'bg-[#00897B] text-white border-2 border-teal-500'}`}
                                >
                                    <Download size={18} /> PDF
                                </button>
                            </>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    {Object.keys(draft).length === 0 ? (
                        <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
                            <FileText size={48} className="mb-4" />
                            <p className="font-bold text-center max-w-xs">Your resume will appear here as you answer Panda's questions.</p>
                        </div>
                    ) : (
                        <div className={`w-full max-w-2xl mx-auto p-8 rounded-xl shadow-2xl ${isClay ? 'bg-white text-[color:var(--clay-text)]' : 'bg-white text-gray-800'}`}>
                            {/* Header Section */}
                            <div className="border-b-4 border-gray-200 pb-6 mb-6">
                                <h1 className="text-4xl font-black tracking-tight text-gray-900 uppercase">
                                    {draft.personal_name || 'YOUR NAME'}
                                </h1>
                                <div className="mt-2 text-sm font-bold text-gray-500 flex gap-4">
                                    {draft.contact_email && <span>{draft.contact_email}</span>}
                                    {draft.contact_phone && <span>{draft.contact_phone}</span>}
                                    {draft.contact_address && <span>{draft.contact_address}</span>}
                                </div>
                            </div>

                            {/* Summary */}
                            {draft.summary && (
                                <div className="mb-6">
                                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest mb-2 border-b border-gray-200 pb-1">Professional Summary</h2>
                                    <p className="text-sm font-medium text-gray-700 leading-relaxed">{draft.summary}</p>
                                </div>
                            )}

                            {/* Experience */}
                            {draft.experience && draft.experience.length > 0 && (
                                <div className="mb-6">
                                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest mb-3 border-b border-gray-200 pb-1">Experience</h2>
                                    <div className="space-y-4">
                                        {draft.experience.map((exp, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between items-baseline">
                                                    <h3 className="font-bold text-gray-900">{exp.role}</h3>
                                                    <span className="text-xs font-bold text-gray-500">{exp.dates}</span>
                                                </div>
                                                <div className="text-sm font-bold text-gray-600 mb-1">{exp.organization}</div>
                                                {exp.duties && (
                                                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                                        {Array.isArray(exp.duties) 
                                                            ? exp.duties.map((duty, j) => <li key={j}>{duty}</li>)
                                                            : <li>{exp.duties}</li>}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Skills */}
                            {draft.skills && draft.skills.length > 0 && (
                                <div className="mb-6">
                                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest mb-3 border-b border-gray-200 pb-1">Skills</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {draft.skills.map((skill, i) => (
                                            <span key={i} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Education */}
                            {draft.education && draft.education.length > 0 && (
                                <div className="mb-6">
                                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest mb-3 border-b border-gray-200 pb-1">Education & Training</h2>
                                    <div className="space-y-3">
                                        {draft.education.map((edu, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between items-baseline">
                                                    <h3 className="font-bold text-gray-900">{edu.qualification || edu.degree}</h3>
                                                    <span className="text-xs font-bold text-gray-500">{edu.year || edu.dates}</span>
                                                </div>
                                                <div className="text-sm text-gray-600">{edu.institution || edu.school}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                             {/* Certificates */}
                             {draft.certificates && draft.certificates.length > 0 && (
                                <div className="mb-6">
                                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest mb-3 border-b border-gray-200 pb-1">Certificates</h2>
                                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                        {draft.certificates.map((cert, i) => (
                                            <li key={i}>{typeof cert === 'string' ? cert : cert.title || cert.name}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
            
            {/* Mobile Actions Overlay */}
            <div className="md:hidden absolute top-20 right-4 z-30 flex flex-col gap-2">
                {isReady && !savedId && (
                     <button 
                        onClick={saveResume}
                        disabled={sending}
                        className={`flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-transform hover:scale-110 active:scale-95 ${isClay ? 'bg-green-400 text-white' : 'bg-yellow-400 text-[#00695C]'}`}
                    >
                        <Save size={24} />
                    </button>
                )}
                {savedId && (
                    <button 
                        onClick={downloadPDF}
                        className={`flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-transform hover:scale-110 active:scale-95 ${isClay ? 'bg-[#21A7F1] text-white' : 'bg-[#00897B] text-white'}`}
                    >
                        <Download size={24} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default ResumeBuilder;
