<?php
header('Content-Type: application/json');

require_once __DIR__ . '/dashboard_core.php';

try {
    $auth = dashboard_require_admin();
    dashboard_ensure_schema($pdo);

    $widgets = dashboard_visible_widgets_for_role((string) ($auth['role'] ?? 'admin'));

    echo json_encode([
        'success' => true,
        'widgets' => array_values($widgets)
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load widget library',
        'details' => $e->getMessage()
    ]);
}

