<?php

function coach_json_input(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function coach_require_user(): int
{
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    return (int) $_SESSION['user_id'];
}

function coach_require_admin(): int
{
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized. Admin access required.']);
        exit;
    }

    return (int) $_SESSION['user_id'];
}

function coach_now_utc(): string
{
    return gmdate('Y-m-d H:i:s');
}

function coach_validate_age_band($value): string
{
    $allowed = ['under_20', 'age_20_40', 'age_40_plus'];
    if (!is_string($value)) {
        return 'age_20_40';
    }
    return in_array($value, $allowed, true) ? $value : 'age_20_40';
}

function coach_validate_sensory_mode($value): string
{
    $allowed = ['quiet', 'calm', 'standard'];
    if (!is_string($value)) {
        return 'calm';
    }
    return in_array($value, $allowed, true) ? $value : 'calm';
}

function coach_validate_support_intensity($value): string
{
    $allowed = ['low', 'medium', 'high'];
    if (!is_string($value)) {
        return 'medium';
    }
    return in_array($value, $allowed, true) ? $value : 'medium';
}

function coach_clamp_int($value, int $min, int $max): int
{
    $num = (int) $value;
    if ($num < $min) {
        return $min;
    }
    if ($num > $max) {
        return $max;
    }
    return $num;
}

function coach_frustration_band(int $score): string
{
    if ($score >= 9) {
        return 'strong_disengagement_risk';
    }
    if ($score >= 6) {
        return 'frustration_likely';
    }
    if ($score >= 3) {
        return 'mild_hesitation';
    }
    return 'normal';
}

function coach_intervention_level(int $score): int
{
    if ($score >= 9) {
        return 3;
    }
    if ($score >= 6) {
        return 2;
    }
    if ($score >= 3) {
        return 1;
    }
    return 0;
}

