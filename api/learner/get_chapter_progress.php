<?php
// api/learner/get_chapter_progress.php
require_once __DIR__ . '/../db_connect.php';

header('Content-Type: application/json');

$user_id = $_GET['user_id'] ?? null;

if (!$user_id) {
    echo json_encode(['error' => 'User ID is required']);
    exit;
}

try {
    // Get all chapters
    $stmt = $pdo->query("SELECT id, title FROM chapters");
    $chapters = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get total lessons per chapter
    $lessonCountStmt = $pdo->prepare("
        SELECT c.id as chapter_id, COUNT(les.id) as total_lessons 
        FROM chapters c
        LEFT JOIN levels l ON l.chapter_id = c.id
        LEFT JOIN lessons les ON les.level_id = l.id
        GROUP BY c.id
    ");
    $lessonCountStmt->execute();
    $lessonCounts = [];
    while ($row = $lessonCountStmt->fetch(PDO::FETCH_ASSOC)) {
        $lessonCounts[$row['chapter_id']] = (int)$row['total_lessons'];
    }

    // Get completed lessons per chapter for the user
    $completedCountStmt = $pdo->prepare("
        SELECT c.id as chapter_id, COUNT(DISTINCT cl.lesson_id) as completed_lessons
        FROM completed_lessons cl
        JOIN lessons les ON les.id = cl.lesson_id
        JOIN levels l ON l.id = les.level_id
        JOIN chapters c ON c.id = l.chapter_id
        WHERE cl.user_id = ?
        GROUP BY c.id
    ");
    $completedCountStmt->execute([$user_id]);
    $completedCounts = [];
    while ($row = $completedCountStmt->fetch(PDO::FETCH_ASSOC)) {
        $completedCounts[$row['chapter_id']] = (int)$row['completed_lessons'];
    }

    $progressInfo = [];
    foreach ($chapters as $c) {
        $cid = $c['id'];
        $total = isset($lessonCounts[$cid]) ? $lessonCounts[$cid] : 0;
        $completed = isset($completedCounts[$cid]) ? $completedCounts[$cid] : 0;
        $percent = $total > 0 ? round(($completed / $total) * 100) : 0;
        
        $progressInfo[] = [
            'chapter_id' => $cid,
            'title' => $c['title'],
            'total_lessons' => $total,
            'completed_lessons' => $completed,
            'completion_percentage' => $percent
        ];
    }

    echo json_encode(['success' => true, 'progress' => $progressInfo]);
} catch (PDOException $e) {
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
