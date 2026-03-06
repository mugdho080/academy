<?php
// api/learner/ping_session.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['session_id']) || empty($data['session_id'])) {
    echo json_encode(['success' => false, 'error' => 'session_id is required']);
    exit();
}

try {
    $sessionId = $data['session_id'];
    $currentTime = date('Y-m-d H:i:s');

    $stmt = $pdo->prepare("SELECT session_start FROM user_time_logs WHERE session_id = ?");
    $stmt->execute([$sessionId]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($session) {
        $sessionStart = new DateTime($session['session_start']);
        $sessionEnd = new DateTime($currentTime);
        $totalSeconds = $sessionEnd->getTimestamp() - $sessionStart->getTimestamp();

        $updateStmt = $pdo->prepare("UPDATE user_time_logs SET session_end = ?, total_seconds = ? WHERE session_id = ?");
        if ($updateStmt->execute([$currentTime, $totalSeconds, $sessionId])) {
            echo json_encode([
                'success' => true,
                'session_end' => $currentTime,
                'total_seconds' => $totalSeconds
            ]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to update session']);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Session not found.']);
    }

} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
?>