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

try {
    $service = new AchievementService($pdo);
    $service->ensureSchema();

    $users = $pdo->query("SELECT id FROM users WHERE role = 'learner'")->fetchAll(PDO::FETCH_COLUMN);
    $rebuilt = [];
    foreach ($users as $uid) {
        $userId = (int) $uid;
        $service->recalculateUserSummary($userId);
        $service->updateWeeklyTargetProgress($userId);
        $service->evaluateAchievements($userId);
        $service->getChapterMastery($userId);
        $rebuilt[] = $userId;
    }

    echo json_encode([
        'success' => true,
        'rebuilt_count' => count($rebuilt),
        'user_ids' => $rebuilt
    ]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to rebuild achievements', 'details' => $e->getMessage()]);
}
