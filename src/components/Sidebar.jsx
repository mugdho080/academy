import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Map,
    Trophy,
    Bot,
    User,
    LogOut,
    Settings,
    Gamepad2
} from 'lucide-react';
import { useActivityTimer } from '../context/ActivityTimerProvider';

const Sidebar = ({ className = '', onNavigate }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logoutLearner } = useActivityTimer();
    const isClay = false;

    const menuItems = [
        { icon: <Map size={24} />, text: 'My World Map', path: '/dashboard' },
        { icon: <Trophy size={24} />, text: 'Achievements', path: '/achievements' },
        { icon: <Bot size={24} />, text: 'My AI Friend', path: '/ai-friend' },
        { icon: <Gamepad2 size={24} />, text: 'Arcade', path: '/arcade' },
        { icon: <User size={24} />, text: 'My Profile', path: '/profile' },
    ];

    const isActive = (path) => {
        if (path === '/dashboard') {
            return (
                location.pathname === '/dashboard' ||
                location.pathname.startsWith('/chapter/') ||
                location.pathname.startsWith('/level/') ||
                location.pathname.startsWith('/lesson/')
            );
        }
        return location.pathname === path;
    };

    const goTo = (path) => {
        navigate(path);
        if (onNavigate) onNavigate();
    };

    return (
        <aside
            className={`h-full w-[280px] max-w-[86vw] flex flex-col p-4 sm:p-5 lg:p-6 z-50 shadow-2xl font-sans overflow-y-auto ${isClay ? 'ui-clay-sidebar text-[color:var(--clay-text)]' : 'bg-[#00695C] text-white'} ${className}`}
            aria-label="Main navigation"
        >
            <button
                type="button"
                className="mb-8 sm:mb-10 flex items-center gap-2 cursor-pointer group text-left"
                onClick={() => goTo('/dashboard')}
            >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform ${isClay ? 'bg-gradient-to-br from-[#8fd4ff] to-[#21A7F1] text-white' : 'bg-yellow-400 text-[#00695C]'}`}>
                    <span className="font-black text-2xl italic">G</span>
                </div>
                <div className="flex flex-col">
                    <span className={`text-2xl font-black leading-tight tracking-tighter italic transition-colors ${isClay ? 'text-[color:var(--clay-text)] group-hover:text-[#21A7F1]' : 'text-white group-hover:text-yellow-400'}`}>Goodwill Care</span>
                    <span className={`text-sm font-bold leading-tight tracking-widest uppercase ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-teal-200'}`}>Academy</span>
                </div>
            </button>

            <nav className="flex-1 space-y-3" aria-label="Learner pages">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-2 ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-white/40'}`}>Menu</p>
                {menuItems.map((item, index) => (
                    <button
                        key={index}
                        onClick={() => item.path !== '#' && goTo(item.path)}
                        className={`
                            flex items-center gap-4 w-full text-left p-3 sm:p-3.5 rounded-2xl transition-all group relative overflow-hidden
                            ${isActive(item.path)
                                ? isClay
                                    ? 'ui-clay-surface text-[color:var(--clay-text)] scale-[1.02]'
                                    : 'bg-white text-[#00695C] shadow-lg scale-105'
                                : isClay
                                    ? 'text-[color:var(--clay-text-soft)] hover:bg-white/45 hover:text-[color:var(--clay-text)]'
                                    : 'hover:bg-white/10 text-teal-100 hover:text-white'
                            }
                        `}
                        aria-current={isActive(item.path) ? 'page' : undefined}
                    >
                        <span className={`
                            p-2 rounded-xl transition-colors
                            ${isActive(item.path)
                                ? isClay
                                    ? 'bg-gradient-to-br from-[#8fd4ff] to-[#21A7F1] text-white'
                                    : 'bg-[#00695C] text-white'
                                : isClay
                                    ? 'ui-clay-icon-pocket text-[#21A7F1]'
                                    : 'bg-white/5 text-teal-200 group-hover:bg-yellow-400 group-hover:text-[#00695C]'
                            }
                        `}>
                            {item.icon}
                        </span>
                        <span className="font-black text-sm tracking-wide">
                            {item.text}
                        </span>
                        {isActive(item.path) && (
                            <div className={`absolute right-3 w-2 h-2 rounded-full animate-pulse ${isClay ? 'bg-[#21A7F1]' : 'bg-yellow-400'}`} />
                        )}
                    </button>
                ))}
            </nav>

            <div className={`mt-auto space-y-3 pt-5 ${isClay ? 'border-t border-white/50' : 'border-t border-white/10'}`}>
                <button className={`flex items-center gap-4 w-full p-2 rounded-xl transition-colors text-sm font-bold ${isClay ? 'text-[color:var(--clay-text-soft)] hover:bg-white/35 hover:text-[color:var(--clay-text)]' : 'hover:bg-white/5 text-teal-200 hover:text-white'}`}>
                    <Settings size={18} />
                    Settings
                </button>

                <button
                    onClick={async () => {
                        await logoutLearner();
                        navigate('/login');
                        if (onNavigate) onNavigate();
                    }}
                    className={`flex items-center gap-4 w-full font-bold p-3.5 rounded-2xl transition-all shadow-lg border group ${isClay ? 'ui-clay-button-danger' : 'bg-[#00897B] hover:bg-red-500/20 text-white hover:text-red-200 border-white/10'}`}
                >
                    <div className={`p-2 rounded-lg transition-colors ${isClay ? 'bg-white/35 text-white' : 'bg-red-500/20 group-hover:bg-red-500 group-hover:text-white'}`}>
                        <LogOut size={20} />
                    </div>
                    Log Out
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
