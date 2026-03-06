import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SensoryBackground from '../components/SensoryBackground';

const Signup = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        ndis_number: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post('/api/auth/signup', formData);
            setSuccess(response.data.message);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            console.error("Signup error details:", err);
            setError(err.response?.data?.error || `Something went wrong. Connection error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <SensoryBackground />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-xl w-full max-w-lg relative z-10 border-4 border-primary-light"
            >
                <div className="text-center mb-8">
                    <div className="inline-block p-4 bg-primary-light rounded-full mb-4 text-primary-dark">
                        <UserPlus size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-primary-dark">Join Our Learning Family!</h1>
                    <p className="text-gray-600 mt-2 font-medium">Create your profile to start your adventure 🌈</p>
                </div>

                <form onSubmit={handleSignup} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-gray-700 font-semibold mb-1">Your Full Name</label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-primary focus:outline-none"
                            placeholder="e.g. Alex Smith"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 font-semibold mb-1">Email Address</label>
                        <input
                            type="email"
                            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-primary focus:outline-none"
                            placeholder="alex@email.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 font-semibold mb-1">NDIS Number</label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-primary focus:outline-none"
                            placeholder="e.g. 123 456 789"
                            value={formData.ndis_number}
                            onChange={(e) => setFormData({ ...formData, ndis_number: e.target.value })}
                            required
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-gray-700 font-semibold mb-1">Choose a Password</label>
                        <input
                            type="password"
                            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-primary focus:outline-none"
                            placeholder="Make it strong and simple..."
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>

                    <div className="md:col-span-2 space-y-4 pt-4">
                        {error && <p className="text-red-500 bg-red-50 p-3 rounded-xl text-sm font-medium text-center">{error}</p>}
                        {success && <p className="text-green-600 bg-green-50 p-3 rounded-xl text-lg font-bold text-center flex items-center justify-center gap-2">
                            <Sparkles className="animate-pulse" /> {success}
                        </p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 rounded-2xl font-bold text-lg text-white shadow-lg transform transition-all active:scale-95 ${loading ? 'bg-gray-400' : 'bg-primary hover:bg-primary-dark'}`}
                        >
                            {loading ? 'Creating your world...' : 'Join the Adventure! ✨'}
                        </button>

                        <p className="text-center text-gray-600">
                            Already have an account? {' '}
                            <Link to="/login" className="text-primary-dark font-bold hover:underline">
                                Sign in here
                            </Link>
                        </p>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default Signup;
