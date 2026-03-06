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
if (!isset($payload['session_id']) || !is_numeric($payload['session_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid session_id']);
    exit;
}

$userId = (int) $_SESSION['user_id'];
$sessionId = (int) $payload['session_id'];
$context = at_validate_context($payload);
$clientEvent = at_validate_client_event($payload['client_event'] ?? 'manual');
$clientTs = at_parse_client_ts($payload['client_ts'] ?? null);
$eventId = at_normalize_event_id($payload['event_id'] ?? null);

$isActive = true;
if (array_key_exists('is_active', $payload)) {
    $parsed = filter_var($payload['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    $isActive = $parsed === null ? true : $parsed;
}

$deltaProvided = array_key_exists('delta_seconds_active', $payload);
$deltaSeconds = $deltaProvided ? (int) $payload['delta_seconds_active'] : null;
$maxDeltaSeconds = 120;

try {
    at_ensure_tracking_schema($pdo);
    $pdo->beginTransaction();

    at_expire_stale_sessions($pdo, $userId, 60);

    $sessionStmt = $pdo->prepare("
        SELECT
            id,
            login_at,
            logout_at,
            total_seconds_active,
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

    if (($session['status'] ?? '') !== 'active') {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode([
            'error' => 'Session is not active',
            'session_closed' => true,
            'status' => $session['status']
        ]);
        exit;
    }

    if ($deltaSeconds === null) {
        $deltaSeconds = $isActive ? (int) $session['elapsed_since_ping'] : 0;
    }

    if (!$isActive) {
        $deltaSeconds = 0;
    }

    $deltaSeconds = max(0, min($deltaSeconds, $maxDeltaSeconds));

    $duplicate = false;
    if ($eventId) {
        $eventInsert = $pdo->prepare("
            INSERT IGNORE INTO activity_events (
                event_id,
                session_id,
                user_id,
                client_event,
                client_ts,
                processed_at
            ) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())
        ");
        $eventInsert->execute([$eventId, $sessionId, $userId, $clientEvent, $clientTs]);
        $duplicate = $eventInsert->rowCount() === 0;
    }

    if (!$duplicate) {
        $sessionUpdate = $pdo->prepare("
            UPDATE sessions
            SET total_seconds_active = total_seconds_active + ?,
                last_ping_at = UTC_TIMESTAMP()
            WHERE id = ?
        ");
        $sessionUpdate->execute([$deltaSeconds, $sessionId]);

        if ($deltaSeconds > 0) {
            at_bucket_add_seconds($pdo, $sessionId, $userId, $context, $deltaSeconds);

            $activityStmt = $pdo->prepare("
                INSERT INTO activity_log (user_id, activity_date, seconds_active)
                VALUES (?, UTC_DATE(), ?)
                ON DUPLICATE KEY UPDATE seconds_active = seconds_active + VALUES(seconds_active)
            ");
            $activityStmt->execute([$userId, $deltaSeconds]);
        }
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
        'duplicate' => $duplicate,
        'session_id' => $sessionId,
        'client_event' => $clientEvent,
        'context' => $context,
        'applied_seconds' => $duplicate ? 0 : $deltaSeconds,
        'total_seconds_active' => (int) ($freshSession['total_seconds_active'] ?? 0),
        'summary' => at_session_summary($freshSession ?: [])
    ]);
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to log activity delta',
        'details' => $e->getMessage()
    ]);
}
