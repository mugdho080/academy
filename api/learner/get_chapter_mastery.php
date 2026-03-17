<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/AchievementService.php';

session_start();

$sessionUserId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
$queryUserId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : null;
$userId = $sessionUserId ?: $queryUserId;

if (!$userId) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}
if ($sessionUserId && $queryUserId && $sessionUserId !== $queryUserId) {
    http_response_code(403);
    echo json_encode(['error' => 'User mismatch']);
    exit;
}

try {
    $service = new AchievementService($pdo);
    echo json_encode(['items' => $service->getChapterMastery($userId)]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch chapter mastery', 'details' => $e->getMessage()]);
}
