<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/AchievementService.php';

session_start();

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin') {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
$payload = is_array($payload) ? $payload : [];
$userId = isset($payload['user_id']) ? (int) $payload['user_id'] : 0;

if (!$userId) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id is required']);
    exit;
}

try {
    $service = new AchievementService($pdo);
    $service->ensureSchema();
    $service->recalculateUserSummary($userId);
    $service->updateWeeklyTargetProgress($userId);
    $service->evaluateAchievements($userId);
    $service->getChapterMastery($userId);
    $summary = $service->buildAchievementSummary($userId);

    echo json_encode(['success' => true, 'summary' => $summary]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to recalculate user achievements', 'details' => $e->getMessage()]);
}
