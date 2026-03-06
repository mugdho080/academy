<?php
// api/admin/add_level_json.php
require_once __DIR__ . '/../db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$chapterId = $data['chapter_id'] ?? null;
$levelData = $data['level'] ?? null;

if (!$chapterId || !$levelData) {
    http_response_code(400);
    echo json_encode(['error' => 'Chapter ID and Level JSON data are required']);
    exit;
}

try {
    $pdo->beginTransaction();

    // Determine order index
    $stmt = $pdo->prepare("SELECT IFNULL(MAX(order_index), -1) + 1 FROM levels WHERE chapter_id = ?");
    $stmt->execute([$chapterId]);
    $levelOrder = $stmt->fetchColumn();

    $lvlTitle = $levelData['level_title'] ?? ("Level " . ($levelData['level_number'] ?? $levelOrder + 1));
    $videoUrl = $levelData['youtube_url'] ?? null;

    // is_free logic: Level 1 is free
    $lvlNum = $levelData['level_number'] ?? ($levelOrder + 1);
    $isFree = ($lvlNum == 1) ? 1 : 0;

    // 1. Insert Level
    $stmt = $pdo->prepare("INSERT INTO levels (chapter_id, title, video_url, is_free, order_index) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$chapterId, $lvlTitle, $videoUrl, $isFree, $levelOrder]);
    $levelId = $pdo->lastInsertId();

    $lessons = $levelData['lessons'] ?? [];
    $lessonOrder = 0;

    // 2. Insert Lessons
    foreach ($lessons as $lesson) {
        $lesTitle = $lesson['lesson_title'] ?? "Lesson " . ($lessonOrder + 1);

        $paragraphs = $lesson['lesson_body']['paragraphs'] ?? [];
        $bullets = $lesson['lesson_body']['bullets'] ?? [];
        $rawContent = implode("\n\n", $paragraphs) . "\n\n" . implode("\n", $bullets);
        $structuredContent = json_encode($lesson['lesson_body'] ?? []);

        $miniActivity = $lesson['mini_activity'] ?? null;
        $funReminder = $lesson['fun_reminder'] ?? null;
        $lessonType = $lesson['lesson_format'] ?? 'standard';

        $stmt = $pdo->prepare("INSERT INTO lessons (level_id, title, content, structured_content, mini_activity, fun_reminder, lesson_type, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $levelId,
            $lesTitle,
            trim($rawContent),
            $structuredContent,
            $miniActivity,
            $funReminder,
            $lessonType,
            $lessonOrder++
        ]);
        $lessonId = $pdo->lastInsertId();

        // 3. Insert Quizzes
        $quizzes = $lesson['quizzes'] ?? [];
        foreach ($quizzes as $quizBlock) {
            $questions = $quizBlock['questions'] ?? [];
            foreach ($questions as $q) {
                $prompt = $q['prompt'] ?? "Question?";
                $options = $q['options'] ?? [];
                $correctIdx = $q['correct_index'] ?? 0;
                $explanation = $q['explanation'] ?? "";

                $stmt = $pdo->prepare("INSERT INTO quizzes (lesson_id, question, options, correct_answer, explanation) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([
                    $lessonId,
                    $prompt,
                    json_encode($options),
                    $correctIdx,
                    $explanation
                ]);
            }
        }
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'message' => "Level '$lvlTitle' and its contents imported successfully.", 'level_id' => $levelId]);

} catch (\PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Database Error: ' . $e->getMessage()]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => 'Import Error: ' . $e->getMessage()]);
}
