<?php

require_once __DIR__ . '/dashboard_core.php';

function dashboard_get_learners(PDO $pdo, array &$cache): array
{
    if (isset($cache['learners'])) {
        return $cache['learners'];
    }

    if (!dashboard_table_exists($pdo, 'users')) {
        $cache['learners'] = [];
        return $cache['learners'];
    }

    $cache['learners'] = dashboard_fetch_all(
        $pdo,
        "SELECT id, name, email, ndis_number, role, status, points, created_at FROM users WHERE role = 'learner' ORDER BY created_at DESC"
    );

    return $cache['learners'];
}

function dashboard_get_agreements_map(PDO $pdo, array &$cache): array
{
    if (isset($cache['agreements_map'])) {
        return $cache['agreements_map'];
    }

    if (!dashboard_table_exists($pdo, 'service_agreements')) {
        $cache['agreements_map'] = [];
        return $cache['agreements_map'];
    }

    $rows = dashboard_fetch_all(
        $pdo,
        "SELECT sa.user_id, sa.signed_at, sa.address, sa.dob, sa.full_name
         FROM service_agreements sa
         INNER JOIN (
            SELECT user_id, MAX(signed_at) as latest_signed
            FROM service_agreements
            GROUP BY user_id
         ) latest ON latest.user_id = sa.user_id AND latest.latest_signed = sa.signed_at"
    );

    $map = [];
    foreach ($rows as $row) {
        $userId = (int) ($row['user_id'] ?? 0);
        if ($userId <= 0) {
            continue;
        }
        $map[$userId] = $row;
    }

    $cache['agreements_map'] = $map;
    return $cache['agreements_map'];
}

function dashboard_get_activity_map(PDO $pdo, array &$cache): array
{
    if (isset($cache['activity_map'])) {
        return $cache['activity_map'];
    }

    $map = [];
    if (dashboard_table_exists($pdo, 'sessions')) {
        $currentWeek = dashboard_week_window(0);
        $rows = dashboard_fetch_all(
            $pdo,
            "SELECT s.user_id, MAX(s.last_ping_at) as last_active,
                    SUM(CASE WHEN s.login_at >= ? AND s.login_at < ? THEN s.total_seconds_active ELSE 0 END) as week_seconds,
                    SUM(s.total_seconds_active) as total_seconds
             FROM sessions s
             INNER JOIN users u ON u.id = s.user_id AND u.role = 'learner'
             GROUP BY s.user_id",
            [$currentWeek['start'], $currentWeek['end']]
        );

        foreach ($rows as $row) {
            $userId = (int) ($row['user_id'] ?? 0);
            if ($userId <= 0) {
                continue;
            }

            $map[$userId] = [
                'last_active' => $row['last_active'] ?? null,
                'week_seconds' => (int) ($row['week_seconds'] ?? 0),
                'total_seconds' => (int) ($row['total_seconds'] ?? 0)
            ];
        }
    } elseif (dashboard_table_exists($pdo, 'activity_log')) {
        $rows = dashboard_fetch_all(
            $pdo,
            "SELECT user_id, MAX(activity_date) as last_active, SUM(seconds_active) as total_seconds
             FROM activity_log
             GROUP BY user_id"
        );

        foreach ($rows as $row) {
            $userId = (int) ($row['user_id'] ?? 0);
            if ($userId <= 0) {
                continue;
            }

            $map[$userId] = [
                'last_active' => !empty($row['last_active']) ? ($row['last_active'] . ' 00:00:00') : null,
                'week_seconds' => 0,
                'total_seconds' => (int) ($row['total_seconds'] ?? 0)
            ];
        }
    }

    if (dashboard_table_exists($pdo, 'coach_state')) {
        $stateRows = dashboard_fetch_all($pdo, 'SELECT user_id, last_route, engagement_score, frustration_score FROM coach_state');
        foreach ($stateRows as $stateRow) {
            $userId = (int) ($stateRow['user_id'] ?? 0);
            if ($userId <= 0) {
                continue;
            }

            if (!isset($map[$userId])) {
                $map[$userId] = [
                    'last_active' => null,
                    'week_seconds' => 0,
                    'total_seconds' => 0
                ];
            }

            $map[$userId]['last_route'] = $stateRow['last_route'] ?? null;
            $map[$userId]['engagement_score'] = (int) ($stateRow['engagement_score'] ?? 0);
            $map[$userId]['frustration_score'] = (int) ($stateRow['frustration_score'] ?? 0);
        }
    }

    $cache['activity_map'] = $map;
    return $cache['activity_map'];
}

function dashboard_time_ago(?string $datetime): string
{
    if (!$datetime) {
        return 'No recent activity';
    }

    try {
        $now = new DateTime('now', new DateTimeZone('UTC'));
        $dt = new DateTime($datetime, new DateTimeZone('UTC'));
        $seconds = $now->getTimestamp() - $dt->getTimestamp();
        if ($seconds < 60) {
            return 'Just now';
        }
        if ($seconds < 3600) {
            return floor($seconds / 60) . ' min ago';
        }
        if ($seconds < 86400) {
            return floor($seconds / 3600) . ' hr ago';
        }
        return floor($seconds / 86400) . ' days ago';
    } catch (Throwable $e) {
        return 'Unknown';
    }
}

