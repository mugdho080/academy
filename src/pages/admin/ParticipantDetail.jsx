import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Activity, Download } from 'lucide-react';
import TimeLogsViewer from '../../components/TimeLogsViewer';

export default function ParticipantDetail() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [coachAnalytics, setCoachAnalytics] = useState(null);

    useEffect(() => {
        // Since we didn't build a massive aggregate profile endpoint, we make a few specific calls
        // For demonstration of the UI requirement, we fetch stage and blockers:
        axios.get(`/api/admin/participant_stage.php?id=${id || 1}`)
            .then(res => setData(res.data))
            .catch(err => console.error(err));

        axios.get('/api/admin/get_user_invoices.php', {
            params: { user_id: id || 1, status: 'all' }
        })
            .then(res => setInvoices(res.data?.invoices || []))
            .catch(err => console.error(err));

        axios.get('/api/admin/get_coach_events.php', {
            params: { user_id: id || 1, limit: 30 }
        })
            .then(res => setCoachAnalytics(res.data || null))
            .catch(err => console.error(err));
    }, [id]);

    if (!data) return <div className="p-8">Loading Participant Details...</div>;

    const getStageColor = (stage) => {
        switch (stage) {
            case 'lead': return 'bg-gray-100 text-gray-700';
            case 'active': return 'bg-blue-100 text-blue-700';
            case 'claim_ready': return 'bg-green-100 text-green-700';
            case 'blocked': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="p-8 space-y-6 bg-gray-50 min-h-screen">
            {/* Header section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight">Participant Record</h1>
                    <p className="text-gray-500 mt-1">ID: {id || 1}</p>
                </div>
                <div className={`px-4 py-2 rounded-full font-bold uppercase text-sm tracking-wider ${getStageColor(data.stage)} flex items-center gap-2`}>
                    {data.stage === 'blocked' ? <AlertCircle size={16} /> : <Activity size={16} />}
                    Stage: {data.stage}
                </div>
            </div>

            {/* Blockers Section */}
            {data.blockers && data.blockers.length > 0 && (
                <div className="bg-orange-50 p-6 rounded-2xl shadow-sm border border-orange-200">
                    <h2 className="text-orange-800 font-bold mb-3 flex items-center gap-2">
                        <AlertCircle size={20} /> Active Blockers Preventing NDIS Progress
                    </h2>
                    <ul className="space-y-2">
                        {data.blockers.map((b, i) => (
                            <li key={i} className="flex items-center gap-2 text-orange-900 bg-white px-4 py-2 rounded-lg text-sm shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span> {b}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Time Tracking Section */}
            <TimeLogsViewer userId={id} isAdminView={true} />

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">Invoices</h3>
                {invoices.length === 0 ? (
                    <p className="text-sm text-gray-500">No invoices for this participant yet.</p>
                ) : (
                    <div className="space-y-3">
                        {invoices.map((inv) => (
                            <div key={inv.id} className="p-4 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-gray-800">{inv.invoice_number}</p>
                                    <p className="text-xs text-gray-500">{inv.invoice_date} • Status {inv.status}</p>
                                    <p className="text-sm font-bold text-[#00695C]">${Number(inv.total || 0).toFixed(2)}</p>
                                </div>
                                <button
                                    onClick={() => window.open(`/api/admin/download_invoice.php?id=${inv.id}`, '_blank')}
                                    className="inline-flex items-center gap-2 bg-[#00695C] text-white px-3 py-2 rounded-lg text-sm font-bold"
                                >
                                    <Download size={14} /> PDF
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">Panda Coach Analytics</h3>
                {!coachAnalytics ? (
                    <p className="text-sm text-gray-500">Loading coach analytics...</p>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-xs uppercase tracking-widest text-gray-400 font-black">Frustration</p>
                                <p className="text-xl font-black text-gray-700">{coachAnalytics?.state?.frustration_score ?? 0}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-xs uppercase tracking-widest text-gray-400 font-black">Engagement</p>
                                <p className="text-xl font-black text-gray-700">{coachAnalytics?.state?.engagement_score ?? 0}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-xs uppercase tracking-widest text-gray-400 font-black">Last Route</p>
                                <p className="text-sm font-black text-gray-700">{coachAnalytics?.state?.last_route || '-'}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs uppercase tracking-widest text-gray-400 font-black mb-2">Recent Coach Events</p>
                            <div className="space-y-2 max-h-64 overflow-auto">
                                {(coachAnalytics?.events || []).slice(0, 10).map((evt) => (
                                    <div key={evt.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                                        <p className="font-bold text-gray-700">{evt.event_type}</p>
                                        <p className="text-xs text-gray-500">{evt.route || '-'} • {new Date(evt.created_at).toLocaleString()}</p>
                                    </div>
                                ))}
                                {(coachAnalytics?.events || []).length === 0 && (
                                    <p className="text-sm text-gray-500">No coach events yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Traffic Light Session Rules (Mock representation) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <ShieldCheck className="text-[#00695C]" size={20} /> Recent Sessions & Compliance Traffic Light
                </h3>

                <div className="space-y-3">
                    {/* Hardcoded visual representation of traffic lights array items would map here */}
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                            <p className="font-bold text-sm text-gray-800">12 Feb 2026 - Innovation Program</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">Session ID: 104 • Requires Note, Attendance</p>
                        </div>
                        <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span> Claimable
                        </div>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                            <p className="font-bold text-sm text-gray-800">14 Feb 2026 - Independent Living</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">Session ID: 105 • Missing Outcome Report</p>
                        </div>
                        <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_#f59e0b]"></span> Missing Evidence
                        </div>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                            <p className="font-bold text-sm text-gray-800">20 Feb 2026 - Community Access</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">Session ID: 108 • Plan Expired before Delivery</p>
                        </div>
                        <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444]"></span> Blocked
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
