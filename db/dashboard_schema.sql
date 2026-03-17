CREATE TABLE IF NOT EXISTS dashboard_layouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    dashboard_name VARCHAR(64) NOT NULL DEFAULT 'default_admin_view',
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    layout_json LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_dashboard_layout_user_name (user_id, dashboard_name),
    INDEX idx_dashboard_layout_user_default (user_id, is_default),
    CONSTRAINT fk_dashboard_layout_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS widget_definitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    widget_key VARCHAR(128) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    category VARCHAR(64) NOT NULL,
    default_w INT NOT NULL DEFAULT 3,
    default_h INT NOT NULL DEFAULT 4,
    min_w INT NOT NULL DEFAULT 2,
    min_h INT NOT NULL DEFAULT 2,
    permissions_json LONGTEXT NULL,
    settings_schema_json LONGTEXT NULL,
    component_name VARCHAR(255) NOT NULL,
    icon VARCHAR(64) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_widget_key (widget_key)
);

CREATE TABLE IF NOT EXISTS dashboard_presets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    preset_name VARCHAR(64) NOT NULL,
    description TEXT NULL,
    layout_json LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_dashboard_preset_name (preset_name)
);

