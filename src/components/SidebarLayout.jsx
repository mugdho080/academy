import React from 'react';
import Sidebar from './Sidebar';
import TimerWidget from './TimerWidget';

const SidebarLayout = ({ children }) => {
    return (
        <div className="flex min-h-screen bg-[#00A5C4]"> {/* Teal background from design */}
            <TimerWidget /> {/* Active across all private routes wrapped in SidebarLayout */}
            <Sidebar />
            <main className="flex-1 ml-[280px] relative min-h-screen overflow-hidden">
                {children}
            </main>
        </div>
    );
};

export default SidebarLayout;
