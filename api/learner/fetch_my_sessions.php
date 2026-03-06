<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/ActivityTrackingService.php';

$userId = $_GET['user_id'] ?? null;

if (!$userId) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID required']);
    exit;
}

try {
    at_ensure_tracking_schema($pdo);

    $stmt = $pdo->prepare("
        SELECT id, login_at, logout_at, total_seconds_active, status
        FROM sessions
        WHERE user_id = ?
        ORDER BY login_at DESC
        LIMIT 20
    ");
    $stmt->execute([$userId]);
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($sessions as &$session) {
        $session['id'] = (int) $session['id'];
        $session['total_seconds_active'] = (int) $session['total_seconds_active'];
        $session['summary'] = at_session_summary($session);
    }
    unset($session);

    echo json_encode(['success' => true, 'sessions' => $sessions]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
