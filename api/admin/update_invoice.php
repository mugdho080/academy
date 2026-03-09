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
if ($invoiceId <= 0) {
    http_response_code(422);
    echo json_encode(['error' => 'Missing invoice_id']);
    exit;
}

$invoiceNumber = trim((string) ($payload['invoice_number'] ?? ''));
$participantName = trim((string) ($payload['participant_name'] ?? ''));
$participantNdis = trim((string) ($payload['participant_ndis_number'] ?? ''));
$invoiceDate = inv_validate_date($payload['invoice_date'] ?? null);
$dueDate = inv_validate_date($payload['due_date'] ?? null);
$dateFrom = inv_validate_date($payload['date_from'] ?? null);
$dateTo = inv_validate_date($payload['date_to'] ?? null);
$currency = strtoupper(trim((string) ($payload['currency'] ?? 'AUD')));
$notes = trim((string) ($payload['notes'] ?? ''));
$paymentReference = trim((string) ($payload['payment_reference'] ?? ''));
$paymentInstructionCode = trim((string) ($payload['payment_instruction_code'] ?? ''));
$totalSecondsRaw = isset($payload['total_seconds_raw']) ? max(0, (int) $payload['total_seconds_raw']) : null;

$items = $payload['items'] ?? [];
if (!is_array($items) || count($items) === 0) {
    http_response_code(422);
    echo json_encode(['error' => 'At least one invoice item is required']);
    exit;
}
if ($invoiceNumber === '' || $participantName === '' || $participantNdis === '' || !$invoiceDate || !$dueDate || !$dateFrom || !$dateTo) {
    http_response_code(422);
    echo json_encode(['error' => 'invoice_number, participant fields, invoice_date, due_date, date_from, date_to are required']);
    exit;
}

try {
    $pdo->beginTransaction();

    $existsStmt = $pdo->prepare("SELECT id FROM invoices WHERE id = ? FOR UPDATE");
    $existsStmt->execute([$invoiceId]);
    if (!$existsStmt->fetch(PDO::FETCH_ASSOC)) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Invoice not found']);
        exit;
    }

    $updateInvoice = $pdo->prepare("
        UPDATE invoices
        SET invoice_number = ?,
            participant_name = ?,
            participant_ndis_number = ?,
            invoice_date = ?,
            due_date = ?,
            date_from = ?,
            date_to = ?,
            currency = ?,
            notes = ?,
            payment_reference = ?,
            payment_instruction_code = ?,
            updated_at = UTC_TIMESTAMP()
        WHERE id = ?
    ");
    $updateInvoice->execute([
        $invoiceNumber,
        $participantName,
        $participantNdis,
        $invoiceDate,
        $dueDate,
        $dateFrom,
        $dateTo,
        $currency,
        $notes,
        $paymentReference,
        $paymentInstructionCode,
        $invoiceId
    ]);

    $deleteItems = $pdo->prepare("DELETE FROM invoice_items WHERE invoice_id = ?");
    $deleteItems->execute([$invoiceId]);

    $insertItem = $pdo->prepare("
        INSERT INTO invoice_items (
            invoice_id,
            service_date_from,
            service_date_to,
            line_item_code,
            line_item_description,
            quantity_hours,
            rate,
            amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");

    foreach ($items as $item) {
        $lineCode = trim((string) ($item['line_item_code'] ?? ''));
        $lineDescription = trim((string) ($item['line_item_description'] ?? ''));
        $serviceFrom = inv_validate_date($item['service_date_from'] ?? $dateFrom, $dateFrom);
        $serviceTo = inv_validate_date($item['service_date_to'] ?? $dateTo, $dateTo);
        $qty = max(0, round((float) ($item['quantity_hours'] ?? 0), 2));
        $rate = max(0, inv_money((float) ($item['rate'] ?? 0)));
        $amount = inv_money(isset($item['amount']) ? (float) $item['amount'] : ($qty * $rate));

        if ($lineCode === '' || $lineDescription === '') {
            $pdo->rollBack();
            http_response_code(422);
            echo json_encode(['error' => 'Each line item requires code and description']);
            exit;
        }

        $insertItem->execute([
            $invoiceId,
            $serviceFrom,
            $serviceTo,
            $lineCode,
            $lineDescription,
            $qty,
            $rate,
            $amount
        ]);
    }

    $totals = inv_recalculate_totals($pdo, $invoiceId);
    if ($totalSecondsRaw !== null) {
        $updateSeconds = $pdo->prepare("
            UPDATE invoices
            SET total_seconds_raw = ?
            WHERE id = ?
        ");
        $updateSeconds->execute([$totalSecondsRaw, $invoiceId]);
    }

    $pdo->commit();
    echo json_encode([
        'success' => true,
        'updated_by_admin_id' => $admin['user_id'],
        'invoice_id' => $invoiceId,
        'totals' => $totals
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ((int) $e->getCode() === 23000) {
        http_response_code(422);
        echo json_encode(['error' => 'Invoice number already exists']);
        exit;
    }
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update invoice', 'details' => $e->getMessage()]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update invoice', 'details' => $e->getMessage()]);
}
