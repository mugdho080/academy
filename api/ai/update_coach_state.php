<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/CoachService.php';

session_start();
$userId = coach_require_user();
$payload = coach_json_input();

try {
    coach_ensure_schema($pdo);
    $pdo->beginTransaction();

    $profilePatch = [];
    $profileFields = [
        'age_band',
        'sensory_mode',
        'preferred_tone',
        'preferred_session_length_minutes',
        'favorite_topics_json',
        'support_intensity',
        'coach_enabled',
        'voice_enabled'
    ];
    foreach ($profileFields as $field) {
        if (array_key_exists($field, $payload)) {
            $profilePatch[$field] = $payload[$field];
        }
    }
    if (array_key_exists('favorite_topics', $payload) && !array_key_exists('favorite_topics_json', $profilePatch)) {
        $profilePatch['favorite_topics_json'] = is_array($payload['favorite_topics']) ? $payload['favorite_topics'] : [];
    }

    $statePatch = [];
    $stateFields = [
        'last_route',
        'last_chapter_id',
        'last_level_id',
        'last_lesson_id',
        'last_message_type',
        'last_message_text',
        'last_intervention_level',
        'frustration_score',
        'engagement_score',
        'streak_days',
        'last_seen_at',
        'last_completed_lesson_id',
        'last_recommendation_json'
    ];
    foreach ($stateFields as $field) {
        if (array_key_exists($field, $payload)) {
            $statePatch[$field] = $payload[$field];
        }
    }

    if ($profilePatch) {
        coach_upsert_profile($pdo, $userId, $profilePatch);
    }
    if ($statePatch) {
        coach_upsert_state($pdo, $userId, $statePatch);
    }

    if (isset($payload['recommendation_id']) && is_numeric($payload['recommendation_id'])) {
        $show = array_key_exists('was_shown', $payload) ? (bool) $payload['was_shown'] : null;
        $accepted = array_key_exists('was_accepted', $payload) ? (bool) $payload['was_accepted'] : null;
        coach_mark_recommendation($pdo, $userId, (int) $payload['recommendation_id'], $show, $accepted);
    }

    $profile = coach_get_or_create_profile($pdo, $userId);
    $state = coach_get_or_create_state($pdo, $userId);
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'profile' => $profile,
        'state' => $state,
        'frustration_band' => coach_frustration_band((int) $state['frustration_score'])
    ]);
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to update coach state',
        'details' => $e->getMessage()
    ]);
}
