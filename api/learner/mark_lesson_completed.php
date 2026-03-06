<?php
// api/learner/mark_lesson_completed.php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';

$data = json_decode(file_get_contents('php://input'), true);
$userId = $data['user_id'] ?? null;
$lessonId = $data['lesson_id'] ?? null;

if (!$userId || !$lessonId) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID and Lesson ID are required']);
    exit;
}

try {
    // Check if already completed
    $stmt = $pdo->prepare("SELECT id FROM completed_lessons WHERE user_id = ? AND lesson_id = ?");
    $stmt->execute([$userId, $lessonId]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => true, 'message' => 'Already completed']);
        exit;
    }

    // Insert completion
    $stmt = $pdo->prepare("INSERT INTO completed_lessons (user_id, lesson_id) VALUES (?, ?)");
    $stmt->execute([$userId, $lessonId]);

    // Reward points for lesson completion (e.g. 10 points)
    $stmt = $pdo->prepare("UPDATE users SET points = points + 10 WHERE id = ?");
    $stmt->execute([$userId]);

    echo json_encode(['success' => true]);

} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to log completion: ' . $e->getMessage()]);
}
?>