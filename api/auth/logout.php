<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/ActivityTrackingService.php';

session_start();

$userId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
$payload = at_json_input();
$sessionId = isset($payload['session_id']) ? (int) $payload['session_id'] : null;

if ($userId) {
    try {
        at_ensure_tracking_schema($pdo);
        $pdo->beginTransaction();

        at_expire_stale_sessions($pdo, $userId, 10);

        if ($sessionId) {
            $closeStmt = $pdo->prepare("
                UPDATE sessions
                SET status = 'closed',
                    logout_at = COALESCE(logout_at, UTC_TIMESTAMP()),
                    last_ping_at = UTC_TIMESTAMP()
                WHERE id = ? AND user_id = ? AND status = 'active'
            ");
            $closeStmt->execute([$sessionId, $userId]);

            $closeEntriesStmt = $pdo->prepare("
                UPDATE time_entries
                SET end_at = COALESCE(end_at, NOW())
                WHERE session_id = ? AND end_at IS NULL
            ");
            $closeEntriesStmt->execute([$sessionId]);
        } else {
            $activeStmt = $pdo->prepare("
                SELECT id
                FROM sessions
                WHERE user_id = ? AND status = 'active'
                FOR UPDATE
            ");
            $activeStmt->execute([$userId]);
            $activeSessions = $activeStmt->fetchAll(PDO::FETCH_ASSOC);

            $closeStmt = $pdo->prepare("
                UPDATE sessions
                SET status = 'closed',
                    logout_at = COALESCE(logout_at, UTC_TIMESTAMP()),
                    last_ping_at = UTC_TIMESTAMP()
                WHERE id = ? AND user_id = ? AND status = 'active'
            ");
            $closeEntriesStmt = $pdo->prepare("
                UPDATE time_entries
                SET end_at = COALESCE(end_at, NOW())
                WHERE session_id = ? AND end_at IS NULL
            ");

            foreach ($activeSessions as $session) {
                $id = (int) $session['id'];
                $closeStmt->execute([$id, $userId]);
                $closeEntriesStmt->execute([$id]);
            }
        }

        $pdo->commit();
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to close active tracking session',
            'details' => $e->getMessage()
        ]);
        exit;
    }
}

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 3600, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}

session_destroy();

echo json_encode(['success' => true]);
