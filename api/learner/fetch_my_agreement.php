<?php
header("Content-Type: application/json");
if (!isset($pdo)) {
    require_once __DIR__ . '/../db_connect.php';
}

// In a real app, we'd use session user_id. For now, matching the existing pattern of passing user_id
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
        // Prepend uploads path for frontend image loading
        if ($agreement['signature_data']) {
            $agreement['signature_url'] = '/uploads/signatures/' . $agreement['signature_data'];
        }
        echo json_encode($agreement);
    } else {
        echo json_encode(['error' => 'No agreement found']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => "Database error: " . $e->getMessage()]);
}
?>