<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/InvoiceService.php';

session_start();
inv_require_admin();
inv_ensure_schema($pdo);

$userId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : 0;
if ($userId <= 0) {
    http_response_code(422);
    echo json_encode(['error' => 'Missing or invalid user_id']);
    exit;
}

$status = trim((string) ($_GET['status'] ?? 'all'));
$allowed = ['draft', 'unpaid', 'paid', 'all'];
if (!in_array($status, $allowed, true)) {
    $status = 'all';
}

$where = "user_id = ?";
$params = [$userId];
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
        SELECT id, invoice_number, invoice_date, due_date, status, currency, total, paid_at, pdf_path
        FROM invoices
        WHERE {$where}
        ORDER BY invoice_date DESC, id DESC
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$row) {
        $row['id'] = (int) $row['id'];
        $row['total'] = (float) $row['total'];
    }
    unset($row);

    echo json_encode([
        'success' => true,
        'user_id' => $userId,
        'status' => $status,
        'invoices' => $rows
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch user invoices', 'details' => $e->getMessage()]);
}
