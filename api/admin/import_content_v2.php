<?php
// api/admin/import_content.php
require_once __DIR__ . '/../db_connect.php';

$jsonFile = __DIR__ . '/../../contents/final_v3_content.json';

// Only allow post or direct execution if in dev
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && php_sapi_name() !== 'cli') {
    // Optional: allow GET for triggering
}

// Check for POST body content first
$rawInput = file_get_contents('php://input');
file_put_contents(__DIR__ . '/debug_received.json', $rawInput); // DEBUG
$data = json_decode($rawInput, true);

if (!$data) {
    // Fallback to file
    if (!file_exists($jsonFile)) {
        die(json_encode(['error' => 'JSON body invalid and file not found at ' . $jsonFile]));
    }
    $data = json_decode(file_get_contents($jsonFile), true);
    if (!$data) {
        die(json_encode(['error' => 'Invalid JSON in file']));
    }
}

try {
    // 1. Truncate Tables
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $pdo->exec("TRUNCATE TABLE chapters");
    $pdo->exec("TRUNCATE TABLE levels");
    $pdo->exec("TRUNCATE TABLE lessons");
    $pdo->exec("TRUNCATE TABLE quizzes");
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    $chapterOrder = 0;

    if (!isset($data['chapters'])) {
        throw new Exception("No chapters found in JSON");
    }

    foreach ($data['chapters'] as $chapter) {
        $chapTitle = $chapter['chapter_title'] ?? "Untitled Chapter";
        $chapEmoji = $chapter['chapter_icon'] ?? "📚";

        // Insert Chapter
        // icon column might be the emoji or a URL. User JSON uses emoji.
        $stmt = $pdo->prepare("INSERT INTO chapters (title, emoji, icon, order_index) VALUES (?, ?, ?, ?)");
        $stmt->execute([$chapTitle, $chapEmoji, $chapEmoji, $chapterOrder++]);
        $chapterId = $pdo->lastInsertId();

        $levels = $chapter['levels'] ?? [];
        $levelOrder = 0;

        foreach ($levels as $level) {
            $lvlTitle = $level['level_title'] ?? ("Level " . ($level['level_number'] ?? $levelOrder + 1));
            // Default video URL if null? Or keeps null.
            $videoUrl = $level['youtube_url'] ?? null;

            // is_free logic: Level 1 is free?
            // "Level 1 of all the chapters will be unlocked when one signs up"
            // So if level_number is 1, is_free = 1.
            $lvlNum = $level['level_number'] ?? ($levelOrder + 1);
            $isFree = ($lvlNum == 1) ? 1 : 0;

            $stmt = $pdo->prepare("INSERT INTO levels (chapter_id, title, video_url, is_free, order_index) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$chapterId, $lvlTitle, $videoUrl, $isFree, $levelOrder++]);
            $levelId = $pdo->lastInsertId();

            $lessons = $level['lessons'] ?? [];
            $lessonOrder = 0;

            foreach ($lessons as $lesson) {
                $lesTitle = $lesson['lesson_title'] ?? "Lesson " . ($lessonOrder + 1);

                // Content: Raw text from paragraphs
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

                // Quizzes
                $quizzes = $lesson['quizzes'] ?? [];
                foreach ($quizzes as $quizBlock) {
                    $questions = $quizBlock['questions'] ?? [];
                    foreach ($questions as $q) {
                        $prompt = $q['prompt'] ?? "Question?";
                        $options = $q['options'] ?? [];
                        // Parser now provides correct_index (0-based)
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
        }
    }

    $firstPrompt = $data['chapters'][0]['levels'][0]['lessons'][0]['quizzes'][0]['questions'][0]['prompt'] ?? "N/A";
    echo json_encode(['success' => true, 'message' => 'Content imported successfully', 'debug_json_path' => $jsonFile, 'debug_first_prompt' => $firstPrompt, 'debug_raw_sample' => substr($rawInput, 0, 500)]);

} catch (\PDOException $e) {
    echo json_encode(['error' => 'Database Error: ' . $e->getMessage()]);
} catch (Exception $e) {
    echo json_encode(['error' => 'Import Error: ' . $e->getMessage()]);
}