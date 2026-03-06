<?php
// learner/fetch_level_content.php
require_once __DIR__ . '/../db_connect.php';

if (!isset($_GET['level_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Level ID required']);
    exit;
}

$levelId = $_GET['level_id'];
$userId = $_GET['user_id'] ?? null;

try {
    // 1. Fetch Level Info (Video)
    $stmt = $pdo->prepare("SELECT * FROM levels WHERE id = ?");
    $stmt->execute([$levelId]);
    $level = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$level) {
        http_response_code(404);
        echo json_encode(['error' => 'Level not found']);
        exit;
    }

    // 2. Fetch Lessons
    $stmt = $pdo->prepare("SELECT * FROM lessons WHERE level_id = ? ORDER BY order_index ASC");
    $stmt->execute([$levelId]);
    $lessons = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Attach Quizzes to Lessons
    foreach ($lessons as &$lesson) {
        $stmt = $pdo->prepare("SELECT * FROM quizzes WHERE lesson_id = ?");
        $stmt->execute([$lesson['id']]);
        $lesson['quizzes'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Return combined structure
    $response = ['level' => $level, 'lessons' => $lessons];

    // 4. Fetch Completed Lessons if user_id provided
    if ($userId) {
        $stmt = $pdo->prepare("SELECT lesson_id FROM completed_lessons WHERE user_id = ?");
        $stmt->execute([$userId]);
        $response['completed_lessons'] = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    echo json_encode($response);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>