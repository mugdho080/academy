import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, AlertCircle, Save, Plus, X, Clock, Calendar } from 'lucide-react';
import TimeLogsViewer from '../../components/TimeLogsViewer';

export default function CRMProfileModal({ userId, onClose }) {
    const [loading, setLoading] = useState(true);
    const [participant, setParticipant] = useState(null);
    const [plans, setPlans] = useState([]);
    const [loginSessions, setLoginSessions] = useState([]);

    // Stage logic state (reusing the logic we built in ParticipantDetail)
    const [stageData, setStageData] = useState(null);

    useEffect(() => {
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // First we need the participant ID linked to this user_id
            // Our existing API fetch_users brought back user objects. 
            // In a real flow, fetch_users should join participants. For now we will find it by User ID.
            const partRes = await axios.get(`/api/admin/crm/master_edit.php?action=read&participant_id=${userId}`);

            if (partRes.data.success && partRes.data.participant) {
                setParticipant(partRes.data.participant);
                setPlans(partRes.data.plans || []);
                setLoginSessions(partRes.data.login_sessions || []);

                // Fetch traffic light stage data
                const stageRes = await axios.get(`/api/admin/participant_stage.php?id=${partRes.data.participant.id}`);
                setStageData(stageRes.data);
            }
        } catch (err) {
            console.error("Error fetching CRM Profile:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateParticipant = async (field, value) => {
        try {
            await axios.post('/api/admin/crm/master_edit.php?action=update_participant', {
                id: participant.id,
                [field]: value
            });
            fetchData();
        } catch (err) {
            alert("Failed to update participant.");
        }
    };

    const handleSavePlan = async (e, planId = null) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            await axios.post('/api/admin/crm/master_edit.php?action=save_plan', {
                id: planId,
                participant_id: participant.id,
                start_date: formData.get('start_date'),
                end_date: formData.get('end_date')
            });
            fetchData();
            e.target.reset();
        } catch (err) {
            alert("Failed to save plan.");
        }
    };

    if (loading) return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-3xl">Loading CRM Record...</div>
        </div>
    );

    if (!participant) return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-3xl relative">
                <button onClick={onClose} className="absolute top-4 right-4"><X /></button>
                <div className="text-red-500 font-bold">No CRM Participant record mapped to this user yet.</div>
                <p className="text-sm text-gray-500 mt-2">Did the DB sync run successfully?</p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-gray-50 w-full max-w-4xl rounded-[1.5rem] sm:rounded-[2.5rem] max-h-[94vh] sm:max-h-[90vh] overflow-y-auto relative z-10 flex flex-col">

                {/* Header Profile Ribbon */}
                <div className="bg-white p-4 sm:p-8 pb-4 sm:pb-6 rounded-t-[1.5rem] sm:rounded-t-[2.5rem] border-b border-gray-100 sticky top-0 z-20 shadow-sm">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>

                    <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3">
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-black text-gray-800">{participant.full_name}</h2>
                            <p className="text-primary font-bold font-mono mt-1">{participant.ndis_number}</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
                            <label className="flex items-center gap-2 text-sm font-bold bg-gray-50 px-4 py-2 rounded-xl">
                                Risk Flag:
                                <input
                                    type="checkbox"
                                    checked={participant.risk_flag === 1}
                                    onChange={(e) => handleUpdateParticipant('risk_flag', e.target.checked ? 1 : 0)}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                            </label>

                            <select
                                value={participant.stage || 'lead'}
                                onChange={(e) => handleUpdateParticipant('stage', e.target.value)}
                                className="bg-blue-50 border border-blue-100 text-blue-800 font-bold uppercase text-xs px-4 py-3 rounded-xl outline-none"
                            >
                                <option value="lead">Stage: Lead</option>
                                <option value="active">Stage: Active</option>
                                <option value="claim_ready">Stage: Claim Ready</option>
                                <option value="blocked">Stage: Blocked</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Dashboard Engine Rules Overlay */}
                {stageData && stageData.blockers && stageData.blockers.length > 0 && (
                    <div className="bg-red-50 px-8 py-4 border-b border-red-100 flex items-start gap-3">
                        <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="font-bold text-red-800">Compliance Blockers Detected</p>
                            <ul className="text-sm text-red-700 mt-1 space-y-1">
                                {stageData.blockers.map((b, i) => <li key={i}>• {b}</li>)}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
                    {/* Plans Editor */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <ShieldCheck className="text-primary" /> NDIS Plans & Budgets
                        </h3>

                        <div className="space-y-6">
                            {plans.map(plan => (
                                <div key={plan.id} className="border border-gray-200 rounded-2xl p-5 bg-gray-50">
                                    <form onSubmit={(e) => handleSavePlan(e, plan.id)} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-4">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Start Date</label>
                                            <input type="date" name="start_date" defaultValue={plan.start_date} className="w-full mt-1 p-2 border border-gray-200 rounded-lg" required />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase">End Date</label>
                                            <input type="date" name="end_date" defaultValue={plan.end_date} className="w-full mt-1 p-2 border border-gray-200 rounded-lg" required />
                                        </div>
                                        <button type="submit" className="bg-gray-800 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-black transition-colors flex items-center justify-center gap-2">
                                            <Save size={16} /> Update Plan
                                        </button>
                                    </form>

                                    {/* Line Items for this plan */}
                                    <div className="pl-4 border-l-2 border-primary-light space-y-2">
                                        <p className="text-sm font-bold text-gray-500 mb-2">Line Items Budget</p>
                                        {plan.line_items?.map(li => (
                                            <div key={li.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-3 rounded-lg text-sm border border-gray-100 gap-1">
                                                <span className="font-bold text-gray-700">{li.code} ({li.category})</span>
                                                <span className="text-gray-500 font-mono">Bal: ${parseFloat(li.remaining_balance).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Add New Plan form */}
                            <form onSubmit={(e) => handleSavePlan(e)} className="border-2 border-dashed border-gray-200 rounded-2xl p-5 bg-white">
                                <p className="text-sm font-bold text-primary mb-3 flex items-center gap-1"><Plus size={16} /> Register New Plan</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Start Date</label>
                                        <input type="date" name="start_date" className="w-full mt-1 p-2 border border-gray-200 rounded-lg bg-gray-50" required />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">End Date</label>
                                        <input type="date" name="end_date" className="w-full mt-1 p-2 border border-gray-200 rounded-lg bg-gray-50" required />
                                    </div>
                                    <button type="submit" className="bg-primary text-white px-4 py-2.5 rounded-lg font-bold hover:bg-primary-dark transition-colors">
                                        Add Plan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Activity Sessions Log using new TimeLogsViewer */}
                    <div className="bg-gradient-to-br from-slate-50 to-[#e0f7fa]/30 p-2 rounded-3xl shadow-sm border border-slate-100">
                        <TimeLogsViewer userId={userId} isAdminView={true} />
                        <p className="mt-2 text-center text-xs text-slate-400 italic">This exact tracking log is used as the base for invoicing and verifying student active time (paused when tab inactive).</p>
                    </div>
                </div>

            </div>
        </div>
    );
}
