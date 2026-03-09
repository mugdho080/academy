<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/CoachService.php';

session_start();
$userId = coach_require_user();
$payload = coach_json_input();

try {
    coach_ensure_schema($pdo);
    $pdo->beginTransaction();

    $input = [
        'intent' => $payload['intent'] ?? 'next_step',
        'route' => $payload['route'] ?? '/dashboard',
        'chapter_id' => $payload['chapter_id'] ?? null,
        'level_id' => $payload['level_id'] ?? null,
        'lesson_id' => $payload['lesson_id'] ?? null,
        'chapter_title' => $payload['chapter_title'] ?? null,
        'level_title' => $payload['level_title'] ?? null,
        'lesson_title' => $payload['lesson_title'] ?? null,
        'lesson_excerpt' => $payload['lesson_excerpt'] ?? null,
        'age_band' => $payload['age_band'] ?? null,
        'frustration_score' => $payload['frustration_score'] ?? null,
        'engagement_score' => $payload['engagement_score'] ?? null,
        'recommended_action' => $payload['recommended_action'] ?? null,
        'last_completed_lesson_id' => $payload['last_completed_lesson_id'] ?? null,
        'event_type' => $payload['event_type'] ?? null,
        'sensory_mode' => $payload['sensory_mode'] ?? null,
        'mode' => $payload['mode'] ?? 'bubble'
    ];

    $response = coach_generate_message($pdo, $userId, $input);

    if (isset($payload['recommendation_id']) && is_numeric($payload['recommendation_id'])) {
        $accepted = !empty($payload['recommendation_accepted']);
        coach_mark_recommendation($pdo, $userId, (int) $payload['recommendation_id'], true, $accepted);
    } elseif (!empty($response['recommended_action']['id'])) {
        coach_mark_recommendation($pdo, $userId, (int) $response['recommended_action']['id'], true, null);
    }

    $pdo->commit();
    echo json_encode($response);
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to generate coach response',
        'details' => $e->getMessage()
    ]);
}
