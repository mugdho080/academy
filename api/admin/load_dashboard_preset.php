<?php
header('Content-Type: application/json');

require_once __DIR__ . '/dashboard_core.php';

try {
    $auth = dashboard_require_admin();
    dashboard_ensure_schema($pdo);

    $payload = dashboard_json_input();
    $presetName = dashboard_slug((string) ($payload['preset_name'] ?? DASHBOARD_DEFAULT_VIEW), DASHBOARD_DEFAULT_VIEW);
    $dashboardName = dashboard_slug((string) ($payload['dashboard_name'] ?? DASHBOARD_DEFAULT_VIEW), DASHBOARD_DEFAULT_VIEW);

    $saved = dashboard_load_preset($pdo, (int) $auth['user_id'], $presetName, $dashboardName);

    echo json_encode([
        'success' => true,
        'dashboard_name' => $saved['dashboard_name'],
        'layout_json' => $saved['layout_json'],
        'updated_at' => $saved['updated_at'],
        'preset_name' => $presetName
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load dashboard preset',
        'details' => $e->getMessage()
    ]);
}

