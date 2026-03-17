import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ShieldCheck, PenTool, ChevronRight, ChevronLeft } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import axios from 'axios';

const ServiceAgreementModal = ({ isOpen, onClose, onSign, status, userId }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [signed, setSigned] = useState(false);
    const sigCanvas = useRef({});

    const [formData, setFormData] = useState({
        full_name: '',
        dob: '',
        address: '',
        phone: '',
        emergency_contact: '',
        ndis_number: '',
        nominee: '',
        plan_type: 'NDIA', // Default
        who_pays: 'NDIA', // Default
        plan_manager_name: '',
        plan_manager_contact: '',
        plan_start_date: '',
        plan_end_date: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const clearSignature = () => sigCanvas.current.clear();

    const handleSubmit = async () => {
        if (!userId) {
            alert("Unexpected error: User ID missing. Please log in again.");
            return;
        }

        if (sigCanvas.current.isEmpty()) {
            alert("Please sign the agreement!");
            return;
        }

        setLoading(true);
        try {
            // Workaround for trim-canvas error in some environments
            const canvas = sigCanvas.current.getCanvas();
            const signatureData = canvas.toDataURL('image/png');

            const res = await axios.post('/api/learner/submit_agreement.php', {
                user_id: userId,
                signature_data: signatureData,
                ...formData
            });

            if (res.data.success) {
                setSigned(true);
                // Important: Update local storage status so user doesn't see modal again immediately if they refresh
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...storedUser, status: 'pending' }));

                setTimeout(() => onSign(), 2000);
            } else {
                alert("Submission failed: " + (res.data.error || "Unknown server error"));
            }
        } catch (err) {
            const msg = err.response?.data?.error || err.message || "Error submitting agreement.";
            alert("Error: " + msg);
            console.error("Submission error details:", err.response?.data || err);
        } finally {
            setLoading(false);
        }
    };

    // If already signed/pending, show success state
    React.useEffect(() => {
        if (status === 'pending') setSigned(true);
    }, [status, isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-primary-dark/60 backdrop-blur-md"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-white w-full max-w-4xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border-4 sm:border-8 border-white flex flex-col max-h-[95vh] sm:max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="bg-[#00695C] p-4 sm:p-6 text-white flex justify-between items-center">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase flex items-center gap-2">
                                <ShieldCheck size={28} /> Service Agreement
                            </h2>
                            <p className="text-white/70 text-sm">Step {step} of 3</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="p-4 sm:p-8 overflow-y-auto flex-1">
                        {!signed ? (
                            <>
                                {/* Step 1: Personal Details */}
                                {step === 1 && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right duration-500">
                                        <h3 className="text-xl font-bold text-[#00695C] mb-4">1. Personal Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                            <input name="full_name" placeholder="Full Legal Name" className="p-3 bg-gray-50 rounded-xl border border-gray-200" onChange={handleChange} value={formData.full_name} />
                                            <input name="dob" type="date" placeholder="Date of Birth" className="p-3 bg-gray-50 rounded-xl border border-gray-200" onChange={handleChange} value={formData.dob} />
                                            <input name="address" placeholder="Address" className="p-3 bg-gray-50 rounded-xl border border-gray-200 md:col-span-2" onChange={handleChange} value={formData.address} />
                                            <input name="phone" placeholder="Phone or Email" className="p-3 bg-gray-50 rounded-xl border border-gray-200" onChange={handleChange} value={formData.phone} />
                                            <input name="emergency_contact" placeholder="Emergency Contact" className="p-3 bg-gray-50 rounded-xl border border-gray-200" onChange={handleChange} value={formData.emergency_contact} />
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: NDIS Details */}
                                {step === 2 && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right duration-500">
                                        <h3 className="text-xl font-bold text-[#00695C] mb-4">2. NDIS Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                            <input name="ndis_number" placeholder="NDIS Number" className="p-3 bg-gray-50 rounded-xl border border-gray-200" onChange={handleChange} value={formData.ndis_number} />
                                            <input name="nominee" placeholder="Nominee (Optional)" className="p-3 bg-gray-50 rounded-xl border border-gray-200" onChange={handleChange} value={formData.nominee} />

                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Plan Type</label>
                                                <select name="plan_type" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" onChange={handleChange} value={formData.plan_type}>
                                                    <option value="NDIA">NDIA Managed</option>
                                                    <option value="Plan Managed">Plan Managed</option>
                                                    <option value="Self Managed">Self Managed</option>
                                                </select>
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Who pays the invoices?</label>
                                                <select name="who_pays" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" onChange={handleChange} value={formData.who_pays}>
                                                    <option value="NDIA">NDIA</option>
                                                    <option value="Plan Manager">Plan Manager</option>
                                                    <option value="Participant">Participant</option>
                                                </select>
                                            </div>

                                            {formData.plan_type === 'Plan Managed' && (
                                                <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                                    <p className="text-sm font-bold text-blue-800">Plan Manager Details</p>
                                                    <input name="plan_manager_name" placeholder="Plan Manager Name" className="w-full p-3 bg-white rounded-xl border border-blue-200" onChange={handleChange} value={formData.plan_manager_name} />
                                                    <input name="plan_manager_contact" placeholder="Email or Phone" className="w-full p-3 bg-white rounded-xl border border-blue-200" onChange={handleChange} value={formData.plan_manager_contact} />
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:col-span-2">
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500">Plan Start (Optional)</label>
                                                    <input name="plan_start_date" type="date" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" onChange={handleChange} value={formData.plan_start_date} />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500">Plan End (Optional)</label>
                                                    <input name="plan_end_date" type="date" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" onChange={handleChange} value={formData.plan_end_date} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Sign & Submit */}
                                {step === 3 && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right duration-500">
                                        <h3 className="text-xl font-bold text-[#00695C] mb-4">3. Agreement & Signature</h3>

                                        <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600 border border-gray-200">
                                            <div className="flex justify-between mb-2">
                                                <span className="font-bold">Item</span>
                                                <span className="font-mono">Innovative Community Participation</span>
                                            </div>
                                            <div className="flex justify-between mb-2">
                                                <span className="font-bold">Code</span>
                                                <span className="font-mono">09_008_0116_6_3</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="font-bold">Price</span>
                                                <span className="font-mono text-[#00695C] font-bold">$50.00 / hr</span>
                                            </div>
                                        </div>

                                        <div className="border-2 border-dashed border-[#00695C]/30 rounded-2xl bg-white relative">
                                            <SignatureCanvas
                                                ref={sigCanvas}
                                                penColor="#00695C"
                                                canvasProps={{ className: 'w-full h-40 rounded-2xl' }}
                                            />
                                            <button onClick={clearSignature} className="absolute top-2 right-2 text-xs bg-gray-200 px-2 py-1 rounded text-gray-600 hover:bg-gray-300">Clear</button>
                                            <div className="absolute bottom-2 left-4 pointer-events-none text-gray-300 italic text-sm">Sign here</div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="py-12 text-center animate-in zoom-in duration-500">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"
                                >
                                    <CheckCircle2 size={48} />
                                </motion.div>
                                <h2 className="text-3xl font-bold text-gray-800 mb-4">Agreement Submitted!</h2>
                                <p className="text-xl text-gray-600 px-8">
                                    Our agent will contact you soon. Your account status is now <strong>Under Review</strong>.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    {!signed && (
                        <div className="p-4 sm:p-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3 sm:justify-between">
                            {step > 1 ? (
                                <button onClick={() => setStep(s => s - 1)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl flex items-center justify-center gap-2 w-full sm:w-auto">
                                    <ChevronLeft size={20} /> Back
                                </button>
                            ) : <div className="hidden sm:block"></div>}

                            {step < 3 ? (
                                <button onClick={() => setStep(s => s + 1)} className="px-8 py-3 bg-[#00695C] text-white font-bold rounded-xl shadow-lg hover:bg-[#00897B] flex items-center justify-center gap-2 w-full sm:w-auto">
                                    Next <ChevronRight size={20} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="px-8 py-3 bg-[#00695C] text-white font-bold rounded-xl shadow-lg hover:bg-[#00897B] flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
                                >
                                    {loading ? 'Submitting...' : 'Sign & Submit'} <PenTool size={18} />
                                </button>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ServiceAgreementModal;
