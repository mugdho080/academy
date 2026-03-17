import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    Activity,
    AlertCircle,
    Calendar,
    Clock,
    Download,
    Layers,
    Map,
    BookOpen
} from 'lucide-react';
import ResponsiveTable from './layout/ResponsiveTable';

const todayIso = () => new Date().toISOString().split('T')[0];
const thirtyDaysAgoIso = () => {
    const now = new Date();
    now.setDate(now.getDate() - 30);
    return now.toISOString().split('T')[0];
};

const formatSeconds = (value) => {
    const total = Number(value) || 0;
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatDateTime = (value) => {
    if (!value) return 'Active';
    const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString();
};

const TimeLogsViewer = ({ userId, isAdminView = false, variant = 'classic', className = '' }) => {
    const [startDate, setStartDate] = useState(thirtyDaysAgoIso());
    const [endDate, setEndDate] = useState(todayIso());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [payload, setPayload] = useState({
        sessions: [],
        daily_totals: [],
        context_totals: { dashboard: 0, chapter: 0, level: 0, lesson: 0 },
        breakdown: { chapters: [], levels: [], lessons: [] },
        total_active_seconds: 0
    });

    useEffect(() => {
        if (isAdminView && !userId) return;

        const fetchSummary = async () => {
            setLoading(true);
            setError('');

            try {
                const endpoint = isAdminView
                    ? '/api/admin/get_time_summary.php'
                    : '/api/learner/get_time_summary.php';

                const response = await axios.get(endpoint, {
                    params: {
                        user_id: isAdminView ? userId : undefined,
                        start: startDate,
                        end: endDate
                    }
                });

                if (response.data?.error) {
                    setError(response.data.error);
                    return;
                }

                setPayload({
                    sessions: response.data?.sessions || [],
                    daily_totals: response.data?.daily_totals || [],
                    context_totals: response.data?.context_totals || { dashboard: 0, chapter: 0, level: 0, lesson: 0 },
                    breakdown: response.data?.breakdown || { chapters: [], levels: [], lessons: [] },
                    total_active_seconds: Number(response.data?.total_active_seconds || 0)
                });
            } catch (err) {
                setError(err?.response?.data?.error || 'Failed to load time analytics.');
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, [endDate, isAdminView, startDate, userId]);

    const csvContent = useMemo(() => {
        const rows = [
            ['Session ID', 'Login At', 'Logout At', 'Status', 'Total Seconds Active', 'Summary']
        ];

        payload.sessions.forEach((session) => {
            rows.push([
                session.id,
                session.login_at || '',
                session.logout_at || '',
                session.status || '',
                session.total_seconds_active || 0,
                session.summary || ''
            ]);
        });

        return rows
            .map((row) => row.map((item) => `"${String(item ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');
    }, [payload.sessions]);

    const exportCsv = () => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `time-summary-${startDate}-to-${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const isClay = variant === 'clay';

    const rootClassName = isClay
        ? `clay-card p-4 sm:p-6 md:p-8 mt-0 mb-0 space-y-5 sm:space-y-6 ${className}`
        : `bg-white rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-white mt-8 mb-8 backdrop-blur-md space-y-5 sm:space-y-6 ${className}`;

    const controlClassName = isClay
        ? 'bg-[rgba(255,255,255,0.62)] border border-white/80 rounded-xl px-3 py-2 text-sm w-full text-[color:var(--clay-text)] shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.85),inset_6px_6px_10px_rgba(93,114,144,0.08)]'
        : 'bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm w-full';

    return (
        <div className={rootClassName}>
            <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${isClay ? 'clay-inset text-[color:var(--clay-cyan)]' : 'bg-[#e0f7fa] text-[#00695C]'}`}>
                        <Clock size={24} />
                    </div>
                    <div>
                        <h2 className={`text-xl font-black uppercase italic ${isClay ? 'text-[color:var(--clay-text)]' : 'text-[#00695C]'}`}>Learning Time Analytics</h2>
                        <p className={`text-sm font-medium ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-500'}`}>Accurate active-time sessions and route breakdown</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-stretch lg:items-center gap-2 sm:gap-3 w-full lg:w-auto">
                    <div className="flex items-center gap-2 w-full">
                        <Calendar size={16} className={isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-400'} />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            max={endDate}
                            className={controlClassName}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full">
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={startDate}
                            className={controlClassName}
                        />
                    </div>
                    {isAdminView && (
                        <button
                            onClick={exportCsv}
                            className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold w-full sm:w-auto ${isClay ? 'clay-button bg-[linear-gradient(145deg,#b6d4fc,#9ed9fa)] text-[color:var(--clay-text)]' : 'bg-[#00695C] text-white'}`}
                        >
                            <Download size={16} />
                            Export CSV
                        </button>
                    )}
                </div>
            </div>

            <div className={`${isClay ? 'clay-card text-[color:var(--clay-text)]' : 'bg-gradient-to-r from-[#00695C] to-[#00897B] text-white'} rounded-3xl p-6 relative overflow-hidden`}>
                <Activity size={90} className="absolute -right-2 -bottom-2 opacity-10" />
                <p className={`text-xs uppercase tracking-widest font-black ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-[#B2DFDB]'}`}>Total Active Time</p>
                <p className="text-3xl sm:text-4xl font-black mt-1">{formatSeconds(payload.total_active_seconds)}</p>
                <p className="text-xs mt-2 opacity-80">Range: {startDate} to {endDate}</p>
            </div>

            {loading && (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 text-center font-bold text-[#00695C]">
                    Loading time analytics...
                </div>
            )}

            {error && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 font-bold flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {!loading && !error && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className={isClay ? 'clay-inset p-4' : 'bg-slate-50 border border-slate-100 rounded-xl p-4'}>
                            <p className={`text-[10px] uppercase tracking-widest font-black ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-400'}`}>Dashboard</p>
                            <p className={`font-black ${isClay ? 'text-[color:var(--clay-text)]' : 'text-[#00695C]'}`}>{formatSeconds(payload.context_totals.dashboard)}</p>
                        </div>
                        <div className={isClay ? 'clay-inset p-4' : 'bg-slate-50 border border-slate-100 rounded-xl p-4'}>
                            <p className={`text-[10px] uppercase tracking-widest font-black ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-400'}`}>Chapter</p>
                            <p className={`font-black ${isClay ? 'text-[color:var(--clay-text)]' : 'text-[#00695C]'}`}>{formatSeconds(payload.context_totals.chapter)}</p>
                        </div>
                        <div className={isClay ? 'clay-inset p-4' : 'bg-slate-50 border border-slate-100 rounded-xl p-4'}>
                            <p className={`text-[10px] uppercase tracking-widest font-black ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-400'}`}>Level</p>
                            <p className={`font-black ${isClay ? 'text-[color:var(--clay-text)]' : 'text-[#00695C]'}`}>{formatSeconds(payload.context_totals.level)}</p>
                        </div>
                        <div className={isClay ? 'clay-inset p-4' : 'bg-slate-50 border border-slate-100 rounded-xl p-4'}>
                            <p className={`text-[10px] uppercase tracking-widest font-black ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-400'}`}>Lesson</p>
                            <p className={`font-black ${isClay ? 'text-[color:var(--clay-text)]' : 'text-[#00695C]'}`}>{formatSeconds(payload.context_totals.lesson)}</p>
                        </div>
                    </div>

                    <ResponsiveTable className="bg-slate-50">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="p-3 text-left">Session</th>
                                    <th className="p-3 text-left">Login</th>
                                    <th className="p-3 text-left">Logout</th>
                                    <th className="p-3 text-left">Status</th>
                                    <th className="p-3 text-right">Active</th>
                                    <th className="p-3 text-left">Readable Summary</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {payload.sessions.length === 0 && (
                                    <tr>
                                        <td className="p-4 text-slate-400 font-medium" colSpan={6}>No sessions in this date range.</td>
                                    </tr>
                                )}
                                {payload.sessions.map((session) => (
                                    <tr key={session.id} className="bg-white">
                                        <td className="p-3 font-bold text-slate-700">#{session.id}</td>
                                        <td className="p-3">{formatDateTime(session.login_at)}</td>
                                        <td className="p-3">{formatDateTime(session.logout_at)}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${session.status === 'active' ? 'bg-green-100 text-green-700' : session.status === 'expired' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {session.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right font-black text-[#00695C]">{formatSeconds(session.total_seconds_active)}</td>
                                        <td className="p-3 text-slate-500">{session.summary}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </ResponsiveTable>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                            <h3 className="font-black text-slate-600 uppercase text-xs tracking-widest mb-3 flex items-center gap-2">
                                <Map size={14} />
                                Chapter Totals
                            </h3>
                            <div className="space-y-2">
                                {payload.breakdown.chapters.length === 0 && <p className="text-slate-400 text-sm">No chapter activity.</p>}
                                {payload.breakdown.chapters.map((row) => (
                                    <div key={`chapter-${row.chapter_id}-${row.chapter_title}`} className="bg-white rounded-lg border border-slate-100 p-3 flex justify-between">
                                        <span className="text-sm font-bold text-slate-700">{row.chapter_title || `Chapter ${row.chapter_id}`}</span>
                                        <span className="text-sm font-black text-[#00695C]">{formatSeconds(row.total_seconds)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                            <h3 className="font-black text-slate-600 uppercase text-xs tracking-widest mb-3 flex items-center gap-2">
                                <Layers size={14} />
                                Level Totals
                            </h3>
                            <div className="space-y-2">
                                {payload.breakdown.levels.length === 0 && <p className="text-slate-400 text-sm">No level activity.</p>}
                                {payload.breakdown.levels.map((row) => (
                                    <div key={`level-${row.level_id}-${row.level_title}`} className="bg-white rounded-lg border border-slate-100 p-3 flex justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{row.level_title || `Level ${row.level_id}`}</p>
                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">{row.chapter_title || 'No chapter'}</p>
                                        </div>
                                        <span className="text-sm font-black text-[#00695C]">{formatSeconds(row.total_seconds)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                            <h3 className="font-black text-slate-600 uppercase text-xs tracking-widest mb-3 flex items-center gap-2">
                                <BookOpen size={14} />
                                Lesson Totals
                            </h3>
                            <div className="space-y-2">
                                {payload.breakdown.lessons.length === 0 && <p className="text-slate-400 text-sm">No lesson activity.</p>}
                                {payload.breakdown.lessons.map((row) => (
                                    <div key={`lesson-${row.lesson_id}-${row.lesson_title}`} className="bg-white rounded-lg border border-slate-100 p-3 flex justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{row.lesson_title || `Lesson ${row.lesson_id}`}</p>
                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">{row.level_title || 'No level'}</p>
                                        </div>
                                        <span className="text-sm font-black text-[#00695C]">{formatSeconds(row.total_seconds)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100">
                            <h3 className="font-black text-slate-600 uppercase text-xs tracking-widest">Daily Totals</h3>
                        </div>
                        <ResponsiveTable className="border-0 rounded-none">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 text-slate-500 uppercase text-xs">
                                    <tr>
                                        <th className="p-3 text-left">Date</th>
                                        <th className="p-3 text-right">Active Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {payload.daily_totals.length === 0 && (
                                        <tr>
                                            <td className="p-3 text-slate-400" colSpan={2}>No daily totals in this range.</td>
                                        </tr>
                                    )}
                                    {payload.daily_totals.map((day) => (
                                        <tr key={day.date_key} className="bg-white">
                                            <td className="p-3 font-bold text-slate-700">{day.date_key}</td>
                                            <td className="p-3 text-right font-black text-[#00695C]">{formatSeconds(day.total_seconds)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </ResponsiveTable>
                    </div>
                </>
            )}
        </div>
    );
};

export default TimeLogsViewer;
