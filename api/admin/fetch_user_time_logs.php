<?php
// admin/fetch_user_time_logs.php
require_once __DIR__ . '/../db_connect.php';

$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;
$startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
$endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;

if (!$userId || !$startDate || !$endDate) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id, start_date, and end_date are required']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT 
            chunk_start, 
            chunk_end, 
            TIMESTAMPDIFF(SECOND, chunk_start, chunk_end) as duration_seconds 
        FROM activity_chunks 
        WHERE user_id = ? AND DATE(chunk_start) >= ? AND DATE(chunk_start) <= ? 
        ORDER BY chunk_start DESC
    ");
    $stmt->execute([$userId, $startDate, $endDate]);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'logs' => $logs]);

} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>