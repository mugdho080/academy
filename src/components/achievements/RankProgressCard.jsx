import React from 'react';

const RankProgressCard = ({ summary }) => {
    const rank = summary?.rank_progress;
    const hasNext = Boolean(summary?.next_rank);
    const percent = rank?.percent ?? 100;

    return (
        <section className="bg-white rounded-2xl border border-[#d7ece8] p-5 shadow-sm">
            <h2 className="text-lg font-black text-[#0f5b52] uppercase tracking-wide">Rank Progress</h2>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div>
                    <p className="text-sm font-bold text-slate-500">Current Rank</p>
                    <p className="text-xl sm:text-2xl font-black text-[#0f5b52] break-words">{summary?.current_rank || 'Seed'}</p>
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-500">Next Rank</p>
                    <p className="text-xl sm:text-2xl font-black text-[#0f5b52] break-words">{summary?.next_rank || 'Master Learner'}</p>
                </div>
            </div>

            {hasNext ? (
                <>
                    <div className="mt-4 h-4 bg-[#e8f5f2] rounded-full overflow-hidden border border-[#cae7e1]">
                        <div className="h-full bg-[#2d9c89]" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mt-2 text-sm font-bold text-slate-600">
                        {rank?.current_points ?? 0} / {rank?.next_rank_points ?? 0} points
                    </p>
                    <p className="mt-1 text-sm text-[#0f5b52] font-semibold">
                        {summary?.points_to_next_rank ?? 0} more points to rank up
                    </p>
                </>
            ) : (
                <p className="mt-4 text-sm font-semibold text-[#0f5b52]">You reached the highest rank. Great consistency.</p>
            )}
        </section>
    );
};

export default RankProgressCard;
