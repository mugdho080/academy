<?php

require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/CoachService.php';

const DASHBOARD_DEFAULT_VIEW = 'default_admin_view';

function dashboard_start_session_if_needed(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
}

function dashboard_require_admin(): array
{
    dashboard_start_session_if_needed();

    if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized. Admin access required.']);
        exit;
    }

    return [
        'user_id' => (int) $_SESSION['user_id'],
        'role' => (string) $_SESSION['role']
    ];
}

function dashboard_json_input(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function dashboard_slug(string $value, string $fallback = DASHBOARD_DEFAULT_VIEW): string
{
    $value = strtolower(trim($value));
    if ($value === '') {
        return $fallback;
    }

    $value = preg_replace('/[^a-z0-9_]+/', '_', $value);
    $value = preg_replace('/_+/', '_', (string) $value);
    $value = trim((string) $value, '_');

    return $value !== '' ? $value : $fallback;
}

function dashboard_week_window(int $offsetWeeks = 0): array
{
    $start = new DateTime('now', new DateTimeZone('UTC'));
    $start->setTime(0, 0, 0);
    $dayOfWeek = (int) $start->format('N');
    $start->modify('-' . ($dayOfWeek - 1) . ' days');

    if ($offsetWeeks !== 0) {
        $start->modify(($offsetWeeks > 0 ? '+' : '') . $offsetWeeks . ' weeks');
    }

    $end = clone $start;
    $end->modify('+7 days');

    return [
        'start' => $start->format('Y-m-d H:i:s'),
        'end' => $end->format('Y-m-d H:i:s')
    ];
}

function dashboard_month_window(int $offsetMonths = 0): array
{
    $start = new DateTime('first day of this month 00:00:00', new DateTimeZone('UTC'));
    if ($offsetMonths !== 0) {
        $start->modify(($offsetMonths > 0 ? '+' : '') . $offsetMonths . ' months');
    }
    $end = clone $start;
    $end->modify('+1 month');

    return [
        'start' => $start->format('Y-m-d H:i:s'),
        'end' => $end->format('Y-m-d H:i:s')
    ];
}

function dashboard_percent_change(float $current, float $previous): float
{
    if ($previous <= 0.0) {
        return $current > 0 ? 100.0 : 0.0;
    }

    return round((($current - $previous) / $previous) * 100, 2);
}

function dashboard_fetch_all(PDO $pdo, string $sql, array $params = []): array
{
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return is_array($rows) ? $rows : [];
    } catch (Throwable $e) {
        return [];
    }
}

function dashboard_fetch_row(PDO $pdo, string $sql, array $params = []): array
{
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : [];
    } catch (Throwable $e) {
        return [];
    }
}

function dashboard_fetch_value(PDO $pdo, string $sql, array $params = [], $default = 0)
{
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $value = $stmt->fetchColumn();
        return $value !== false ? $value : $default;
    } catch (Throwable $e) {
        return $default;
    }
}

function dashboard_table_exists(PDO $pdo, string $table): bool
{
    static $cache = [];

    if (array_key_exists($table, $cache)) {
        return $cache[$table];
    }

    try {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1');
        $stmt->execute([$table]);
        $cache[$table] = (bool) $stmt->fetchColumn();
    } catch (Throwable $e) {
        $cache[$table] = false;
    }

    return $cache[$table];
}

function dashboard_make_layout_item(string $key, int $x, int $y, int $w, int $h, int $minW = 2, int $minH = 2): array
{
    return [
        'i' => $key,
        'x' => $x,
        'y' => $y,
        'w' => $w,
        'h' => $h,
        'minW' => $minW,
        'minH' => $minH
    ];
}

function dashboard_compact_layout_for_columns(array $items, int $cols): array
{
    $cursorX = 0;
    $cursorY = 0;
    $rowHeight = 0;
    $result = [];

    foreach ($items as $item) {
        $w = max(1, min($cols, (int) ($item['w'] ?? 3)));
        $h = max(2, (int) ($item['h'] ?? 3));

        if ($cursorX + $w > $cols) {
            $cursorX = 0;
            $cursorY += max(2, $rowHeight);
            $rowHeight = 0;
        }

        $result[] = [
            'i' => (string) $item['i'],
            'x' => $cursorX,
            'y' => $cursorY,
            'w' => $w,
            'h' => $h,
            'minW' => max(1, min($w, (int) ($item['minW'] ?? 1))),
            'minH' => max(2, (int) ($item['minH'] ?? 2))
        ];

        $cursorX += $w;
        $rowHeight = max($rowHeight, $h);
    }

    return $result;
}

