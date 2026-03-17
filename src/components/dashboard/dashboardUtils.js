export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 0 };
export const GRID_COLS = { lg: 12, md: 8, sm: 4 };

export function cloneLayoutJson(layoutJson) {
  return JSON.parse(JSON.stringify(layoutJson || {}));
}

export function normalizeLayoutJson(layoutJson, widgetMap = {}) {
  const safe = layoutJson && typeof layoutJson === 'object' ? layoutJson : {};
  const widgets = Array.isArray(safe.widgets) ? safe.widgets.filter((key) => !!widgetMap[key]) : [];
  const layouts = safe.layouts && typeof safe.layouts === 'object' ? safe.layouts : {};

  const normalizedLayouts = {
    lg: normalizeBreakpointLayout(layouts.lg, widgets, widgetMap, 12),
    md: normalizeBreakpointLayout(layouts.md, widgets, widgetMap, 8),
    sm: normalizeBreakpointLayout(layouts.sm, widgets, widgetMap, 4)
  };

  return {
    widgets,
    layouts: normalizedLayouts,
    widget_settings: safe.widget_settings && typeof safe.widget_settings === 'object' ? safe.widget_settings : {}
  };
}

function normalizeBreakpointLayout(rawLayout, widgetKeys, widgetMap, cols) {
  const list = Array.isArray(rawLayout) ? rawLayout : [];
  const byKey = new Map();

  for (const item of list) {
    if (!item || typeof item !== 'object' || !item.i || !widgetMap[item.i]) continue;
    byKey.set(item.i, {
      i: item.i,
      x: Math.max(0, Number(item.x) || 0),
      y: Math.max(0, Number(item.y) || 0),
      w: Math.min(cols, Math.max(1, Number(item.w) || widgetMap[item.i].default_w || 3)),
      h: Math.max(2, Number(item.h) || widgetMap[item.i].default_h || 4),
      minW: Math.max(1, Number(item.minW) || widgetMap[item.i].min_w || 2),
      minH: Math.max(2, Number(item.minH) || widgetMap[item.i].min_h || 2)
    });
  }

  let cursorY = 0;
  for (const key of widgetKeys) {
    if (byKey.has(key)) continue;
    const widget = widgetMap[key] || {};
    const w = Math.min(cols, widget.default_w || 3);
    byKey.set(key, {
      i: key,
      x: 0,
      y: cursorY,
      w,
      h: widget.default_h || 4,
      minW: Math.min(w, widget.min_w || 2),
      minH: widget.min_h || 2
    });
    cursorY += widget.default_h || 4;
  }

  return widgetKeys.map((key) => byKey.get(key)).filter(Boolean);
}

export function addWidgetToLayout(layoutJson, widgetKey, widgetDef) {
  if (!widgetDef || layoutJson.widgets.includes(widgetKey)) {
    return layoutJson;
  }

  const next = cloneLayoutJson(layoutJson);
  next.widgets.push(widgetKey);
  next.layouts = next.layouts || {};

  for (const [breakpoint, cols] of Object.entries(GRID_COLS)) {
    const list = Array.isArray(next.layouts[breakpoint]) ? next.layouts[breakpoint] : [];
    const nextY = list.reduce((max, item) => Math.max(max, (item.y || 0) + (item.h || 0)), 0);
    const w = Math.min(cols, widgetDef.default_w || 3);
    list.push({
      i: widgetKey,
      x: 0,
      y: nextY,
      w,
      h: widgetDef.default_h || 4,
      minW: Math.min(w, widgetDef.min_w || 2),
      minH: widgetDef.min_h || 2
    });
    next.layouts[breakpoint] = list;
  }

  return next;
}

export function removeWidgetFromLayout(layoutJson, widgetKey) {
  const next = cloneLayoutJson(layoutJson);
  next.widgets = next.widgets.filter((key) => key !== widgetKey);
  for (const breakpoint of Object.keys(next.layouts || {})) {
    next.layouts[breakpoint] = (next.layouts[breakpoint] || []).filter((item) => item.i !== widgetKey);
  }
  if (next.widget_settings?.[widgetKey]) {
    delete next.widget_settings[widgetKey];
  }
  return next;
}
