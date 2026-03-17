import React from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';
import AnimatedPanda from './AnimatedPanda';
import PandaCoachNavigator from './PandaCoachNavigator';
import { useCoach } from '../context/CoachContext';
import { useUiVariant } from '../context/UiVariantContext';

const PandaCoachPanel = () => {
    const { panelOpen, setPanelOpen, message, profile, routeContext } = useCoach();
    const { variant } = useUiVariant('learner');
    const isClay = variant === 'clay';

    if (!panelOpen) return null;

    return (
        <div className="fixed inset-0 z-[130] bg-black/25 backdrop-blur-[1px] flex items-end sm:items-center justify-end">
            <div className={`w-full sm:w-[440px] h-[86vh] sm:h-[92vh] p-4 sm:p-5 overflow-y-auto rounded-t-3xl sm:rounded-none ${isClay ? 'ui-clay-overlay-panel' : 'bg-white shadow-2xl border-l border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className={`text-xs font-black uppercase tracking-[0.14em] ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-400'}`}>Panda Coach</p>
                        <h3 className={`text-xl font-black ${isClay ? 'text-[#21A7F1]' : 'text-[#00695C]'}`}>Learning Guide</h3>
                    </div>
                    <button
                        onClick={() => setPanelOpen(false)}
                        className={`p-2 rounded-xl ${isClay ? 'ui-clay-button-secondary text-[color:var(--clay-text-soft)]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                        aria-label="Close coach panel"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className={`flex items-center gap-4 rounded-3xl p-4 ${isClay ? 'ui-clay-inset-surface' : 'bg-[#f2fbf9] border border-[#d2ece5]'}`}>
                    <div className={`w-20 h-20 rounded-full p-1.5 shrink-0 ${isClay ? 'ui-clay-surface border border-white/70' : 'bg-white border border-[#cde8e2]'}`}>
                        <AnimatedPanda
                            mood={message?.mood || 'calm'}
                            isSpeaking={message?.animation_state === 'speaking'}
                            isListening={false}
                        />
                    </div>
                    <div className="min-w-0">
                        <p className={`text-sm font-semibold leading-snug ${isClay ? 'text-[color:var(--clay-text)]' : 'text-slate-700'}`}>
                            {message?.message || 'I can help you with one clear next step.'}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold">
                            <span className={`px-2 py-1 rounded-full ${isClay ? 'ui-clay-surface text-[color:var(--clay-text-soft)]' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                {routeContext?.context_type || 'dashboard'}
                            </span>
                            <span className={`px-2 py-1 rounded-full ${isClay ? 'ui-clay-surface text-[color:var(--clay-text-soft)]' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                {message?.frustration_band || 'normal'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className={`mt-5 rounded-2xl p-4 ${isClay ? 'ui-clay-surface' : 'border border-slate-200'}`}>
                    <p className={`text-xs uppercase tracking-[0.12em] font-black mb-2 ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-400'}`}>Navigator</p>
                    <PandaCoachNavigator onAction={() => setPanelOpen(false)} />
                </div>

                <div className={`mt-5 rounded-2xl p-4 ${isClay ? 'ui-clay-surface' : 'border border-slate-200'}`}>
                    <p className={`text-xs uppercase tracking-[0.12em] font-black mb-2 ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-400'}`}>Coach Preferences</p>
                    <div className={`space-y-2 text-sm ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-600'}`}>
                        <div className="flex items-center justify-between">
                            <span>Age Band</span>
                            <span className={`font-bold ${isClay ? 'text-[color:var(--clay-text)]' : ''}`}>{profile?.age_band || 'age_20_40'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Sensory Mode</span>
                            <span className={`font-bold ${isClay ? 'text-[color:var(--clay-text)]' : ''}`}>{profile?.sensory_mode || 'calm'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Voice Coaching</span>
                            <span className={`inline-flex items-center gap-1 font-bold ${isClay ? 'text-[color:var(--clay-text)]' : ''}`}>
                                {profile?.voice_enabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                                {profile?.voice_enabled ? 'On' : 'Off'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PandaCoachPanel;
