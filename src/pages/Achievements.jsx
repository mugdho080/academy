import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AchievementSummaryCards from '../components/achievements/AchievementSummaryCards';
import RankProgressCard from '../components/achievements/RankProgressCard';
import BadgeGrid from '../components/achievements/BadgeGrid';
import WeeklyTargetCard from '../components/achievements/WeeklyTargetCard';
import RecentWinsTimeline from '../components/achievements/RecentWinsTimeline';
import ChapterMasteryGrid from '../components/achievements/ChapterMasteryGrid';
import PandaAchievementCard from '../components/achievements/PandaAchievementCard';
import PageContainer from '../components/layout/PageContainer';
import { useUiVariant } from '../context/UiVariantContext';

const Achievements = () => {
    const [summary, setSummary] = useState(null);
    const [badges, setBadges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { variant } = useUiVariant('learner');
    const isClay = variant === 'clay';

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [summaryRes, badgesRes] = await Promise.all([
                    axios.get('/api/learner/get_achievement_summary.php'),
                    axios.get('/api/learner/get_achievements.php')
                ]);
                setSummary(summaryRes.data || null);
                setBadges(Array.isArray(badgesRes.data?.items) ? badgesRes.data.items : []);
                setError('');
            } catch (err) {
                setError(err?.response?.data?.error || 'Failed to load achievements');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className={`min-h-screen ${isClay ? 'ui-clay-page' : 'bg-[#e8f5f2]'}`}>
                <PageContainer>
                    <p className={`text-lg font-black ${isClay ? 'ui-clay-heading' : 'text-[#0f5b52]'}`}>Loading achievements...</p>
                </PageContainer>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`min-h-screen ${isClay ? 'ui-clay-page' : 'bg-[#e8f5f2]'}`}>
                <PageContainer className="space-y-4">
                    <div className={`rounded-2xl p-5 ${isClay ? 'ui-clay-surface' : 'bg-white border border-[#d7ece8]'}`}>
                        <p className="text-sm font-bold text-red-600">{error}</p>
                    </div>
                </PageContainer>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${isClay ? 'ui-clay-page' : 'bg-gradient-to-b from-[#e8f5f2] to-[#f6fbfa]'}`}>
            <PageContainer className="space-y-5 md:space-y-6 pb-24 lg:pb-10">
                <header className={`rounded-2xl p-5 ${isClay ? 'ui-clay-surface' : 'bg-white border border-[#d7ece8] shadow-sm'}`}>
                    <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${isClay ? 'ui-clay-heading' : 'text-[#0f5b52]'}`}>Achievements</h1>
                    <p className={`mt-1 text-sm font-semibold ${isClay ? 'ui-clay-text-soft' : 'text-slate-600'}`}>
                        Your progress is personal. Every step counts.
                    </p>
                </header>

                <AchievementSummaryCards summary={summary} />
                <RankProgressCard summary={summary} />
                <BadgeGrid badges={badges} />
                <WeeklyTargetCard weekly={summary?.weekly_target} />
                <RecentWinsTimeline wins={summary?.recent_wins || []} />
                <ChapterMasteryGrid chapters={summary?.chapter_mastery || []} />
                <PandaAchievementCard panda={summary?.panda_suggestion} />
            </PageContainer>
        </div>
    );
};

export default Achievements;