function coach_ensure_schema(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS learner_profiles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            age_band ENUM('under_20','age_20_40','age_40_plus') NOT NULL DEFAULT 'age_20_40',
            sensory_mode ENUM('quiet','calm','standard') NOT NULL DEFAULT 'calm',
            preferred_tone VARCHAR(64) NOT NULL DEFAULT 'supportive',
            preferred_session_length_minutes INT NOT NULL DEFAULT 20,
            favorite_topics_json LONGTEXT NULL,
            support_intensity ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
            coach_enabled TINYINT(1) NOT NULL DEFAULT 1,
            voice_enabled TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_learner_profiles_user (user_id),
            CONSTRAINT fk_learner_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS coach_state (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            last_route VARCHAR(255) NULL,
            last_chapter_id INT NULL,
            last_level_id INT NULL,
            last_lesson_id INT NULL,
            last_message_type VARCHAR(64) NULL,
            last_message_text TEXT NULL,
            last_intervention_level TINYINT NOT NULL DEFAULT 0,
            frustration_score INT NOT NULL DEFAULT 0,
            engagement_score INT NOT NULL DEFAULT 5,
            streak_days INT NOT NULL DEFAULT 0,
            last_seen_at DATETIME NULL,
            last_completed_lesson_id INT NULL,
            last_recommendation_json LONGTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_coach_state_user (user_id),
            CONSTRAINT fk_coach_state_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS coach_events (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_id INT NULL,
            event_type VARCHAR(64) NOT NULL,
            route VARCHAR(255) NULL,
            chapter_id INT NULL,
            level_id INT NULL,
            lesson_id INT NULL,
            payload_json LONGTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_coach_events_user_time (user_id, created_at),
            INDEX idx_coach_events_type_time (event_type, created_at),
            INDEX idx_coach_events_route (route),
            CONSTRAINT fk_coach_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_coach_events_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS coach_recommendations (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            route VARCHAR(255) NULL,
            recommendation_type VARCHAR(64) NOT NULL,
            recommendation_json LONGTEXT NOT NULL,
            was_shown TINYINT(1) NOT NULL DEFAULT 0,
            was_accepted TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_coach_recommendations_user_time (user_id, created_at),
            INDEX idx_coach_recommendations_route_type (route, recommendation_type),
            CONSTRAINT fk_coach_recommendations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS coach_interventions (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            intervention_level TINYINT NOT NULL DEFAULT 0,
            trigger_type VARCHAR(64) NOT NULL,
            trigger_details_json LONGTEXT NULL,
            response_type VARCHAR(64) NULL,
            response_text TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_coach_interventions_user_time (user_id, created_at),
            INDEX idx_coach_interventions_level (intervention_level),
            CONSTRAINT fk_coach_interventions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ");

    $ready = true;
}

function coach_default_profile(int $userId): array
{
    return [
        'user_id' => $userId,
        'age_band' => 'age_20_40',
        'sensory_mode' => 'calm',
        'preferred_tone' => 'supportive',
        'preferred_session_length_minutes' => 20,
        'favorite_topics_json' => '[]',
        'support_intensity' => 'medium',
        'coach_enabled' => 1,
        'voice_enabled' => 0
    ];
}

function coach_get_or_create_profile(PDO $pdo, int $userId): array
{
    $select = $pdo->prepare("SELECT * FROM learner_profiles WHERE user_id = ? LIMIT 1");
    $select->execute([$userId]);
    $row = $select->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        return $row;
    }

    $default = coach_default_profile($userId);
    $insert = $pdo->prepare("
        INSERT INTO learner_profiles (
            user_id, age_band, sensory_mode, preferred_tone, preferred_session_length_minutes,
            favorite_topics_json, support_intensity, coach_enabled, voice_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $insert->execute([
        $default['user_id'],
        $default['age_band'],
        $default['sensory_mode'],
        $default['preferred_tone'],
        $default['preferred_session_length_minutes'],
        $default['favorite_topics_json'],
        $default['support_intensity'],
        $default['coach_enabled'],
        $default['voice_enabled']
    ]);

    $select->execute([$userId]);
    return $select->fetch(PDO::FETCH_ASSOC) ?: $default;
}

function coach_get_or_create_state(PDO $pdo, int $userId): array
{
    $select = $pdo->prepare("SELECT * FROM coach_state WHERE user_id = ? LIMIT 1");
    $select->execute([$userId]);
    $row = $select->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        return $row;
    }

    $insert = $pdo->prepare("
        INSERT INTO coach_state (
            user_id, frustration_score, engagement_score, streak_days, last_seen_at
        ) VALUES (?, 0, 5, 0, UTC_TIMESTAMP())
    ");
    $insert->execute([$userId]);

    $select->execute([$userId]);
    return $select->fetch(PDO::FETCH_ASSOC) ?: [
        'user_id' => $userId,
        'frustration_score' => 0,
        'engagement_score' => 5,
        'streak_days' => 0
    ];
}

function coach_parse_topics($favoriteTopicsJson): array
{
    if (!is_string($favoriteTopicsJson) || trim($favoriteTopicsJson) === '') {
        return [];
    }

    $parsed = json_decode($favoriteTopicsJson, true);
    if (!is_array($parsed)) {
        return [];
    }

    $topics = [];
    foreach ($parsed as $topic) {
        if (!is_string($topic)) {
            continue;
        }
        $clean = trim($topic);
        if ($clean !== '') {
            $topics[] = $clean;
        }
    }

    return array_values(array_unique($topics));
}

function coach_upsert_state(PDO $pdo, int $userId, array $patch): array
{
    coach_get_or_create_state($pdo, $userId);

    $allowed = [
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

    $fields = [];
    $params = [];

    foreach ($allowed as $key) {
        if (!array_key_exists($key, $patch)) {
            continue;
        }

        $value = $patch[$key];
        if (in_array($key, ['last_chapter_id', 'last_level_id', 'last_lesson_id', 'last_completed_lesson_id'], true)) {
            $value = ($value === null || $value === '') ? null : (int) $value;
        }
        if (in_array($key, ['frustration_score', 'engagement_score', 'streak_days', 'last_intervention_level'], true)) {
            $value = (int) $value;
        }

        $fields[] = "{$key} = ?";
        $params[] = $value;
    }

    if ($fields) {
        $params[] = $userId;
        $sql = 'UPDATE coach_state SET ' . implode(', ', $fields) . ', updated_at = UTC_TIMESTAMP() WHERE user_id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }

    return coach_get_or_create_state($pdo, $userId);
}

function coach_upsert_profile(PDO $pdo, int $userId, array $patch): array
{
    coach_get_or_create_profile($pdo, $userId);

    $allowed = [
        'age_band',
        'sensory_mode',
        'preferred_tone',
        'preferred_session_length_minutes',
        'favorite_topics_json',
        'support_intensity',
        'coach_enabled',
        'voice_enabled'
    ];

    $fields = [];
    $params = [];

    foreach ($allowed as $key) {
        if (!array_key_exists($key, $patch)) {
            continue;
        }

        $value = $patch[$key];
        if ($key === 'age_band') {
            $value = coach_validate_age_band($value);
        } elseif ($key === 'sensory_mode') {
            $value = coach_validate_sensory_mode($value);
        } elseif ($key === 'support_intensity') {
            $value = coach_validate_support_intensity($value);
        } elseif ($key === 'preferred_session_length_minutes') {
            $value = coach_clamp_int($value, 5, 180);
        } elseif (in_array($key, ['coach_enabled', 'voice_enabled'], true)) {
            $value = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        } elseif ($key === 'favorite_topics_json') {
            if (is_array($value)) {
                $value = json_encode(array_values($value), JSON_UNESCAPED_UNICODE);
            }
            if (!is_string($value)) {
                $value = '[]';
            }
        } else {
            $value = (string) $value;
        }

        $fields[] = "{$key} = ?";
        $params[] = $value;
    }

    if ($fields) {
        $params[] = $userId;
        $sql = 'UPDATE learner_profiles SET ' . implode(', ', $fields) . ', updated_at = UTC_TIMESTAMP() WHERE user_id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }

    return coach_get_or_create_profile($pdo, $userId);
}

function coach_event_deltas(string $eventType, array $payload, array $state): array
{
    $frustrationDelta = 0;
    $engagementDelta = 0;

    switch ($eventType) {
        case 'quiz_answer_incorrect':
            $frustrationDelta += 2;
            break;
        case 'rapid_navigation':
            $frustrationDelta += 2;
            $engagementDelta -= 1;
            break;
        case 'session_idle':
            $frustrationDelta += 1;
            $engagementDelta -= 1;
            break;
        case 'page_hidden':
            $engagementDelta -= 1;
            break;
        case 'lesson_swipe_prev':
            $frustrationDelta += 1;
            break;
        case 'quiz_answer_correct':
            $frustrationDelta -= 2;
            $engagementDelta += 1;
            break;
        case 'lesson_completed':
            $frustrationDelta -= 3;
            $engagementDelta += 2;
            break;
        case 'session_reactivated':
            $frustrationDelta -= 1;
            $engagementDelta += 1;
            break;
        default:
            break;
    }

    $lessonId = isset($payload['lesson_id']) ? (int) $payload['lesson_id'] : null;
    $lastLessonId = isset($state['last_lesson_id']) ? (int) $state['last_lesson_id'] : null;
    if ($eventType === 'lesson_opened' && $lessonId && $lastLessonId && $lessonId === $lastLessonId) {
        $frustrationDelta += 1;
    }

    if (!empty($payload['recommendation_accepted'])) {
        $frustrationDelta -= 1;
        $engagementDelta += 1;
    }

    return [
        'frustration_delta' => $frustrationDelta,
        'engagement_delta' => $engagementDelta
    ];
}

function coach_apply_event(PDO $pdo, int $userId, array $event): array
{
    $eventType = (string) ($event['event_type'] ?? 'page_view');
    $route = isset($event['route']) ? (string) $event['route'] : null;
    $chapterId = isset($event['chapter_id']) && $event['chapter_id'] !== '' ? (int) $event['chapter_id'] : null;
    $levelId = isset($event['level_id']) && $event['level_id'] !== '' ? (int) $event['level_id'] : null;
    $lessonId = isset($event['lesson_id']) && $event['lesson_id'] !== '' ? (int) $event['lesson_id'] : null;
    $sessionId = isset($event['session_id']) && $event['session_id'] !== '' ? (int) $event['session_id'] : null;
    $payload = $event['payload_json'] ?? [];
    if (!is_array($payload)) {
        $payload = [];
    }

    $insertEvent = $pdo->prepare("
        INSERT INTO coach_events (
            user_id, session_id, event_type, route, chapter_id, level_id, lesson_id, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $insertEvent->execute([
        $userId,
        $sessionId,
        $eventType,
        $route,
        $chapterId,
        $levelId,
        $lessonId,
        json_encode($payload, JSON_UNESCAPED_UNICODE)
    ]);

    $state = coach_get_or_create_state($pdo, $userId);
    $delta = coach_event_deltas($eventType, array_merge($payload, ['lesson_id' => $lessonId]), $state);

    $nextFrustration = coach_clamp_int((int) ($state['frustration_score'] ?? 0) + (int) $delta['frustration_delta'], 0, 12);
    $nextEngagement = coach_clamp_int((int) ($state['engagement_score'] ?? 5) + (int) $delta['engagement_delta'], 0, 10);
    $intervention = coach_intervention_level($nextFrustration);

    $patch = [
        'last_route' => $route,
        'last_chapter_id' => $chapterId,
        'last_level_id' => $levelId,
        'last_lesson_id' => $lessonId,
        'frustration_score' => $nextFrustration,
        'engagement_score' => $nextEngagement,
        'last_intervention_level' => $intervention,
        'last_seen_at' => coach_now_utc()
    ];

    if ($eventType === 'lesson_completed' && $lessonId) {
        $patch['last_completed_lesson_id'] = $lessonId;
    }

    $updatedState = coach_upsert_state($pdo, $userId, $patch);

    if ($intervention >= 2) {
        $insertIntervention = $pdo->prepare("
            INSERT INTO coach_interventions (
                user_id, intervention_level, trigger_type, trigger_details_json, response_type, response_text
            ) VALUES (?, ?, ?, ?, ?, ?)
        ");
        $insertIntervention->execute([
            $userId,
            $intervention,
            $eventType,
            json_encode($payload, JSON_UNESCAPED_UNICODE),
            'auto',
            null
        ]);
    }

    return [
        'state' => $updatedState,
        'frustration_band' => coach_frustration_band((int) ($updatedState['frustration_score'] ?? 0)),
        'intervention_level' => $intervention
    ];
}

function coach_get_user_snapshot(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('SELECT id, name, status FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: ['id' => $userId, 'name' => 'Learner', 'status' => 'locked'];
}

function coach_build_recommendation_row(?array $row, string $type, string $reason, string $intent, int $sessionLength, string $rewardHint): array
{
    if (!$row) {
        return [
            'recommended_route' => '/dashboard',
            'recommended_chapter_id' => null,
            'recommended_level_id' => null,
            'recommended_lesson_id' => null,
            'recommendation_type' => $type,
            'reason_code' => $reason,
            'coach_intent' => $intent,
            'session_length_minutes' => $sessionLength,
            'reward_hint' => $rewardHint
        ];
    }

    return [
        'recommended_route' => '/lesson/' . (int) $row['level_id'],
        'recommended_chapter_id' => isset($row['chapter_id']) ? (int) $row['chapter_id'] : null,
        'recommended_level_id' => isset($row['level_id']) ? (int) $row['level_id'] : null,
        'recommended_lesson_id' => isset($row['lesson_id']) ? (int) $row['lesson_id'] : null,
        'recommendation_type' => $type,
        'reason_code' => $reason,
        'coach_intent' => $intent,
        'session_length_minutes' => $sessionLength,
        'reward_hint' => $rewardHint
    ];
}

function coach_get_default_lesson(PDO $pdo, int $userId, bool $allowPaid, ?string $topic = null): ?array
{
    $params = [$userId];
    $whereTopic = '';
    if ($topic !== null && trim($topic) !== '') {
        $whereTopic = ' AND (ch.title LIKE ? OR les.title LIKE ?)';
        $params[] = '%' . $topic . '%';
        $params[] = '%' . $topic . '%';
    }

    $sql = "
        SELECT
            les.id AS lesson_id,
            les.title AS lesson_title,
            lv.id AS level_id,
            lv.title AS level_title,
            lv.chapter_id,
            ch.title AS chapter_title
        FROM lessons les
        INNER JOIN levels lv ON lv.id = les.level_id
        INNER JOIN chapters ch ON ch.id = lv.chapter_id
        LEFT JOIN progress p ON p.lesson_id = les.id AND p.user_id = ?
        WHERE (p.is_completed IS NULL OR p.is_completed = 0)
          AND (lv.is_free = 1 " . ($allowPaid ? " OR 1 = 1" : "") . ")
          {$whereTopic}
        ORDER BY lv.is_free DESC, ch.order_index ASC, lv.order_index ASC, les.order_index ASC
        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function coach_get_resume_lesson(PDO $pdo, int $userId, ?int $lessonId): ?array
{
    if (!$lessonId) {
        return null;
    }

    $stmt = $pdo->prepare("
        SELECT
            les.id AS lesson_id,
            les.title AS lesson_title,
            lv.id AS level_id,
            lv.title AS level_title,
            lv.chapter_id,
            ch.title AS chapter_title
        FROM lessons les
        INNER JOIN levels lv ON lv.id = les.level_id
        INNER JOIN chapters ch ON ch.id = lv.chapter_id
        LEFT JOIN progress p ON p.lesson_id = les.id AND p.user_id = ?
        WHERE les.id = ?
          AND (p.is_completed IS NULL OR p.is_completed = 0)
        LIMIT 1
    ");
    $stmt->execute([$userId, $lessonId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function coach_get_recommendation(PDO $pdo, int $userId, array $options = []): array
{
    $profile = coach_get_or_create_profile($pdo, $userId);
    $state = coach_get_or_create_state($pdo, $userId);
    $user = coach_get_user_snapshot($pdo, $userId);

    $frustrationScore = isset($options['frustration_score']) ? (int) $options['frustration_score'] : (int) ($state['frustration_score'] ?? 0);
    $sessionLength = coach_clamp_int((int) ($profile['preferred_session_length_minutes'] ?? 20), 5, 180);
    $allowPaid = ($user['status'] ?? 'locked') === 'active';
    $topics = coach_parse_topics($profile['favorite_topics_json'] ?? '[]');

    $resume = coach_get_resume_lesson($pdo, $userId, isset($state['last_lesson_id']) ? (int) $state['last_lesson_id'] : null);
    if ($resume && $frustrationScore < 9) {
        $recommendation = coach_build_recommendation_row(
            $resume,
            'resume_unfinished',
            'recent_unfinished_lesson',
            'resume_path',
            $sessionLength,
            'Finish one small step to keep momentum.'
        );
    } elseif ($frustrationScore >= 6) {
        $easy = coach_get_default_lesson($pdo, $userId, $allowPaid, null);
        $recommendation = coach_build_recommendation_row(
            $easy,
            'short_easy_success',
            'high_frustration',
            'frustration_support',
            min(15, $sessionLength),
            'Choose a short win to rebuild confidence.'
        );
    } elseif (!empty($topics)) {
        $topicPick = coach_get_default_lesson($pdo, $userId, $allowPaid, $topics[0]);
        $recommendation = coach_build_recommendation_row(
            $topicPick,
            'favorite_topic',
            'preferred_topic_match',
            'next_step',
            $sessionLength,
            'Use a favorite topic for an easy restart.'
        );
    } else {
        $starter = coach_get_default_lesson($pdo, $userId, $allowPaid, null);
        $recommendation = coach_build_recommendation_row(
            $starter,
            'starter_path',
            'no_recent_history',
            'welcome',
            $sessionLength,
            'One short lesson today is enough.'
        );
    }

    $insert = $pdo->prepare("
        INSERT INTO coach_recommendations (
            user_id, route, recommendation_type, recommendation_json, was_shown, was_accepted
        ) VALUES (?, ?, ?, ?, 0, 0)
    ");
    $insert->execute([
        $userId,
        $options['route'] ?? ($state['last_route'] ?? '/dashboard'),
        $recommendation['recommendation_type'],
        json_encode($recommendation, JSON_UNESCAPED_UNICODE)
    ]);

    $recommendation['id'] = (int) $pdo->lastInsertId();
    return $recommendation;
}

function coach_mark_recommendation(PDO $pdo, int $userId, int $recommendationId, ?bool $shown = null, ?bool $accepted = null): void
{
    $sets = [];
    $params = [];

    if ($shown !== null) {
        $sets[] = 'was_shown = ?';
        $params[] = $shown ? 1 : 0;
    }
    if ($accepted !== null) {
        $sets[] = 'was_accepted = ?';
        $params[] = $accepted ? 1 : 0;
    }

    if (!$sets) {
        return;
    }

    $params[] = $recommendationId;
    $params[] = $userId;

    $sql = 'UPDATE coach_recommendations SET ' . implode(', ', $sets) . ' WHERE id = ? AND user_id = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
}

function coach_get_api_key(): ?string
{
    $keys = [
        getenv('GEMINI_API_KEY'),
        getenv('GOOGLE_GENAI_API_KEY'),
        $_ENV['GEMINI_API_KEY'] ?? null,
        $_ENV['GOOGLE_GENAI_API_KEY'] ?? null
    ];

    foreach ($keys as $key) {
        if (is_string($key) && trim($key) !== '') {
            return trim($key);
        }
    }

    return null;
}

function coach_default_message(array $input): string
{
    $intent = $input['intent'] ?? 'next_step';
    $ageBand = coach_validate_age_band($input['age_band'] ?? 'age_20_40');

    $map = [
        'welcome' => [
            'under_20' => 'Hi! I am your Panda Coach. Pick one small lesson and we can do it together.',
            'age_20_40' => 'Welcome back. I can guide you to one practical next step.',
            'age_40_plus' => 'Welcome back. Let us take one calm, simple step next.'
        ],
        'resume_path' => [
            'under_20' => 'You can continue where you left off. One short step is enough.',
            'age_20_40' => 'You can resume your last lesson and finish one clear step.',
            'age_40_plus' => 'Resume your previous lesson at a steady pace.'
        ],
        'mistake_reassurance' => [
            'under_20' => 'That is okay. Try one easier choice and we keep going.',
            'age_20_40' => 'That attempt still helps. Try one simpler step now.',
            'age_40_plus' => 'No problem. Take a slower step and try again.'
        ],
        'frustration_support' => [
            'under_20' => 'Let us pause for a short break, then do one easy win.',
            'age_20_40' => 'A short break can help. Come back for one easy task.',
            'age_40_plus' => 'Take a short calm break. Return for one manageable step.'
        ],
        'completion_celebration' => [
            'under_20' => 'Nice work. You finished this step. Ready for one more?',
            'age_20_40' => 'Well done. You completed this lesson step clearly.',
            'age_40_plus' => 'Good progress. You completed this lesson with care.'
        ]
    ];

    $bucket = $map[$intent] ?? [
        'under_20' => 'Let us do one clear next step together.',
        'age_20_40' => 'Here is one clear next action to continue.',
        'age_40_plus' => 'One simple next action is ready when you are.'
    ];

    return $bucket[$ageBand] ?? $bucket['age_20_40'];
}

function coach_limit_words(string $text, int $maxWords): string
{
    $words = preg_split('/\\s+/', trim($text));
    if (!is_array($words) || count($words) <= $maxWords) {
        return trim($text);
    }
    return trim(implode(' ', array_slice($words, 0, $maxWords)));
}

function coach_sanitize_text(string $text): string
{
    $clean = trim($text);
    if ($clean === '') {
        return $clean;
    }

    $blockedPatterns = [
        '/\\byou must\\b/i',
        "/\\bdon't leave\\b/i",
        '/\\byou are behind\\b/i',
        '/\\bstay longer\\b/i',
        '/\\bbeat others\\b/i',
        '/\\bcompete\\b/i'
    ];

    foreach ($blockedPatterns as $pattern) {
        if (preg_match($pattern, $clean)) {
            return '';
        }
    }

    return preg_replace('/[!]{2,}/', '!', $clean);
}

function coach_extract_json_object(string $text): ?array
{
    $text = trim($text);
    if ($text === '') {
        return null;
    }

    if (preg_match('/\\{[\\s\\S]*\\}/', $text, $matches)) {
        $json = json_decode($matches[0], true);
        if (is_array($json)) {
            return $json;
        }
    }

    return null;
}

function coach_call_gemini(array $input, string $mode): ?array
{
    $apiKey = coach_get_api_key();
    if (!$apiKey) {
        return null;
    }

    $intent = $input['intent'] ?? 'next_step';
    $maxWords = $mode === 'bubble' ? 35 : 60;

    $systemPrompt = "You are Panda Coach for Goodwill Care Academy.\\n"
        . "Rules: neuroinclusive, low stimulation, no pressure, no guilt, no diagnosis, one suggestion at a time.\\n"
        . "Use simple supportive language. Keep response short and predictable.\\n"
        . "Return ONLY JSON with keys: message, mood, animation_state, suggested_cta, should_speak.";

    $context = [
        'intent' => $intent,
        'learner_name' => $input['learner_name'] ?? 'Learner',
        'age_band' => $input['age_band'] ?? 'age_20_40',
        'route' => $input['route'] ?? '/dashboard',
        'chapter_title' => $input['chapter_title'] ?? null,
        'level_title' => $input['level_title'] ?? null,
        'lesson_title' => $input['lesson_title'] ?? null,
        'recommended_action' => $input['recommended_action'] ?? null,
        'frustration_band' => coach_frustration_band((int) ($input['frustration_score'] ?? 0)),
        'sensory_mode' => $input['sensory_mode'] ?? 'calm',
        'max_words' => $maxWords,
        'mode' => $mode
    ];

    $userPrompt = "Generate a safe coach message for this context:\\n" . json_encode($context, JSON_UNESCAPED_UNICODE);

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . urlencode($apiKey);
    $payload = [
        'system_instruction' => [
            'parts' => [
                ['text' => $systemPrompt]
            ]
        ],
        'contents' => [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => $userPrompt]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.4,
            'maxOutputTokens' => 200
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode < 200 || $httpCode >= 300 || !is_string($response)) {
        return null;
    }

    $decoded = json_decode($response, true);
    $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? null;
    if (!is_string($text)) {
        return null;
    }

    return coach_extract_json_object($text);
}

function coach_build_visual_state(string $intent, int $frustrationScore): array
{
    $mood = 'calm';
    $animation = 'idle';

    if ($intent === 'completion_celebration') {
        $mood = 'celebrate';
        $animation = 'celebrate_soft';
    } elseif (in_array($intent, ['frustration_support', 'break_suggestion'], true)) {
        $mood = 'gentle';
        $animation = 'breathe';
    } elseif (in_array($intent, ['navigation_help', 'next_step', 'resume_path'], true)) {
        $mood = 'encouraging';
        $animation = 'nod';
    } elseif ($intent === 'welcome') {
        $mood = 'happy';
        $animation = 'wave';
    }

    if ($frustrationScore >= 9) {
        $mood = 'resting';
        $animation = 'breathe';
    }

    return ['mood' => $mood, 'animation_state' => $animation];
}

function coach_generate_message(PDO $pdo, int $userId, array $input): array
{
    $profile = coach_get_or_create_profile($pdo, $userId);
    $state = coach_get_or_create_state($pdo, $userId);
    $user = coach_get_user_snapshot($pdo, $userId);

    $intent = (string) ($input['intent'] ?? 'next_step');
    $mode = (string) ($input['mode'] ?? 'bubble');
    $mode = in_array($mode, ['bubble', 'panel', 'voice'], true) ? $mode : 'bubble';

    $frustrationScore = isset($input['frustration_score'])
        ? coach_clamp_int($input['frustration_score'], 0, 12)
        : coach_clamp_int((int) ($state['frustration_score'] ?? 0), 0, 12);

    $recommendation = $input['recommended_action'] ?? null;
    if (!$recommendation || !is_array($recommendation)) {
        $recommendation = coach_get_recommendation($pdo, $userId, [
            'route' => $input['route'] ?? ($state['last_route'] ?? '/dashboard'),
            'frustration_score' => $frustrationScore
        ]);
    }

    $modelInput = [
        'intent' => $intent,
        'route' => $input['route'] ?? ($state['last_route'] ?? '/dashboard'),
        'chapter_title' => $input['chapter_title'] ?? null,
        'level_title' => $input['level_title'] ?? null,
        'lesson_title' => $input['lesson_title'] ?? null,
        'frustration_score' => $frustrationScore,
        'age_band' => coach_validate_age_band($input['age_band'] ?? ($profile['age_band'] ?? 'age_20_40')),
        'sensory_mode' => coach_validate_sensory_mode($input['sensory_mode'] ?? ($profile['sensory_mode'] ?? 'calm')),
        'learner_name' => $user['name'] ?? 'Learner',
        'recommended_action' => $recommendation
    ];

    $maxWords = $mode === 'bubble' ? 35 : 60;
    $llm = coach_call_gemini($modelInput, $mode);
    $defaultMessage = coach_default_message([
        'intent' => $intent,
        'age_band' => $modelInput['age_band']
    ]);

    $message = $llm['message'] ?? $defaultMessage;
    $message = coach_sanitize_text((string) $message);
    if ($message === '') {
        $message = $defaultMessage;
    }
    $message = coach_limit_words($message, $maxWords);

    $visual = coach_build_visual_state($intent, $frustrationScore);
    $mood = $llm['mood'] ?? $visual['mood'];
    $animation = $llm['animation_state'] ?? $visual['animation_state'];

    $allowedMoods = ['calm', 'happy', 'encouraging', 'thinking', 'gentle', 'celebrate', 'resting'];
    if (!in_array($mood, $allowedMoods, true)) {
        $mood = $visual['mood'];
    }

    $allowedAnimations = ['idle', 'listening', 'speaking', 'wave', 'nod', 'celebrate_soft', 'breathe'];
    if (!in_array($animation, $allowedAnimations, true)) {
        $animation = $visual['animation_state'];
    }

    $shouldSpeak = false;
    if ($mode === 'voice') {
        $voiceEnabled = (int) ($profile['voice_enabled'] ?? 0) === 1;
        $coachEnabled = (int) ($profile['coach_enabled'] ?? 1) === 1;
        $sensoryMode = coach_validate_sensory_mode($profile['sensory_mode'] ?? 'calm');
        $shouldSpeak = $voiceEnabled && $coachEnabled && $sensoryMode !== 'quiet';
    }

    $suggestedCta = $llm['suggested_cta'] ?? ($recommendation['recommended_route'] ?? '/dashboard');
    $intervention = coach_intervention_level($frustrationScore);

    coach_upsert_state($pdo, $userId, [
        'last_message_type' => $intent,
        'last_message_text' => $message,
        'last_intervention_level' => $intervention,
        'frustration_score' => $frustrationScore,
        'last_recommendation_json' => json_encode($recommendation, JSON_UNESCAPED_UNICODE),
        'last_seen_at' => coach_now_utc()
    ]);

    $insertIntervention = $pdo->prepare("
        INSERT INTO coach_interventions (
            user_id, intervention_level, trigger_type, trigger_details_json, response_type, response_text
        ) VALUES (?, ?, ?, ?, ?, ?)
    ");
    $insertIntervention->execute([
        $userId,
        $intervention,
        $intent,
        json_encode($modelInput, JSON_UNESCAPED_UNICODE),
        $intent,
        $message
    ]);

    return [
        'message' => $message,
        'intent' => $intent,
        'mood' => $mood,
        'animation_state' => $animation,
        'suggested_cta' => $suggestedCta,
        'should_speak' => $shouldSpeak,
        'intervention_level' => $intervention,
        'frustration_score' => $frustrationScore,
        'frustration_band' => coach_frustration_band($frustrationScore),
        'recommended_action' => $recommendation
    ];
}
