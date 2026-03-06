<?php
// learner/track_time.php
require_once __DIR__ . '/../db_connect.php';

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['user_id']) || !isset($data['chunk_id']) || !isset($data['chunk_start']) || !isset($data['chunk_end'])) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID, Chunk ID, Start, and End are required']);
    exit;
}

$userId = $data['user_id'];
$sessionId = $data['session_id'] ?? null;
$chunkId = $data['chunk_id'];
$chunkStart = $data['chunk_start'];
$chunkEnd = $data['chunk_end'];
$date = date('Y-m-d');

try {
    // Upsert the activity chunk
    if ($sessionId) {
        $stmt = $pdo->prepare("
            INSERT INTO activity_chunks (user_id, session_id, chunk_id, chunk_start, chunk_end)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE chunk_end = ?
        ");
        $stmt->execute([$userId, $sessionId, $chunkId, $chunkStart, $chunkEnd, $chunkEnd]);

        // Update login_sessions high-level total time (optional but good for backwards compatibility)
        if (isset($data['seconds'])) {
            // We can safely add seconds if we know how many seconds passed since the last ping
            $updateSession = $pdo->prepare("UPDATE login_sessions SET logout_time = NOW() WHERE id = ? AND user_id = ?");
            $updateSession->execute([$sessionId, $userId]);
        }
    }

    // Keep the old activity_log update for backwards compatibility if needed
    if (isset($data['seconds'])) {
        $seconds = $data['seconds'];
        $stmt = $pdo->prepare("SELECT id FROM activity_log WHERE user_id = ? AND activity_date = ?");
        $stmt->execute([$userId, $date]);
        $log = $stmt->fetch();

        if ($log) {
            $update = $pdo->prepare("UPDATE activity_log SET seconds_active = seconds_active + ? WHERE id = ?");
            $update->execute([$seconds, $log['id']]);
        } else {
            $insert = $pdo->prepare("INSERT INTO activity_log (user_id, activity_date, seconds_active) VALUES (?, ?, ?)");
            $insert->execute([$userId, $date, $seconds]);
        }
    }

    echo json_encode(['success' => true]);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Tracking failed: ' . $e->getMessage()]);
}
?>