function dashboard_parse_region(?string $address): array
{
    $address = trim((string) $address);
    if ($address === '') {
        return ['suburb' => 'Unknown region', 'postcode' => null];
    }

    preg_match('/(\d{4})(?!.*\d)/', $address, $postcodeMatch);
    $postcode = $postcodeMatch[1] ?? null;

    $suburb = 'Unknown region';
    $clean = preg_replace('/\s+/', ' ', $address);
    $parts = array_values(array_filter(array_map('trim', explode(',', (string) $clean))));
    if (count($parts) >= 2) {
        $suburb = $parts[count($parts) - 2];
    } elseif (!empty($parts[0])) {
        $suburb = $parts[0];
    }

    $suburb = preg_replace('/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i', '', (string) $suburb);
    $suburb = trim((string) $suburb);
    if ($suburb === '') {
        $suburb = 'Unknown region';
    }

    return [
        'suburb' => $suburb,
        'postcode' => $postcode
    ];
}

function dashboard_region_centroid(?string $postcode, int $seed): array
{
    $postcodeInt = (int) $postcode;
    $base = ['lat' => -25.2744, 'lng' => 133.7751];

    if ($postcodeInt >= 2000 && $postcodeInt <= 2999) {
        $base = ['lat' => -33.8688, 'lng' => 151.2093];
    } elseif ($postcodeInt >= 3000 && $postcodeInt <= 3999) {
        $base = ['lat' => -37.8136, 'lng' => 144.9631];
    } elseif ($postcodeInt >= 4000 && $postcodeInt <= 4999) {
        $base = ['lat' => -27.4698, 'lng' => 153.0251];
    } elseif ($postcodeInt >= 5000 && $postcodeInt <= 5799) {
        $base = ['lat' => -34.9285, 'lng' => 138.6007];
    } elseif ($postcodeInt >= 6000 && $postcodeInt <= 6799) {
        $base = ['lat' => -31.9505, 'lng' => 115.8605];
    } elseif ($postcodeInt >= 7000 && $postcodeInt <= 7999) {
        $base = ['lat' => -42.8821, 'lng' => 147.3272];
    } elseif ($postcodeInt >= 800 && $postcodeInt <= 899) {
        $base = ['lat' => -12.4634, 'lng' => 130.8456];
    } elseif ($postcodeInt >= 2600 && $postcodeInt <= 2618) {
        $base = ['lat' => -35.2809, 'lng' => 149.1300];
    }

    $hash = abs(crc32((string) $seed . '-' . (string) $postcode));
    $latJitter = ((($hash % 1000) / 1000) - 0.5) * 0.24;
    $lngJitter = ((((int) floor($hash / 1000) % 1000) / 1000) - 0.5) * 0.24;

    return [
        'lat' => round($base['lat'] + $latJitter, 5),
        'lng' => round($base['lng'] + $lngJitter, 5)
    ];
}

function dashboard_age_group(?string $dob, ?string $coachAgeBand = null): string
{
    if ($dob) {
        try {
            $birth = new DateTime($dob, new DateTimeZone('UTC'));
            $now = new DateTime('now', new DateTimeZone('UTC'));
            $age = (int) $birth->diff($now)->y;
            if ($age < 20) {
                return 'under_20';
            }
            if ($age <= 40) {
                return 'age_20_40';
            }
            return 'age_40_plus';
        } catch (Throwable $e) {
            // Fall through.
        }
    }

    if (in_array($coachAgeBand, ['under_20', 'age_20_40', 'age_40_plus'], true)) {
        return (string) $coachAgeBand;
    }

    return 'unknown';
}

function dashboard_engagement_status(?int $engagementScore, ?int $frustrationScore): string
{
    $engagementScore = (int) ($engagementScore ?? 0);
    $frustrationScore = (int) ($frustrationScore ?? 0);

    if ($frustrationScore >= 8) {
        return 'risk';
    }
    if ($engagementScore >= 7) {
        return 'high';
    }
    if ($engagementScore >= 4) {
        return 'medium';
    }
    return 'low';
}

