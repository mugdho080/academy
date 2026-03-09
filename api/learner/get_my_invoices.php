<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/InvoiceService.php';

session_start();
$auth = inv_require_user();
inv_ensure_schema($pdo);

$status = trim((string) ($_GET['status'] ?? 'paid'));
$allowed = ['draft', 'unpaid', 'paid', 'sent', 'overdue', 'all'];
if (!in_array($status, $allowed, true)) {
    $status = 'paid';
}

$where = "user_id = ?";
$params = [$auth['user_id']];
if ($status !== 'all') {
    if ($status === 'unpaid') {
        $where .= " AND status IN ('unpaid','sent','overdue')";
    } else {
        $where .= " AND status = ?";
        $params[] = $status;
    }
}

try {
    $stmt = $pdo->prepare("
        SELECT
            id,
            invoice_number,
            invoice_date,
            due_date,
            date_from,
            date_to,
            status,
            currency,
            subtotal,
            total,
            total_hours,
            total_seconds_raw,
            paid_at,
            payment_date,
            pdf_path,
            notes
        FROM invoices
        WHERE {$where}
        ORDER BY invoice_date DESC, id DESC
        LIMIT 500
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as &$row) {
        $row['id'] = (int) $row['id'];
        $row['subtotal'] = (float) $row['subtotal'];
        $row['total'] = (float) $row['total'];
        $row['total_hours'] = (float) $row['total_hours'];
        $row['total_seconds_raw'] = (int) $row['total_seconds_raw'];
    }
    unset($row);

    echo json_encode([
        'success' => true,
        'status' => $status,
        'invoices' => $rows
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch invoices', 'details' => $e->getMessage()]);
}
