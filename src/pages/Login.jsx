import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { saveAuth } from '../utils/api';
import SensoryBackground from '../components/SensoryBackground';
import { useActivityTimer } from '../context/ActivityTimerProvider';

const Login = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { startSession } = useActivityTimer();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await axios.post('/api/auth/login', { identifier, password });
            if (response.data.success) {
                saveAuth(response.data.token, response.data.user);

                if (response.data.user.role === 'admin') {
                    navigate('/admin/dashboard');
                } else {
                    try {
                        await startSession({ context_type: 'dashboard' });
                    } catch (sessionErr) {
                        console.error("Failed to start tracking session:", sessionErr);
                    }
                    navigate('/dashboard');
                }
            }
        } catch (err) {
            console.error("Login error details:", err);
            setError(err.response?.data?.error || `Oops! Something went wrong. Connection error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen safe-mobile-height flex items-center justify-center p-3 sm:p-4">
            <SensoryBackground />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/80 backdrop-blur-md p-5 sm:p-8 rounded-3xl shadow-xl w-full max-w-md relative z-10 border-4 border-primary-light"
            >
                <div className="text-center mb-6 sm:mb-8">
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="inline-block p-4 bg-primary-light rounded-full mb-4 text-primary-dark"
                    >
                        <LogIn size={32} />
                    </motion.div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark">Welcome Back!</h1>
                    <p className="text-sm sm:text-base text-gray-600 mt-2 italic font-medium">"Every small step is a great victory."</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-gray-700 font-semibold mb-2">Email or NDIS Number</label>
                        <input
                            type="text"
                            className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-primary focus:outline-none transition-all text-base"
                            placeholder="Your email or NDIS number..."
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 font-semibold mb-2">Password</label>
                        <input
                            type="password"
                            className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-primary focus:outline-none transition-all text-base"
                            placeholder="Your secret password..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 bg-red-50 p-3 rounded-xl text-sm font-medium text-center">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 rounded-2xl font-bold text-base sm:text-lg text-white shadow-lg transform transition-all active:scale-95 ${loading ? 'bg-gray-400' : 'bg-primary hover:bg-primary-dark'}`}
                    >
                        {loading ? 'Joining the adventure...' : 'Let\'s Start Learning! 🚀'}
                    </button>
                </form>

                <div className="mt-8 text-center space-y-4">
                    <p className="block text-primary-dark/70 font-semibold">
                        Password resets are handled by an administrator.
                    </p>
                    <div className="h-px bg-gray-100 w-full"></div>
                    <p className="text-gray-600">
                        New here? {' '}
                        <Link to="/signup" className="text-primary-dark font-bold hover:underline">
                            Create your account
                        </Link>
                    </p>
                </div>
            </motion.div>

            <div className="fixed bottom-4 left-4 items-center gap-2 text-primary-dark/60 font-medium hidden sm:flex">
                <Heart size={20} className="fill-current" />
                <span>Built with care for you</span>
            </div>
        </div>
    );
};

export default Login;
