import React, { useEffect, useMemo, useState } from 'react';
import { useUiVariant } from '../../context/UiVariantContext';

function deepClone(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function setByPath(target, path, value) {
  const keys = path.split('.');
  let ref = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!ref[key] || typeof ref[key] !== 'object') {
      ref[key] = {};
    }
    ref = ref[key];
  }
  ref[keys[keys.length - 1]] = value;
}

function getByPath(target, path, fallback = '') {
  const keys = path.split('.');
  let ref = target;
  for (const key of keys) {
    if (!ref || typeof ref !== 'object' || !(key in ref)) {
      return fallback;
    }
    ref = ref[key];
  }
  return ref;
}

export default function WidgetSettingsModal({ widget, currentSettings = {}, open = false, onSave, onClose }) {
  const [draft, setDraft] = useState({});
  const { variant } = useUiVariant('admin');
  const isClay = variant === 'clay';

  const fields = useMemo(() => widget?.settings_schema?.fields || [], [widget]);

  useEffect(() => {
    if (!open || !widget) return;
    const base = deepClone(currentSettings);
    for (const field of fields) {
      const current = getByPath(base, field.key, undefined);
      if (current === undefined && field.default !== undefined) {
        setByPath(base, field.key, field.default);
      }
    }
    setDraft(base);
  }, [open, widget, currentSettings, fields]);

  if (!open || !widget) return null;

  const updateField = (fieldKey, value) => {
    setDraft((prev) => {
      const next = deepClone(prev);
      setByPath(next, fieldKey, value);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/45" onClick={onClose} aria-label="Close settings modal backdrop" />
      <div className={`relative w-full max-w-lg rounded-2xl ${isClay ? 'ui-clay-overlay-panel' : 'bg-white border border-slate-200 shadow-2xl'}`}>
        <header className={`px-5 py-4 border-b ${isClay ? 'border-white/60' : 'border-slate-100'}`}>
          <h3 className={`text-base font-black ${isClay ? 'text-[color:var(--clay-text)]' : 'text-slate-800'}`}>{widget.title} Settings</h3>
        </header>

        <div className="p-5 max-h-[70vh] overflow-auto space-y-4">
          {!fields.length ? (
            <p className={`text-sm ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-500'}`}>No configurable options for this widget.</p>
          ) : null}

          {fields.map((field) => {
            const value = getByPath(draft, field.key, field.default ?? '');
            return (
              <label key={field.key} className="block space-y-1.5">
                <span className={`text-sm font-semibold ${isClay ? 'text-[color:var(--clay-text)]' : 'text-slate-700'}`}>{field.label}</span>
                {field.type === 'select' ? (
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                    value={value}
                    onChange={(event) => updateField(field.key, event.target.value)}
                  >
                    {(field.options || []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}

                {field.type === 'number' ? (
                  <input
                    type="number"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                    value={value}
                    min={field.min}
                    max={field.max}
                    onChange={(event) => updateField(field.key, Number(event.target.value))}
                  />
                ) : null}

                {field.type === 'date' ? (
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                    value={value}
                    onChange={(event) => updateField(field.key, event.target.value)}
                  />
                ) : null}

                {(field.type === 'textarea' || field.type === 'text') ? (
                  field.type === 'textarea' ? (
                    <textarea
                      rows={4}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                      value={value}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                      value={value}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    />
                  )
                ) : null}
              </label>
            );
          })}
        </div>

        <footer className={`px-5 py-4 border-t flex justify-end gap-2 ${isClay ? 'border-white/60' : 'border-slate-100'}`}>
          <button type="button" onClick={onClose} className={`px-3 py-2 rounded-lg text-sm font-semibold ${isClay ? 'ui-clay-button-secondary' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave?.(draft)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold ${isClay ? 'ui-clay-button-primary' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
          >
            Save Settings
          </button>
        </footer>
      </div>
    </div>
  );
}
