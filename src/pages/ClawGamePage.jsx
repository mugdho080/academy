import React, { useEffect, useState, useRef } from 'react';
import SensoryBackground from '../components/SensoryBackground';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { Trophy, Gamepad2, ArrowLeft, AlertTriangle } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import { useUiVariant } from '../context/UiVariantContext';

const ClawGamePage = () => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [pointsWon, setPointsWon] = useState(null);
    const [activeGame, setActiveGame] = useState(null);
    const iframeRef = useRef(null);
    const { variant } = useUiVariant('learner');
    const isClay = variant === 'clay';

    const arcadeName = (user.name || 'PLY').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();

    useEffect(() => {
        const handleMessage = async (event) => {
            if (event.data && event.data.type === 'CLAW_GAME_OVER') {
                const score = event.data.score;
                setPointsWon(score);

                if (score > 0) {
                    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });

                    try {
                        const pointsRes = await axios.post('/api/learner/update_points.php', {
                            user_id: user.id,
                            points: score,
                            action_code: 'manual_points',
                            source_type: 'arcade_game',
                            source_id: `${Date.now()}`
                        });

                        const updatedUser = { ...user, points: pointsRes?.data?.total_points ?? ((user.points || 0) + score) };
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        setUser(updatedUser);
                    } catch (error) {
                        console.error('Failed to update points:', error);
                    }
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [user]);

    const playAgain = () => {
        setPointsWon(null);
        if (iframeRef.current) {
            iframeRef.current.src = iframeRef.current.src;
        }
    };

    const games = [
        { id: 'claw', name: 'Neon Claw', icon: '??', color: 'bg-[#9C27B0]', description: 'Grab prizes to earn rewards.', locked: false },
        { id: 'math', name: 'Math Blaster', icon: '??', color: 'bg-[#0288D1]', description: 'Coming soon.', locked: true },
        { id: 'memory', name: 'Memory Match', icon: '??', color: 'bg-[#388E3C]', description: 'Coming soon.', locked: true },
        { id: 'words', name: 'Word Scramble', icon: '??', color: 'bg-[#F57C00]', description: 'Coming soon.', locked: true }
    ];

    return (
        <div className={`min-h-screen safe-mobile-height font-sans text-slate-800 relative flex flex-col pb-24 ${isClay ? 'ui-clay-page' : 'bg-[#e0f7fa]'}`}>
            <SensoryBackground />

            <PageContainer className="w-full relative z-10 flex-1 flex flex-col space-y-5 sm:space-y-7">
                <div className="text-center">
                    <h1 className={`text-3xl md:text-5xl font-black italic leading-tight uppercase tracking-tight flex items-center justify-center gap-2 sm:gap-3 ${isClay ? 'ui-clay-heading' : 'text-[#00695C]'}`}>
                        <Gamepad2 size={38} className={isClay ? 'text-[#21A7F1]' : 'text-yellow-500'} /> Game Arcade
                    </h1>
                    <p className={`font-bold mt-2 text-base sm:text-lg ${isClay ? 'ui-clay-text-soft' : 'text-[#00897B]'}`}>Play games and earn points.</p>
                </div>

                {!activeGame ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        {games.map((game) => (
                            <button
                                key={game.id}
                                disabled={game.locked}
                                onClick={() => setActiveGame(game.id)}
                                className={`relative w-full overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 text-left transition-all ${
                                    game.locked
                                        ? isClay ? 'ui-clay-surface opacity-70 cursor-not-allowed grayscale' : 'bg-slate-200 opacity-70 cursor-not-allowed grayscale border-4 border-slate-300'
                                        : isClay ? 'ui-clay-surface ui-clay-interactive hover:scale-105 active:scale-95 cursor-pointer group' : `${game.color} hover:scale-105 active:scale-95 shadow-xl border-4 border-white cursor-pointer group`
                                }`}
                            >
                                <div className="text-5xl sm:text-6xl mb-3 sm:mb-4 transform origin-bottom-left transition-transform group-hover:scale-110">{game.icon}</div>
                                <h3 className={`text-xl sm:text-2xl font-black mb-2 ${game.locked ? 'text-slate-500' : isClay ? 'ui-clay-heading' : 'text-white'}`}>{game.name}</h3>
                                <p className={`font-semibold ${game.locked ? 'text-slate-400' : isClay ? 'ui-clay-text-soft' : 'text-white/80'}`}>{game.description}</p>

                                {game.locked && (
                                    <div className={`absolute top-4 right-4 text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full ${isClay ? 'ui-clay-surface text-[color:var(--clay-text-soft)]' : 'bg-slate-400 text-white'}`}>
                                        LOCKED
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col animate-fade-in gap-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
                            <button
                                onClick={() => {
                                    setActiveGame(null);
                                    setPointsWon(null);
                                }}
                                className={`px-5 py-3 rounded-[2rem] font-bold flex items-center gap-2 transition-all w-full sm:w-auto justify-center ${isClay ? 'ui-clay-button-secondary text-[color:var(--clay-text)]' : 'bg-white/85 backdrop-blur shadow-md text-[#00695C] hover:bg-white'}`}
                            >
                                <ArrowLeft size={20} /> Back to Arcade
                            </button>

                            <div className={`font-bold px-4 sm:px-6 py-3 rounded-[2rem] flex items-center gap-3 text-xs sm:text-sm w-full md:w-auto ${isClay ? 'ui-clay-chip-warning' : 'bg-amber-100/90 backdrop-blur border-2 border-amber-300 text-amber-800 shadow-sm'}`}>
                                <AlertTriangle className="shrink-0 text-amber-500" size={20} />
                                <span>
                                    Game not loading? Run <code className="bg-white/50 px-2 py-1 rounded-lg border border-amber-200 shadow-sm">npm run dev:all</code>.
                                </span>
                            </div>
                        </div>

                        <div className={`relative flex-1 w-full bg-black rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden min-h-[480px] sm:min-h-[600px] ${isClay ? 'ui-clay-surface' : 'shadow-2xl border-4 sm:border-[6px] border-white'}`}>
                            <iframe
                                ref={iframeRef}
                                src={`http://localhost:3001?name=${arcadeName}`}
                                className="absolute inset-0 w-full h-full border-0 bg-[#0a0a0a]"
                                title="Claw Game"
                                allow="fullscreen"
                            />

                            {pointsWon !== null && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center p-4 sm:p-6">
                                    <div className={`rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-10 max-w-md w-full text-center animate-fade-in-up ${isClay ? 'ui-clay-overlay-panel' : 'bg-white shadow-2xl'}`}>
                                        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6 ${isClay ? 'ui-clay-inset-surface' : 'bg-yellow-100 shadow-inner'}`}>
                                            <Trophy size={40} className="text-yellow-500" />
                                        </div>
                                        <h2 className={`text-2xl sm:text-3xl font-black mb-2 ${isClay ? 'ui-clay-heading' : 'text-slate-800'}`}>Great Job!</h2>
                                        <p className="text-slate-600 mb-6 font-medium">You scored <span className="text-[#34A853] font-black text-2xl">{pointsWon}</span> points.</p>

                                        <button
                                            onClick={playAgain}
                                            className={`w-full font-bold py-4 rounded-xl transition-colors active:scale-95 mb-3 ${isClay ? 'ui-clay-button-primary' : 'bg-[#00695C] text-white hover:bg-[#004D40] shadow-lg'}`}
                                        >
                                            Play Again
                                        </button>
                                        <button
                                            onClick={() => {
                                                setActiveGame(null);
                                                setPointsWon(null);
                                            }}
                                            className={`w-full font-bold py-4 rounded-xl transition-colors ${isClay ? 'ui-clay-button-secondary' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                        >
                                            Back to Arcade
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </PageContainer>
        </div>
    );
};

export default ClawGamePage;
