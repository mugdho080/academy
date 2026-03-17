<?php
header('Content-Type: application/json');

require_once __DIR__ . '/dashboard_data.php';

try {
    $auth = dashboard_require_admin();
    dashboard_ensure_schema($pdo);

    $payload = dashboard_json_input();
    $widgetKeys = $payload['widget_keys'] ?? [];
    $settingsByWidget = $payload['widget_settings'] ?? [];

    if (!is_array($widgetKeys) || !$widgetKeys) {
        $widgetKeys = array_values(array_map(static fn(array $w): string => (string) $w['widget_key'], dashboard_visible_widgets_for_role((string) ($auth['role'] ?? 'admin'))));
    }
    if (!is_array($settingsByWidget)) {
        $settingsByWidget = [];
    }

    $data = dashboard_collect_widget_data($pdo, $widgetKeys, $settingsByWidget);

    echo json_encode([
        'success' => true,
        'data' => $data,
        'generated_at' => gmdate('Y-m-d H:i:s')
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load dashboard data',
        'details' => $e->getMessage()
    ]);
}

