import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Coffee } from 'lucide-react';
import { useCoach } from '../context/CoachContext';

const PandaCoachNavigator = ({ compact = false, onAction }) => {
    const navigate = useNavigate();
    const { recommendation, acceptRecommendation } = useCoach();

    const goToRecommended = async () => {
        if (!recommendation?.recommended_route) return;
        await acceptRecommendation();
        navigate(recommendation.recommended_route, {
            state: recommendation?.recommended_lesson_id
                ? { recommendedLessonId: recommendation.recommended_lesson_id }
                : undefined
        });
        if (onAction) onAction();
    };

    if (!recommendation) return null;

    return (
        <div className={`flex ${compact ? 'gap-2' : 'gap-3'} flex-wrap`}>
            <button
                onClick={goToRecommended}
                className={`inline-flex items-center gap-2 rounded-full font-bold transition-colors ${
                    compact
                        ? 'px-3 py-1.5 text-xs bg-[#00695C] text-white'
                        : 'px-4 py-2 text-sm bg-[#00695C] text-white hover:bg-[#005247]'
                }`}
            >
                Next Step <ArrowRight size={compact ? 14 : 16} />
            </button>
            <button
                onClick={onAction}
                className={`inline-flex items-center gap-2 rounded-full font-bold border transition-colors ${
                    compact
                        ? 'px-3 py-1.5 text-xs border-slate-200 text-slate-600'
                        : 'px-4 py-2 text-sm border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
                Quick Break <Coffee size={compact ? 14 : 16} />
            </button>
        </div>
    );
};

export default PandaCoachNavigator;
