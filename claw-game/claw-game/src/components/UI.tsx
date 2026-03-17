/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useState, useEffect } from 'react';
import { useGameStore } from '../store';
import { Users, Trophy, Play, Clock, Info, ListOrdered } from 'lucide-react';

export const UI = () => {
  const { connected, players, queue, activePlayer, turnEndTime, myId, join, joinQueue, gameOver } = useGameStore();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  const DISALLOW_LIST = new Set([
    'ASS', 'CUM', 'FAG', 'FUK', 'FUQ', 'GAY', 'JEW', 'JIZ', 'KKK', 'SEX', 'TIT', 'VAG', 'WAP', 'WTF', 'WTG', 'DIK', 'COK', 'FUC', 'FUX', 'NIG', 'NGR', 'BCH', 'BIT', 'HOE', 'SLT', 'CUN', 'KYS'
  ]);

  const handleJoin = () => {
    const finalName = name.toUpperCase();
    if (finalName.length !== 3) {
      setNameError('Name must be exactly 3 letters');
      return;
    }
    if (!/^[A-Z]{3}$/.test(finalName)) {
      setNameError('Name must contain only letters');
      return;
    }
    if (DISALLOW_LIST.has(finalName)) {
      setNameError('This name is not allowed');
      return;
    }
    setNameError('');
    join(finalName);
  };
  const [activeTab, setActiveTab] = useState<'play' | 'leaderboard' | 'legend'>('play');

  const me = players[myId || ''];
  const isActive = activePlayer === myId && myId !== null;

  useEffect(() => {
    const interval = setInterval(() => {
      if (activePlayer && turnEndTime) {
        setTimeLeft(Math.max(0, Math.ceil((turnEndTime - Date.now()) / 1000)));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [activePlayer, turnEndTime]);

  if (!connected) {
    return <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white font-mono">Connecting to Arcade...</div>;
  }

  if (!me) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full border border-gray-100 text-center">
          <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">NEON CLAW</h1>
          <p className="text-gray-500 font-medium mb-6">Grab as many prizes as you can in 60 seconds!</p>
          
          <div className="mb-6">
            <input 
              type="text" 
              placeholder="AAA" 
              className={`w-full bg-gray-50 text-gray-900 px-6 py-4 rounded-2xl focus:outline-none focus:ring-2 font-black text-center text-2xl uppercase tracking-[0.5em] border transition-all ${nameError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#4285F4]'}`}
              value={name}
              onChange={e => {
                setName(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3));
                setNameError('');
              }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              maxLength={3}
            />
            {nameError && <p className="text-red-500 text-xs font-bold mt-2">{nameError}</p>}
          </div>

          <button 
            onClick={handleJoin}
            className="w-full bg-[#4285F4] text-white font-bold py-4 rounded-full hover:bg-[#3367D6] hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Play size={20} fill="currentColor" /> PLAY NOW
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between font-sans">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-3xl p-5 pointer-events-auto w-80 border border-gray-100 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-1">NEON CLAW</h1>
            <div className="flex items-center gap-2 text-gray-700 text-xs font-medium bg-gray-100/80 px-2 py-1 rounded-lg w-fit">
              <Users size={12} className="text-[#4285F4]" /> {Object.keys(players).length} Online
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-bold">{isActive ? 'Current Score' : 'High Score'}</div>
            <div className="text-3xl font-black text-[#34A853] leading-none">{isActive ? (me.currentScore || 0) : me.score}</div>
          </div>
        </div>

        {/* Right Panel (Consolidated) */}
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-3xl p-5 w-80 pointer-events-auto border border-gray-100 flex flex-col max-h-[calc(100vh-48px)]">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 bg-gray-100/50 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('play')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'play' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Play size={14} className={activeTab === 'play' ? 'text-[#4285F4]' : ''} /> Play
            </button>
            <button 
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'leaderboard' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Trophy size={14} className={activeTab === 'leaderboard' ? 'text-[#FBBC04]' : ''} /> Top
            </button>
            <button 
              onClick={() => setActiveTab('legend')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'legend' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Info size={14} className={activeTab === 'legend' ? 'text-[#34A853]' : ''} /> Info
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto min-h-[200px]">
            {activeTab === 'leaderboard' && (
              <div className="space-y-3">
                {Object.values(players).sort((a: any, b: any) => b.score - a.score).slice(0, 10).map((p: any, i) => (
                  <div key={p.id} className="flex justify-between items-center text-sm">
                    <span className="font-bold flex items-center gap-2" style={{ color: p.color }}>
                      <span className="text-gray-400 text-xs w-4">{i+1}.</span> {p.name} {p.id === myId && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-1">YOU</span>}
                    </span>
                    <span className="font-bold text-gray-900">{p.score}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'play' && (
              <div className="flex flex-col h-full">
                {activePlayer ? (
                  <div className="mb-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex-1 flex flex-col items-center justify-center">
                    <div className="text-xs text-gray-500 mb-2 font-bold uppercase tracking-widest">Game in Progress</div>
                    <div className="font-black text-5xl text-[#4285F4] mb-2">{timeLeft}s</div>
                    <div className="text-sm font-medium text-gray-600 mb-4">Grab as many points as you can!</div>
                    <div className="bg-white/80 px-4 py-2 rounded-lg text-xs font-bold text-gray-500 border border-blue-100">
                      WASD to move • SPACE to drop
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Clock size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-black text-gray-900 mb-2">Ready to Play?</h3>
                    <p className="text-sm text-gray-500 mb-6 font-medium">You have 60 seconds to grab as many prizes as possible.</p>
                    <button 
                      onClick={joinQueue}
                      className="w-full bg-[#4285F4] text-white font-bold py-4 rounded-xl hover:bg-[#3367D6] hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base"
                    >
                      <Play size={20} fill="currentColor" /> Start Game
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'legend' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Colors (Base Points)</h2>
                  <div className="grid grid-cols-2 gap-y-2 text-xs font-medium text-gray-700">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#FBBC04] shadow-sm"></div> Yellow: 50</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#EA4335] shadow-sm"></div> Red: 40</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#34A853] shadow-sm"></div> Green: 30</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#E37400] shadow-sm"></div> Orange: 20</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#9AA0A6] shadow-sm"></div> Gray: 10</div>
                  </div>
                </div>
                <div>
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Shapes (Multiplier)</h2>
                  <div className="space-y-2 text-xs font-medium text-gray-700">
                    <div className="text-[#34A853] font-bold flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-[#34A853] shadow-sm"></div> Bugdroid: 100 pts</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-gray-300 shadow-sm"></div> Dodecahedron: x3</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-gray-300 shadow-sm"></div> Sphere: x2</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-gray-300 shadow-sm"></div> Box: x1</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {gameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
          <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-md w-full text-center border border-gray-100">
            <h2 className="text-5xl font-black mb-3 text-gray-900">
              TIME'S UP!
            </h2>
            <p className="text-lg text-gray-600 mb-8 font-medium">
              You scored <span className="font-bold text-[#34A853]">{gameOver.winner?.currentScore || 0}</span> points!
            </p>
            
            <div className="space-y-2 mb-8 text-left bg-gray-50 p-5 rounded-2xl border border-gray-100">
              {gameOver.players.slice(0, 5).map((p: any, i: number) => (
                <div key={p.id} className="flex justify-between items-center p-2 rounded-xl hover:bg-white transition-colors">
                  <span className="font-bold flex items-center gap-3" style={{ color: p.color }}>
                    <span className="text-gray-400 text-sm">{i + 1}.</span> 
                    {p.name} {p.id === myId ? <span className="text-[10px] uppercase font-bold bg-gray-200 px-2 py-0.5 rounded-full text-gray-600 ml-1">You</span> : ''}
                  </span>
                  <span className="text-gray-900 font-black">{p.score}</span>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => useGameStore.setState({ gameOver: null })}
              className="w-full py-4 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-800 transition-all active:scale-[0.98]"
            >
              Close & Keep Playing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
