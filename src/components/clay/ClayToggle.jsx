import React from 'react';

const ClayToggle = ({ label, value, onChange, options, appearance = 'clay', compact = false }) => {
    const isClay = appearance === 'clay';

    return (
        <div className={isClay ? 'clay-card px-3 py-3 sm:px-4 sm:py-4 w-full overflow-hidden' : 'rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 sm:px-4 sm:py-4 shadow-sm w-full overflow-hidden'}>
            <div className={`flex gap-3 ${compact ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:justify-between'}`}>
                <div className={compact ? 'max-w-[6rem]' : ''}>
                    <p className={`text-[11px] uppercase tracking-[0.16em] font-black ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-400'}`}>
                        UI Variant
                    </p>
                    <p className={`text-sm font-semibold ${isClay ? 'text-[color:var(--clay-text)]' : 'text-slate-700'}`}>
                        {label}
                    </p>
                </div>
                <div className={isClay ? `clay-toggle-shell w-full ${compact ? 'grid grid-cols-2' : 'sm:w-auto'}` : `gap-1 rounded-full bg-slate-100 p-1 w-full ${compact ? 'grid grid-cols-2' : 'inline-flex sm:w-auto'}`}>
                    {options.map((option) => {
                        const active = value === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onChange(option.value)}
                                className={isClay
                                    ? `clay-toggle-option w-full min-w-0 ${compact ? 'px-3 text-center' : ''} ${active ? 'clay-toggle-option-active' : ''}`
                                    : `min-h-[40px] w-full min-w-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${active ? 'bg-[#00695C] text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`
                                }
                                aria-pressed={active}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ClayToggle;
