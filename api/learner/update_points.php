<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/AchievementService.php';

session_start();

$payload = json_decode(file_get_contents('php://input'), true);
$payload = is_array($payload) ? $payload : [];

$sessionUserId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
$payloadUserId = isset($payload['user_id']) ? (int) $payload['user_id'] : null;
$userId = $sessionUserId ?: $payloadUserId;
$points = isset($payload['points']) ? (int) $payload['points'] : 0;
$actionCode = isset($payload['action_code']) ? (string) $payload['action_code'] : 'quick_win_completed';
$sourceType = isset($payload['source_type']) ? (string) $payload['source_type'] : 'manual';
$sourceId = $payload['source_id'] ?? gmdate('Y-m-d');

if (!$userId || $points <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id and positive points are required']);
    exit;
}

if ($sessionUserId && $payloadUserId && $sessionUserId !== $payloadUserId) {
    http_response_code(403);
    echo json_encode(['error' => 'User mismatch']);
    exit;
}

try {
    $service = new AchievementService($pdo);
    $result = $service->awardPoints($userId, $actionCode, $sourceType, $sourceId, [
        'points_override' => $points
    ]);
    $summary = $service->buildAchievementSummary($userId);

    echo json_encode([
        'success' => true,
        'awarded' => (bool) ($result['awarded'] ?? false),
        'points_awarded' => (int) ($result['points_awarded'] ?? 0),
        'total_points' => (int) ($summary['total_points'] ?? 0),
        'current_rank' => $summary['current_rank'] ?? 'Seed',
        'summary' => $summary
    ]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update points', 'details' => $e->getMessage()]);
}
