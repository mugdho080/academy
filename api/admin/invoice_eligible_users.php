<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/InvoiceService.php';

session_start();
inv_require_admin();
inv_ensure_schema($pdo);

try {
    $stmt = $pdo->query("
        SELECT
            u.id,
            u.name,
            u.email,
            u.ndis_number,
            u.status,
            sa.signed_at,
            COALESCE(SUM(te.seconds_active), 0) AS lifetime_seconds
        FROM users u
        INNER JOIN (
            SELECT user_id, MAX(signed_at) AS signed_at
            FROM service_agreements
            GROUP BY user_id
        ) sa ON sa.user_id = u.id
        LEFT JOIN time_entries te ON te.user_id = u.id
        WHERE u.role = 'learner'
          AND u.status = 'active'
        GROUP BY u.id, u.name, u.email, u.ndis_number, u.status, sa.signed_at
        ORDER BY u.name ASC
    ");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($users as &$user) {
        $user['id'] = (int) $user['id'];
        $user['lifetime_seconds'] = (int) $user['lifetime_seconds'];
    }
    unset($user);

    echo json_encode([
        'success' => true,
        'count' => count($users),
        'users' => $users
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch eligible users', 'details' => $e->getMessage()]);
}
