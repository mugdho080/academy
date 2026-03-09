<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/InvoiceService.php';

session_start();
inv_require_admin();
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

    $itemsStmt = $pdo->prepare("
        SELECT *
        FROM invoice_items
        WHERE invoice_id = ?
        ORDER BY id ASC
    ");
    $itemsStmt->execute([$invoiceId]);
    $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

    $sourceStmt = $pdo->prepare("
        SELECT *
        FROM invoice_log_sources
        WHERE invoice_id = ?
        ORDER BY id DESC
    ");
    $sourceStmt->execute([$invoiceId]);
    $sources = $sourceStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($items as &$item) {
        $item['id'] = (int) $item['id'];
        $item['invoice_id'] = (int) $item['invoice_id'];
        $item['quantity_hours'] = (float) $item['quantity_hours'];
        $item['rate'] = (float) $item['rate'];
        $item['amount'] = (float) $item['amount'];
    }
    unset($item);

    foreach ($sources as &$source) {
        $source['id'] = (int) $source['id'];
        $source['invoice_id'] = (int) $source['invoice_id'];
        $source['user_id'] = (int) $source['user_id'];
        $source['total_seconds_included'] = (int) $source['total_seconds_included'];
        $source['summary_json'] = $source['summary_json'] ? json_decode($source['summary_json'], true) : null;
    }
    unset($source);

    $invoice['id'] = (int) $invoice['id'];
    $invoice['user_id'] = $invoice['user_id'] !== null ? (int) $invoice['user_id'] : null;
    $invoice['subtotal'] = (float) $invoice['subtotal'];
    $invoice['total'] = (float) $invoice['total'];
    $invoice['total_hours'] = (float) $invoice['total_hours'];
    $invoice['total_seconds_raw'] = (int) $invoice['total_seconds_raw'];

    echo json_encode([
        'success' => true,
        'invoice' => $invoice,
        'items' => $items,
        'log_sources' => $sources,
        'company_settings' => inv_get_company_settings($pdo)
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch invoice detail', 'details' => $e->getMessage()]);
}
