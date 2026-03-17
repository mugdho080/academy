import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, BookOpen, Settings, LogOut, CheckCircle, Clock, Plus, Trash2, Edit2, Save, ChevronRight, ArrowLeft, FileText, HelpCircle, Upload, LayoutDashboard, X, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import CRMProfileModal from './admin/CRMProfileModal';
import ResponsiveTable from '../components/layout/ResponsiveTable';
import { useUiVariant } from '../context/UiVariantContext';
import ClayToggle from '../components/clay/ClayToggle';

const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [crmFilter, setCrmFilter] = useState('new'); // 'new' | 'agreement'
    const [users, setUsers] = useState([]);
    const [content, setContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState(null); // { type, id, data }

    // Drill-down navigation state
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [selectedLevel, setSelectedLevel] = useState(null);
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [viewingCRMProfile, setViewingCRMProfile] = useState(null); // null or user.id
    const [viewingAgreement, setViewingAgreement] = useState(null);
    const [importingJson, setImportingJson] = useState(false); // boolean for modal
    const [jsonInput, setJsonInput] = useState('');
    const [adminNavOpen, setAdminNavOpen] = useState(false);
    const { variant, setVariant } = useUiVariant('admin');
    const isClay = variant === 'clay';

    const navigate = useNavigate();

    const handleViewAgreement = async (userId) => {
        setViewingAgreement('loading');
        try {
            const res = await axios.get(`/api/admin/fetch_agreement.php?user_id=${userId}`);
            if (res.data.error) {
                setViewingAgreement({ signature_data: null }); // Show not found state
            } else {
                setViewingAgreement(res.data);
            }
        } catch (err) {
            console.error("Failed to fetch agreement", err);
            alert("Failed to fetch agreement details");
            setViewingAgreement(null);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    useEffect(() => {
        setAdminNavOpen(false);
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'crm') {
                const res = await axios.get('/api/admin/fetch_users');
                setUsers(Array.isArray(res.data) ? res.data : []);
            } else {
                const res = await axios.get('/api/admin/fetch_content');
                setContent(Array.isArray(res.data) ? res.data : []);
            }
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (userId, newStatus) => {
        try {
            await axios.post('/api/admin/update_status', { user_id: userId, status: newStatus });
            fetchData();
        } catch (err) {
            alert("Failed to update status");
        }
    };

    const handleSaveContent = async (type, item) => {
        try {
            await axios.post('/api/admin/save_content', { ...item, type });
            setEditingItem(null);
            fetchData(); // Refresh tree
        } catch (err) {
            console.error("Save Error:", err);
            const msg = err.response?.data?.error || err.message || "Unknown error";
            alert(`Failed to save content: ${msg}`);
        }
    };

    const handleImportContent = async () => {
        if (!window.confirm("⚠️ WARNING: This will DELETE all existing content and import the new JSON data. Are you sure?")) return;
        setLoading(true);
        try {
            const res = await axios.post('/api/admin/import_content');
            if (res.data.success) {
                alert("✅ Content Imported Successfully!");
                fetchData();
                setSelectedChapter(null);
                setSelectedLevel(null);
                setSelectedLesson(null);
            } else {
                alert("❌ Import Failed: " + (res.data.error || "Unknown Error"));
            }
        } catch (err) {
            console.error("Import Error:", err);
            alert("❌ Import Error: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };
    const handleImportLevelJson = async () => {
        if (!jsonInput.trim()) {
            alert("Please paste your JSON first.");
            return;
        }

        try {
            const parsed = JSON.parse(jsonInput);

            // Allow them to paste either the `{ level_number: 1, ... }` object directly,
            // or the full format if they specifically copied the 'level' object from inside chapters > levels
            const levelData = parsed.levels ? parsed.levels[0] : parsed.level_title ? parsed : null;

            if (!levelData) {
                alert("Invalid format: Could not find 'level_title' or a 'levels' array in your JSON.");
                return;
            }

            setLoading(true);
            const res = await axios.post('/api/admin/add_level_json', {
                chapter_id: selectedChapter.id,
                level: levelData
            });

            if (res.data.success) {
                alert("✅ Level Added Successfully!");
                setImportingJson(false);
                setJsonInput('');
                fetchData(); // Refresh the list
            } else {
                alert("❌ Error: " + (res.data.error || "Unknown Error"));
            }
        } catch (err) {
            console.error("JSON Error:", err);
            alert("❌ Invalid JSON or Server Error: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };


    const formatTime = (totalSeconds) => {
        if (!totalSeconds) return "0m";
        const totalMins = Math.floor(totalSeconds / 60);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    };

    // Helper to get current view data
    const getCurrentLevels = () => selectedChapter ? (content.find(c => c.id === selectedChapter.id)?.levels || []) : [];
    const getCurrentLessons = () => selectedLevel ? (getCurrentLevels().find(l => l.id === selectedLevel.id)?.lessons || []) : [];
    const getCurrentQuizzes = () => selectedLesson ? (getCurrentLessons().find(l => l.id === selectedLesson.id)?.quizzes || []) : [];

    return (
        <div className={`min-h-screen flex relative ${isClay ? 'ui-variant-clay ui-admin-shell admin-page-shell' : 'bg-gray-50'}`}>
            {adminNavOpen && (
                <button
                    onClick={() => setAdminNavOpen(false)}
                    className="lg:hidden fixed inset-0 bg-black/40 z-20"
                    aria-label="Close admin navigation overlay"
                />
            )}

            <header className={`lg:hidden fixed top-0 inset-x-0 z-30 px-3 py-3 border-b ${isClay ? 'ui-clay-topbar border-white/60' : 'bg-primary-dark text-white border-white/10'}`}>
                <div className="flex items-center justify-between gap-3">
                    <button
                        onClick={() => setAdminNavOpen((prev) => !prev)}
                        className={`h-11 w-11 rounded-xl flex items-center justify-center ${isClay ? 'ui-clay-button-secondary' : 'bg-white/10'}`}
                        aria-label="Open admin navigation"
                        aria-expanded={adminNavOpen}
                    >
                        <Menu size={22} />
                    </button>
                    <div className="text-center">
                        <p className={`text-[11px] uppercase tracking-[0.14em] font-black ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-primary-light'}`}>Goodwill Care Academy</p>
                        <p className="text-base font-black">Admin Panel</p>
                    </div>
                    <div className="w-11" aria-hidden="true" />
                </div>
            </header>

            <aside className={`w-64 p-4 sm:p-6 space-y-8 fixed h-full z-40 transition-transform duration-200 ${isClay ? 'ui-clay-sidebar text-[color:var(--clay-text)]' : 'bg-primary-dark text-white'} ${adminNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div>
                    <h1 className="text-2xl font-bold">LMS Admin</h1>
                    <p className={`text-sm ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-primary-light'}`}>Goodwill Care Academy Portal</p>
                </div>

                <nav className="space-y-4">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTab === 'dashboard' ? (isClay ? 'ui-clay-surface' : 'bg-white/20') : isClay ? 'hover:bg-white/35' : 'hover:bg-white/10'}`}
                    >
                        <LayoutDashboard size={20} /> Command Centre
                    </button>
                    <button
                        onClick={() => { setActiveTab('crm'); setSelectedChapter(null); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTab === 'crm' ? (isClay ? 'ui-clay-surface' : 'bg-white/20') : isClay ? 'hover:bg-white/35' : 'hover:bg-white/10'}`}
                    >
                        <Users size={20} /> Students
                    </button>
                    <button
                        onClick={() => setActiveTab('content')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTab === 'content' ? (isClay ? 'ui-clay-surface' : 'bg-white/20') : isClay ? 'hover:bg-white/35' : 'hover:bg-white/10'}`}
                    >
                        <BookOpen size={20} /> Curriculum
                    </button>
                    <button
                        onClick={() => navigate('/admin/invoicing')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${isClay ? 'hover:bg-white/35' : 'hover:bg-white/10'}`}
                    >
                        <FileText size={20} /> Invoicing
                    </button>
                </nav>

                <ClayToggle
                    label="Admin pages"
                    value={variant}
                    onChange={setVariant}
                    options={[
                        { label: 'Classic', value: 'classic' },
                        { label: 'Clay', value: 'clay' }
                    ]}
                    appearance={isClay ? 'clay' : 'classic'}
                    compact={true}
                />

                <button
                    onClick={async () => {
                        try {
                            await axios.post('/api/auth/logout', {}, { withCredentials: true });
                        } catch (_) {
                            // Ignore logout API errors and still redirect.
                        }
                        localStorage.removeItem('user');
                        localStorage.removeItem('ndis_session_id');
                        navigate('/login');
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors mt-auto absolute bottom-8 left-4 right-4 sm:left-6 sm:right-6 ${isClay ? 'ui-clay-button-danger' : 'hover:bg-red-500'}`}
                >
                    <LogOut size={20} /> Logout
                </button>
            </aside>

            <main className="flex-1 p-3 sm:p-5 lg:p-10 pt-20 lg:pt-10 lg:ml-64">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className={`font-bold ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-gray-500'}`}>Loading your dashboard...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'dashboard' && (
                            <div className={`rounded-3xl p-6 sm:p-8 ${isClay ? 'ui-clay-surface' : 'bg-white shadow-sm border border-gray-100'}`}>
                                <h2 className={`text-2xl sm:text-3xl font-bold ${isClay ? 'ui-clay-heading' : 'text-gray-800'}`}>Admin Command Center</h2>
                                <p className={`text-sm sm:text-base mt-3 max-w-2xl ${isClay ? 'ui-clay-text-soft' : 'text-gray-500'}`}>
                                    Open the customizable dashboard to monitor learners, engagement, finance, compliance, and operations with widget-based layouts.
                                </p>
                                <div className="mt-6">
                                    <button
                                        onClick={() => navigate('/admin/dashboard')}
                                        className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold ${isClay ? 'ui-clay-button-primary' : 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20'}`}
                                    >
                                        <LayoutDashboard size={18} />
                                        Open Admin Dashboard
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'crm' && (
                            <div className="space-y-5 sm:space-y-8">
                                <h2 className={`text-2xl sm:text-3xl font-bold ${isClay ? 'ui-clay-heading' : 'text-gray-800'}`}>Student Management</h2>

                                <div className="flex flex-wrap gap-2 sm:gap-4 border-b border-gray-200 pb-1">
                                    <button
                                        onClick={() => setCrmFilter('new')}
                                        className={`px-4 sm:px-6 py-3 font-bold rounded-t-xl transition-all text-sm sm:text-base ${crmFilter === 'new' ? (isClay ? 'ui-clay-surface text-[#21A7F1]' : 'bg-white border-x border-t border-gray-100 text-primary') : isClay ? 'text-[color:var(--clay-text-soft)] hover:text-[color:var(--clay-text)]' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        New Signups ({users.filter(u => !u.status || u.status === 'new' || u.status === 'locked').length})
                                    </button>
                                    <button
                                        onClick={() => setCrmFilter('agreement')}
                                        className={`px-4 sm:px-6 py-3 font-bold rounded-t-xl transition-all text-sm sm:text-base ${crmFilter === 'agreement' ? (isClay ? 'ui-clay-surface text-[#21A7F1]' : 'bg-white border-x border-t border-gray-100 text-primary') : isClay ? 'text-[color:var(--clay-text-soft)] hover:text-[color:var(--clay-text)]' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Service Agreements ({users.filter(u => u.status === 'pending' || u.status === 'active').length})
                                    </button>
                                </div>

                                <div className={`rounded-b-[2.5rem] rounded-tr-[2.5rem] p-1 ${isClay ? 'ui-clay-surface' : 'bg-white shadow-sm border border-gray-100'}`}>
                                    <ResponsiveTable className="border-0 rounded-[2rem]">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="p-6 font-bold text-gray-600">Student</th>
                                                <th className="p-6 font-bold text-gray-600">NDIS No.</th>
                                                <th className="p-6 font-bold text-gray-600">Active Time</th>
                                                <th className="p-6 font-bold text-gray-600">Status</th>
                                                <th className="p-6 font-bold text-gray-600">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.filter(u => {
                                                if (crmFilter === 'new') return !u.status || u.status === 'new' || u.status === 'locked';
                                                if (crmFilter === 'agreement') return u.status === 'pending' || u.status === 'active';
                                                return true;
                                            }).map(u => (
                                                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                    <td className="p-6">
                                                        <div
                                                            className="font-bold text-gray-800 cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
                                                            onClick={() => setViewingCRMProfile(u.id)}
                                                        >
                                                            {u.name} <Edit2 size={12} className="text-gray-400" />
                                                        </div>
                                                        <div className="text-sm text-gray-500">{u.email}</div>
                                                    </td>
                                                    <td className="p-6 font-mono text-primary font-bold">{u.ndis_number}</td>
                                                    <td className="p-6 flex items-center gap-2"><Clock size={16} /> {formatTime(u.total_active_seconds)}</td>
                                                    <td className="p-6">
                                                        <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${u.status === 'active' ? 'bg-green-100 text-green-600' : u.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                                                            {u.status || 'New'}
                                                        </span>
                                                    </td>
                                                    <td className="p-6">
                                                        {u.status === 'pending' && (
                                                            <div className="flex flex-wrap gap-2">
                                                                <button
                                                                    onClick={() => handleViewAgreement(u.id)}
                                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                                                                >
                                                                    <FileText size={16} /> View Agreement
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(u.id, 'active')}
                                                                    className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                                                                >
                                                                    <CheckCircle size={16} /> Approve
                                                                </button>
                                                            </div>
                                                        )}
                                                        {u.status === 'active' && (
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-green-500 font-bold flex items-center gap-1"><CheckCircle size={16} /> Active</span>
                                                                <button
                                                                    onClick={() => handleViewAgreement(u.id)}
                                                                    className="text-gray-400 hover:text-primary text-sm underline"
                                                                >
                                                                    View Agreement
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {users.filter(u => crmFilter === 'new' ? (!u.status || u.status === 'new' || u.status === 'locked') : (u.status === 'pending' || u.status === 'active')).length === 0 && (
                                                <tr>
                                                    <td colSpan="5" className="p-8 text-center text-gray-400">No students found in this category.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    </ResponsiveTable>
                                </div>
                            </div>
                        )}

                        {activeTab === 'content' && (
                            <div className="space-y-5 sm:space-y-8">
                                {/* Breadcrumbs */}
                                <div className="flex flex-wrap items-center gap-2 text-gray-500 font-medium text-sm sm:text-base">
                                    <span
                                        onClick={() => { setSelectedChapter(null); setSelectedLevel(null); setSelectedLesson(null); }}
                                        className="cursor-pointer hover:text-primary"
                                    >
                                        Curriculum
                                    </span>
                                    {selectedChapter && (
                                        <>
                                            <ChevronRight size={16} />
                                            <span
                                                onClick={() => { setSelectedLevel(null); setSelectedLesson(null); }}
                                                className="cursor-pointer hover:text-primary"
                                            >
                                                {selectedChapter.title}
                                            </span>
                                        </>
                                    )}
                                    {selectedLevel && (
                                        <>
                                            <ChevronRight size={16} />
                                            <span
                                                onClick={() => setSelectedLesson(null)}
                                                className="cursor-pointer hover:text-primary"
                                            >
                                                {selectedLevel.title}
                                            </span>
                                        </>
                                    )}
                                    {selectedLesson && (
                                        <>
                                            <ChevronRight size={16} />
                                            <span className="text-gray-800">{selectedLesson.title}</span>
                                        </>
                                    )}
                                </div>

                                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3">
                                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
                                        {selectedLesson ? `Quizzes for ${selectedLesson.title}` :
                                            selectedLevel ? `Lessons in ${selectedLevel.title}` :
                                                selectedChapter ? `Levels in ${selectedChapter.title}` :
                                                    'All Chapters'}
                                    </h2>
                                    <div className="flex flex-wrap gap-2 sm:gap-3">
                                        {!selectedChapter && (
                                            <button
                                                onClick={handleImportContent}
                                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 sm:px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg text-sm sm:text-base"
                                            >
                                                <Upload size={20} /> Import ALL JSON
                                            </button>
                                        )}
                                        {selectedChapter && !selectedLevel && (
                                            <button
                                                onClick={() => setImportingJson(true)}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg text-sm sm:text-base"
                                            >
                                                <Upload size={20} /> Add Level JSON
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (selectedLesson) setEditingItem({ type: 'quiz', data: { lesson_id: selectedLesson.id, question: '', options: ['', '', ''], correct_answer: 0 } });
                                                else if (selectedLevel) setEditingItem({ type: 'lesson', data: { level_id: selectedLevel.id, title: '', content: '', order_index: getCurrentLessons().length } });
                                                else if (selectedChapter) setEditingItem({ type: 'level', data: { chapter_id: selectedChapter.id, title: '', video_url: '', is_free: 0, order_index: getCurrentLevels().length } });
                                                else setEditingItem({ type: 'chapter', data: { title: '', emoji: '📚', order_index: content.length } });
                                            }}
                                            className="bg-primary hover:bg-primary-dark text-white px-4 sm:px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg text-sm sm:text-base"
                                        >
                                            <Plus size={20} /> Add {selectedLesson ? 'Quiz' : selectedLevel ? 'Lesson' : selectedChapter ? 'Level' : 'Chapter'}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                                    {/* Chapters View */}
                                    {!selectedChapter && content.map(chapter => (
                                        <motion.div
                                            key={chapter.id}
                                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                            onClick={() => setSelectedChapter(chapter)}
                                            className="bg-white p-4 sm:p-8 rounded-[2rem] sm:rounded-[3rem] shadow-sm border border-gray-100 cursor-pointer hover:border-primary-light transition-all group relative"
                                        >
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-4xl">{chapter.emoji}</span>
                                                    <div>
                                                        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 group-hover:text-primary transition-colors">{chapter.title}</h3>
                                                        <p className="text-gray-500">{chapter.levels?.length || 0} Levels</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'chapter', data: chapter }); }}
                                                    className="p-3 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 z-10"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {/* Levels View */}
                                    {selectedChapter && !selectedLevel && getCurrentLevels().map(level => (
                                        <motion.div
                                            key={level.id}
                                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                                            onClick={() => setSelectedLevel(level)}
                                            className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:border-primary-light transition-all flex justify-between items-center gap-3"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center font-bold text-primary text-lg">
                                                    {level.order_index + 1}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">{level.title}</h3>
                                                    <p className="text-xs text-gray-400 truncate max-w-xs">{level.video_url || 'No video'}</p>
                                                    <p className="text-gray-500 text-sm mt-1">{level.lessons?.length || 0} Lessons</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'level', data: level }); }}
                                                className="p-3 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        </motion.div>
                                    ))}

                                    {/* Lessons View */}
                                    {selectedLevel && !selectedLesson && getCurrentLessons().map(lesson => (
                                        <motion.div
                                            key={lesson.id}
                                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                                            onClick={() => setSelectedLesson(lesson)}
                                            className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:border-primary-light transition-all flex justify-between items-center gap-3"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-secondary/10 text-secondary rounded-xl">
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">{lesson.title}</h3>
                                                    <p className="text-gray-500 text-sm">{lesson.quizzes?.length || 0} Quizzes</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'lesson', data: lesson }); }}
                                                className="p-3 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        </motion.div>
                                    ))}

                                    {/* Quizzes View */}
                                    {selectedLesson && getCurrentQuizzes().map((quiz, idx) => (
                                        <motion.div
                                            key={quiz.id}
                                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                            className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-gray-100"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg mt-1">
                                                        <HelpCircle size={16} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-800 mb-2">Q{idx + 1}: {quiz.question}</h3>
                                                        <div className="flex flex-wrap gap-2 text-sm">
                                                            {JSON.parse(quiz.options).map((opt, i) => (
                                                                <span key={i} className={`px-2 py-1 rounded-md border ${i === quiz.correct_answer ? 'bg-green-100 border-green-200 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                                                                    {opt}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setEditingItem({ type: 'quiz', data: quiz })}
                                                    className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Modal for Editing */}
            <AnimatePresence>
                {editingItem && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingItem(null)} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-lg rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8 max-h-[94vh] sm:max-h-[90vh] overflow-y-auto relative z-10">
                            <h3 className="text-xl sm:text-2xl font-bold mb-5 sm:mb-6 text-gray-800 capitalize">
                                {editingItem.data.id ? 'Edit' : 'Create'} {editingItem.type}
                            </h3>

                            <div className="space-y-4">
                                {editingItem.type === 'chapter' && (
                                    <>
                                        <input type="text" placeholder="Title" className="w-full px-4 py-3 bg-gray-50 rounded-xl" value={editingItem.data.title} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })} />
                                        <input type="text" placeholder="Emoji" className="w-full px-4 py-3 bg-gray-50 rounded-xl" value={editingItem.data.emoji} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, emoji: e.target.value } })} />
                                    </>
                                )}

                                {editingItem.type === 'level' && (
                                    <>
                                        <input type="text" placeholder="Title" className="w-full px-4 py-3 bg-gray-50 rounded-xl" value={editingItem.data.title} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })} />
                                        <input type="text" placeholder="Video URL" className="w-full px-4 py-3 bg-gray-50 rounded-xl" value={editingItem.data.video_url} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, video_url: e.target.value } })} />
                                    </>
                                )}

                                {editingItem.type === 'lesson' && (
                                    <>
                                        <input type="text" placeholder="Title" className="w-full px-4 py-3 bg-gray-50 rounded-xl" value={editingItem.data.title} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })} />
                                        <textarea placeholder="Lesson Content (HTML/Text)" className="w-full px-4 py-3 bg-gray-50 rounded-xl h-32" value={editingItem.data.content} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, content: e.target.value } })} />
                                    </>
                                )}

                                {editingItem.type === 'quiz' && (
                                    <>
                                        <input type="text" placeholder="Question" className="w-full px-4 py-3 bg-gray-50 rounded-xl" value={editingItem.data.question} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, question: e.target.value } })} />
                                        {(Array.isArray(editingItem.data.options) ? editingItem.data.options : JSON.parse(editingItem.data.options || '["","",""]')).map((opt, i) => (
                                            <div key={i} className="flex gap-2 items-center">
                                                <input
                                                    type="radio"
                                                    name="correct_answer"
                                                    checked={editingItem.data.correct_answer === i}
                                                    onChange={() => setEditingItem({ ...editingItem, data: { ...editingItem.data, correct_answer: i } })}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder={`Option ${i + 1}`}
                                                    className="w-full px-4 py-2 bg-gray-50 rounded-xl"
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const newOpts = [...(Array.isArray(editingItem.data.options) ? editingItem.data.options : JSON.parse(editingItem.data.options))];
                                                        newOpts[i] = e.target.value;
                                                        setEditingItem({ ...editingItem, data: { ...editingItem.data, options: newOpts } });
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-6 sm:mt-8">
                                <button onClick={() => setEditingItem(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold">Cancel</button>
                                <button onClick={() => handleSaveContent(editingItem.type, editingItem.data)} className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20">Save</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal for Level JSON Import */}
            <AnimatePresence>
                {importingJson && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setImportingJson(false)} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8 max-h-[94vh] sm:max-h-[90vh] flex flex-col relative z-10">
                            <h3 className="text-xl sm:text-2xl font-bold mb-2 text-gray-800">
                                Import Level JSON
                            </h3>
                            <p className="text-sm text-gray-500 mb-6 font-medium">
                                Paste the JSON object for a single Level to inject it into <span className="text-indigo-600 font-bold">{selectedChapter?.title}</span>.
                            </p>

                            <textarea
                                placeholder='{\n  "level_number": 2,\n  "level_title": "Understanding Safety",\n  "lessons": [ ... ]\n}'
                                className="w-full flex-1 min-h-[300px] px-4 py-3 bg-gray-50 rounded-xl font-mono text-sm border focus:border-indigo-500 outline-none"
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-6 sm:mt-8 shrink-0">
                                <button onClick={() => setImportingJson(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold">Cancel</button>
                                <button onClick={handleImportLevelJson} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20">Import & Save</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* CRM Deep Dive Modal */}
            <AnimatePresence>
                {viewingCRMProfile && (
                    <CRMProfileModal
                        userId={viewingCRMProfile}
                        onClose={() => setViewingCRMProfile(null)}
                    />
                )}
            </AnimatePresence>

            {/* Agreement View Modal */}
            <AnimatePresence>
                {viewingAgreement && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewingAgreement(null)} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8 max-h-[94vh] sm:max-h-[90vh] overflow-y-auto relative z-10">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-800">Service Agreement</h3>
                                <button onClick={() => setViewingAgreement(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} /></button>
                            </div>

                            {viewingAgreement === 'loading' ? (
                                <div className="p-10 text-center text-gray-500">Loading agreement details...</div>
                            ) : !viewingAgreement.signature_data ? (
                                <div className="p-10 text-center text-red-500">No agreement found for this user.</div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-gray-50 p-4 sm:p-6 rounded-2xl border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Full Name</p>
                                            <p className="font-bold">{viewingAgreement.full_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">DOB</p>
                                            <p className="font-bold">{viewingAgreement.dob}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs text-gray-500 uppercase font-bold">Address</p>
                                            <p className="font-bold">{viewingAgreement.address}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Control</p>
                                            <p className="font-bold">{viewingAgreement.phone}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Emergency</p>
                                            <p className="font-bold">{viewingAgreement.emergency_contact}</p>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 p-4 sm:p-6 rounded-2xl border border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-blue-500 uppercase font-bold">NDIS Number</p>
                                            <p className="font-bold text-blue-900">{viewingAgreement.ndis_number}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-blue-500 uppercase font-bold">Plan Type</p>
                                            <p className="font-bold text-blue-900">{viewingAgreement.plan_type}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-blue-500 uppercase font-bold">Who Pays</p>
                                            <p className="font-bold text-blue-900">{viewingAgreement.who_pays}</p>
                                        </div>
                                        {viewingAgreement.plan_manager_name && (
                                            <div className="col-span-2 mt-2 pt-2 border-t border-blue-200">
                                                <p className="text-xs text-blue-500 uppercase font-bold">Plan Manager</p>
                                                <p className="font-bold text-blue-900">{viewingAgreement.plan_manager_name} ({viewingAgreement.plan_manager_contact})</p>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <p className="text-center text-sm text-gray-400 mb-2">Signed on {new Date(viewingAgreement.signed_at).toLocaleDateString()}</p>
                                        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-4 bg-white flex justify-center">
                                            <img
                                                src={`/uploads/signatures/${viewingAgreement.signature_data}`}
                                                alt="Signature"
                                                className="max-h-32 mix-blend-multiply"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminPanel;
