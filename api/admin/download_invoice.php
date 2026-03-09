<?php
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/InvoiceService.php';

session_start();
$auth = inv_require_user();
inv_ensure_schema($pdo);

$invoiceId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($invoiceId <= 0) {
    http_response_code(422);
    echo json_encode(['error' => 'Missing or invalid id']);
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

    $isAdmin = ($auth['role'] ?? '') === 'admin';
    $isOwner = (int) ($invoice['user_id'] ?? 0) === (int) $auth['user_id'];
    if (!$isAdmin && !$isOwner) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }

    $pdfPath = (string) ($invoice['pdf_path'] ?? '');
    if ($pdfPath === '') {
        $itemsStmt = $pdo->prepare("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC");
        $itemsStmt->execute([$invoiceId]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
        $company = inv_get_company_settings($pdo);
        $pdfPath = inv_generate_invoice_pdf_file($invoice, $items, $company);
        $update = $pdo->prepare("UPDATE invoices SET pdf_path = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?");
        $update->execute([$pdfPath, $invoiceId]);
    }

    $basename = basename($pdfPath);
    $fullPath = __DIR__ . '/../uploads/invoices/' . $basename;
    if (!is_file($fullPath)) {
        http_response_code(404);
        echo json_encode(['error' => 'PDF file not found on disk']);
        exit;
    }

    header('Content-Type: application/pdf');
    header('Content-Length: ' . filesize($fullPath));
    header('Content-Disposition: attachment; filename="' . $basename . '"');
    readfile($fullPath);
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    header("Content-Type: application/json");
    echo json_encode(['error' => 'Failed to download invoice', 'details' => $e->getMessage()]);
}
