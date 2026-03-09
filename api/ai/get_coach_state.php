<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/CoachService.php';

session_start();
$userId = coach_require_user();

try {
    coach_ensure_schema($pdo);

    $profile = coach_get_or_create_profile($pdo, $userId);
    $state = coach_get_or_create_state($pdo, $userId);

    $recentEventsStmt = $pdo->prepare("
        SELECT id, event_type, route, chapter_id, level_id, lesson_id, created_at
        FROM coach_events
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 20
    ");
    $recentEventsStmt->execute([$userId]);
    $recentEvents = $recentEventsStmt->fetchAll(PDO::FETCH_ASSOC);

    $recommendation = null;
    if (!empty($state['last_recommendation_json'])) {
        $decoded = json_decode($state['last_recommendation_json'], true);
        if (is_array($decoded)) {
            $recommendation = $decoded;
        }
    }

    echo json_encode([
        'success' => true,
        'profile' => [
            'user_id' => (int) $profile['user_id'],
            'age_band' => $profile['age_band'],
            'sensory_mode' => $profile['sensory_mode'],
            'preferred_tone' => $profile['preferred_tone'],
            'preferred_session_length_minutes' => (int) $profile['preferred_session_length_minutes'],
            'favorite_topics' => coach_parse_topics($profile['favorite_topics_json'] ?? '[]'),
            'support_intensity' => $profile['support_intensity'],
            'coach_enabled' => (int) $profile['coach_enabled'] === 1,
            'voice_enabled' => (int) $profile['voice_enabled'] === 1
        ],
        'state' => [
            'last_route' => $state['last_route'],
            'last_chapter_id' => $state['last_chapter_id'] !== null ? (int) $state['last_chapter_id'] : null,
            'last_level_id' => $state['last_level_id'] !== null ? (int) $state['last_level_id'] : null,
            'last_lesson_id' => $state['last_lesson_id'] !== null ? (int) $state['last_lesson_id'] : null,
            'last_message_type' => $state['last_message_type'],
            'last_message_text' => $state['last_message_text'],
            'last_intervention_level' => (int) $state['last_intervention_level'],
            'frustration_score' => (int) $state['frustration_score'],
            'frustration_band' => coach_frustration_band((int) $state['frustration_score']),
            'engagement_score' => (int) $state['engagement_score'],
            'streak_days' => (int) $state['streak_days'],
            'last_seen_at' => $state['last_seen_at'],
            'last_completed_lesson_id' => $state['last_completed_lesson_id'] !== null ? (int) $state['last_completed_lesson_id'] : null,
            'last_recommendation' => $recommendation
        ],
        'recent_events' => $recentEvents
    ]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to fetch coach state',
        'details' => $e->getMessage()
    ]);
}
