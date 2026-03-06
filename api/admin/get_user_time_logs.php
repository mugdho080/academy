<?php
// api/admin/get_user_time_logs.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../db_connect.php';

$userId = isset($_GET['user_id']) ? $_GET['user_id'] : null;
$startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
$endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;

if (!$userId) {
    echo json_encode(['success' => false, 'error' => 'user_id is required']);
    exit();
}

try {
    $query = "SELECT l.id, l.session_id, l.session_start, l.session_end, l.total_seconds, u.name, u.email 
              FROM user_time_logs l
              JOIN users u ON l.user_id = u.id
              WHERE l.user_id = ?";
    $params = [$userId];

    if ($startDate && $endDate) {
        $query .= " AND DATE(l.session_start) >= ? AND DATE(l.session_start) <= ?";
        $params[] = $startDate;
        $params[] = $endDate;
    }

    $query .= " ORDER BY l.session_start DESC";

    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalTimeSeconds = 0;
    foreach ($logs as $log) {
        $totalTimeSeconds += (int) $log['total_seconds'];
    }

    echo json_encode([
        'success' => true,
        'logs' => $logs,
        'total_time_seconds' => $totalTimeSeconds
    ]);

} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
?>