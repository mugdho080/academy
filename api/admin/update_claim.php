<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/RulesEngineService.php';

// Endpoint to transition claim status
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['claim_id']) || !isset($data['status'])) {
    echo json_encode(['error' => 'Missing claim_id or status']);
    exit;
}

$claimId = $data['claim_id'];
$newStatus = $data['status']; // draft, ready, submitted, paid, rejected
$adminId = $data['admin_id'] ?? null; // Ideally passed from auth session

try {
    $rulesEngine = new RulesEngineService($pdo);

    // If moving to "ready" or "submitted", must be evaluated GREEN
    if ($newStatus === 'ready' || $newStatus === 'submitted') {
        $evaluation = $rulesEngine->evaluateClaim($claimId);
        if ($evaluation['status'] !== 'GREEN') {
            echo json_encode(['success' => false, 'error' => 'Claim not eligible for submission.', 'reasons' => $evaluation['reasons']]);
            exit;
        }
    }

    // Fetch previous state for audit log
    $stmt = $pdo->prepare("SELECT status FROM claims WHERE id = ?");
    $stmt->execute([$claimId]);
    $oldClaim = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$oldClaim) {
        echo json_encode(['success' => false, 'error' => 'Claim not found']);
        exit;
    }

    // Update claim status
    $stmt = $pdo->prepare("UPDATE claims SET status = ?, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$newStatus, $claimId]);

    // Insert Audit Log manually since no model observers
    $auditStmt = $pdo->prepare("INSERT INTO audit_logs (user_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, 'claim', ?, 'status_update', ?, ?)");
    $auditStmt->execute([
        $adminId,
        $claimId,
        json_encode(['status' => $oldClaim['status']]),
        json_encode(['status' => $newStatus])
    ]);

    echo json_encode(['success' => true, 'message' => "Claim transitioned to {$newStatus}"]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>