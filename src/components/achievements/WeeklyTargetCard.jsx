import React from 'react';
import { useNavigate } from 'react-router-dom';

const Progress = ({ label, value, target }) => {
    const percent = target > 0 ? Math.max(0, Math.min(100, Math.round((value / target) * 100))) : 0;
    return (
        <div>
            <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
                <span>{label}</span>
                <span>{value} / {target}</span>
            </div>
            <div className="mt-1 h-3 bg-[#e8f5f2] rounded-full overflow-hidden border border-[#cae7e1]">
                <div className="h-full bg-[#2d9c89]" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
};

const WeeklyTargetCard = ({ weekly }) => {
    const navigate = useNavigate();
    const achieved = Number(weekly?.achieved_flag) === 1;

    return (
        <section className="bg-white rounded-2xl border border-[#d7ece8] p-5 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-[#0f5b52] uppercase tracking-wide">Weekly Target</h2>
            <Progress label="Learning Minutes" value={weekly?.progress_minutes ?? 0} target={weekly?.target_minutes ?? 90} />
            <Progress label="Lessons" value={weekly?.progress_lessons ?? 0} target={weekly?.target_lessons ?? 3} />
            <Progress label="Quizzes" value={weekly?.progress_quizzes ?? 0} target={weekly?.target_quizzes ?? 1} />
            <p className={`text-sm font-bold ${achieved ? 'text-[#1f7a69]' : 'text-slate-600'}`}>
                {achieved ? `Goal achieved. Reward +${weekly?.reward_points ?? 100} points.` : 'Keep going. Small steps are enough.'}
            </p>
            <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2.5 rounded-xl bg-[#0f5b52] text-white font-bold text-sm w-full sm:w-auto"
            >
                Continue today's goal
            </button>
        </section>
    );
};

export default WeeklyTargetCard;
