<?php
// api/learner/update_user_progress.php
require_once __DIR__ . '/../db_connect.php';

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
        // Increment points
        $stmt = $pdo->prepare("UPDATE users SET points = points + ? WHERE id = ?");
        $stmt->execute([$points, $userId]);
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