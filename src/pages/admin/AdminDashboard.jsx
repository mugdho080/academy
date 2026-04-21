import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  ArrowLeft,
  LayoutTemplate,
  Library,
  Loader2,
  PencilLine,
  RefreshCcw,
  RotateCcw,
  Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WidgetGrid from '../../components/dashboard/WidgetGrid';
import WidgetLibrary from '../../components/dashboard/WidgetLibrary';
import WidgetSettingsModal from '../../components/dashboard/WidgetSettingsModal';
import {
  addWidgetToLayout,
  cloneLayoutJson,
  normalizeLayoutJson,
  removeWidgetFromLayout
} from '../../components/dashboard/dashboardUtils';

function parseStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

const DEFAULT_VIEW = 'default_admin_view';
const DASHBOARD_API = {
  getData: '/api/admin/get_dashboard_data.php',
  getLayout: '/api/admin/get_dashboard_layout.php',
  getWidgetLibrary: '/api/admin/get_widget_library.php',
  getPresets: '/api/admin/get_dashboard_presets.php',
  saveLayout: '/api/admin/save_dashboard_layout.php',
  resetLayout: '/api/admin/reset_dashboard_layout.php',
  loadPreset: '/api/admin/load_dashboard_preset.php'
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user] = useState(() => parseStoredUser());
  const isClay = false;
  const [widgets, setWidgets] = useState([]);
  const [presets, setPresets] = useState([]);
  const [dashboardName, setDashboardName] = useState(localStorage.getItem('admin_dashboard_view') || DEFAULT_VIEW);
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_VIEW);

  const [layoutJson, setLayoutJson] = useState({ widgets: [], layouts: { lg: [], md: [], sm: [] }, widget_settings: {} });
  const [widgetData, setWidgetData] = useState({});
  const [widgetErrors, setWidgetErrors] = useState({});
  const [loadingWidgets, setLoadingWidgets] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsWidgetKey, setSettingsWidgetKey] = useState('');

  const widgetMap = useMemo(() => {
    const map = {};
    for (const widget of widgets) map[widget.widget_key] = widget;
    return map;
  }, [widgets]);

  const settingsWidget = settingsWidgetKey ? widgetMap[settingsWidgetKey] : null;

  const setWidgetLoading = useCallback((widgetKeys, isLoading) => {
    if (!widgetKeys?.length) return;
    setLoadingWidgets((prev) => {
      const next = { ...prev };
      for (const key of widgetKeys) {
        next[key] = isLoading;
      }
      return next;
    });
  }, []);

  const fetchWidgetData = useCallback(async (widgetKeys, settingsByWidget, merge = true) => {
    if (!widgetKeys?.length) {
      setWidgetData({});
      setWidgetErrors({});
      return;
    }

    setWidgetLoading(widgetKeys, true);
    try {
      const response = await axios.post(DASHBOARD_API.getData, {
        widget_keys: widgetKeys,
        widget_settings: settingsByWidget || {}
      });

      const payload = response?.data?.data || {};
      setWidgetData((prev) => (merge ? { ...prev, ...payload } : payload));
      setWidgetErrors((prev) => {
        const next = { ...prev };
        widgetKeys.forEach((key) => {
          delete next[key];
        });
        return next;
      });
    } catch (fetchError) {
      const message = fetchError?.response?.data?.error || fetchError.message || 'Failed to load widget data';
      setWidgetErrors((prev) => {
        const next = { ...prev };
        widgetKeys.forEach((key) => {
          next[key] = message;
        });
        return next;
      });
    } finally {
      setWidgetLoading(widgetKeys, false);
    }
  }, [setWidgetLoading]);

  const applyLayoutPayload = useCallback(async (rawLayout, map = widgetMap, mergeData = false) => {
    const normalized = normalizeLayoutJson(rawLayout, map);
    setLayoutJson(normalized);
    await fetchWidgetData(normalized.widgets, normalized.widget_settings, mergeData);
  }, [fetchWidgetData, widgetMap]);

  const loadDashboardLayout = useCallback(async (viewName, widgetList = widgets) => {
    const map = {};
    for (const widget of widgetList) map[widget.widget_key] = widget;

    const response = await axios.get(DASHBOARD_API.getLayout, {
      params: { dashboard_name: viewName }
    });

    const layout = response?.data?.layout_json || {};
    await applyLayoutPayload(layout, map, false);
  }, [applyLayoutPayload, widgets]);

  const bootstrap = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [libraryRes, presetsRes] = await Promise.all([
        axios.get(DASHBOARD_API.getWidgetLibrary),
        axios.get(DASHBOARD_API.getPresets)
      ]);

      const widgetList = libraryRes?.data?.widgets || [];
      const presetList = presetsRes?.data?.presets || [];
      setWidgets(widgetList);
      setPresets(presetList);

      const availableViews = presetList.map((item) => item.preset_key);
      const storedView = localStorage.getItem('admin_dashboard_view') || DEFAULT_VIEW;
      const preferredView = availableViews.includes(storedView) ? storedView : DEFAULT_VIEW;
      setDashboardName(preferredView);
      setSelectedPreset(preferredView);
      localStorage.setItem('admin_dashboard_view', preferredView);

      await loadDashboardLayout(preferredView, widgetList);
    } catch (bootstrapError) {
      setError(bootstrapError?.response?.data?.error || bootstrapError.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [loadDashboardLayout, navigate, user]);

  useEffect(() => {
    bootstrap();
    // Intentionally run once on mount to avoid bootstrap fetch loops caused by callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = async () => {
    await fetchWidgetData(layoutJson.widgets, layoutJson.widget_settings, false);
  };

  const refreshWidget = async (widgetKey) => {
    await fetchWidgetData([widgetKey], { [widgetKey]: layoutJson.widget_settings?.[widgetKey] || {} }, true);
  };

  const enterEditMode = () => {
    setSnapshot(cloneLayoutJson(layoutJson));
    setEditMode(true);
  };

  const cancelEditMode = async () => {
    if (!snapshot) {
      setEditMode(false);
      return;
    }
    setLayoutJson(snapshot);
    await fetchWidgetData(snapshot.widgets, snapshot.widget_settings, false);
    setEditMode(false);
    setSnapshot(null);
  };

  const saveLayout = async () => {
    try {
      await axios.post(DASHBOARD_API.saveLayout, {
        dashboard_name: dashboardName,
        layout_json: layoutJson
      });
      setEditMode(false);
      setSnapshot(null);
    } catch (saveError) {
      setError(saveError?.response?.data?.error || saveError.message || 'Failed to save dashboard layout');
    }
  };

  const resetLayout = async () => {
    try {
      const response = await axios.post(DASHBOARD_API.resetLayout, {
        dashboard_name: dashboardName
      });
      await applyLayoutPayload(response?.data?.layout_json || {}, widgetMap, false);
      setEditMode(false);
      setSnapshot(null);
    } catch (resetError) {
      setError(resetError?.response?.data?.error || resetError.message || 'Failed to reset layout');
    }
  };

  const addWidget = async (widgetKey) => {
    const next = addWidgetToLayout(layoutJson, widgetKey, widgetMap[widgetKey]);
    setLayoutJson(next);
    await fetchWidgetData([widgetKey], { [widgetKey]: next.widget_settings?.[widgetKey] || {} }, true);
  };

  const removeWidget = (widgetKey) => {
    const next = removeWidgetFromLayout(layoutJson, widgetKey);
    setLayoutJson(next);
    setWidgetData((prev) => {
      const clone = { ...prev };
      delete clone[widgetKey];
      return clone;
    });
  };

  const handleLayoutsChange = (allLayouts) => {
    if (!editMode) return;
    setLayoutJson((prev) => {
      const nextLayouts = {
        lg: allLayouts?.lg || prev.layouts.lg,
        md: allLayouts?.md || prev.layouts.md,
        sm: allLayouts?.sm || prev.layouts.sm
      };

      const sameLayouts =
        JSON.stringify(prev.layouts?.lg || []) === JSON.stringify(nextLayouts.lg || []) &&
        JSON.stringify(prev.layouts?.md || []) === JSON.stringify(nextLayouts.md || []) &&
        JSON.stringify(prev.layouts?.sm || []) === JSON.stringify(nextLayouts.sm || []);

      if (sameLayouts) return prev;

      return {
        ...prev,
        layouts: nextLayouts
      };
    });
  };

  const handleWidgetSettingsChange = async (widgetKey, nextSettings, options = {}) => {
    const refresh = options.refresh !== false;
    setLayoutJson((prev) => ({
      ...prev,
      widget_settings: {
        ...(prev.widget_settings || {}),
        [widgetKey]: nextSettings
      }
    }));

    if (refresh) {
      await fetchWidgetData([widgetKey], { [widgetKey]: nextSettings }, true);
    }
  };

  const changeDashboardView = async (nextView) => {
    setDashboardName(nextView);
    localStorage.setItem('admin_dashboard_view', nextView);
    setEditMode(false);
    setSnapshot(null);
    try {
      await loadDashboardLayout(nextView);
    } catch (loadError) {
      setError(loadError?.response?.data?.error || loadError.message || 'Failed to load view');
    }
  };

  const loadPreset = async () => {
    try {
      const response = await axios.post(DASHBOARD_API.loadPreset, {
        preset_name: selectedPreset,
        dashboard_name: dashboardName
      });
      await applyLayoutPayload(response?.data?.layout_json || {}, widgetMap, false);
      setEditMode(false);
      setSnapshot(null);
    } catch (loadError) {
      setError(loadError?.response?.data?.error || loadError.message || 'Failed to load preset');
    }
  };

  const openParticipant = (userId) => {
    if (!userId) return;
    navigate(`/admin/participant/${userId}`);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center gap-2 ${isClay ? 'ui-variant-clay ui-admin-shell text-[color:var(--clay-text)]' : 'bg-slate-50 text-slate-600'}`}>
        <Loader2 size={16} className="animate-spin" />
        Loading admin command center
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isClay ? 'ui-variant-clay ui-admin-shell admin-page-shell' : 'bg-[linear-gradient(180deg,#f6fafb_0%,#eef4f8_100%)]'}`}>
      <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-8 py-4 sm:py-6 space-y-4">
        <header className={`rounded-2xl p-4 sm:p-5 ${isClay ? 'ui-clay-surface' : 'border border-slate-200 bg-white shadow-sm'}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => navigate('/admin')} className={`h-10 w-10 rounded-xl inline-flex items-center justify-center ${isClay ? 'ui-clay-button-secondary' : 'border border-slate-200 bg-white hover:bg-slate-100'}`}>
                <ArrowLeft size={16} />
              </button>
              <div>
                <p className={`text-[11px] uppercase tracking-[0.14em] font-black ${isClay ? 'text-[color:var(--clay-text-soft)]' : 'text-slate-500'}`}>Goodwill Care Academy</p>
                <h1 className={`text-xl sm:text-2xl font-black ${isClay ? 'ui-clay-heading' : 'text-slate-800'}`}>Admin Command Center</h1>
                <p className={`text-sm ${isClay ? 'ui-clay-text-soft' : 'text-slate-500'}`}>Action-first operational dashboard for learners, engagement, invoicing, and compliance.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!editMode ? (
                <button type="button" onClick={enterEditMode} className={`px-3 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 ${isClay ? 'ui-clay-button-primary' : 'bg-slate-800 text-white'}`}>
                  <PencilLine size={14} />
                  Edit Dashboard
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setLibraryOpen(true)} className={`px-3 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 ${isClay ? 'ui-clay-button-secondary' : 'border border-slate-200 bg-white text-slate-700'}`}>
                    <Library size={14} />
                    Widget Library
                  </button>
                  <button type="button" onClick={saveLayout} className={`px-3 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 ${isClay ? 'ui-clay-button-primary' : 'bg-emerald-600 text-white'}`}>
                    <Save size={14} />
                    Save Layout
                  </button>
                  <button type="button" onClick={cancelEditMode} className={`px-3 py-2 rounded-lg text-sm font-bold ${isClay ? 'ui-clay-button-secondary' : 'border border-slate-200 bg-white text-slate-700'}`}>
                    Cancel
                  </button>
                  <button type="button" onClick={resetLayout} className={`px-3 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 ${isClay ? 'ui-clay-button-danger' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}>
                    <RotateCcw size={14} />
                    Reset
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="dashboard-workspace-view" className={`text-xs font-semibold ${isClay ? 'ui-clay-text-soft' : 'text-slate-600'}`}>Workspace View</label>
              <select
                id="dashboard-workspace-view"
                value={dashboardName}
                onChange={(event) => changeDashboardView(event.target.value)}
                className={`rounded-lg px-3 py-2 text-sm ${isClay ? '' : 'border border-slate-200 bg-white'}`}
              >
                {presets.map((preset) => (
                  <option key={preset.preset_key} value={preset.preset_key}>
                    {preset.preset_name}
                  </option>
                ))}
              </select>

              <label htmlFor="dashboard-preset-select" className={`text-xs font-semibold ml-2 ${isClay ? 'ui-clay-text-soft' : 'text-slate-600'}`}>Load Preset</label>
              <select
                id="dashboard-preset-select"
                value={selectedPreset}
                onChange={(event) => setSelectedPreset(event.target.value)}
                className={`rounded-lg px-3 py-2 text-sm ${isClay ? '' : 'border border-slate-200 bg-white'}`}
              >
                {presets.map((preset) => (
                  <option key={preset.preset_key} value={preset.preset_key}>
                    {preset.preset_name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={loadPreset} className={`px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1 ${isClay ? 'ui-clay-button-secondary' : 'border border-slate-200 bg-white text-slate-700'}`}>
                <LayoutTemplate size={14} />
                Apply Preset
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={refreshAll} className={`px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 ${isClay ? 'ui-clay-button-secondary' : 'border border-slate-200 bg-white text-slate-700'}`}>
                <RefreshCcw size={14} />
                Refresh Data
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${isClay ? 'ui-clay-button-danger' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}>{error}</div>
        ) : null}

        <WidgetGrid
          layoutJson={layoutJson}
          widgetMap={widgetMap}
          widgetData={widgetData}
          widgetErrors={widgetErrors}
          loadingWidgets={loadingWidgets}
          editMode={editMode}
          onLayoutsChange={handleLayoutsChange}
          onRefreshWidget={refreshWidget}
          onRemoveWidget={removeWidget}
          onConfigureWidget={(widgetKey) => setSettingsWidgetKey(widgetKey)}
          onWidgetSettingsChange={handleWidgetSettingsChange}
          onOpenParticipant={openParticipant}
          onNavigate={(path) => navigate(path)}
        />
      </div>

      <WidgetLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        widgets={widgets}
        activeWidgetKeys={layoutJson.widgets}
        onAdd={addWidget}
      />

      <WidgetSettingsModal
        open={!!settingsWidget}
        widget={settingsWidget}
        currentSettings={settingsWidget ? layoutJson.widget_settings?.[settingsWidget.widget_key] || {} : {}}
        onClose={() => setSettingsWidgetKey('')}
        onSave={(nextSettings) => {
          if (!settingsWidget) return;
          handleWidgetSettingsChange(settingsWidget.widget_key, nextSettings, { refresh: true });
          setSettingsWidgetKey('');
        }}
      />
    </div>
  );
}
