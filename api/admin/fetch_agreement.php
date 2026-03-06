<?php
header("Content-Type: application/json");
if (!isset($pdo)) {
    require_once __DIR__ . '/../db_connect.php';
}

$user_id = $_GET['user_id'] ?? null;

if (!$user_id) {
    echo json_encode(['error' => 'User ID required']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM service_agreements WHERE user_id = ? ORDER BY signed_at DESC LIMIT 1");
    $stmt->execute([$user_id]);
    $agreement = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($agreement) {
        echo json_encode($agreement);
    } else {
        echo json_encode(['error' => 'No agreement found']);
    }
} catch (Exception $e) {
    echo json_encode(['error' => "Database error: " . $e->getMessage()]);
}
?>