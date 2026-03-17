import React from 'react';

const ChapterMasteryGrid = ({ chapters = [] }) => (
    <section className="space-y-3">
        <h2 className="text-lg font-black text-[#0f5b52] uppercase tracking-wide">Chapter Mastery</h2>
        <div className="grid md:grid-cols-2 gap-3">
            {chapters.map((chapter) => (
                <div key={chapter.chapter_id} className="bg-white rounded-2xl border border-[#d7ece8] p-4 shadow-sm">
                    <p className="text-sm font-black text-[#0f5b52] break-words">{chapter.chapter_name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                        Lessons {chapter.completed_lessons} • Levels {chapter.completed_levels}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{chapter.chapter_points} chapter points</p>
                    <p className="mt-2 inline-block text-xs font-bold px-2 py-1 rounded-full bg-[#e8f5f2] text-[#0f5b52]">
                        {chapter.mastery_rank}
                    </p>
                </div>
            ))}
            {chapters.length === 0 ? <p className="text-sm text-slate-500 font-semibold">No chapter data yet.</p> : null}
        </div>
    </section>
);

export default ChapterMasteryGrid;
