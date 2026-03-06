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
$userId = (int) $_SESSION['user_id'];
$sessionId = isset($payload['session_id']) ? (int) $payload['session_id'] : null;
$maxWindowSeconds = 20;

$isActive = false;
if (array_key_exists('is_active', $payload)) {
    $parsed = filter_var($payload['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    $isActive = $parsed === null ? false : $parsed;
}

try {
    at_ensure_tracking_schema($pdo);

    $pdo->beginTransaction();

    at_expire_stale_sessions($pdo, $userId, 10);

    if (!$sessionId) {
        $latestStmt = $pdo->prepare("
            SELECT id
            FROM sessions
            WHERE user_id = ? AND status = 'active'
            ORDER BY login_at DESC
            LIMIT 1
            FOR UPDATE
        ");
        $latestStmt->execute([$userId]);
        $latest = $latestStmt->fetch(PDO::FETCH_ASSOC);
        $sessionId = $latest ? (int) $latest['id'] : null;
    }

    if (!$sessionId) {
        $pdo->commit();
        echo json_encode(['success' => true, 'closed' => false]);
        exit;
    }

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
        $pdo->commit();
        echo json_encode([
            'success' => true,
            'closed' => false,
            'status' => $session['status'],
            'summary' => at_session_summary($session)
        ]);
        exit;
    }

    $rawDelta = (int) ($session['elapsed_since_ping'] ?? 0);
    $appliedSeconds = $isActive ? min($rawDelta, $maxWindowSeconds) : 0;

    $entryStmt = $pdo->prepare("
        SELECT id
        FROM time_entries
        WHERE session_id = ? AND end_at IS NULL
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $entryStmt->execute([$sessionId]);
    $entry = $entryStmt->fetch(PDO::FETCH_ASSOC);

    if ($entry && $appliedSeconds > 0) {
        $updateEntryTimeStmt = $pdo->prepare("
            UPDATE time_entries
            SET seconds_active = seconds_active + ?
            WHERE id = ?
        ");
        $updateEntryTimeStmt->execute([$appliedSeconds, (int) $entry['id']]);
    }

    if ($entry) {
        $closeEntryStmt = $pdo->prepare("UPDATE time_entries SET end_at = NOW() WHERE id = ?");
        $closeEntryStmt->execute([(int) $entry['id']]);
    }

    $closeSessionStmt = $pdo->prepare("
        UPDATE sessions
        SET total_seconds_active = total_seconds_active + ?,
            last_ping_at = UTC_TIMESTAMP(),
            logout_at = UTC_TIMESTAMP(),
            status = 'closed'
        WHERE id = ?
    ");
    $closeSessionStmt->execute([$appliedSeconds, $sessionId]);

    if ($appliedSeconds > 0) {
        $activityStmt = $pdo->prepare("
            INSERT INTO activity_log (user_id, activity_date, seconds_active)
            VALUES (?, UTC_DATE(), ?)
            ON DUPLICATE KEY UPDATE seconds_active = seconds_active + VALUES(seconds_active)
        ");
        $activityStmt->execute([$userId, $appliedSeconds]);
    }

    $finalStmt = $pdo->prepare("
        SELECT id, login_at, logout_at, total_seconds_active, status
        FROM sessions
        WHERE id = ?
    ");
    $finalStmt->execute([$sessionId]);
    $finalSession = $finalStmt->fetch(PDO::FETCH_ASSOC);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'closed' => true,
        'session_id' => $sessionId,
        'applied_seconds' => $appliedSeconds,
        'total_seconds_active' => (int) $finalSession['total_seconds_active'],
        'summary' => at_session_summary($finalSession)
    ]);
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to close session',
        'details' => $e->getMessage()
    ]);
}
