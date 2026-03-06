<?php
// admin/fetch_content.php
require_once __DIR__ . '/../db_connect.php';

try {
    // Fetch chapters
    $stmt = $pdo->query("SELECT * FROM chapters ORDER BY order_index ASC");
    $chapters = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($chapters as &$chapter) {
        // Fetch levels for each chapter
        $stmtLevel = $pdo->prepare("SELECT * FROM levels WHERE chapter_id = ? ORDER BY order_index ASC");
        $stmtLevel->execute([$chapter['id']]);
        $chapter['levels'] = $stmtLevel->fetchAll(PDO::FETCH_ASSOC);

        foreach ($chapter['levels'] as &$level) {
            // Fetch lessons for each level
            $stmtLesson = $pdo->prepare("SELECT * FROM lessons WHERE level_id = ? ORDER BY order_index ASC");
            $stmtLesson->execute([$level['id']]);
            $level['lessons'] = $stmtLesson->fetchAll(PDO::FETCH_ASSOC);

            foreach ($level['lessons'] as &$lesson) {
                // Fetch quizzes for each lesson
                $stmtQuiz = $pdo->prepare("SELECT * FROM quizzes WHERE lesson_id = ?");
                $stmtQuiz->execute([$lesson['id']]);
                $lesson['quizzes'] = $stmtQuiz->fetchAll(PDO::FETCH_ASSOC);
            }
        }
    }

    echo json_encode($chapters);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch content: ' . $e->getMessage()]);
}
?>