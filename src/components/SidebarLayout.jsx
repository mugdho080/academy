import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TimerWidget from './TimerWidget';
import PandaCoachBubble from './PandaCoachBubble';
import PandaCoachPanel from './PandaCoachPanel';
import { useUiVariant } from '../context/UiVariantContext';

const SidebarLayout = ({ children }) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const location = useLocation();
    const { variant } = useUiVariant('learner');
    const isClay = variant === 'clay';

    useEffect(() => {
        setDrawerOpen(false);
    }, [location.pathname]);

    return (
        <div className={`flex min-h-screen safe-mobile-height ${isClay ? 'ui-variant-clay ui-learner-shell' : 'bg-[#00A5C4]'}`}>
            <TimerWidget />
            <PandaCoachBubble />
            <PandaCoachPanel />

            <Sidebar className="hidden lg:flex fixed left-0 top-0" />

            <header className={`lg:hidden fixed top-0 inset-x-0 z-[70] px-3 py-2.5 border-b ${isClay ? 'ui-clay-topbar border-white/60 backdrop-blur-xl' : 'bg-[#00695C]/95 backdrop-blur border-white/15'}`}>
                <div className="flex items-center justify-between gap-3">
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className={`h-11 w-11 rounded-xl flex items-center justify-center ${isClay ? 'ui-clay-button-secondary text-[color:var(--clay-text)]' : 'bg-white/10 text-white'}`}
                        aria-label="Open menu"
                        aria-expanded={drawerOpen}
                        aria-controls="mobile-main-menu"
                    >
                        <Menu size={22} />
                    </button>
                    <div className={`text-center ${isClay ? 'text-[color:var(--clay-text)]' : 'text-white'}`}>
                        <p className={`text-[11px] uppercase tracking-[0.14em] font-black ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-teal-100'}`}>Goodwill Care Academy</p>
                        <p className="text-base font-black leading-tight">Learning Menu</p>
                    </div>
                    <div className="h-11 w-11" aria-hidden="true" />
                </div>
            </header>

            {drawerOpen && (
                <div className="lg:hidden fixed inset-0 z-[95]">
                    <button
                        onClick={() => setDrawerOpen(false)}
                        className={`absolute inset-0 ${isClay ? 'bg-[#5d7290]/28 backdrop-blur-[1px]' : 'bg-black/45'}`}
                        aria-label="Close menu overlay"
                    />
                    <div id="mobile-main-menu" className="absolute inset-y-0 left-0">
                        <Sidebar className="h-full" onNavigate={() => setDrawerOpen(false)} />
                        <button
                            onClick={() => setDrawerOpen(false)}
                            className={`absolute top-3 right-3 h-10 w-10 rounded-xl flex items-center justify-center ${isClay ? 'ui-clay-button-secondary text-[color:var(--clay-text)]' : 'bg-white/15 text-white'}`}
                            aria-label="Close menu"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            <main className={`flex-1 lg:ml-[280px] relative min-h-screen safe-mobile-height overflow-hidden pt-[64px] lg:pt-0 ${isClay ? 'ui-clay-page' : ''}`}>
                {children}
            </main>
        </div>
    );
};

export default SidebarLayout;
