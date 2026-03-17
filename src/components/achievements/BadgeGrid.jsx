import React, { useMemo, useState } from 'react';

const BadgeGrid = ({ badges = [] }) => {
    const [selected, setSelected] = useState(null);
    const grouped = useMemo(() => [...badges].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)), [badges]);

    return (
        <section className="space-y-3">
            <h2 className="text-lg font-black text-[#0f5b52] uppercase tracking-wide">Badge Gallery</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {grouped.map((badge) => (
                    <button
                        key={badge.id}
                        onClick={() => setSelected(badge)}
                        className={`text-left rounded-2xl border p-4 transition ${badge.is_unlocked
                            ? 'bg-white border-[#bde2da] shadow-sm hover:border-[#2d9c89]'
                            : 'bg-[#f2f4f5] border-[#d9dde0] text-slate-500'
                            }`}
                    >
                        <p className="text-[10px] uppercase tracking-[0.1em] font-black">{badge.category}</p>
                        <p className="mt-1 text-sm font-black">{badge.title}</p>
                        <p className="mt-2 text-xs">{badge.is_unlocked ? 'Unlocked' : 'Locked'}</p>
                    </button>
                ))}
            </div>

            {selected ? (
                <div className="fixed inset-0 z-[150] bg-black/30 flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl p-4 sm:p-5 border border-[#d7ece8] shadow-xl">
                        <h3 className="text-lg sm:text-xl font-black text-[#0f5b52]">{selected.title}</h3>
                        <p className="mt-2 text-sm text-slate-600">{selected.description}</p>
                        <p className="mt-3 text-xs text-slate-500">
                            Condition: {selected.threshold_value} {selected.threshold_type}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            {selected.is_unlocked ? `Unlocked on ${new Date(selected.unlocked_at).toLocaleDateString()}` : 'Not unlocked yet'}
                        </p>
                        <button
                            onClick={() => setSelected(null)}
                            className="mt-4 px-4 py-2 rounded-xl bg-[#0f5b52] text-white font-bold text-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            ) : null}
        </section>
    );
};

export default BadgeGrid;
