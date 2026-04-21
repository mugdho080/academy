import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Bot,
  Building2,
  Compass,
  Grid3X3,
  MapPinned,
  Search,
  Wallet
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  'All',
  'Overview',
  'Learners',
  'Engagement',
  'Finance',
  'Achievements',
  'AI / Panda',
  'Compliance',
  'Map',
  'Utilities'
];

const CATEGORY_ICON = {
  All: Grid3X3,
  Overview: Activity,
  Learners: Search,
  Engagement: Compass,
  Finance: Wallet,
  Achievements: Award,
  'AI / Panda': Bot,
  Compliance: Building2,
  Map: MapPinned,
  Utilities: Grid3X3
};

export default function WidgetLibrary({ open, widgets = [], activeWidgetKeys = [], onAdd, onClose }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
    const isClay = false;

  const filteredWidgets = useMemo(() => {
    return widgets.filter((widget) => {
      const categoryMatch = category === 'All' || widget.category === category;
      if (!categoryMatch) return false;

      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        widget.title?.toLowerCase().includes(q) ||
        widget.description?.toLowerCase().includes(q) ||
        widget.widget_key?.toLowerCase().includes(q)
      );
    });
  }, [category, query, widgets]);

  return (
    <>
      {open ? <button className="fixed inset-0 bg-slate-900/40 z-40" onClick={onClose} aria-label="Close widget library backdrop" /> : null}
      <aside className={`fixed top-0 right-0 bottom-0 w-full max-w-xl z-50 transition-transform duration-200 ${isClay ? 'ui-clay-overlay-panel border-l border-white/70' : 'bg-white border-l border-slate-200 shadow-2xl'} ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <header className={`px-5 py-4 border-b ${isClay ? 'border-white/60' : 'border-slate-200'}`}>
            <h2 className={`text-lg font-black ${isClay ? 'text-[color:var(--clay-text)]' : 'text-slate-800'}`}>Widget Library</h2>
            <p className={`text-sm mt-1 ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-500'}`}>Add modules that match your workflow.</p>
          </header>

          <div className={`px-5 py-4 border-b space-y-3 ${isClay ? 'border-white/50' : 'border-slate-100'}`}>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
              placeholder="Search widgets"
              aria-label="Search widgets"
            />

            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((option) => {
                const Icon = CATEGORY_ICON[option];
                const active = option === category;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCategory(option)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border ${isClay ? (active ? 'ui-clay-button-primary border-transparent' : 'ui-clay-button-secondary border-transparent') : active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    <Icon size={12} />
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-3">
            {filteredWidgets.map((widget) => {
              const alreadyAdded = activeWidgetKeys.includes(widget.widget_key);
              return (
                <article key={widget.widget_key} className={`rounded-xl p-4 ${isClay ? 'ui-clay-surface' : 'border border-slate-200 bg-slate-50/40'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className={`text-sm font-black ${isClay ? 'text-[color:var(--clay-text)]' : 'text-slate-800'}`}>{widget.title}</h3>
                      <p className={`text-xs mt-1 ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-500'}`}>{widget.description}</p>
                      <p className={`text-[11px] mt-2 uppercase tracking-wide ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-400'}`}>
                        {widget.category} | {widget.default_w}x{widget.default_h}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => onAdd?.(widget.widget_key)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold ${isClay ? (alreadyAdded ? 'ui-clay-surface text-[color:var(--clay-text-soft)] cursor-not-allowed' : 'ui-clay-button-primary') : alreadyAdded ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                      {alreadyAdded ? 'Added' : 'Add'}
                    </button>
                  </div>
                </article>
              );
            })}

            {!filteredWidgets.length ? (
              <div className={`rounded-xl p-6 text-center text-sm ${isClay ? 'ui-clay-surface text-[color:var(--clay-text-soft)]' : 'border border-dashed border-slate-300 text-slate-500'}`}>
                No widgets matched your filter.
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
