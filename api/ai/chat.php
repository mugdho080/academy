<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/CoachService.php';

session_start();
$userId = coach_require_user();
$payload = coach_json_input();

try {
    coach_ensure_schema($pdo);
    $response = coach_generate_message($pdo, $userId, [
        'intent' => $payload['intent'] ?? 'navigation_help',
        'route' => $payload['route'] ?? '/ai-friend',
        'chapter_title' => $payload['chapter_title'] ?? null,
        'level_title' => $payload['level_title'] ?? null,
        'lesson_title' => $payload['lesson_title'] ?? null,
        'frustration_score' => $payload['frustration_score'] ?? null,
        'age_band' => $payload['age_band'] ?? null,
        'sensory_mode' => $payload['sensory_mode'] ?? null,
        'mode' => 'panel'
    ]);

    echo json_encode([
        'reply' => $response['message'],
        'intent' => $response['intent'],
        'mood' => $response['mood'],
        'animation_state' => $response['animation_state'],
        'suggested_cta' => $response['suggested_cta']
    ]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Coach chat failed',
        'details' => $e->getMessage()
    ]);
}
