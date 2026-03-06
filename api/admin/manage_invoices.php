<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);
$action = $_GET['action'] ?? 'update'; // 'create' or 'update'

$adminId = $data['admin_id'] ?? null;

try {
    if ($action === 'create') {
        $participant_id = $data['participant_id'];
        $due_date = $data['due_date'];
        $total_amount = $data['total_amount'];
        $invoice_number = "INV-" . time() . rand(10, 99);

        $stmt = $pdo->prepare("INSERT INTO invoices (participant_id, invoice_number, due_date, status, total_amount) VALUES (?, ?, ?, 'sent', ?)");
        $stmt->execute([$participant_id, $invoice_number, $due_date, $total_amount]);
        $invoiceId = $pdo->lastInsertId();

        $auditStmt = $pdo->prepare("INSERT INTO audit_logs (user_id, entity_type, entity_id, action, after_json) VALUES (?, 'invoice', ?, 'create', ?)");
        $auditStmt->execute([$adminId, $invoiceId, json_encode(['status' => 'sent', 'amount' => $total_amount])]);

        echo json_encode(['success' => true, 'invoice_id' => $invoiceId, 'invoice_number' => $invoice_number]);

    } elseif ($action === 'update') {
        $invoice_id = $data['invoice_id'];
        $new_status = $data['status']; // sent, paid, overdue

        $stmt = $pdo->prepare("SELECT status FROM invoices WHERE id = ?");
        $stmt->execute([$invoice_id]);
        $oldInvoice = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$oldInvoice) {
            echo json_encode(['success' => false, 'error' => 'Invoice not found']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$new_status, $invoice_id]);

        $auditStmt = $pdo->prepare("INSERT INTO audit_logs (user_id, entity_type, entity_id, action, before_json, after_json) VALUES (?, 'invoice', ?, 'status_update', ?, ?)");
        $auditStmt->execute([
            $adminId,
            $invoice_id,
            json_encode(['status' => $oldInvoice['status']]),
            json_encode(['status' => $new_status])
        ]);

        echo json_encode(['success' => true, 'message' => "Invoice updated to {$new_status}"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>