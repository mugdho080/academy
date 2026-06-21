import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import PageContainer from '../components/layout/PageContainer';
import SensoryBackground from '../components/SensoryBackground';

const ProgressWorld = () => {
    const [summary, setSummary] = useState(null);
    const [badges, setBadges] = useState({ allBadges: [], earnedBadges: [] });
    const [shop, setShop] = useState({ shopItems: [], unlockedItems: [] });
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [sumRes, badgeRes, shopRes] = await Promise.all([
                axios.get('/api/learner/gamification/summary'),
                axios.get('/api/learner/gamification/badges'),
                axios.get('/api/learner/gamification/shop')
            ]);
            setSummary(sumRes.data);
            setBadges(badgeRes.data);
            setShop(shopRes.data);
        } catch (err) {
            console.error('Failed to fetch gamification data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUnlock = async (itemKey) => {
        try {
            const res = await axios.post(`/api/learner/gamification/shop/${itemKey}/unlock`);
            if (res.data.success) {
                setSummary(prev => ({ ...prev, current_coins: res.data.newCoinBalance }));
                setShop(prev => ({
                    ...prev,
                    unlockedItems: [...prev.unlockedItems, { cosmetic_key: itemKey }]
                }));
                showToast('Item unlocked successfully!', 'success');
            }
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to unlock', 'error');
        }
    };

    const showToast = (message, type) => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    if (loading) return <div className="p-8">Loading your Panda Progress...</div>;

    const earnedBadgeKeys = badges.earnedBadges.map(b => b.badge_key);
    const unlockedItemKeys = shop.unlockedItems.map(i => i.cosmetic_key);

    return (
        <div className="h-full w-full relative overflow-auto font-sans bg-[#F8FAFC]">
            <SensoryBackground />
            
            {/* Toast Notification */}
            <AnimatePresence>
                {toast.show && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -50, x: '-50%' }}
                        className={`fixed top-6 left-1/2 z-50 px-6 py-3 rounded-full font-black text-sm shadow-xl flex items-center gap-2 ${
                            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}
                    >
                        {toast.type === 'success' ? '✅' : '❌'} {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            <PageContainer className="relative z-10 py-8 space-y-8">
                <header>
                    <h1 className="text-4xl font-black italic uppercase text-[#3B1B54]">My Panda Progress</h1>
                    <p className="text-slate-600 font-bold mt-2">Track your XP, Badges, and Rewards!</p>
                </header>

                <div className="flex gap-4 border-b-2 border-slate-200 pb-2 overflow-x-auto">
                    {['overview', 'badges', 'shop'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 rounded-t-lg font-black uppercase transition-colors ${
                                activeTab === tab 
                                ? 'bg-white text-[#00695C] border-t-4 border-[#00695C] shadow-sm' 
                                : 'text-slate-400 hover:bg-white/50'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl border-4 border-[#00897B] text-center">
                            <div className="text-6xl mb-2">{summary?.rank_icon || '🌱'}</div>
                            <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Current Rank</p>
                            <h2 className="text-2xl font-black text-[#00897B] italic uppercase">{summary?.rank_name || 'Seed Learner'}</h2>
                            
                            <div className="mt-4 bg-slate-100 rounded-full h-4 overflow-hidden relative">
                                <motion.div 
                                    className="h-full bg-yellow-400"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, ((summary?.total_xp || 0) / (summary?.next_rank_xp || 100)) * 100)}%` }}
                                />
                            </div>
                            <p className="text-xs font-bold text-slate-500 mt-2">{summary?.total_xp} / {summary?.next_rank_xp} XP to next rank</p>
                        </div>
                        
                        <div className="bg-white p-6 rounded-[2rem] shadow-lg flex flex-col items-center justify-center text-center">
                            <div className="text-5xl mb-2">🪙</div>
                            <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Star Coins</p>
                            <h2 className="text-4xl font-black text-yellow-500">{summary?.current_coins || 0}</h2>
                        </div>
                        
                        <div className="bg-white p-6 rounded-[2rem] shadow-lg flex flex-col items-center justify-center text-center">
                            <div className="text-5xl mb-2">🔥</div>
                            <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Learning Streak</p>
                            <h2 className="text-4xl font-black text-orange-500">{summary?.current_streak || 0} Days</h2>
                        </div>
                    </div>
                )}

                {activeTab === 'badges' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {badges.allBadges.map(badge => {
                            const isEarned = earnedBadgeKeys.includes(badge.badge_key);
                            return (
                                <div key={badge.badge_key} className={`bg-white p-4 rounded-2xl shadow-md text-center border-2 ${isEarned ? 'border-yellow-400' : 'border-slate-100 opacity-60'}`}>
                                    <div className="text-4xl mb-2">{isEarned ? badge.icon : '🔒'}</div>
                                    <h3 className="font-black text-sm uppercase text-[#3B1B54]">{badge.name}</h3>
                                    <p className="text-xs text-slate-500 mt-1">{badge.description}</p>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'shop' && (
                    <div>
                        <div className="flex items-center gap-2 mb-6 bg-yellow-100 p-4 rounded-xl text-yellow-800 font-bold">
                            <span>🪙</span> You have {summary?.current_coins || 0} Star Coins to spend!
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            {shop.shopItems.map(item => {
                                const isUnlocked = unlockedItemKeys.includes(item.cosmetic_key);
                                return (
                                    <div key={item.cosmetic_key} className="bg-white p-6 rounded-2xl shadow-lg border-2 border-slate-100 flex flex-col items-center text-center">
                                        <div className="text-5xl mb-3">{item.icon}</div>
                                        <h3 className="font-black text-lg uppercase text-[#00695C]">{item.name}</h3>
                                        <p className="text-sm text-slate-500 my-2 flex-grow">{item.description}</p>
                                        
                                        {isUnlocked ? (
                                            <button className="mt-4 w-full py-2 bg-green-100 text-green-700 font-black rounded-lg cursor-default">
                                                UNLOCKED
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleUnlock(item.cosmetic_key)}
                                                className="mt-4 w-full py-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-black rounded-lg transition-colors flex items-center justify-center gap-2"
                                            >
                                                <span>🪙 {item.coin_cost}</span> UNLOCK
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </PageContainer>
        </div>
    );
};

export default ProgressWorld;
