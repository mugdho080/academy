<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';

try {
    // 1. Fetch claims
    $stmt = $pdo->query("
        SELECT c.*, p.full_name as participant_name 
        FROM claims c
        JOIN participants p ON c.participant_id = p.id
        ORDER BY c.created_at DESC
    ");
    $claims = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group by status
    $board = [
        'draft' => [],
        'ready' => [],
        'submitted' => [],
        'paid' => [],
        'rejected' => []
    ];

    foreach ($claims as $c) {
        $status = $c['status'];
        if (isset($board[$status])) {
            $board[$status][] = $c;
        } else {
            // Failsafe bucket
            $board['draft'][] = $c;
        }
    }

    echo json_encode(['success' => true, 'board' => $board]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>