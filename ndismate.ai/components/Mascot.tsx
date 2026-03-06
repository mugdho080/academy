
import React, { useEffect, useState } from 'react';

interface MascotProps {
  volume: number; // 0 to 255
  isSpeaking: boolean;
  isListening: boolean;
}

const Mascot: React.FC<MascotProps> = ({ volume, isSpeaking, isListening }) => {
  const [blink, setBlink] = useState(false);
  const [idleSeed, setIdleSeed] = useState(0);

  // Blinking logic
  useEffect(() => {
    const blinkLoop = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 120);
      const nextBlink = Math.random() * 4000 + 2000;
      timeoutId = setTimeout(blinkLoop, nextBlink);
    };
    let timeoutId = setTimeout(blinkLoop, 3000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Idle movement seed
  useEffect(() => {
    const interval = setInterval(() => {
      setIdleSeed(s => s + 0.05);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Calculate dynamic physics
  const talkScaleY = isSpeaking ? 1 + (volume / 500) : 1;
  const talkScaleX = isSpeaking ? 1 - (volume / 800) : 1;
  const headTilt = isSpeaking ? (Math.sin(idleSeed * 6) * (volume / 35)) : 0;
  const bodySway = isSpeaking ? (Math.cos(idleSeed * 4) * (volume / 70)) : isListening ? Math.sin(idleSeed * 2) * 2 : 0;
  const mouthHeight = isSpeaking ? Math.min(18, Math.max(4, volume / 6)) : 0;
  const eyeScale = isSpeaking ? 1 + (volume / 800) : 1;
  const auraScale = isSpeaking ? 1.1 + (volume / 300) : isListening ? 1.05 + Math.sin(idleSeed * 4) * 0.05 : 1;
  
  // New Interactive Dynamics
  const coreGlow = isSpeaking ? Math.min(25, volume / 10) : isListening ? 10 : 0;
  const armOffset = isSpeaking ? Math.sin(idleSeed * 10) * (volume / 20) : 0;
  const antennaGlow = isSpeaking ? volume / 100 : 0;

  return (
    <div className="relative w-64 h-64 flex items-center justify-center select-none pointer-events-none">
      
      {/* 1. Dynamic Background Aura */}
      <div 
        className={`absolute inset-0 rounded-full blur-3xl transition-all duration-300 ${
          isSpeaking 
            ? 'bg-teal-400/40' 
            : isListening 
              ? 'bg-amber-300/30' 
              : 'bg-blue-400/10'
        }`}
        style={{ transform: `scale(${auraScale})` }}
      ></div>

      {/* 2. Character Container */}
      <div 
        className={`relative z-10 flex flex-col items-center transition-transform duration-75 ease-out ${!isSpeaking ? 'animate-float' : ''}`}
        style={{ 
          transform: `rotate(${bodySway}deg) scale(${talkScaleX}, ${talkScaleY})` 
        }}
      >
        
        {/* --- HEAD --- */}
        <div 
          className="relative z-20 w-32 h-26 bg-gradient-to-br from-blue-500 to-blue-700 rounded-[2.2rem] shadow-[inset_2px_2px_6px_rgba(255,255,255,0.2),_0_8px_20px_rgba(0,0,0,0.3)] flex items-center justify-center border-t border-white/20 transition-transform duration-75"
          style={{ transform: `rotate(${headTilt}deg) translateY(${isSpeaking ? -volume/40 : 0}px)` }}
        >
            {/* Antenna */}
            <div className="absolute -top-6 flex flex-col items-center">
                <div className={`w-1 h-6 bg-slate-800 rounded-full origin-bottom transition-transform duration-75 ${isSpeaking ? 'animate-bounce' : ''}`}></div>
                <div 
                  className={`w-3 h-3 rounded-full -mt-1 transition-all duration-300 ${isSpeaking ? 'bg-teal-300' : isListening ? 'bg-amber-400' : 'bg-slate-700'}`}
                  style={{ 
                    boxShadow: isSpeaking ? `0 0 ${12 + volume/10}px #2dd4bf` : isListening ? '0 0 8px #fbbf24' : 'none',
                    opacity: isSpeaking ? 0.7 + antennaGlow : 1
                  }}
                ></div>
            </div>

            {/* Face/Visor */}
            <div className="w-26 h-16 bg-white rounded-[1.4rem] flex items-center justify-center gap-4 shadow-inner relative overflow-hidden border-2 border-slate-100">
                
                {/* Eyes */}
                {['left', 'right'].map((side) => (
                  <div key={side} className={`w-4 h-6 bg-slate-900 rounded-full transition-all duration-150 relative ${blink ? 'h-1 scale-x-110 mt-2' : ''}`} style={{ transform: `scale(${eyeScale})` }}>
                    <div 
                      className={`absolute w-1.5 h-1.5 bg-white rounded-full transition-transform duration-75 ${blink ? 'hidden' : 'block'}`}
                      style={{ 
                        top: '20%', 
                        left: side === 'left' ? '25%' : '40%',
                        transform: isSpeaking ? `translate(${Math.sin(idleSeed * 12) * 2}px, ${Math.cos(idleSeed * 12) * 1}px)` : 'none'
                      }}
                    ></div>
                  </div>
                ))}

                {/* Mouth */}
                <div 
                    className="absolute bottom-2 bg-slate-800 rounded-full transition-all duration-75"
                    style={{ 
                        height: `${mouthHeight}px`,
                        width: `${Math.max(8, 24 - (mouthHeight/2))}px`,
                        opacity: isSpeaking ? 0.9 : 0,
                        transform: `translateY(${Math.sin(idleSeed * 15) * 1}px)`
                    }}
                ></div>
            </div>
        </div>

        {/* --- NECK --- */}
        <div className="w-10 h-4 bg-slate-800 -mt-2 z-10 rounded-full shadow-lg"></div>

        {/* --- BODY --- */}
        <div className="relative z-10 w-24 h-28 bg-gradient-to-b from-blue-600 to-blue-800 rounded-b-[3rem] rounded-t-2xl -mt-2 shadow-[inset_-4px_-4px_10px_rgba(0,0,0,0.3)] flex flex-col items-center pt-5 border-t border-white/10">
            {/* Chest Power Core */}
            <div 
              className={`w-12 h-12 rounded-2xl bg-blue-900/50 flex items-center justify-center shadow-inner border border-white/5 transition-all duration-300`}
              style={{ boxShadow: `0 0 ${coreGlow * 1.5}px ${isListening ? '#fbbf24aa' : isSpeaking ? '#5eead4aa' : 'transparent'}` }}
            >
                 <svg viewBox="0 0 24 24" className={`w-7 h-7 transition-all duration-300 ${isListening ? 'text-amber-400' : isSpeaking ? 'text-teal-300' : 'text-blue-300/80'}`} fill="currentColor">
                    <path d="M4 4h4l8 8V4h4v16h-4l-8-8v8H4V4z" />
                 </svg>
            </div>
        </div>

        {/* --- ARMS --- */}
        {/* Left Arm (Slight reactivity) */}
        <div 
          className={`absolute top-[6.5rem] -left-3 w-4 h-16 bg-slate-800 rounded-full origin-top shadow-md border-l border-white/10 transition-transform`}
          style={{ transform: `rotate(${12 + armOffset/2}deg) scaleY(${isSpeaking ? 1.1 : 1})` }}
        ></div>
        
        {/* Right Arm (Waving) */}
        <div 
            className={`absolute top-[6.5rem] -right-3 w-4 h-16 bg-slate-800 rounded-full origin-top shadow-md border-r border-white/10 ${isSpeaking ? 'animate-wave-active' : isListening ? 'rotate-[-20deg]' : '-rotate-12'}`}
            style={{ 
              animationDuration: isSpeaking ? `${Math.max(0.2, 1.2 - (volume / 180))}s` : '1.5s'
            }}
        ></div>

        {/* --- LEGS --- */}
        <div className="flex gap-4 -mt-5 z-0">
             <div className={`w-5 h-14 bg-slate-800 rounded-b-xl shadow-lg border-l border-white/10 transition-transform duration-75`} style={{ transform: isSpeaking ? `translateY(${Math.sin(idleSeed * 20) * (volume/100)}px)` : 'none' }}>
                 <div className="mt-11 w-8 h-4 bg-slate-900 rounded-lg -ml-1.5 shadow-md"></div>
             </div>
             <div className={`w-5 h-14 bg-slate-800 rounded-b-xl shadow-lg border-r border-white/10 transition-transform duration-75`} style={{ transform: isSpeaking ? `translateY(${Math.cos(idleSeed * 20) * (volume/100)}px)` : 'none' }}>
                 <div className="mt-11 w-8 h-4 bg-slate-900 rounded-lg -ml-1.5 shadow-md"></div>
             </div>
        </div>

      </div>

      {/* 3. Status Badge */}
      <div className={`absolute bottom-2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl text-[10px] font-black tracking-widest flex items-center gap-2 uppercase transition-all z-20 ${isSpeaking ? 'translate-y-10 scale-110' : 'translate-y-8'}`}>
        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
          isSpeaking 
            ? 'bg-teal-500 animate-pulse shadow-[0_0_10px_#14b8a6]' 
            : isListening 
              ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24]' 
              : 'bg-slate-300'
        }`}></div>
        <span className="text-slate-600">{isSpeaking ? 'Matey Talking' : isListening ? 'Listening...' : 'System Ready'}</span>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1.5deg); }
        }
        .animate-float {
          animation: float 3.5s ease-in-out infinite;
        }

        @keyframes wave-active {
          0%, 100% { transform: rotate(-12deg); }
          50% { transform: rotate(-45deg) scaleY(1.1); }
        }
        .animate-wave-active {
          animation: wave-active linear infinite;
        }
      `}} />
    </div>
  );
};

export default React.memo(Mascot);
