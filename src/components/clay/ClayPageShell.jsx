import React from 'react';

const ClayPageShell = ({ children, className = '' }) => {
    return (
        <div className={`min-h-screen relative overflow-hidden bg-[color:var(--clay-bg)] text-[color:var(--clay-text)] ${className}`}>
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.85),transparent_45%),radial-gradient(circle_at_top_right,rgba(169,204,251,0.35),transparent_35%)]" />
                <div className="absolute right-[-6rem] top-[18%] h-64 w-64 rounded-full bg-[rgba(158,217,250,0.28)] blur-3xl" />
                <div className="absolute left-[-5rem] bottom-[8%] h-72 w-72 rounded-full bg-[rgba(255,255,255,0.75)] blur-3xl" />
            </div>
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};

export default ClayPageShell;