function dashboard_layout_payload_from_lg(array $lgItems): array
{
    return [
        'widgets' => array_values(array_map(static fn(array $item) => (string) $item['i'], $lgItems)),
        'layouts' => [
            'lg' => $lgItems,
            'md' => dashboard_compact_layout_for_columns($lgItems, 8),
            'sm' => dashboard_compact_layout_for_columns($lgItems, 4)
        ],
        'widget_settings' => [
            'users_requiring_attention' => [
                'inactivity_days' => 7
            ],
            'billable_hours' => [
                'date_from' => (new DateTime('now', new DateTimeZone('UTC')))->modify('-30 days')->format('Y-m-d'),
                'date_to' => (new DateTime('now', new DateTimeZone('UTC')))->format('Y-m-d')
            ],
            'user_location_map' => [
                'filters' => [
                    'activity' => 'all',
                    'agreement' => 'all',
                    'age_group' => 'all',
                    'engagement' => 'all',
                    'date_from' => '',
                    'date_to' => ''
                ]
            ],
            'notes_reminders' => [
                'note' => ''
            ]
        ]
    ];
}

function dashboard_preset_layouts(): array
{
    $default = dashboard_layout_payload_from_lg([
        dashboard_make_layout_item('total_learners', 0, 0, 3, 4),
        dashboard_make_layout_item('pending_service_agreements', 3, 0, 3, 4),
        dashboard_make_layout_item('weekly_active_learners', 6, 0, 3, 4),
        dashboard_make_layout_item('unpaid_invoices', 9, 0, 3, 4),

        dashboard_make_layout_item('weekly_learning_hours', 0, 4, 4, 5),
        dashboard_make_layout_item('recently_active_users', 4, 4, 4, 5),
        dashboard_make_layout_item('weekly_target_completion', 8, 4, 4, 5),

        dashboard_make_layout_item('user_location_map', 0, 9, 8, 7, 4, 4),
        dashboard_make_layout_item('achievement_summary', 8, 9, 4, 4),
        dashboard_make_layout_item('audit_activity', 8, 13, 4, 4),

        dashboard_make_layout_item('quick_actions', 0, 16, 6, 4),
        dashboard_make_layout_item('frustration_alerts', 6, 16, 6, 4)
    ]);

    $learnerSupport = dashboard_layout_payload_from_lg([
        dashboard_make_layout_item('users_requiring_attention', 0, 0, 4, 5),
        dashboard_make_layout_item('at_risk_learners', 4, 0, 4, 5),
        dashboard_make_layout_item('pending_service_agreements', 8, 0, 4, 5),
        dashboard_make_layout_item('recently_registered_users', 0, 5, 6, 5),
        dashboard_make_layout_item('recently_active_users', 6, 5, 6, 5),
        dashboard_make_layout_item('learner_quick_search', 0, 10, 3, 4),
        dashboard_make_layout_item('weekly_target_completion', 3, 10, 3, 4),
        dashboard_make_layout_item('learning_time_trend', 6, 10, 6, 4),
        dashboard_make_layout_item('user_location_map', 0, 14, 12, 7, 4, 4)
    ]);

    $finance = dashboard_layout_payload_from_lg([
        dashboard_make_layout_item('draft_invoices', 0, 0, 3, 4),
        dashboard_make_layout_item('unpaid_invoices', 3, 0, 3, 4),
        dashboard_make_layout_item('paid_invoices', 6, 0, 3, 4),
        dashboard_make_layout_item('billable_hours', 9, 0, 3, 4),
        dashboard_make_layout_item('invoice_status_breakdown', 0, 4, 6, 5),
        dashboard_make_layout_item('audit_activity', 6, 4, 6, 5),
        dashboard_make_layout_item('quick_actions', 0, 9, 6, 4),
        dashboard_make_layout_item('notes_reminders', 6, 9, 6, 4)
    ]);

    $engagement = dashboard_layout_payload_from_lg([
        dashboard_make_layout_item('weekly_active_learners', 0, 0, 3, 4),
        dashboard_make_layout_item('weekly_learning_hours', 3, 0, 3, 4),
        dashboard_make_layout_item('learning_time_trend', 6, 0, 6, 4),
        dashboard_make_layout_item('chapter_engagement', 0, 4, 6, 5),
        dashboard_make_layout_item('weekly_target_completion', 6, 4, 3, 5),
        dashboard_make_layout_item('achievement_summary', 9, 4, 3, 5),
        dashboard_make_layout_item('panda_coach_usage', 0, 9, 4, 4),
        dashboard_make_layout_item('recommendation_acceptance', 4, 9, 4, 4),
        dashboard_make_layout_item('at_risk_learners', 8, 9, 4, 4),
        dashboard_make_layout_item('user_location_map', 0, 13, 12, 7, 4, 4)
    ]);

    $compliance = dashboard_layout_payload_from_lg([
        dashboard_make_layout_item('consent_agreement_status', 0, 0, 4, 4),
        dashboard_make_layout_item('pending_service_agreements', 4, 0, 4, 4),
        dashboard_make_layout_item('security_alerts', 8, 0, 4, 4),
        dashboard_make_layout_item('audit_activity', 0, 4, 8, 6),
        dashboard_make_layout_item('backup_system_health', 8, 4, 4, 6),
        dashboard_make_layout_item('user_location_map', 0, 10, 12, 6, 4, 4),
        dashboard_make_layout_item('quick_actions', 0, 16, 6, 4),
        dashboard_make_layout_item('notes_reminders', 6, 16, 6, 4)
    ]);

    return [
        'default_admin_view' => [
            'preset_name' => 'Default Admin View',
            'description' => 'Balanced command center for learners, finance, and operations.',
            'layout_json' => $default
        ],
        'learner_support_view' => [
            'preset_name' => 'Learner Support View',
            'description' => 'Focus on onboarding, engagement, and learner risk triage.',
            'layout_json' => $learnerSupport
        ],
        'finance_view' => [
            'preset_name' => 'Finance View',
            'description' => 'Invoice pipeline and billable operations at a glance.',
            'layout_json' => $finance
        ],
        'engagement_view' => [
            'preset_name' => 'Engagement View',
            'description' => 'Learner activity, progress, and Panda Coach analytics.',
            'layout_json' => $engagement
        ],
        'compliance_view' => [
            'preset_name' => 'Compliance View',
            'description' => 'Agreements, security, and audit readiness.',
            'layout_json' => $compliance
        ]
    ];
}

