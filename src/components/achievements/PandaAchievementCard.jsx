import React from 'react';

const PandaAchievementCard = ({ panda }) => (
    <section className="bg-[#f4fbf9] rounded-2xl border border-[#cfe9e2] p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.12em] font-black text-slate-500">Panda Coach Suggestion</p>
        <p className="mt-2 text-lg font-black text-[#0f5b52]">{panda?.message || 'You are doing well. Keep taking one step at a time.'}</p>
        <p className="mt-2 text-sm font-semibold text-slate-600">{panda?.next_hint || 'One short lesson today keeps your progress moving.'}</p>
    </section>
);

export default PandaAchievementCard;
