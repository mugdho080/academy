<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/CoachService.php';

session_start();
$userId = coach_require_user();
$payload = coach_json_input();

$eventType = isset($payload['event_type']) ? trim((string) $payload['event_type']) : '';
if ($eventType === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing event_type']);
    exit;
}

$allowedEvents = [
    'page_view',
    'session_start',
    'session_resume',
    'chapter_opened',
    'level_opened',
    'lesson_opened',
    'lesson_swipe_next',
    'lesson_swipe_prev',
    'quiz_option_selected',
    'quiz_answer_correct',
    'quiz_answer_incorrect',
    'lesson_completed',
    'session_idle',
    'session_reactivated',
    'rapid_navigation',
    'page_hidden',
    'session_end'
];

if (!in_array($eventType, $allowedEvents, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unsupported event_type']);
    exit;
}

try {
    coach_ensure_schema($pdo);
    $pdo->beginTransaction();

    $result = coach_apply_event($pdo, $userId, [
        'event_type' => $eventType,
        'route' => $payload['route'] ?? null,
        'chapter_id' => $payload['chapter_id'] ?? null,
        'level_id' => $payload['level_id'] ?? null,
        'lesson_id' => $payload['lesson_id'] ?? null,
        'session_id' => $payload['session_id'] ?? null,
        'payload_json' => is_array($payload['payload_json'] ?? null) ? $payload['payload_json'] : []
    ]);

    if (isset($payload['recommendation_id']) && is_numeric($payload['recommendation_id'])) {
        $accepted = !empty($payload['recommendation_accepted']);
        coach_mark_recommendation($pdo, $userId, (int) $payload['recommendation_id'], true, $accepted);
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'event_type' => $eventType,
        'state' => $result['state'],
        'frustration_band' => $result['frustration_band'],
        'intervention_level' => $result['intervention_level']
    ]);
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to log coach event',
        'details' => $e->getMessage()
    ]);
}
