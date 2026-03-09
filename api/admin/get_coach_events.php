<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/CoachService.php';

session_start();
coach_require_admin();

if (!isset($_GET['user_id']) || !is_numeric($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid user_id']);
    exit;
}

$userId = (int) $_GET['user_id'];
$limit = isset($_GET['limit']) && is_numeric($_GET['limit']) ? max(10, min(500, (int) $_GET['limit'])) : 100;
$start = isset($_GET['start']) ? trim((string) $_GET['start']) : null;
$end = isset($_GET['end']) ? trim((string) $_GET['end']) : null;

$where = ' WHERE user_id = ? ';
$params = [$userId];
if ($start && preg_match('/^\d{4}-\d{2}-\d{2}$/', $start)) {
    $where .= ' AND created_at >= ? ';
    $params[] = $start . ' 00:00:00';
}
if ($end && preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
    $where .= ' AND created_at <= ? ';
    $params[] = $end . ' 23:59:59';
}

try {
    coach_ensure_schema($pdo);
    $profile = coach_get_or_create_profile($pdo, $userId);
    $state = coach_get_or_create_state($pdo, $userId);

    $eventsStmt = $pdo->prepare("
        SELECT id, event_type, route, chapter_id, level_id, lesson_id, payload_json, created_at
        FROM coach_events
        {$where}
        ORDER BY id DESC
        LIMIT {$limit}
    ");
    $eventsStmt->execute($params);
    $events = $eventsStmt->fetchAll(PDO::FETCH_ASSOC);

    $recStmt = $pdo->prepare("
        SELECT id, recommendation_type, recommendation_json, was_shown, was_accepted, created_at
        FROM coach_recommendations
        {$where}
        ORDER BY id DESC
        LIMIT {$limit}
    ");
    $recStmt->execute($params);
    $recommendations = $recStmt->fetchAll(PDO::FETCH_ASSOC);

    $intStmt = $pdo->prepare("
        SELECT id, intervention_level, trigger_type, response_type, response_text, created_at
        FROM coach_interventions
        {$where}
        ORDER BY id DESC
        LIMIT {$limit}
    ");
    $intStmt->execute($params);
    $interventions = $intStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'user_id' => $userId,
        'profile' => $profile,
        'state' => $state,
        'events' => $events,
        'recommendations' => $recommendations,
        'interventions' => $interventions
    ]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to fetch coach analytics',
        'details' => $e->getMessage()
    ]);
}
