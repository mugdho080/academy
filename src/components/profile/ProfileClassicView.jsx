import React from 'react';
import { motion } from 'framer-motion';
import {
    User,
    ShieldCheck,
    Mail,
    MapPin,
    FileText,
    Download,
    Trophy,
    Camera,
    Loader2,
    Save,
    PencilLine
} from 'lucide-react';
import SensoryBackground from '../SensoryBackground';
import TimeLogsViewer from '../TimeLogsViewer';
import PageContainer from '../layout/PageContainer';
import ClayToggle from '../clay/ClayToggle';
import { withAuthQuery } from '../../utils/api';

const ProfileClassicView = ({
    variant,
    setVariant,
    agreement,
    paidInvoices,
    invoiceLoading,
    loading,
    user,
    statusStyle,
    isEditingAbout,
    setIsEditingAbout,
    aboutText,
    setAboutText,
    uploadingImage,
    handleImageUpload,
    saveAboutMe
}) => {
    return (
        <div className="min-h-screen bg-[#e0f7fa] font-sans text-slate-800 relative">
            <SensoryBackground />

            <PageContainer className="relative z-10 pb-24 lg:pb-10">
                <div className="mb-5">
                    <ClayToggle
                        appearance="classic"
                        label="Learner profile appearance"
                        value={variant}
                        onChange={setVariant}
                        options={[
                            { label: 'Classic', value: 'classic' },
                            { label: 'Clay', value: 'clay' }
                        ]}
                    />
                </div>

                <header className="mb-6 md:mb-8 text-center">
                    <div className="relative w-24 h-24 md:w-32 md:h-32 mx-auto mb-4 group">
                        {user.profile_image_url ? (
                            <img src={user.profile_image_url} alt="Profile" className="w-full h-full object-cover rounded-full border-4 border-[#00695C] shadow-xl" />
                        ) : (
                            <div className="w-full h-full bg-[#00695C] rounded-full flex items-center justify-center text-white shadow-xl border-4 border-[#00695C]">
                                <User size={48} />
                            </div>
                        )}
                        <label className="absolute bottom-0 right-0 p-2 sm:p-3 bg-yellow-400 text-yellow-900 rounded-full cursor-pointer shadow-lg hover:bg-yellow-500 transition-colors z-10">
                            {uploadingImage ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                        </label>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-[#00695C] uppercase italic tracking-tighter">My <span className="text-yellow-500">Profile</span></h1>
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                        <div className={`flex items-center gap-2 px-4 sm:px-6 py-2 rounded-full font-bold shadow-sm ${statusStyle.color}`}>
                            {statusStyle.icon}
                            {statusStyle.label}
                        </div>
                        <div className="flex items-center gap-2 px-4 sm:px-6 py-2 rounded-full font-bold shadow-sm bg-yellow-100 text-yellow-700">
                            <Trophy size={18} />
                            {user.points || 0} Points
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/80 backdrop-blur-md rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-xl border-4 border-white h-fit"
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

                        <div className="mt-8 border-t-2 border-slate-100 pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black text-[#00695C] uppercase tracking-wider flex items-center gap-2">
                                    <FileText size={16} /> About Me
                                </h3>
                                {!isEditingAbout && (
                                    <button onClick={() => setIsEditingAbout(true)} className="p-1.5 text-slate-400 hover:text-[#00695C] rounded-full hover:bg-slate-50 transition-colors">
                                        <PencilLine size={16} />
                                    </button>
                                )}
                            </div>

                            {isEditingAbout ? (
                                <div className="space-y-3">
                                    <textarea
                                        value={aboutText}
                                        onChange={(e) => setAboutText(e.target.value)}
                                        placeholder="Write a little bit about yourself..."
                                        className="w-full min-h-[100px] p-3 rounded-xl border-2 border-slate-200 focus:border-[#00695C] outline-none text-sm resize-y"
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => { setIsEditingAbout(false); setAboutText(user.about_me || ''); }} className="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                                        <button onClick={saveAboutMe} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-[#00695C] text-white hover:bg-[#00897B] flex items-center gap-1">
                                            <Save size={14} /> Save
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600 leading-relaxed italic border-l-4 border-yellow-400 pl-3 whitespace-pre-wrap">
                                    {user.about_me ? user.about_me : 'No biography added yet. Click the edit icon to tell us about yourself!'}
                                </p>
                            )}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="md:col-span-2 bg-white/80 backdrop-blur-md rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-xl border-4 border-white"
                    >
                        <h2 className="text-xl font-black text-[#00695C] uppercase italic mb-6 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                            <FileText size={24} /> Service Agreement
                        </h2>

                        {loading ? (
                            <div className="py-10 text-center text-slate-400 font-bold">Checking for agreement...</div>
                        ) : agreement ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
                                <p className="text-sm text-slate-400 px-2 sm:px-10">Sign the agreement on the Level Map to unlock all worlds!</p>
                            </div>
                        )}
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="md:col-span-3">
                        <TimeLogsViewer userId={user.id} />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="md:col-span-3 bg-white/80 backdrop-blur-md rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-xl border-4 border-white"
                    >
                        <h2 className="text-xl font-black text-[#00695C] uppercase italic mb-6 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                            <FileText size={22} /> Paid Invoices
                        </h2>

                        {invoiceLoading ? (
                            <p className="text-slate-400 font-bold">Loading invoices...</p>
                        ) : paidInvoices.length === 0 ? (
                            <p className="text-slate-400 font-bold">No paid invoices yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {paidInvoices.map((inv) => (
                                    <div key={inv.id} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div>
                                            <p className="font-black text-slate-700">{inv.invoice_number}</p>
                                            <p className="text-sm text-slate-500">Invoice Date {inv.invoice_date} - Paid {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '-'}</p>
                                            <p className="text-sm font-bold text-[#00695C]">Total ${Number(inv.total || 0).toFixed(2)}</p>
                                        </div>
                                        <button
                                            onClick={() => window.open(withAuthQuery(`/api/learner/download_invoice.php?id=${inv.id}`), '_blank')}
                                            className="inline-flex items-center justify-center gap-2 bg-[#00695C] text-white px-4 py-2.5 rounded-lg font-bold text-sm w-full sm:w-auto"
                                        >
                                            <Download size={16} /> Download PDF
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </div>
            </PageContainer>
        </div>
    );
};

export default ProfileClassicView;

