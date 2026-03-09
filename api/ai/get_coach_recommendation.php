<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/CoachService.php';

session_start();
$userId = coach_require_user();

$route = isset($_GET['route']) ? trim((string) $_GET['route']) : null;
$frustrationScore = isset($_GET['frustration_score']) && is_numeric($_GET['frustration_score'])
    ? (int) $_GET['frustration_score']
    : null;
$markShown = isset($_GET['mark_shown']) ? filter_var($_GET['mark_shown'], FILTER_VALIDATE_BOOLEAN) : false;

try {
    coach_ensure_schema($pdo);
    $pdo->beginTransaction();

    $recommendation = coach_get_recommendation($pdo, $userId, [
        'route' => $route,
        'frustration_score' => $frustrationScore
    ]);

    if ($markShown && !empty($recommendation['id'])) {
        coach_mark_recommendation($pdo, $userId, (int) $recommendation['id'], true, null);
    }

    $pdo->commit();
    echo json_encode($recommendation);
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to generate recommendation',
        'details' => $e->getMessage()
    ]);
}
