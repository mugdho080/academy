import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, ShieldCheck, Mail, Calendar, MapPin, Phone, AlertCircle, FileText, CheckCircle, Clock } from 'lucide-react';
import axios from 'axios';
import SensoryBackground from '../components/SensoryBackground';
import TimeLogsViewer from '../components/TimeLogsViewer';

const Profile = () => {
    const [agreement, setAgreement] = useState(null);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const fetchData = async () => {
            if (!user.id) return;
            try {
                const agreementRes = await axios.get(`/api/learner/fetch_my_agreement.php?user_id=${user.id}`);

                if (!agreementRes.data.error) setAgreement(agreementRes.data);
            } catch (err) {
                console.error("Failed to fetch profile data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user.id]);

    const formatStatus = (status) => {
        switch (status) {
            case 'active': return { label: 'Active Account', color: 'bg-green-100 text-green-600', icon: <CheckCircle size={18} /> };
            case 'pending': return { label: 'Under Review', color: 'bg-amber-100 text-amber-600', icon: <AlertCircle size={18} /> };
            default: return { label: 'Contact Us to Unlock', color: 'bg-gray-100 text-gray-600', icon: <ShieldCheck size={18} /> };
        }
    };

    const statusStyle = formatStatus(user.status);

    return (
        <div className="min-h-screen bg-[#e0f7fa] font-sans text-slate-800 relative">
            <SensoryBackground />

            <div className="max-w-4xl mx-auto p-6 md:p-10 relative z-10">
                <header className="mb-10 text-center">
                    <div className="w-24 h-24 bg-[#00695C] rounded-full mx-auto mb-4 flex items-center justify-center text-white shadow-xl">
                        <User size={48} />
                    </div>
                    <h1 className="text-4xl font-black text-[#00695C] uppercase italic tracking-tighter">My <span className="text-yellow-500">Profile</span></h1>
                    <div className="mt-4 flex justify-center">
                        <div className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold shadow-sm ${statusStyle.color}`}>
                            {statusStyle.icon}
                            {statusStyle.label}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* User Info */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 shadow-xl border-4 border-white h-fit"
                    >
                        <h2 className="text-xl font-black text-[#00695C] uppercase italic mb-6 border-b-2 border-slate-100 pb-2">Account Info</h2>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg text-slate-400"><User size={18} /></div>
                                <div className="text-sm font-bold text-slate-600">{user.name}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg text-slate-400"><Mail size={18} /></div>
                                <div className="text-sm font-bold text-slate-600 truncate">{user.email}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg text-slate-400"><ShieldCheck size={18} /></div>
                                <div className="text-sm font-bold text-[#00695C]">{user.ndis_number}</div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Service Agreement Details */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="md:col-span-2 bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 shadow-xl border-4 border-white"
                    >
                        <h2 className="text-xl font-black text-[#00695C] uppercase italic mb-6 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                            <FileText size={24} /> Service Agreement
                        </h2>

                        {loading ? (
                            <div className="py-10 text-center text-slate-400 font-bold">Checking for agreement...</div>
                        ) : agreement ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Full Legal Name</p>
                                        <p className="font-bold text-slate-800">{agreement.full_name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Date of Birth</p>
                                        <p className="font-bold text-slate-800">{agreement.dob}</p>
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Address</p>
                                        <p className="font-bold text-slate-800 flex items-center gap-1"><MapPin size={14} /> {agreement.address}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Plan Type</p>
                                        <p className="font-bold text-[#00695C]">{agreement.plan_type}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Who Pays</p>
                                        <p className="font-bold text-[#00695C]">{agreement.who_pays}</p>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100">
                                    <p className="text-center text-[10px] uppercase font-black text-slate-400 tracking-widest mb-4">Your Signature</p>
                                    <div className="bg-slate-50 rounded-2xl p-4 border-2 border-dashed border-slate-200 flex justify-center items-center">
                                        {agreement.signature_url ? (
                                            <img
                                                src={agreement.signature_url}
                                                alt="My Signature"
                                                className="max-h-24 mix-blend-multiply drop-shadow-sm"
                                            />
                                        ) : (
                                            <p className="text-slate-300 italic py-4">Signature pending</p>
                                        )}
                                    </div>
                                    <p className="text-center text-[10px] text-slate-300 mt-2 italic font-medium">Signed on {new Date(agreement.signed_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="py-20 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-slate-300">
                                    <FileText size={32} />
                                </div>
                                <p className="text-slate-400 font-bold">No Service Agreement found.</p>
                                <p className="text-sm text-slate-400 px-10">Sign the agreement on the Level Map to unlock all worlds!</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Activity Log / Session History */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="md:col-span-3"
                    >
                        <TimeLogsViewer userId={user.id} />
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
