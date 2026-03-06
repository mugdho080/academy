<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/ActivityTrackingService.php';

session_start();

if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized. Admin access required.']);
    exit;
}

if (!isset($_GET['user_id']) || !is_numeric($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid user_id']);
    exit;
}

$targetUserId = (int) $_GET['user_id'];
$today = date('Y-m-d');
$thirtyDaysAgo = date('Y-m-d', strtotime('-30 days'));
$startDate = at_validate_date($_GET['start'] ?? $thirtyDaysAgo, $thirtyDaysAgo);
$endDate = at_validate_date($_GET['end'] ?? $today, $today);

if ($startDate > $endDate) {
    [$startDate, $endDate] = [$endDate, $startDate];
}

try {
    at_ensure_tracking_schema($pdo);
    at_expire_stale_sessions($pdo, $targetUserId, 10);

    $summary = at_fetch_time_summary($pdo, $targetUserId, $startDate, $endDate);
    $summary['range'] = ['start' => $startDate, 'end' => $endDate];
    $summary['user_id'] = $targetUserId;

    echo json_encode($summary);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to fetch admin time summary',
        'details' => $e->getMessage()
    ]);
}
