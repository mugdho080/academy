import React from 'react';
import { Loader2, RefreshCcw, Settings2, Trash2 } from 'lucide-react';

export default function WidgetShell({
  title,
  icon: Icon,
  editMode = false,
  loading = false,
  error = '',
  onRefresh,
  onConfigure,
  onRemove,
  children
}) {
  return (
    <section className="widget-shell h-full rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
      <header className="widget-shell-header px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon ? <Icon size={16} className="text-slate-500 shrink-0" /> : null}
          <h3 className="text-sm font-bold text-slate-700 truncate">{title}</h3>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 inline-flex items-center justify-center"
              title="Refresh widget"
            >
              <RefreshCcw size={14} className="text-slate-500" />
            </button>
          ) : null}
          {editMode && onConfigure ? (
            <button
              type="button"
              onClick={onConfigure}
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 inline-flex items-center justify-center"
              title="Configure widget"
            >
              <Settings2 size={14} className="text-slate-500" />
            </button>
          ) : null}
          {editMode && onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="h-8 w-8 rounded-lg border border-red-200 bg-white hover:bg-red-50 inline-flex items-center justify-center"
              title="Remove widget"
            >
              <Trash2 size={14} className="text-red-500" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex-1 min-h-0 p-4 overflow-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-500 gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Loading
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-red-600 text-sm font-medium text-center">{error}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
