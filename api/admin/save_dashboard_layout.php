<?php
header('Content-Type: application/json');

require_once __DIR__ . '/dashboard_core.php';

try {
    $auth = dashboard_require_admin();
    dashboard_ensure_schema($pdo);

    $payload = dashboard_json_input();
    $dashboardName = dashboard_slug((string) ($payload['dashboard_name'] ?? DASHBOARD_DEFAULT_VIEW), DASHBOARD_DEFAULT_VIEW);
    $layoutJson = $payload['layout_json'] ?? null;
    if (!is_array($layoutJson)) {
        throw new RuntimeException('layout_json must be an object.');
    }

    $saved = dashboard_save_layout(
        $pdo,
        (int) $auth['user_id'],
        $dashboardName,
        $layoutJson,
        $dashboardName === DASHBOARD_DEFAULT_VIEW
    );

    echo json_encode([
        'success' => true,
        'dashboard_name' => $saved['dashboard_name'],
        'layout_json' => $saved['layout_json'],
        'updated_at' => $saved['updated_at']
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to save dashboard layout',
        'details' => $e->getMessage()
    ]);
}

