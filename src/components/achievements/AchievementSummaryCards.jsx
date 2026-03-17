import React from 'react';

const Card = ({ label, value, helper }) => (
    <div className="bg-white rounded-2xl border border-[#d7ece8] p-4 sm:p-5 shadow-sm min-h-[120px]">
        <p className="text-xs uppercase tracking-[0.12em] font-black text-slate-400">{label}</p>
        <p className="mt-1 text-xl sm:text-2xl font-black text-[#0f5b52] break-words">{value}</p>
        {helper ? <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p> : null}
    </div>
);

const AchievementSummaryCards = ({ summary }) => {
    const weekly = summary?.weekly_target || {};
    return (
        <section className="space-y-3">
            <h2 className="text-lg font-black text-[#0f5b52] uppercase tracking-wide">Progress Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Card label="Total Points" value={summary?.total_points ?? 0} />
                <Card label="Current Rank" value={summary?.current_rank || 'Seed'} />
                <Card label="Lessons Completed" value={summary?.total_lessons_completed ?? 0} />
                <Card label="Levels Completed" value={summary?.total_levels_completed ?? 0} />
                <Card
                    label="Weekly Goal"
                    value={`${weekly.progress_minutes ?? 0} / ${weekly.target_minutes ?? 90} mins`}
                    helper={`${weekly.progress_lessons ?? 0}/${weekly.target_lessons ?? 3} lessons, ${weekly.progress_quizzes ?? 0}/${weekly.target_quizzes ?? 1} quizzes`}
                />
                <Card label="Current Streak" value={`${summary?.current_streak_days ?? 0} days`} helper={`Best ${summary?.best_streak_days ?? 0} days`} />
            </div>
        </section>
    );
};

export default AchievementSummaryCards;
