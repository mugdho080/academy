import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Activity } from 'lucide-react';
import TimeLogsViewer from '../../components/TimeLogsViewer';

export default function ParticipantDetail() {
    const { id } = useParams();
    const [data, setData] = useState(null);

    useEffect(() => {
        // Since we didn't build a massive aggregate profile endpoint, we make a few specific calls
        // For demonstration of the UI requirement, we fetch stage and blockers:
        axios.get(`/api/admin/participant_stage.php?id=${id || 1}`)
            .then(res => setData(res.data))
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
