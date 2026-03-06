import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertCircle, FileText, CheckCircle, Clock, ShieldAlert } from 'lucide-react';

export default function AdminDashboard() {
    const [data, setData] = useState(null);

    useEffect(() => {
        axios.get('/api/admin/command_centre.php')
            .then(res => setData(res.data.data))
            .catch(err => console.error("Error fetching dashboard:", err));
    }, []);

    if (!data) return <div className="p-8">Loading Command Centre...</div>;

    return (
        <div className="p-8 space-y-8 bg-white min-h-[80vh]">
            <h1 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                <ShieldAlert className="text-[#00695C]" /> NDIS Operations Command Centre
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Money Today */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <p className="text-sm font-bold text-gray-500 uppercase">Money Today</p>
                    <p className="text-4xl font-black text-[#00695C] mt-2">${data.money_today?.toFixed(2) || '0.00'}</p>
                </div>

                {/* Blocking Revenue */}
                <div className="bg-red-50 p-6 rounded-2xl shadow-sm border border-red-100 flex flex-col justify-between">
                    <p className="text-sm font-bold text-red-800 uppercase flex items-center gap-2">
                        <AlertCircle size={16} /> Blocking Revenue
                    </p>
                    <p className="text-4xl font-black text-red-600 mt-2">${data.blocking_revenue?.total_value?.toFixed(2) || '0.00'}</p>
                    <p className="text-sm text-red-700 mt-1">{data.blocking_revenue?.count || 0} Unverified Sessions</p>
                </div>

                {/* Pipeline Health */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between col-span-2">
                    <p className="text-sm font-bold text-gray-500 uppercase">Claims Board (Kanban Summary)</p>
                    <div className="flex gap-4 mt-4 text-center">
                        <div className="flex-1 bg-gray-100 p-3 rounded-lg"><p className="text-xs text-gray-500 font-bold mb-1">DRAFT</p><p className="font-bold">{data.claims_board?.draft?.count || 0}</p></div>
                        <div className="flex-1 bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-500 font-bold mb-1">READY</p><p className="font-bold text-blue-700">{data.claims_board?.ready?.count || 0}</p></div>
                        <div className="flex-1 bg-purple-50 p-3 rounded-lg"><p className="text-xs text-purple-500 font-bold mb-1">SUBMITTED</p><p className="font-bold text-purple-700">{data.claims_board?.submitted?.count || 0}</p></div>
                        <div className="flex-1 bg-green-50 p-3 rounded-lg"><p className="text-xs text-green-500 font-bold mb-1">PAID</p><p className="font-bold text-green-700">{data.claims_board?.paid?.count || 0}</p></div>
                        <div className="flex-1 bg-red-50 p-3 rounded-lg"><p className="text-xs text-red-500 font-bold mb-1">REJECTED</p><p className="font-bold text-red-700">{data.claims_board?.rejected?.count || 0}</p></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Participants at Risk */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
                        <AlertCircle className="text-orange-600" size={20} />
                        <h3 className="font-bold text-orange-900">Participants at Risk</h3>
                    </div>
                    <ul className="divide-y divide-gray-50 p-2">
                        {data.participants_at_risk?.length === 0 ? <li className="p-4 text-center text-sm text-gray-500">No high-risk participants currently.</li> : null}
                        {data.participants_at_risk?.map(p => (
                            <li key={p.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors rounded-lg cursor-pointer">
                                <div>
                                    <p className="font-bold text-gray-800">{p.full_name}</p>
                                    <p className="text-xs text-gray-500 font-mono">NDIS: {p.ndis_number}</p>
                                </div>
                                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase">At Risk</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Blocking Revenue List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-red-50 border-b border-red-100 flex items-center gap-2">
                        <Clock className="text-red-600" size={20} />
                        <h3 className="font-bold text-red-900">Action Required (Unverified Sessions)</h3>
                    </div>
                    <ul className="divide-y divide-gray-50 p-2">
                        {data.blocking_revenue?.sessions?.length === 0 ? <li className="p-4 text-center text-sm text-gray-500">All caught up!</li> : null}
                        {data.blocking_revenue?.sessions?.map((s, i) => (
                            <li key={i} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors rounded-lg">
                                <div>
                                    <p className="font-bold text-gray-800">{s.participant}</p>
                                    <p className="text-xs text-gray-500">{new Date(s.session_date).toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-800">${parseFloat(s.total_value).toFixed(2)}</p>
                                    <p className="text-xs text-red-500 font-bold uppercase">Missing Evidence</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
