<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/InvoiceService.php';

session_start();
inv_require_admin();
inv_ensure_schema($pdo);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$payload = inv_json_input();
$invoiceId = (int) ($payload['invoice_id'] ?? 0);
if ($invoiceId <= 0) {
    http_response_code(422);
    echo json_encode(['error' => 'Missing invoice_id']);
    exit;
}

try {
    $invoiceStmt = $pdo->prepare("SELECT * FROM invoices WHERE id = ? LIMIT 1");
    $invoiceStmt->execute([$invoiceId]);
    $invoice = $invoiceStmt->fetch(PDO::FETCH_ASSOC);
    if (!$invoice) {
        http_response_code(404);
        echo json_encode(['error' => 'Invoice not found']);
        exit;
    }

    $itemsStmt = $pdo->prepare("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC");
    $itemsStmt->execute([$invoiceId]);
    $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

    $company = inv_get_company_settings($pdo);
    $pdfPath = inv_generate_invoice_pdf_file($invoice, $items, $company);

    $update = $pdo->prepare("UPDATE invoices SET pdf_path = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?");
    $update->execute([$pdfPath, $invoiceId]);

    echo json_encode([
        'success' => true,
        'invoice_id' => $invoiceId,
        'pdf_path' => $pdfPath
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to generate invoice PDF', 'details' => $e->getMessage()]);
}
