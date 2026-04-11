-- Migration 005: Dashboard layouts & widget definitions

CREATE TABLE IF NOT EXISTS dashboard_layouts (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dashboard_name VARCHAR(64) NOT NULL DEFAULT 'default_admin_view',
    is_default     BOOLEAN NOT NULL DEFAULT FALSE,
    layout_json    TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, dashboard_name)
);
CREATE INDEX IF NOT EXISTS idx_dashboard_layout_user_default ON dashboard_layouts (user_id, is_default);
CREATE TRIGGER trg_dashboard_layouts_updated_at
    BEFORE UPDATE ON dashboard_layouts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS widget_definitions (
    id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    widget_key           VARCHAR(128) NOT NULL UNIQUE,
    title                VARCHAR(255) NOT NULL,
    description          TEXT,
    category             VARCHAR(64) NOT NULL,
    default_w            INTEGER NOT NULL DEFAULT 3,
    default_h            INTEGER NOT NULL DEFAULT 4,
    min_w                INTEGER NOT NULL DEFAULT 2,
    min_h                INTEGER NOT NULL DEFAULT 2,
    permissions_json     TEXT,
    settings_schema_json TEXT,
    component_name       VARCHAR(255) NOT NULL,
    icon                 VARCHAR(64),
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_widget_definitions_updated_at
    BEFORE UPDATE ON widget_definitions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS dashboard_presets (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    preset_name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    layout_json TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_dashboard_presets_updated_at
    BEFORE UPDATE ON dashboard_presets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
