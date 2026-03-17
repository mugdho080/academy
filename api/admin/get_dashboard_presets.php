<?php
header('Content-Type: application/json');

require_once __DIR__ . '/dashboard_core.php';

try {
    dashboard_require_admin();
    dashboard_ensure_schema($pdo);

    $presets = [];
    foreach (dashboard_preset_layouts() as $key => $preset) {
        $presets[] = [
            'preset_key' => $key,
            'preset_name' => $preset['preset_name'],
            'description' => $preset['description'],
            'layout_json' => $preset['layout_json']
        ];
    }

    echo json_encode([
        'success' => true,
        'presets' => $presets
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load dashboard presets',
        'details' => $e->getMessage()
    ]);
}

