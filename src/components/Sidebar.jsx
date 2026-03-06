import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Map,
    Trophy,
    Bot,
    User,
    LogOut,
    Settings,
    Heart
} from 'lucide-react';
import { useActivityTimer } from '../context/ActivityTimerProvider';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logoutLearner } = useActivityTimer();

    const menuItems = [
        { icon: <Map size={24} />, text: 'My World Map', path: '/dashboard' },
        { icon: <Trophy size={24} />, text: 'Achievements', path: '#' }, // Placeholder
        { icon: <Bot size={24} />, text: 'My AI Friend', path: '/ai-friend' },
        { icon: <User size={24} />, text: 'My Profile', path: '/profile' },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <aside className="fixed left-0 top-0 h-full w-[280px] bg-[#00695C] text-white flex flex-col p-6 z-50 shadow-2xl font-sans">
            {/* Logo area */}
            <div className="mb-12 flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/dashboard')}>
                <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-[#00695C] shadow-lg group-hover:rotate-12 transition-transform">
                    <span className="font-black text-2xl italic">e</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-2xl font-black leading-tight tracking-tighter italic text-white group-hover:text-yellow-400 transition-colors">e-learning</span>
                    <span className="text-sm font-bold leading-tight tracking-widest uppercase text-teal-200">Academy</span>
                </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4 px-2">Menu</p>
                {menuItems.map((item, index) => (
                    <button
                        key={index}
                        onClick={() => item.path !== '#' && navigate(item.path)}
                        className={`
                            flex items-center gap-4 w-full text-left p-3 rounded-2xl transition-all group relative overflow-hidden
                            ${isActive(item.path) ? 'bg-white text-[#00695C] shadow-lg scale-105' : 'hover:bg-white/10 text-teal-100 hover:text-white'}
                        `}
                    >
                        <span className={`
                            p-2 rounded-xl transition-colors
                            ${isActive(item.path) ? 'bg-[#00695C] text-white' : 'bg-white/5 text-teal-200 group-hover:bg-yellow-400 group-hover:text-[#00695C]'}
                        `}>
                            {item.icon}
                        </span>
                        <span className="font-black text-sm tracking-wide">
                            {item.text}
                        </span>
                        {isActive(item.path) && (
                            <div className="absolute right-3 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                        )}
                    </button>
                ))}
            </nav>

            {/* Bottom Actions */}
            <div className="mt-auto space-y-4 pt-6 border-t border-white/10">
                <button className="flex items-center gap-4 w-full p-2 hover:bg-white/5 rounded-xl transition-colors text-sm font-bold text-teal-200 hover:text-white">
                    <Settings size={18} />
                    Settings
                </button>

                <button
                    onClick={async () => {
                        await logoutLearner();
                        navigate('/login');
                    }}
                    className="flex items-center gap-4 w-full bg-[#00897B] hover:bg-red-500/20 text-white hover:text-red-200 font-bold p-4 rounded-2xl transition-all shadow-lg border border-white/10 group"
                >
                    <div className="bg-red-500/20 p-2 rounded-lg group-hover:bg-red-500 group-hover:text-white transition-colors">
                        <LogOut size={20} />
                    </div>
                    Log Out
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
