<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/ActivityTrackingService.php';

session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$userId = (int) $_SESSION['user_id'];

$today = date('Y-m-d');
$thirtyDaysAgo = date('Y-m-d', strtotime('-30 days'));
$startDate = at_validate_date($_GET['start'] ?? $thirtyDaysAgo, $thirtyDaysAgo);
$endDate = at_validate_date($_GET['end'] ?? $today, $today);

if ($startDate > $endDate) {
    [$startDate, $endDate] = [$endDate, $startDate];
}

try {
    at_ensure_tracking_schema($pdo);
    at_expire_stale_sessions($pdo, $userId, 10);

    $summary = at_fetch_time_summary($pdo, $userId, $startDate, $endDate);
    $summary['range'] = ['start' => $startDate, 'end' => $endDate];

    echo json_encode($summary);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to fetch time summary',
        'details' => $e->getMessage()
    ]);
}