function dashboard_map_points(PDO $pdo, array $settings, array &$cache): array
{
    $learners = dashboard_get_learners($pdo, $cache);
    $agreements = dashboard_get_agreements_map($pdo, $cache);
    $activity = dashboard_get_activity_map($pdo, $cache);

    $ageBandMap = [];
    if (dashboard_table_exists($pdo, 'learner_profiles')) {
        $rows = dashboard_fetch_all($pdo, 'SELECT user_id, age_band FROM learner_profiles');
        foreach ($rows as $row) {
            $ageBandMap[(int) ($row['user_id'] ?? 0)] = (string) ($row['age_band'] ?? 'unknown');
        }
    }

    $filters = $settings['filters'] ?? [];
    $activityFilter = (string) ($filters['activity'] ?? 'all');
    $agreementFilter = (string) ($filters['agreement'] ?? 'all');
    $ageFilter = (string) ($filters['age_group'] ?? 'all');
    $engagementFilter = (string) ($filters['engagement'] ?? 'all');
    $dateFrom = (string) ($filters['date_from'] ?? '');
    $dateTo = (string) ($filters['date_to'] ?? '');

    $points = [];
    foreach ($learners as $learner) {
        $id = (int) ($learner['id'] ?? 0);
        if ($id <= 0) {
            continue;
        }

        $agreement = $agreements[$id] ?? null;
        $activityInfo = $activity[$id] ?? [];
        $lastActive = $activityInfo['last_active'] ?? null;
        $lastRoute = $activityInfo['last_route'] ?? '/dashboard';
        $engagementScore = isset($activityInfo['engagement_score']) ? (int) $activityInfo['engagement_score'] : null;
        $frustrationScore = isset($activityInfo['frustration_score']) ? (int) $activityInfo['frustration_score'] : null;

        $agreementStatus = 'missing_agreement';
        if ($agreement) {
            $agreementStatus = (($learner['status'] ?? '') === 'pending') ? 'pending_approval' : 'signed';
        }

        $isActive = false;
        if ($lastActive) {
            try {
                $lastActiveDt = new DateTime($lastActive, new DateTimeZone('UTC'));
                $cutoff = new DateTime('now -14 days', new DateTimeZone('UTC'));
                $isActive = $lastActiveDt >= $cutoff;
            } catch (Throwable $e) {
                $isActive = false;
            }
        }

        $ageGroup = dashboard_age_group($agreement['dob'] ?? null, $ageBandMap[$id] ?? null);
        $engagementStatus = dashboard_engagement_status($engagementScore, $frustrationScore);

        if ($activityFilter === 'active' && !$isActive) {
            continue;
        }
        if ($activityFilter === 'inactive' && $isActive) {
            continue;
        }
        if ($agreementFilter === 'signed' && $agreementStatus !== 'signed') {
            continue;
        }
        if ($agreementFilter === 'pending_approval' && $agreementStatus !== 'pending_approval') {
            continue;
        }
        if ($agreementFilter === 'missing' && $agreementStatus !== 'missing_agreement') {
            continue;
        }
        if ($ageFilter !== 'all' && $ageFilter !== $ageGroup) {
            continue;
        }
        if ($engagementFilter !== 'all' && $engagementFilter !== $engagementStatus) {
            continue;
        }
        if ($lastActive && $dateFrom !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom) && substr($lastActive, 0, 10) < $dateFrom) {
            continue;
        }
        if ($lastActive && $dateTo !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo) && substr($lastActive, 0, 10) > $dateTo) {
            continue;
        }

        $region = dashboard_parse_region($agreement['address'] ?? '');
        $coord = dashboard_region_centroid($region['postcode'], $id);

        $points[] = [
            'id' => $id,
            'name' => (string) ($learner['name'] ?? 'Learner'),
            'status' => (string) ($learner['status'] ?? 'locked'),
            'age_group' => $ageGroup,
            'agreement_status' => $agreementStatus,
            'engagement_status' => $engagementStatus,
            'last_active' => $lastActive,
            'last_active_label' => dashboard_time_ago($lastActive),
            'last_route' => $lastRoute,
            'suburb' => $region['suburb'],
            'postcode' => $region['postcode'],
            'lat' => $coord['lat'],
            'lng' => $coord['lng']
        ];
    }

    return [
        'points' => array_values($points),
        'summary' => [
            'total' => count($points),
            'signed' => count(array_filter($points, static fn(array $row): bool => $row['agreement_status'] === 'signed')),
            'pending_approval' => count(array_filter($points, static fn(array $row): bool => $row['agreement_status'] === 'pending_approval')),
            'missing_agreement' => count(array_filter($points, static fn(array $row): bool => $row['agreement_status'] === 'missing_agreement'))
        ],
        'filters' => [
            'activity' => $activityFilter,
            'agreement' => $agreementFilter,
            'age_group' => $ageFilter,
            'engagement' => $engagementFilter,
            'date_from' => $dateFrom,
            'date_to' => $dateTo
        ]
    ];
}

