import React from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import WidgetShell from './WidgetShell';
import { WidgetRenderer } from './widgets/WidgetRegistry';
import { iconByName } from './widgetIcons';

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function WidgetGrid({
  layoutJson,
  widgetMap,
  widgetData,
  widgetErrors,
  loadingWidgets,
  editMode,
  onLayoutsChange,
  onRefreshWidget,
  onRemoveWidget,
  onConfigureWidget,
  onWidgetSettingsChange,
  onOpenParticipant,
  onNavigate
}) {
  const widgetKeys = layoutJson?.widgets || [];
  const layouts = layoutJson?.layouts || {};

  return (
    <ResponsiveGridLayout
      className="dashboard-grid"
      breakpoints={{ lg: 1200, md: 996, sm: 0 }}
      cols={{ lg: 12, md: 8, sm: 4 }}
      layouts={layouts}
      rowHeight={28}
      margin={[12, 12]}
      containerPadding={[0, 0]}
      compactType="vertical"
      isResizable={editMode}
      isDraggable={editMode}
      draggableHandle=".widget-drag-handle"
      onLayoutChange={(_, allLayouts) => {
        if (!editMode) return;
        onLayoutsChange?.(allLayouts);
      }}
    >
      {widgetKeys.map((widgetKey) => {
        const widget = widgetMap?.[widgetKey];
        if (!widget) return null;
        const Icon = iconByName[widget.icon] || null;
        const data = widgetData?.[widgetKey];
        const settings = layoutJson?.widget_settings?.[widgetKey] || {};
        const loading = !!loadingWidgets?.[widgetKey];
        const error = widgetErrors?.[widgetKey] || '';

        return (
          <div key={widgetKey}>
            <div className="widget-drag-handle h-full cursor-default lg:cursor-move">
              <WidgetShell
                title={widget.title}
                icon={Icon}
                loading={loading}
                error={error}
                editMode={editMode}
                onRefresh={() => onRefreshWidget?.(widgetKey)}
                onRemove={() => onRemoveWidget?.(widgetKey)}
                onConfigure={widget.configurable ? () => onConfigureWidget?.(widgetKey) : null}
              >
                <WidgetRenderer
                  widgetKey={widgetKey}
                  data={data}
                  settings={settings}
                  onSettingsChange={(nextSettings, options) => onWidgetSettingsChange?.(widgetKey, nextSettings, options)}
                  onOpenParticipant={onOpenParticipant}
                  onNavigate={onNavigate}
                />
              </WidgetShell>
            </div>
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
}
