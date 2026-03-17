<?php
// api/learner/update_user_progress.php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/AchievementService.php';

$data = json_decode(file_get_contents('php://input'), true);
$userId = $data['user_id'] ?? null;
$points = $data['points'] ?? null;
$avatar = $data['avatar'] ?? null;

if (!$userId) {
    echo json_encode(['error' => 'User ID is required']);
    exit;
}

try {
    if ($points !== null) {
        $service = new AchievementService($pdo);
        $service->awardPoints((int) $userId, 'manual_points', 'user_progress', gmdate('Y-m-d H:i:s'), [
            'points_override' => (int) $points
        ]);
    }

    if ($avatar !== null) {
        $stmt = $pdo->prepare("UPDATE users SET avatar = ? WHERE id = ?");
        $stmt->execute([$avatar, $userId]);
    }

    // Fetch updated user data
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    echo json_encode(['success' => true, 'user' => $user]);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
