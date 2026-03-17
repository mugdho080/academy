<?php
header('Content-Type: application/json');

require_once __DIR__ . '/dashboard_core.php';

try {
    $auth = dashboard_require_admin();
    dashboard_ensure_schema($pdo);

    $dashboardName = isset($_GET['dashboard_name']) ? (string) $_GET['dashboard_name'] : DASHBOARD_DEFAULT_VIEW;
    $dashboardName = dashboard_slug($dashboardName, DASHBOARD_DEFAULT_VIEW);

    $saved = dashboard_get_saved_layout($pdo, (int) $auth['user_id'], $dashboardName);
    if (!$saved) {
        $saved = dashboard_save_layout(
            $pdo,
            (int) $auth['user_id'],
            $dashboardName,
            dashboard_default_layout_for_name($dashboardName),
            $dashboardName === DASHBOARD_DEFAULT_VIEW
        );
    }

    echo json_encode([
        'success' => true,
        'dashboard_name' => $saved['dashboard_name'],
        'layout_json' => $saved['layout_json'],
        'updated_at' => $saved['updated_at'],
        'is_default' => $saved['is_default']
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load dashboard layout',
        'details' => $e->getMessage()
    ]);
}

