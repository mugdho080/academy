<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/ActivityTrackingService.php';

session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$payload = at_json_input();
if (!isset($payload['session_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing session_id']);
    exit;
}

$userId = (int) $_SESSION['user_id'];
$sessionId = (int) $payload['session_id'];
$context = at_validate_context($payload);
$maxWindowSeconds = 20;

$isActive = true;
if (array_key_exists('is_active', $payload)) {
    $parsed = filter_var($payload['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    $isActive = $parsed === null ? true : $parsed;
}

try {
    at_ensure_tracking_schema($pdo);

    $pdo->beginTransaction();

    at_expire_stale_sessions($pdo, $userId, 10);

    $sessionStmt = $pdo->prepare("
        SELECT
            id,
            login_at,
            logout_at,
            total_seconds_active,
            last_ping_at,
            status,
            GREATEST(0, TIMESTAMPDIFF(SECOND, last_ping_at, UTC_TIMESTAMP())) AS elapsed_since_ping
        FROM sessions
        WHERE id = ? AND user_id = ?
        FOR UPDATE
    ");
    $sessionStmt->execute([$sessionId, $userId]);
    $session = $sessionStmt->fetch(PDO::FETCH_ASSOC);

    if (!$session) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Session not found']);
        exit;
    }

    if ($session['status'] !== 'active') {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode([
            'error' => 'Session is not active',
            'session_closed' => true,
            'status' => $session['status']
        ]);
        exit;
    }

    $rawDelta = (int) ($session['elapsed_since_ping'] ?? 0);
    $appliedSeconds = $isActive ? min($rawDelta, $maxWindowSeconds) : 0;

    $updateSessionStmt = $pdo->prepare("
        UPDATE sessions
        SET total_seconds_active = total_seconds_active + ?,
            last_ping_at = UTC_TIMESTAMP()
        WHERE id = ?
    ");
    $updateSessionStmt->execute([$appliedSeconds, $sessionId]);

    if ($appliedSeconds > 0) {
        at_bucket_add_seconds($pdo, $sessionId, $userId, $context, $appliedSeconds);
        $activityStmt = $pdo->prepare("
            INSERT INTO activity_log (user_id, activity_date, seconds_active)
            VALUES (?, UTC_DATE(), ?)
            ON DUPLICATE KEY UPDATE seconds_active = seconds_active + VALUES(seconds_active)
        ");
        $activityStmt->execute([$userId, $appliedSeconds]);
    }

    $freshSessionStmt = $pdo->prepare("
        SELECT id, login_at, logout_at, total_seconds_active, status
        FROM sessions
        WHERE id = ?
    ");
    $freshSessionStmt->execute([$sessionId]);
    $freshSession = $freshSessionStmt->fetch(PDO::FETCH_ASSOC);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'applied_seconds' => $appliedSeconds,
        'raw_elapsed_seconds' => $rawDelta,
        'is_active' => $isActive,
        'total_seconds_active' => (int) $freshSession['total_seconds_active'],
        'summary' => at_session_summary($freshSession)
    ]);
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to ping activity',
        'details' => $e->getMessage()
    ]);
}
