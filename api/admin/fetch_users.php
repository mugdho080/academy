<?php
// admin/fetch_users.php
require_once __DIR__ . '/../db_connect.php';

// In a real app, verify admin session/token here
// For now, we assume the requester is authorized via the admin client

try {
    // Get users and aggregate their active time from activity_log
    $stmt = $pdo->prepare("
        SELECT 
            u.id, 
            u.name, 
            u.email, 
            u.ndis_number, 
            u.role, 
            u.status, 
            u.points,
            (SELECT SUM(seconds_active) FROM activity_log WHERE user_id = u.id) as total_active_seconds
        FROM users u
        WHERE u.role = 'learner'
        ORDER BY u.id DESC
    ");
    $stmt->execute();
    $users = $stmt->fetchAll();

    echo json_encode($users);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch users: ' . $e->getMessage()]);
}
?>