function dashboard_widget_data(PDO $pdo, string $widgetKey, array $settings, array &$cache): array
{
    $currentWeek = dashboard_week_window(0);
    $lastWeek = dashboard_week_window(-1);

    switch ($widgetKey) {
        case 'total_learners': {
            $row = dashboard_fetch_row(
                $pdo,
                "SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as approved
                 FROM users
                 WHERE role = 'learner'"
            );

            return [
                'metrics' => [
                    ['label' => 'Total Registered', 'value' => (int) ($row['total'] ?? 0)],
                    ['label' => 'Active', 'value' => (int) ($row['active'] ?? 0)],
                    ['label' => 'Pending', 'value' => (int) ($row['pending'] ?? 0)],
                    ['label' => 'Approved', 'value' => (int) ($row['approved'] ?? 0)]
                ]
            ];
        }

        case 'new_signups': {
            $current = (int) dashboard_fetch_value(
                $pdo,
                "SELECT COUNT(*) FROM users WHERE role = 'learner' AND created_at >= ? AND created_at < ?",
                [$currentWeek['start'], $currentWeek['end']],
                0
            );
            $previous = (int) dashboard_fetch_value(
                $pdo,
                "SELECT COUNT(*) FROM users WHERE role = 'learner' AND created_at >= ? AND created_at < ?",
                [$lastWeek['start'], $lastWeek['end']],
                0
            );

            return [
                'current' => $current,
                'previous' => $previous,
                'delta_pct' => dashboard_percent_change($current, $previous)
            ];
        }

        case 'weekly_active_learners': {
            if (!dashboard_table_exists($pdo, 'sessions')) {
                return ['current' => 0, 'previous' => 0, 'delta_pct' => 0.0];
            }

            $current = (int) dashboard_fetch_value(
                $pdo,
                "SELECT COUNT(DISTINCT s.user_id)
                 FROM sessions s
                 INNER JOIN users u ON u.id = s.user_id AND u.role = 'learner'
                 WHERE s.login_at >= ? AND s.login_at < ?",
                [$currentWeek['start'], $currentWeek['end']],
                0
            );
            $previous = (int) dashboard_fetch_value(
                $pdo,
                "SELECT COUNT(DISTINCT s.user_id)
                 FROM sessions s
                 INNER JOIN users u ON u.id = s.user_id AND u.role = 'learner'
                 WHERE s.login_at >= ? AND s.login_at < ?",
                [$lastWeek['start'], $lastWeek['end']],
                0
            );

            return [
                'current' => $current,
                'previous' => $previous,
                'delta_pct' => dashboard_percent_change($current, $previous)
            ];
        }

        case 'weekly_learning_hours': {
            if (!dashboard_table_exists($pdo, 'sessions')) {
                return ['hours' => 0.0, 'previous_hours' => 0.0, 'delta_pct' => 0.0];
            }

            $currentSeconds = (float) dashboard_fetch_value(
                $pdo,
                "SELECT COALESCE(SUM(s.total_seconds_active), 0)
                 FROM sessions s
                 INNER JOIN users u ON u.id = s.user_id AND u.role = 'learner'
                 WHERE s.login_at >= ? AND s.login_at < ?",
                [$currentWeek['start'], $currentWeek['end']],
                0
            );
            $previousSeconds = (float) dashboard_fetch_value(
                $pdo,
                "SELECT COALESCE(SUM(s.total_seconds_active), 0)
                 FROM sessions s
                 INNER JOIN users u ON u.id = s.user_id AND u.role = 'learner'
                 WHERE s.login_at >= ? AND s.login_at < ?",
                [$lastWeek['start'], $lastWeek['end']],
                0
            );

            $hours = dashboard_to_hours($currentSeconds);
            $previous = dashboard_to_hours($previousSeconds);

            return [
                'hours' => $hours,
                'previous_hours' => $previous,
                'delta_pct' => dashboard_percent_change($hours, $previous)
            ];
        }

        case 'platform_completion': {
            $lessons = dashboard_table_exists($pdo, 'completed_lessons')
                ? (int) dashboard_fetch_value($pdo, 'SELECT COUNT(*) FROM completed_lessons', [], 0)
                : (dashboard_table_exists($pdo, 'progress')
                    ? (int) dashboard_fetch_value($pdo, 'SELECT COUNT(*) FROM progress WHERE is_completed = 1', [], 0)
                    : 0);
            $levels = dashboard_table_exists($pdo, 'completed_levels')
                ? (int) dashboard_fetch_value($pdo, 'SELECT COUNT(*) FROM completed_levels', [], 0)
                : 0;
            $quizzes = dashboard_table_exists($pdo, 'completed_quizzes')
                ? (int) dashboard_fetch_value($pdo, 'SELECT COUNT(*) FROM completed_quizzes', [], 0)
                : 0;

            return [
                'lessons_completed' => $lessons,
                'levels_completed' => $levels,
                'quizzes_completed' => $quizzes
            ];
        }

        case 'pending_service_agreements': {
            if (!dashboard_table_exists($pdo, 'service_agreements')) {
                return ['count' => 0, 'items' => []];
            }

            $items = dashboard_fetch_all(
                $pdo,
                "SELECT u.id as user_id, u.name, u.ndis_number, u.status, sa.signed_at
                 FROM service_agreements sa
                 INNER JOIN users u ON u.id = sa.user_id
                 WHERE u.role = 'learner' AND u.status = 'pending'
                 ORDER BY sa.signed_at DESC
                 LIMIT 10"
            );

            return ['count' => count($items), 'items' => $items];
        }

        case 'recently_registered_users': {
            $rows = dashboard_fetch_all(
                $pdo,
                "SELECT id as user_id, name, ndis_number, created_at, status
                 FROM users
                 WHERE role = 'learner'
                 ORDER BY created_at DESC
                 LIMIT 12"
            );

            return ['items' => $rows];
        }

        case 'recently_active_users': {
            $learners = dashboard_get_learners($pdo, $cache);
            $activityMap = dashboard_get_activity_map($pdo, $cache);

            $rows = [];
            foreach ($learners as $learner) {
                $id = (int) ($learner['id'] ?? 0);
                if ($id <= 0) {
                    continue;
                }
                $activity = $activityMap[$id] ?? [];
                $rows[] = [
                    'user_id' => $id,
                    'name' => (string) ($learner['name'] ?? 'Learner'),
                    'last_active' => $activity['last_active'] ?? null,
                    'last_active_label' => dashboard_time_ago($activity['last_active'] ?? null),
                    'session_duration_minutes' => round(((float) ($activity['week_seconds'] ?? 0)) / 60, 1),
                    'last_visited_page' => (string) ($activity['last_route'] ?? '/dashboard')
                ];
            }

            usort($rows, static function (array $a, array $b): int {
                return strcmp((string) ($b['last_active'] ?? ''), (string) ($a['last_active'] ?? ''));
            });

            return ['items' => array_slice($rows, 0, 12)];
        }

        case 'users_requiring_attention': {
            $thresholdDays = isset($settings['inactivity_days']) ? max(1, (int) $settings['inactivity_days']) : 7;
            $learners = dashboard_get_learners($pdo, $cache);
            $activityMap = dashboard_get_activity_map($pdo, $cache);

            $failMap = [];
            if (dashboard_table_exists($pdo, 'quiz_attempts')) {
                $failRows = dashboard_fetch_all(
                    $pdo,
                    "SELECT user_id, COUNT(*) as fail_count
                     FROM quiz_attempts
                     WHERE is_correct = 0 AND attempted_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)
                     GROUP BY user_id
                     HAVING COUNT(*) >= 3"
                );
                foreach ($failRows as $failRow) {
                    $failMap[(int) ($failRow['user_id'] ?? 0)] = (int) ($failRow['fail_count'] ?? 0);
                }
            }

            $items = [];
            $threshold = new DateTime('now', new DateTimeZone('UTC'));
            $threshold->modify('-' . $thresholdDays . ' days');

            foreach ($learners as $learner) {
                $id = (int) ($learner['id'] ?? 0);
                $activity = $activityMap[$id] ?? [];
                $reasons = [];

                $lastActiveStr = $activity['last_active'] ?? null;
                if ($lastActiveStr) {
                    try {
                        $lastActive = new DateTime($lastActiveStr, new DateTimeZone('UTC'));
                        if ($lastActive < $threshold) {
                            $reasons[] = 'Inactive over ' . $thresholdDays . ' days';
                        }
                    } catch (Throwable $e) {
                        $reasons[] = 'No recent activity';
                    }
                } else {
                    $reasons[] = 'No recent activity';
                }

                if (($learner['status'] ?? '') === 'pending') {
                    $reasons[] = 'Onboarding pending';
                }
                if (isset($failMap[$id]) && $failMap[$id] >= 3) {
                    $reasons[] = 'Repeated failed lessons';
                }
                if ((int) ($activity['frustration_score'] ?? 0) >= 7) {
                    $reasons[] = 'Frustration risk';
                }

                if (!$reasons) {
                    continue;
                }

                $items[] = [
                    'user_id' => $id,
                    'name' => (string) ($learner['name'] ?? 'Learner'),
                    'ndis_number' => (string) ($learner['ndis_number'] ?? ''),
                    'last_active' => $lastActiveStr,
                    'last_active_label' => dashboard_time_ago($lastActiveStr),
                    'reasons' => $reasons
                ];
            }

            usort($items, static function (array $a, array $b): int {
                return count($b['reasons']) <=> count($a['reasons']);
            });

            return [
                'threshold_days' => $thresholdDays,
                'items' => array_slice($items, 0, 12)
            ];
        }

        case 'learner_quick_search': {
            $rows = dashboard_fetch_all(
                $pdo,
                "SELECT id as user_id, name, ndis_number, status
                 FROM users
                 WHERE role = 'learner'
                 ORDER BY name ASC
                 LIMIT 200"
            );

            return ['items' => $rows];
        }

        case 'learning_time_trend': {
            if (!dashboard_table_exists($pdo, 'sessions')) {
                return ['series' => []];
            }

            $rows = dashboard_fetch_all(
                $pdo,
                "SELECT DATE(login_at) as day_key, COALESCE(SUM(total_seconds_active), 0) as seconds_total
                 FROM sessions
                 WHERE login_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)
                 GROUP BY DATE(login_at)
                 ORDER BY day_key ASC"
            );

            $series = [];
            foreach ($rows as $row) {
                $series[] = [
                    'date' => (string) ($row['day_key'] ?? ''),
                    'hours' => dashboard_to_hours((float) ($row['seconds_total'] ?? 0))
                ];
            }

            return ['series' => $series];
        }

        case 'chapter_engagement': {
            if (!dashboard_table_exists($pdo, 'chapter_mastery')) {
                return ['most_used' => [], 'least_used' => [], 'drop_off' => []];
            }

            $rows = dashboard_fetch_all(
                $pdo,
                "SELECT c.id as chapter_id, c.title,
                        COALESCE(SUM(cm.completed_lessons), 0) as completed_lessons,
                        COALESCE(SUM(cm.chapter_points), 0) as chapter_points
                 FROM chapters c
                 LEFT JOIN chapter_mastery cm ON cm.chapter_id = c.id
                 GROUP BY c.id, c.title"
            );

            usort($rows, static function (array $a, array $b): int {
                return ((int) ($b['completed_lessons'] ?? 0)) <=> ((int) ($a['completed_lessons'] ?? 0));
            });

            $most = array_slice($rows, 0, 3);
            $least = array_slice(array_reverse($rows), 0, 3);
            $drop = array_values(array_filter($rows, static function (array $row): bool {
                return (int) ($row['completed_lessons'] ?? 0) === 0;
            }));

            return ['most_used' => $most, 'least_used' => $least, 'drop_off' => array_slice($drop, 0, 3)];
        }

        case 'weekly_target_completion': {
            if (!dashboard_table_exists($pdo, 'weekly_targets')) {
                return ['achieved' => 0, 'near' => 0, 'far' => 0, 'total' => 0];
            }

            $row = dashboard_fetch_row(
                $pdo,
                "SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN achieved_flag = 1 THEN 1 ELSE 0 END) as achieved,
                    SUM(CASE WHEN achieved_flag = 0 AND target_minutes > 0 AND (progress_minutes / target_minutes) >= 0.7 THEN 1 ELSE 0 END) as near_target,
                    SUM(CASE WHEN achieved_flag = 0 AND target_minutes > 0 AND (progress_minutes / target_minutes) < 0.7 THEN 1 ELSE 0 END) as far_target
                 FROM weekly_targets
                 WHERE week_start <= CURDATE() AND week_end >= CURDATE()"
            );

            return [
                'total' => (int) ($row['total'] ?? 0),
                'achieved' => (int) ($row['achieved'] ?? 0),
                'near' => (int) ($row['near_target'] ?? 0),
                'far' => (int) ($row['far_target'] ?? 0)
            ];
        }

        case 'achievement_summary': {
            $badges = dashboard_table_exists($pdo, 'user_achievements')
                ? (int) dashboard_fetch_value($pdo, 'SELECT COUNT(*) FROM user_achievements WHERE unlocked_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)', [], 0)
                : 0;
            $avgPoints = dashboard_table_exists($pdo, 'user_points')
                ? (float) dashboard_fetch_value($pdo, 'SELECT COALESCE(AVG(total_points), 0) FROM user_points', [], 0)
                : (float) dashboard_fetch_value($pdo, "SELECT COALESCE(AVG(points), 0) FROM users WHERE role = 'learner'", [], 0);
            $rankUps = dashboard_table_exists($pdo, 'points_log')
                ? (int) dashboard_fetch_value($pdo, "SELECT COUNT(*) FROM points_log WHERE action_code LIKE 'rank_%' AND awarded_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)", [], 0)
                : 0;

            return ['badges_unlocked_week' => $badges, 'avg_points' => round($avgPoints, 1), 'rank_up_count' => $rankUps];
        }

        case 'at_risk_learners': {
            $items = [];
            $learners = dashboard_get_learners($pdo, $cache);
            $activityMap = dashboard_get_activity_map($pdo, $cache);

            foreach ($learners as $learner) {
                $id = (int) ($learner['id'] ?? 0);
                $activity = $activityMap[$id] ?? [];
                $flags = [];

                if ((int) ($activity['frustration_score'] ?? 0) >= 6) {
                    $flags[] = 'Frustration flags';
                }

                $lastActive = $activity['last_active'] ?? null;
                if ($lastActive) {
                    try {
                        $date = new DateTime($lastActive, new DateTimeZone('UTC'));
                        $threshold = new DateTime('now -10 days', new DateTimeZone('UTC'));
                        if ($date < $threshold) {
                            $flags[] = 'Inactivity over 10 days';
                        }
                    } catch (Throwable $e) {
                        $flags[] = 'Inactivity pattern';
                    }
                } else {
                    $flags[] = 'No recent activity';
                }

                if (!$flags) {
                    continue;
                }

                $items[] = [
                    'user_id' => $id,
                    'name' => (string) ($learner['name'] ?? 'Learner'),
                    'ndis_number' => (string) ($learner['ndis_number'] ?? ''),
                    'flags' => $flags,
                    'last_active_label' => dashboard_time_ago($lastActive)
                ];
            }

            usort($items, static function (array $a, array $b): int {
                return count($b['flags']) <=> count($a['flags']);
            });

            return ['items' => array_slice($items, 0, 10)];
        }

        case 'draft_invoices': {
            if (!dashboard_table_exists($pdo, 'invoices')) {
                return ['count' => 0, 'total_amount' => 0.0];
            }

            $row = dashboard_fetch_row(
                $pdo,
                "SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_amount
                 FROM invoices
                 WHERE status = 'draft'"
            );

            return [
                'count' => (int) ($row['count'] ?? 0),
                'total_amount' => dashboard_money((float) ($row['total_amount'] ?? 0))
            ];
        }

        case 'unpaid_invoices': {
            if (!dashboard_table_exists($pdo, 'invoices')) {
                return ['count' => 0, 'overdue_count' => 0, 'total_amount' => 0.0];
            }

            $row = dashboard_fetch_row(
                $pdo,
                "SELECT
                    SUM(CASE WHEN status IN ('unpaid', 'sent', 'overdue') THEN 1 ELSE 0 END) as unpaid_count,
                    SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
                    COALESCE(SUM(CASE WHEN status IN ('unpaid', 'sent', 'overdue') THEN total_amount ELSE 0 END), 0) as unpaid_amount
                 FROM invoices"
            );

            return [
                'count' => (int) ($row['unpaid_count'] ?? 0),
                'overdue_count' => (int) ($row['overdue_count'] ?? 0),
                'total_amount' => dashboard_money((float) ($row['unpaid_amount'] ?? 0))
            ];
        }

        case 'paid_invoices': {
            if (!dashboard_table_exists($pdo, 'invoices')) {
                return ['count' => 0, 'total_amount' => 0.0];
            }

            $month = dashboard_month_window(0);
            $row = dashboard_fetch_row(
                $pdo,
                "SELECT COUNT(*) as paid_count, COALESCE(SUM(total_amount), 0) as paid_total
                 FROM invoices
                 WHERE status = 'paid' AND COALESCE(paid_at, updated_at) >= ? AND COALESCE(paid_at, updated_at) < ?",
                [$month['start'], $month['end']]
            );

            return [
                'count' => (int) ($row['paid_count'] ?? 0),
                'total_amount' => dashboard_money((float) ($row['paid_total'] ?? 0))
            ];
        }

        case 'billable_hours': {
            $dateFrom = isset($settings['date_from']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $settings['date_from'])
                ? (string) $settings['date_from']
                : (new DateTime('now -30 days', new DateTimeZone('UTC')))->format('Y-m-d');
            $dateTo = isset($settings['date_to']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $settings['date_to'])
                ? (string) $settings['date_to']
                : (new DateTime('now', new DateTimeZone('UTC')))->format('Y-m-d');

            $hours = 0.0;
            if (dashboard_table_exists($pdo, 'sessions')) {
                $seconds = (float) dashboard_fetch_value(
                    $pdo,
                    "SELECT COALESCE(SUM(s.total_seconds_active), 0)
                     FROM sessions s
                     INNER JOIN users u ON u.id = s.user_id AND u.role = 'learner'
                     WHERE DATE(s.login_at) >= ? AND DATE(s.login_at) <= ?",
                    [$dateFrom, $dateTo],
                    0
                );
                $hours = dashboard_to_hours($seconds);
            }

            return ['date_from' => $dateFrom, 'date_to' => $dateTo, 'hours' => $hours];
        }

        case 'invoice_status_breakdown': {
            if (!dashboard_table_exists($pdo, 'invoices')) {
                return ['draft' => 0, 'unpaid' => 0, 'paid' => 0];
            }

            $row = dashboard_fetch_row(
                $pdo,
                "SELECT
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
                    SUM(CASE WHEN status IN ('unpaid', 'sent', 'overdue') THEN 1 ELSE 0 END) as unpaid_count,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count
                 FROM invoices"
            );

            return [
                'draft' => (int) ($row['draft_count'] ?? 0),
                'unpaid' => (int) ($row['unpaid_count'] ?? 0),
                'paid' => (int) ($row['paid_count'] ?? 0)
            ];
        }

        case 'panda_coach_usage': {
            if (!dashboard_table_exists($pdo, 'coach_events')) {
                return ['active_learners' => 0, 'avg_interactions' => 0.0, 'lessons_using_coach' => 0];
            }

            $row = dashboard_fetch_row(
                $pdo,
                "SELECT
                    COUNT(*) as total_interactions,
                    COUNT(DISTINCT user_id) as active_learners,
                    COUNT(DISTINCT CASE WHEN lesson_id IS NOT NULL THEN lesson_id END) as lessons_using
                 FROM coach_events
                 WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)"
            );

            $active = (int) ($row['active_learners'] ?? 0);
            $interactions = (int) ($row['total_interactions'] ?? 0);

            return [
                'active_learners' => $active,
                'avg_interactions' => $active > 0 ? round($interactions / $active, 2) : 0.0,
                'lessons_using_coach' => (int) ($row['lessons_using'] ?? 0)
            ];
        }

        case 'frustration_alerts': {
            if (!dashboard_table_exists($pdo, 'coach_state')) {
                return ['items' => []];
            }

            $rows = dashboard_fetch_all(
                $pdo,
                "SELECT cs.user_id, cs.frustration_score, cs.engagement_score, cs.last_seen_at, u.name, u.ndis_number
                 FROM coach_state cs
                 INNER JOIN users u ON u.id = cs.user_id
                 WHERE u.role = 'learner' AND cs.frustration_score >= 6
                 ORDER BY cs.frustration_score DESC, cs.last_seen_at DESC
                 LIMIT 12"
            );

            return ['items' => $rows];
        }

        case 'recommendation_acceptance': {
            if (!dashboard_table_exists($pdo, 'coach_recommendations')) {
                return ['total' => 0, 'accepted' => 0, 'acceptance_rate' => 0.0];
            }

            $row = dashboard_fetch_row(
                $pdo,
                "SELECT
                    COUNT(*) as total_count,
                    SUM(CASE WHEN was_accepted = 1 THEN 1 ELSE 0 END) as accepted_count
                 FROM coach_recommendations
                 WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)"
            );

            $total = (int) ($row['total_count'] ?? 0);
            $accepted = (int) ($row['accepted_count'] ?? 0);
            return ['total' => $total, 'accepted' => $accepted, 'acceptance_rate' => $total > 0 ? round(($accepted / $total) * 100, 2) : 0.0];
        }

        case 'audit_activity': {
            $events = [];
            if (dashboard_table_exists($pdo, 'service_agreements')) {
                $events = array_merge($events, dashboard_fetch_all(
                    $pdo,
                    "SELECT 'Service agreement signed' as action_label, COALESCE(sa.full_name, u.name) as subject, sa.signed_at as occurred_at, CONCAT('Learner #', u.id) as detail
                     FROM service_agreements sa
                     INNER JOIN users u ON u.id = sa.user_id
                     ORDER BY sa.signed_at DESC
                     LIMIT 10"
                ));
            }
            if (dashboard_table_exists($pdo, 'invoices')) {
                $events = array_merge($events, dashboard_fetch_all(
                    $pdo,
                    "SELECT CONCAT('Invoice ', UPPER(status)) as action_label, participant_name as subject, updated_at as occurred_at, invoice_number as detail
                     FROM invoices
                     ORDER BY updated_at DESC
                     LIMIT 10"
                ));
            }
            if (dashboard_table_exists($pdo, 'users')) {
                $events = array_merge($events, dashboard_fetch_all(
                    $pdo,
                    "SELECT 'Learner registered' as action_label, name as subject, created_at as occurred_at, CONCAT('Status: ', status) as detail
                     FROM users
                     WHERE role = 'learner'
                     ORDER BY created_at DESC
                     LIMIT 8"
                ));
            }

            usort($events, static function (array $a, array $b): int {
                return strcmp((string) ($b['occurred_at'] ?? ''), (string) ($a['occurred_at'] ?? ''));
            });

            return ['items' => array_slice($events, 0, 15)];
        }

        case 'security_alerts': {
            $failedLogins = 0;
            $suspicious = 0;
            if (dashboard_table_exists($pdo, 'security_events')) {
                $failedLogins = (int) dashboard_fetch_value($pdo, "SELECT COUNT(*) FROM security_events WHERE event_type = 'failed_admin_login' AND occurred_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)", [], 0);
                $suspicious = (int) dashboard_fetch_value($pdo, "SELECT COUNT(*) FROM security_events WHERE event_type = 'suspicious_login' AND occurred_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)", [], 0);
            }
            $lockedAccounts = (int) dashboard_fetch_value($pdo, "SELECT COUNT(*) FROM users WHERE status = 'locked'", [], 0);
            return ['failed_admin_logins' => $failedLogins, 'suspicious_logins' => $suspicious, 'locked_accounts' => $lockedAccounts];
        }

        case 'backup_system_health': {
            $backup = ['last_backup_at' => null, 'backup_status' => 'Unknown'];
            if (dashboard_table_exists($pdo, 'system_backups')) {
                $row = dashboard_fetch_row($pdo, 'SELECT backup_at, status FROM system_backups ORDER BY backup_at DESC LIMIT 1');
                if ($row) {
                    $backup['last_backup_at'] = $row['backup_at'] ?? null;
                    $backup['backup_status'] = $row['status'] ?? 'Unknown';
                }
            }

            $dbOk = true;
            try {
                $pdo->query('SELECT 1');
            } catch (Throwable $e) {
                $dbOk = false;
            }

            return [
                'last_backup_at' => $backup['last_backup_at'],
                'backup_status' => $backup['backup_status'],
                'api_status' => 'Operational',
                'database_status' => $dbOk ? 'Healthy' : 'Unreachable',
                'generated_at' => gmdate('Y-m-d H:i:s')
            ];
        }

        case 'consent_agreement_status': {
            $learners = dashboard_get_learners($pdo, $cache);
            $agreements = dashboard_get_agreements_map($pdo, $cache);
            $pending = 0;
            $signedNotApproved = 0;
            $missing = 0;

            foreach ($learners as $learner) {
                $id = (int) ($learner['id'] ?? 0);
                $hasAgreement = isset($agreements[$id]);
                $status = (string) ($learner['status'] ?? 'locked');

                if (!$hasAgreement) {
                    $missing++;
                    continue;
                }
                if ($status === 'pending') {
                    $signedNotApproved++;
                }
                if ($status !== 'active') {
                    $pending++;
                }
            }

            return ['pending_agreement' => $pending, 'signed_not_approved' => $signedNotApproved, 'missing_agreement' => $missing];
        }

        case 'user_location_map': {
            return dashboard_map_points($pdo, $settings, $cache);
        }

        case 'quick_actions': {
            return [
                'actions' => [
                    ['label' => 'Approve Agreements', 'route' => '/admin', 'type' => 'primary'],
                    ['label' => 'Open Invoicing', 'route' => '/admin/invoicing', 'type' => 'primary'],
                    ['label' => 'Create Draft Invoices', 'route' => '/admin/invoicing', 'type' => 'secondary'],
                    ['label' => 'Open Content Manager', 'route' => '/admin', 'type' => 'secondary'],
                    ['label' => 'Open Company Settings', 'route' => '/admin/company-settings', 'type' => 'secondary']
                ]
            ];
        }

        case 'notes_reminders': {
            return ['note' => (string) ($settings['note'] ?? '')];
        }

        default:
            return ['message' => 'No data handler implemented for this widget yet.'];
    }
}

function dashboard_collect_widget_data(PDO $pdo, array $widgetKeys, array $settingsByWidget): array
{
    $result = [];
    $cache = [];

    foreach ($widgetKeys as $key) {
        $widgetKey = dashboard_slug((string) $key, '');
        if ($widgetKey === '') {
            continue;
        }
        $widgetSettings = $settingsByWidget[$widgetKey] ?? [];
        if (!is_array($widgetSettings)) {
            $widgetSettings = [];
        }

        $result[$widgetKey] = dashboard_widget_data($pdo, $widgetKey, $widgetSettings, $cache);
    }

    return $result;
}
