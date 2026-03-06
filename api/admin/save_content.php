<?php
// admin/save_content.php
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't echo errors, return JSON
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connect.php';

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['type'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Type (chapter/level/lesson) required']);
    exit;
}

try {
    if ($data['type'] === 'chapter') {
        if (isset($data['id'])) {
            $stmt = $pdo->prepare("UPDATE chapters SET title = ?, emoji = ?, order_index = ? WHERE id = ?");
            $stmt->execute([$data['title'], $data['emoji'], $data['order_index'], $data['id']]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO chapters (title, emoji, order_index) VALUES (?, ?, ?)");
            $stmt->execute([$data['title'], $data['emoji'], $data['order_index']]);
        }
    } elseif ($data['type'] === 'level') {
        if (isset($data['id'])) {
            $stmt = $pdo->prepare("UPDATE levels SET title = ?, video_url = ?, is_free = ?, order_index = ? WHERE id = ?");
            $stmt->execute([$data['title'], $data['video_url'], $data['is_free'], $data['order_index'], $data['id']]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO levels (chapter_id, title, video_url, is_free, order_index) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$data['chapter_id'], $data['title'], $data['video_url'], $data['is_free'], $data['order_index']]);
        }
    } elseif ($data['type'] === 'lesson') {
        if (isset($data['id'])) {
            $stmt = $pdo->prepare("UPDATE lessons SET title = ?, content = ?, order_index = ? WHERE id = ?");
            $stmt->execute([$data['title'], $data['content'], $data['order_index'], $data['id']]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO lessons (level_id, title, content, order_index) VALUES (?, ?, ?, ?)");
            $stmt->execute([$data['level_id'], $data['title'], $data['content'], $data['order_index']]);
        }
    } elseif ($data['type'] === 'quiz') {
        $options = is_string($data['options']) ? $data['options'] : json_encode($data['options']);
        if (isset($data['id'])) {
            $stmt = $pdo->prepare("UPDATE quizzes SET question = ?, options = ?, correct_answer = ? WHERE id = ?");
            $stmt->execute([$data['question'], $options, $data['correct_answer'], $data['id']]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES (?, ?, ?, ?)");
            $stmt->execute([$data['lesson_id'], $data['question'], $options, $data['correct_answer']]);
        }
    }

    echo json_encode(['success' => true]);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Save failed: ' . $e->getMessage()]);
}
?>