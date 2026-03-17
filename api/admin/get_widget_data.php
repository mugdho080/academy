<?php
header('Content-Type: application/json');

require_once __DIR__ . '/dashboard_data.php';

try {
    dashboard_require_admin();
    dashboard_ensure_schema($pdo);

    $widgetKey = isset($_GET['widget']) ? dashboard_slug((string) $_GET['widget'], '') : '';
    if ($widgetKey === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing widget query parameter']);
        exit;
    }

    $settings = [];
    if (isset($_GET['settings_json'])) {
        $decoded = json_decode((string) $_GET['settings_json'], true);
        if (is_array($decoded)) {
            $settings = $decoded;
        }
    }

    $data = dashboard_collect_widget_data($pdo, [$widgetKey], [$widgetKey => $settings]);

    echo json_encode([
        'success' => true,
        'widget' => $widgetKey,
        'data' => $data[$widgetKey] ?? [],
        'generated_at' => gmdate('Y-m-d H:i:s')
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load widget data',
        'details' => $e->getMessage()
    ]);
}

