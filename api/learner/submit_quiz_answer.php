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
$quizId = isset($payload['quiz_id']) ? (int) $payload['quiz_id'] : 0;
$isCorrect = !empty($payload['is_correct']);
$lessonId = isset($payload['lesson_id']) ? (int) $payload['lesson_id'] : null;
$levelId = isset($payload['level_id']) ? (int) $payload['level_id'] : null;
$chapterId = isset($payload['chapter_id']) ? (int) $payload['chapter_id'] : null;

if (!$userId || !$quizId) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id and quiz_id are required']);
    exit;
}

if ($sessionUserId && $payloadUserId && $sessionUserId !== $payloadUserId) {
    http_response_code(403);
    echo json_encode(['error' => 'User mismatch']);
    exit;
}

try {
    $service = new AchievementService($pdo);
    $result = $service->handleQuizAnswer($userId, $quizId, $isCorrect, $lessonId, $levelId, $chapterId);
    $summary = $service->buildAchievementSummary($userId);

    echo json_encode([
        'success' => true,
        'is_correct' => $isCorrect,
        'new_completion' => (bool) ($result['new_completion'] ?? false),
        'points_awarded' => (int) ($result['points_awarded'] ?? 0),
        'total_points' => (int) ($summary['total_points'] ?? 0),
        'current_rank' => $summary['current_rank'] ?? 'Seed',
        'summary' => $summary
    ]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to submit quiz answer', 'details' => $e->getMessage()]);
}