function dashboard_widget_definitions(): array
{
    return [
        ['widget_key' => 'total_learners', 'title' => 'Total Learners', 'description' => 'Registered, active, pending, and approved learner counts.', 'category' => 'Overview', 'icon' => 'Users', 'default_w' => 3, 'default_h' => 4, 'min_w' => 2, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'TotalLearnersWidget'],
        ['widget_key' => 'new_signups', 'title' => 'New Signups', 'description' => 'This week signups with trend vs last week.', 'category' => 'Overview', 'icon' => 'UserPlus', 'default_w' => 3, 'default_h' => 4, 'min_w' => 2, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'NewSignupsWidget'],
        ['widget_key' => 'weekly_active_learners', 'title' => 'Weekly Active Learners', 'description' => 'Distinct learners active this week vs previous week.', 'category' => 'Overview', 'icon' => 'Activity', 'default_w' => 3, 'default_h' => 4, 'min_w' => 2, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'WeeklyActiveLearnersWidget'],
        ['widget_key' => 'weekly_learning_hours', 'title' => 'Weekly Learning Hours', 'description' => 'Total learner hours this week and trend signal.', 'category' => 'Overview', 'icon' => 'Clock3', 'default_w' => 4, 'default_h' => 5, 'min_w' => 3, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'WeeklyLearningHoursWidget'],
        ['widget_key' => 'platform_completion', 'title' => 'Platform Completion', 'description' => 'Lessons, levels, and quizzes completed.', 'category' => 'Overview', 'icon' => 'CheckCheck', 'default_w' => 4, 'default_h' => 4, 'min_w' => 3, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'PlatformCompletionWidget'],
        ['widget_key' => 'pending_service_agreements', 'title' => 'Pending Service Agreements', 'description' => 'Signed agreements awaiting admin approval.', 'category' => 'Learners', 'icon' => 'FileClock', 'default_w' => 3, 'default_h' => 4, 'min_w' => 3, 'min_h' => 4, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'PendingAgreementsWidget'],
        ['widget_key' => 'recently_registered_users', 'title' => 'Recently Registered Users', 'description' => 'Latest learner registrations and onboarding status.', 'category' => 'Learners', 'icon' => 'UserRoundPlus', 'default_w' => 6, 'default_h' => 5, 'min_w' => 4, 'min_h' => 4, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'RecentlyRegisteredUsersWidget'],
        ['widget_key' => 'recently_active_users', 'title' => 'Recently Active Users', 'description' => 'Latest learner activity with last route context.', 'category' => 'Learners', 'icon' => 'History', 'default_w' => 4, 'default_h' => 5, 'min_w' => 4, 'min_h' => 4, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'RecentlyActiveUsersWidget'],
        ['widget_key' => 'users_requiring_attention', 'title' => 'Users Requiring Attention', 'description' => 'Inactivity, pending onboarding, and learning risks.', 'category' => 'Learners', 'icon' => 'TriangleAlert', 'default_w' => 4, 'default_h' => 5, 'min_w' => 3, 'min_h' => 4, 'configurable' => 1, 'settings_schema' => ['fields' => [['key' => 'inactivity_days', 'label' => 'Inactivity Threshold (Days)', 'type' => 'number', 'default' => 7, 'min' => 1, 'max' => 60]]], 'permissions' => ['admin'], 'component_name' => 'UsersRequiringAttentionWidget'],
        ['widget_key' => 'learner_quick_search', 'title' => 'Learner Quick Search', 'description' => 'Jump directly to participant profiles.', 'category' => 'Learners', 'icon' => 'Search', 'default_w' => 3, 'default_h' => 4, 'min_w' => 2, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'LearnerQuickSearchWidget'],
        ['widget_key' => 'learning_time_trend', 'title' => 'Learning Time Trend', 'description' => 'Daily trend of learning hours.', 'category' => 'Engagement', 'icon' => 'ChartLine', 'default_w' => 6, 'default_h' => 4, 'min_w' => 4, 'min_h' => 4, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'LearningTimeTrendWidget'],
        ['widget_key' => 'chapter_engagement', 'title' => 'Chapter Engagement', 'description' => 'Most used, least used, and drop-off chapters.', 'category' => 'Engagement', 'icon' => 'BookMarked', 'default_w' => 6, 'default_h' => 5, 'min_w' => 4, 'min_h' => 4, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'ChapterEngagementWidget'],
        ['widget_key' => 'weekly_target_completion', 'title' => 'Weekly Target Completion', 'description' => 'Target achievers, near-target, and at-risk learners.', 'category' => 'Engagement', 'icon' => 'Target', 'default_w' => 3, 'default_h' => 5, 'min_w' => 3, 'min_h' => 4, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'WeeklyTargetCompletionWidget'],
        ['widget_key' => 'achievement_summary', 'title' => 'Achievement Summary', 'description' => 'Badges, average points, and rank-up momentum.', 'category' => 'Achievements', 'icon' => 'Award', 'default_w' => 4, 'default_h' => 4, 'min_w' => 3, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'AchievementSummaryWidget'],
        ['widget_key' => 'at_risk_learners', 'title' => 'At-Risk Learners', 'description' => 'Learners showing signs of disengagement.', 'category' => 'Engagement', 'icon' => 'ShieldAlert', 'default_w' => 4, 'default_h' => 4, 'min_w' => 3, 'min_h' => 4, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'AtRiskLearnersWidget'],
        ['widget_key' => 'draft_invoices', 'title' => 'Draft Invoices', 'description' => 'Current draft invoice volume and value.', 'category' => 'Finance', 'icon' => 'FilePenLine', 'default_w' => 3, 'default_h' => 4, 'min_w' => 2, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin', 'finance'], 'component_name' => 'DraftInvoicesWidget'],
        ['widget_key' => 'unpaid_invoices', 'title' => 'Unpaid Invoices', 'description' => 'Unpaid and overdue invoice totals.', 'category' => 'Finance', 'icon' => 'CircleDollarSign', 'default_w' => 3, 'default_h' => 4, 'min_w' => 2, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin', 'finance'], 'component_name' => 'UnpaidInvoicesWidget'],
        ['widget_key' => 'paid_invoices', 'title' => 'Paid Invoices', 'description' => 'Paid invoice totals for current month.', 'category' => 'Finance', 'icon' => 'BadgeCheck', 'default_w' => 3, 'default_h' => 4, 'min_w' => 2, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin', 'finance'], 'component_name' => 'PaidInvoicesWidget'],
        ['widget_key' => 'billable_hours', 'title' => 'Billable Hours', 'description' => 'Hours available for invoicing by date range.', 'category' => 'Finance', 'icon' => 'Calculator', 'default_w' => 3, 'default_h' => 4, 'min_w' => 3, 'min_h' => 3, 'configurable' => 1, 'settings_schema' => ['fields' => [['key' => 'date_from', 'label' => 'Date From', 'type' => 'date', 'default' => ''], ['key' => 'date_to', 'label' => 'Date To', 'type' => 'date', 'default' => '']]], 'permissions' => ['admin', 'finance'], 'component_name' => 'BillableHoursWidget'],
        ['widget_key' => 'invoice_status_breakdown', 'title' => 'Invoice Status Breakdown', 'description' => 'Distribution across draft, unpaid, and paid invoices.', 'category' => 'Finance', 'icon' => 'PieChart', 'default_w' => 6, 'default_h' => 5, 'min_w' => 4, 'min_h' => 4, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin', 'finance'], 'component_name' => 'InvoiceStatusBreakdownWidget'],
        ['widget_key' => 'panda_coach_usage', 'title' => 'Panda Coach Usage', 'description' => 'Interaction volume and usage reach across learners.', 'category' => 'AI / Panda', 'icon' => 'Bot', 'default_w' => 4, 'default_h' => 4, 'min_w' => 3, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'PandaCoachUsageWidget'],
        ['widget_key' => 'frustration_alerts', 'title' => 'Frustration Alerts', 'description' => 'Learners with repeated error and disengagement signals.', 'category' => 'AI / Panda', 'icon' => 'Siren', 'default_w' => 6, 'default_h' => 4, 'min_w' => 4, 'min_h' => 4, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'FrustrationAlertsWidget'],
        ['widget_key' => 'recommendation_acceptance', 'title' => 'Recommendation Acceptance', 'description' => 'How often learners accept AI recommendations.', 'category' => 'AI / Panda', 'icon' => 'ThumbsUp', 'default_w' => 4, 'default_h' => 4, 'min_w' => 3, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'RecommendationAcceptanceWidget'],
        ['widget_key' => 'audit_activity', 'title' => 'Audit Activity', 'description' => 'Recent operational actions for oversight.', 'category' => 'Compliance', 'icon' => 'ClipboardList', 'default_w' => 4, 'default_h' => 4, 'min_w' => 4, 'min_h' => 4, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin', 'compliance'], 'component_name' => 'AuditActivityWidget'],
        ['widget_key' => 'security_alerts', 'title' => 'Security Alerts', 'description' => 'Failed admin logins, suspicious access, and locks.', 'category' => 'Compliance', 'icon' => 'ShieldX', 'default_w' => 4, 'default_h' => 4, 'min_w' => 3, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin', 'super_admin'], 'component_name' => 'SecurityAlertsWidget'],
        ['widget_key' => 'backup_system_health', 'title' => 'Backup / System Health', 'description' => 'Backup recency and API/database health indicators.', 'category' => 'Compliance', 'icon' => 'HardDriveDownload', 'default_w' => 4, 'default_h' => 4, 'min_w' => 3, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin', 'super_admin'], 'component_name' => 'BackupSystemHealthWidget'],
        ['widget_key' => 'consent_agreement_status', 'title' => 'Consent / Agreement Status', 'description' => 'Pending, signed-not-approved, and missing agreements.', 'category' => 'Compliance', 'icon' => 'FileCheck2', 'default_w' => 4, 'default_h' => 4, 'min_w' => 3, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'ConsentAgreementStatusWidget'],
        ['widget_key' => 'user_location_map', 'title' => 'User Location Map', 'description' => 'Clustered learner locations with operational filters.', 'category' => 'Map', 'icon' => 'MapPinned', 'default_w' => 8, 'default_h' => 7, 'min_w' => 4, 'min_h' => 4, 'configurable' => 1, 'settings_schema' => ['fields' => [['key' => 'filters.activity', 'label' => 'Activity Filter', 'type' => 'select', 'default' => 'all', 'options' => [['label' => 'All', 'value' => 'all'], ['label' => 'Active users only', 'value' => 'active'], ['label' => 'Inactive users', 'value' => 'inactive']]], ['key' => 'filters.agreement', 'label' => 'Agreement Filter', 'type' => 'select', 'default' => 'all', 'options' => [['label' => 'All', 'value' => 'all'], ['label' => 'Signed agreement users', 'value' => 'signed'], ['label' => 'Pending approval users', 'value' => 'pending_approval']]]]], 'permissions' => ['admin', 'ops'], 'component_name' => 'UserLocationMapWidget'],
        ['widget_key' => 'quick_actions', 'title' => 'Quick Actions', 'description' => 'Fast navigation to key admin operational screens.', 'category' => 'Utilities', 'icon' => 'Rocket', 'default_w' => 6, 'default_h' => 4, 'min_w' => 4, 'min_h' => 3, 'configurable' => 0, 'settings_schema' => ['fields' => []], 'permissions' => ['admin'], 'component_name' => 'QuickActionsWidget'],
        ['widget_key' => 'notes_reminders', 'title' => 'Notes / Reminders', 'description' => 'Personal dashboard notes for admin follow-up items.', 'category' => 'Utilities', 'icon' => 'NotebookText', 'default_w' => 6, 'default_h' => 4, 'min_w' => 4, 'min_h' => 3, 'configurable' => 1, 'settings_schema' => ['fields' => [['key' => 'note', 'label' => 'Sticky Note', 'type' => 'textarea', 'default' => '']]], 'permissions' => ['admin'], 'component_name' => 'NotesRemindersWidget']
    ];
}

function dashboard_default_layout_for_name(string $dashboardName): array
{
    $presets = dashboard_preset_layouts();
    $key = dashboard_slug($dashboardName, DASHBOARD_DEFAULT_VIEW);

    if (isset($presets[$key])) {
        return $presets[$key]['layout_json'];
    }

    return $presets[DASHBOARD_DEFAULT_VIEW]['layout_json'];
}

function dashboard_ensure_schema(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS dashboard_layouts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            dashboard_name VARCHAR(64) NOT NULL DEFAULT 'default_admin_view',
            is_default TINYINT(1) NOT NULL DEFAULT 0,
            layout_json LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_dashboard_layout_user_name (user_id, dashboard_name),
            INDEX idx_dashboard_layout_user_default (user_id, is_default),
            CONSTRAINT fk_dashboard_layout_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS widget_definitions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            widget_key VARCHAR(128) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NULL,
            category VARCHAR(64) NOT NULL,
            default_w INT NOT NULL DEFAULT 3,
            default_h INT NOT NULL DEFAULT 4,
            min_w INT NOT NULL DEFAULT 2,
            min_h INT NOT NULL DEFAULT 2,
            permissions_json LONGTEXT NULL,
            settings_schema_json LONGTEXT NULL,
            component_name VARCHAR(255) NOT NULL,
            icon VARCHAR(64) NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_widget_key (widget_key)
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS dashboard_presets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            preset_name VARCHAR(64) NOT NULL,
            description TEXT NULL,
            layout_json LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_dashboard_preset_name (preset_name)
        )
    ");

    $widgetUpsert = $pdo->prepare("
        INSERT INTO widget_definitions (
            widget_key, title, description, category, default_w, default_h, min_w, min_h,
            permissions_json, settings_schema_json, component_name, icon, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            description = VALUES(description),
            category = VALUES(category),
            default_w = VALUES(default_w),
            default_h = VALUES(default_h),
            min_w = VALUES(min_w),
            min_h = VALUES(min_h),
            permissions_json = VALUES(permissions_json),
            settings_schema_json = VALUES(settings_schema_json),
            component_name = VALUES(component_name),
            icon = VALUES(icon),
            is_active = VALUES(is_active),
            updated_at = CURRENT_TIMESTAMP
    ");

    foreach (dashboard_widget_definitions() as $widget) {
        $widgetUpsert->execute([
            $widget['widget_key'],
            $widget['title'],
            $widget['description'],
            $widget['category'],
            (int) $widget['default_w'],
            (int) $widget['default_h'],
            (int) $widget['min_w'],
            (int) $widget['min_h'],
            json_encode($widget['permissions'], JSON_UNESCAPED_UNICODE),
            json_encode($widget['settings_schema'], JSON_UNESCAPED_UNICODE),
            $widget['component_name'],
            $widget['icon']
        ]);
    }

    $presetUpsert = $pdo->prepare("
        INSERT INTO dashboard_presets (preset_name, description, layout_json)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            description = VALUES(description),
            layout_json = VALUES(layout_json),
            updated_at = CURRENT_TIMESTAMP
    ");

    foreach (dashboard_preset_layouts() as $key => $preset) {
        $presetUpsert->execute([
            $key,
            $preset['description'],
            json_encode($preset['layout_json'], JSON_UNESCAPED_UNICODE)
        ]);
    }

    $ready = true;
}

function dashboard_visible_widgets_for_role(string $role = 'admin'): array
{
    $widgets = dashboard_widget_definitions();

    return array_values(array_filter($widgets, static function (array $widget) use ($role): bool {
        $permissions = $widget['permissions'] ?? ['admin'];
        if (!is_array($permissions) || !$permissions) {
            return true;
        }

        return in_array($role, $permissions, true) || in_array('admin', $permissions, true);
    }));
}

function dashboard_get_saved_layout(PDO $pdo, int $userId, string $dashboardName): ?array
{
    $dashboardName = dashboard_slug($dashboardName, DASHBOARD_DEFAULT_VIEW);

    $row = dashboard_fetch_row(
        $pdo,
        'SELECT id, dashboard_name, layout_json, is_default, updated_at FROM dashboard_layouts WHERE user_id = ? AND dashboard_name = ? LIMIT 1',
        [$userId, $dashboardName]
    );

    if (!$row) {
        return null;
    }

    $decoded = json_decode((string) ($row['layout_json'] ?? ''), true);
    if (!is_array($decoded)) {
        return null;
    }

    return [
        'id' => (int) $row['id'],
        'dashboard_name' => (string) $row['dashboard_name'],
        'layout_json' => $decoded,
        'is_default' => (int) $row['is_default'] === 1,
        'updated_at' => (string) $row['updated_at']
    ];
}

function dashboard_save_layout(PDO $pdo, int $userId, string $dashboardName, array $layoutJson, bool $isDefault = false): array
{
    $dashboardName = dashboard_slug($dashboardName, DASHBOARD_DEFAULT_VIEW);
    $layoutText = json_encode($layoutJson, JSON_UNESCAPED_UNICODE);

    if (!is_string($layoutText) || $layoutText === '') {
        throw new RuntimeException('Invalid layout payload.');
    }

    $stmt = $pdo->prepare("
        INSERT INTO dashboard_layouts (user_id, dashboard_name, is_default, layout_json)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            is_default = VALUES(is_default),
            layout_json = VALUES(layout_json),
            updated_at = CURRENT_TIMESTAMP
    ");
    $stmt->execute([$userId, $dashboardName, $isDefault ? 1 : 0, $layoutText]);

    $saved = dashboard_get_saved_layout($pdo, $userId, $dashboardName);
    if (!$saved) {
        throw new RuntimeException('Failed to read saved layout.');
    }

    return $saved;
}

function dashboard_reset_layout(PDO $pdo, int $userId, string $dashboardName): array
{
    $dashboardName = dashboard_slug($dashboardName, DASHBOARD_DEFAULT_VIEW);
    $default = dashboard_default_layout_for_name($dashboardName);

    return dashboard_save_layout($pdo, $userId, $dashboardName, $default, $dashboardName === DASHBOARD_DEFAULT_VIEW);
}

function dashboard_load_preset(PDO $pdo, int $userId, string $presetName, string $dashboardName): array
{
    $presetName = dashboard_slug($presetName, DASHBOARD_DEFAULT_VIEW);
    $dashboardName = dashboard_slug($dashboardName, DASHBOARD_DEFAULT_VIEW);

    $presets = dashboard_preset_layouts();
    $layout = $presets[$presetName]['layout_json'] ?? $presets[DASHBOARD_DEFAULT_VIEW]['layout_json'];

    return dashboard_save_layout($pdo, $userId, $dashboardName, $layout, $dashboardName === DASHBOARD_DEFAULT_VIEW);
}

function dashboard_money(float $value): float
{
    return round($value, 2);
}

function dashboard_to_hours(float $seconds): float
{
    return round($seconds / 3600, 2);
}
