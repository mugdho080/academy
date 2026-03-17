import React from 'react';

const RecentWinsTimeline = ({ wins = [] }) => (
    <section className="space-y-3">
        <h2 className="text-lg font-black text-[#0f5b52] uppercase tracking-wide">Recent Wins</h2>
        <div className="bg-white rounded-2xl border border-[#d7ece8] p-4 shadow-sm">
            {wins.length === 0 ? (
                <p className="text-sm text-slate-500 font-semibold">Complete one activity to start your wins timeline.</p>
            ) : (
                <div className="space-y-3">
                    {wins.map((item) => (
                        <div key={item.id} className="border-l-4 border-[#2d9c89] pl-3">
                            <p className="text-sm font-semibold text-slate-700">{item.message}</p>
                            <p className="text-xs text-slate-500">{new Date(item.awarded_at).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </section>
);

export default RecentWinsTimeline;
