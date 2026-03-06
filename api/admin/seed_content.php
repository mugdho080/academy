<?php
// admin/seed_content.php
require_once __DIR__ . '/../db_connect.php';

$chapters = [
    ['title' => 'AI & Digital Skills', 'emoji' => '🤖'],
    ['title' => 'Math & Numbers', 'emoji' => '🔢'],
    ['title' => 'Self Choice & Control', 'emoji' => '🧭'],
    ['title' => 'Life Skills & Independence', 'emoji' => '🏡'],
    ['title' => 'Psychology & Behaviour', 'emoji' => '💛']
];

try {
    // Clear existing content (optional, but good for clean seed)
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $pdo->exec("TRUNCATE TABLE chapters");
    $pdo->exec("TRUNCATE TABLE levels");
    $pdo->exec("TRUNCATE TABLE lessons");
    $pdo->exec("TRUNCATE TABLE quizzes");
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    foreach ($chapters as $cIndex => $c) {
        // Create Chapter
        $stmt = $pdo->prepare("INSERT INTO chapters (title, emoji, order_index) VALUES (?, ?, ?)");
        $stmt->execute([$c['title'], $c['emoji'], $cIndex]);
        $chapterId = $pdo->lastInsertId();

        // Create 10 Levels
        for ($l = 0; $l < 10; $l++) {
            $isFree = ($l === 0) ? 1 : 0; // Level 1 is free
            $stmt = $pdo->prepare("INSERT INTO levels (chapter_id, title, video_url, is_free, order_index) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$chapterId, "Level " . ($l + 1), "https://www.youtube.com/embed/dQw4w9WgXcQ", $isFree, $l]);
            $levelId = $pdo->lastInsertId();

            // Create 5 Lessons
            for ($les = 0; $les < 5; $les++) {
                $stmt = $pdo->prepare("INSERT INTO lessons (level_id, title, content, order_index) VALUES (?, ?, ?, ?)");
                $stmt->execute([$levelId, "Lesson " . ($les + 1), "Welcome to this lesson! Here is some amazing content.", $les]);
                $lessonId = $pdo->lastInsertId();

                // Create 3 Quizzes
                for ($q = 0; $q < 3; $q++) {
                    $jsonOptions = json_encode(["Option A", "Option B", "Option C"]);
                    $stmt = $pdo->prepare("INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES (?, ?, ?, ?)");
                    $stmt->execute([$lessonId, "What is the answer to question " . ($q + 1) . "?", $jsonOptions, 0]);
                }
            }
        }
    }

    echo json_encode(['success' => true, 'message' => 'Seeding complete!']);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>