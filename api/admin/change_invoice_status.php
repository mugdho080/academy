<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/InvoiceService.php';

session_start();
$admin = inv_require_admin();
inv_ensure_schema($pdo);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$payload = inv_json_input();
$invoiceId = (int) ($payload['invoice_id'] ?? 0);
$targetStatus = strtolower(trim((string) ($payload['target_status'] ?? '')));
$paymentDate = $payload['payment_date'] ?? null;

if ($invoiceId <= 0 || $targetStatus === '') {
    http_response_code(422);
    echo json_encode(['error' => 'invoice_id and target_status are required']);
    exit;
}

$allowedStatuses = ['draft', 'unpaid', 'paid'];
if (!in_array($targetStatus, $allowedStatuses, true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid target_status']);
    exit;
}

try {
    $pdo->beginTransaction();

    $find = $pdo->prepare("SELECT id, status FROM invoices WHERE id = ? FOR UPDATE");
    $find->execute([$invoiceId]);
    $invoice = $find->fetch(PDO::FETCH_ASSOC);

    if (!$invoice) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Invoice not found']);
        exit;
    }

    $current = strtolower((string) $invoice['status']);
    if ($current === 'sent' || $current === 'overdue') {
        $current = 'unpaid';
    }

    $validTransition = ($current === 'draft' && $targetStatus === 'unpaid')
        || ($current === 'unpaid' && $targetStatus === 'paid')
        || ($current === $targetStatus);

    if (!$validTransition) {
        $pdo->rollBack();
        http_response_code(422);
        echo json_encode(['error' => "Invalid transition {$current} -> {$targetStatus}"]);
        exit;
    }

    $paidAt = null;
    if ($targetStatus === 'paid') {
        $date = inv_validate_date((string) $paymentDate);
        $paidAt = $date ? ($date . ' 00:00:00') : gmdate('Y-m-d H:i:s');
    }

    $update = $pdo->prepare("
        UPDATE invoices
        SET status = ?,
            paid_at = CASE WHEN ? IS NULL THEN paid_at ELSE ? END,
            payment_date = CASE WHEN ? IS NULL THEN payment_date ELSE ? END,
            updated_at = UTC_TIMESTAMP()
        WHERE id = ?
    ");
    $update->execute([
        $targetStatus,
        $paidAt,
        $paidAt,
        $paidAt,
        $paidAt,
        $invoiceId
    ]);

    $pdo->commit();
    echo json_encode([
        'success' => true,
        'invoice_id' => $invoiceId,
        'from' => $current,
        'to' => $targetStatus,
        'updated_by_admin_id' => $admin['user_id'],
        'paid_at' => $paidAt
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Failed to change invoice status', 'details' => $e->getMessage()]);
}
