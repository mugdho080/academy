<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/ActivityTrackingService.php';
require_once __DIR__ . '/../services/AchievementService.php';

session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$userId = (int) $_SESSION['user_id'];
$payload = at_json_input();
$context = at_validate_context($payload);

try {
    at_ensure_tracking_schema($pdo);

    $pdo->beginTransaction();

    at_expire_stale_sessions($pdo, $userId, 60);

    $activeStmt = $pdo->prepare("
        SELECT id, COALESCE(last_ping_at, login_at, UTC_TIMESTAMP()) AS close_time
        FROM sessions
        WHERE user_id = ? AND status = 'active'
        FOR UPDATE
    ");
    $activeStmt->execute([$userId]);
    $activeSessions = $activeStmt->fetchAll(PDO::FETCH_ASSOC);

    if ($activeSessions) {
        $closeSessionStmt = $pdo->prepare("
            UPDATE sessions
            SET status = 'expired',
                logout_at = COALESCE(logout_at, ?)
            WHERE id = ? AND status = 'active'
        ");
        $closeEntryStmt = $pdo->prepare("
            UPDATE time_entries
            SET end_at = ?
            WHERE session_id = ? AND end_at IS NULL
        ");

        foreach ($activeSessions as $active) {
            $closeAt = $active['close_time'];
            $sessionId = (int) $active['id'];
            $closeSessionStmt->execute([$closeAt, $sessionId]);
            $closeEntryStmt->execute([$closeAt, $sessionId]);
        }
    }

    $createSessionStmt = $pdo->prepare("
        INSERT INTO sessions (user_id, login_at, last_ping_at, status, total_seconds_active)
        VALUES (?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), 'active', 0)
    ");
    $createSessionStmt->execute([$userId]);
    $sessionId = (int) $pdo->lastInsertId();

    $createEntryStmt = $pdo->prepare("
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
    $createEntryStmt->execute([
        $sessionId,
        $userId,
        $context['context_type'],
        $context['chapter_id'],
        $context['level_id'],
        $context['lesson_id']
    ]);

    $sessionStmt = $pdo->prepare("
        SELECT id, login_at, logout_at, total_seconds_active, status
        FROM sessions
        WHERE id = ?
    ");
    $sessionStmt->execute([$sessionId]);
    $session = $sessionStmt->fetch(PDO::FETCH_ASSOC);

    $pdo->commit();

    $achievementSummary = null;
    try {
        $achievementService = new AchievementService($pdo);
        $achievementService->handleSessionStart($userId, $sessionId);
        $achievementSummary = $achievementService->buildAchievementSummary($userId);
    } catch (\Throwable $achievementError) {
        // Do not fail session start if rewards update fails.
        $achievementSummary = null;
    }

    echo json_encode([
        'success' => true,
        'session_id' => $sessionId,
        'session' => [
            'id' => (int) $session['id'],
            'login_at' => $session['login_at'],
            'logout_at' => $session['logout_at'],
            'status' => $session['status'],
            'total_seconds_active' => (int) $session['total_seconds_active'],
            'summary' => at_session_summary($session)
        ],
        'context' => $context,
        'achievement_summary' => $achievementSummary
    ]);
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to start session',
        'details' => $e->getMessage()
    ]);
}
