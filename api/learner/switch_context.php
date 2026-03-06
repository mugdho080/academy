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
if (!isset($payload['session_id']) || !isset($payload['context_type'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing session_id or context_type']);
    exit;
}

$userId = (int) $_SESSION['user_id'];
$sessionId = (int) $payload['session_id'];
$context = at_validate_context($payload);

try {
    at_ensure_tracking_schema($pdo);

    $pdo->beginTransaction();

    at_expire_stale_sessions($pdo, $userId, 10);

    $sessionStmt = $pdo->prepare("
        SELECT id, status
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

    $openEntryStmt = $pdo->prepare("
        SELECT id, context_type, chapter_id, level_id, lesson_id
        FROM time_entries
        WHERE session_id = ? AND end_at IS NULL
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $openEntryStmt->execute([$sessionId]);
    $openEntry = $openEntryStmt->fetch(PDO::FETCH_ASSOC);

    if ($openEntry && at_context_equals($openEntry, $context)) {
        $pdo->commit();
        echo json_encode([
            'success' => true,
            'changed' => false,
            'context' => $context
        ]);
        exit;
    }

    if ($openEntry) {
        $closeStmt = $pdo->prepare("UPDATE time_entries SET end_at = UTC_TIMESTAMP() WHERE id = ?");
        $closeStmt->execute([(int) $openEntry['id']]);
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO time_entries (
            session_id,
            user_id,
            context_type,
            chapter_id,
            level_id,
            lesson_id,
            start_at,
            date_key
        ) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_DATE())
    ");
    $insertStmt->execute([
        $sessionId,
        $userId,
        $context['context_type'],
        $context['chapter_id'],
        $context['level_id'],
        $context['lesson_id']
    ]);

    $pdo->commit();
    echo json_encode([
        'success' => true,
        'changed' => true,
        'entry_id' => (int) $pdo->lastInsertId(),
        'context' => $context
    ]);
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to switch context',
        'details' => $e->getMessage()
    ]);
}
