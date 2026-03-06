<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';

$action = $_GET['action'] ?? 'missing';

try {
    if ($action === 'missing') {
        // Find participants who have NO signed agreement
        $stmt = $pdo->query("
            SELECT p.id, p.full_name, p.ndis_number 
            FROM participants p
            LEFT JOIN crm_service_agreements a ON p.id = a.participant_id
            WHERE a.id IS NULL OR a.signed_at IS NULL
        ");
        $missingAgreements = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Find participants who have NO signed consent
        $stmt = $pdo->query("
            SELECT p.id, p.full_name, p.ndis_number 
            FROM participants p
            LEFT JOIN consents c ON p.id = c.participant_id AND c.signed = 1
            WHERE c.id IS NULL
        ");
        $missingConsents = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'missing_agreements' => $missingAgreements, 'missing_consents' => $missingConsents]);

    } elseif ($action === 'upload_agreement') {
        // Simplified raw payload handler for simulation
        $data = json_decode(file_get_contents("php://input"), true);
        $participant_id = $data['participant_id'];
        $signer_name = $data['signer_name'];
        $pdf_path = $data['pdf_path'] ?? '/uploads/dummy_agreement.pdf';

        $stmt = $pdo->prepare("INSERT INTO crm_service_agreements (participant_id, signed_at, signer_name, pdf_path) VALUES (?, NOW(), ?, ?)");
        $stmt->execute([$participant_id, $signer_name, $pdf_path]);

        $adminId = $data['admin_id'] ?? null;
        $auditStmt = $pdo->prepare("INSERT INTO audit_logs (user_id, entity_type, entity_id, action) VALUES (?, 'agreement', ?, 'upload')");
        $auditStmt->execute([$adminId, $pdo->lastInsertId()]);

        echo json_encode(['success' => true, 'message' => 'Agreement uploaded']);

    } elseif ($action === 'record_consent') {
        $data = json_decode(file_get_contents("php://input"), true);
        $participant_id = $data['participant_id'];
        $consent_type = $data['consent_type'];

        $stmt = $pdo->prepare("INSERT INTO consents (participant_id, consent_type, signed, signed_at) VALUES (?, ?, 1, NOW())");
        $stmt->execute([$participant_id, $consent_type]);

        echo json_encode(['success' => true, 'message' => 'Consent recorded']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>