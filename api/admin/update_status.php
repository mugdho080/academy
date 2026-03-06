<?php
// admin/update_status.php
require_once __DIR__ . '/../db_connect.php';

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['user_id']) || !isset($data['status'])) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID and Status required']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
    $stmt->execute([$data['status'], $data['user_id']]);

    echo json_encode(['success' => true]);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Update failed: ' . $e->getMessage()]);
}
?>