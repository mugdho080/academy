<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/InvoiceService.php';

session_start();
inv_require_admin();
inv_ensure_schema($pdo);

$status = trim((string) ($_GET['status'] ?? ''));
$participant = trim((string) ($_GET['participant'] ?? ''));
$userId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : null;
$invoiceNumber = trim((string) ($_GET['invoice_number'] ?? ''));
$startDate = inv_validate_date($_GET['start'] ?? null);
$endDate = inv_validate_date($_GET['end'] ?? null);
$limit = max(1, min(500, (int) ($_GET['limit'] ?? 200)));

$where = ["1=1"];
$params = [];

if ($status !== '') {
    $allowed = ['draft', 'unpaid', 'paid', 'sent', 'overdue'];
    if (in_array($status, $allowed, true)) {
        $where[] = "i.status = ?";
        $params[] = $status;
    }
}

if ($participant !== '') {
    $where[] = "(i.participant_name LIKE ? OR i.participant_ndis_number LIKE ?)";
    $search = '%' . $participant . '%';
    $params[] = $search;
    $params[] = $search;
}

if ($userId) {
    $where[] = "i.user_id = ?";
    $params[] = $userId;
}

if ($invoiceNumber !== '') {
    $where[] = "i.invoice_number LIKE ?";
    $params[] = '%' . $invoiceNumber . '%';
}

if ($startDate && $endDate) {
    $where[] = "i.invoice_date BETWEEN ? AND ?";
    $params[] = $startDate;
    $params[] = $endDate;
}

$sql = "
    SELECT
        i.*,
        COUNT(ii.id) AS item_count
    FROM invoices i
    LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
    WHERE " . implode(' AND ', $where) . "
    GROUP BY i.id
    ORDER BY i.invoice_date DESC, i.id DESC
    LIMIT {$limit}
";

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totals = [
        'count' => 0,
        'subtotal' => 0.0,
        'total' => 0.0
    ];

    foreach ($rows as &$row) {
        $row['id'] = (int) $row['id'];
        $row['user_id'] = $row['user_id'] !== null ? (int) $row['user_id'] : null;
        $row['item_count'] = (int) $row['item_count'];
        $row['subtotal'] = (float) $row['subtotal'];
        $row['total'] = (float) $row['total'];
        $row['total_hours'] = (float) $row['total_hours'];
        $row['total_seconds_raw'] = (int) $row['total_seconds_raw'];
        $totals['count']++;
        $totals['subtotal'] += (float) $row['subtotal'];
        $totals['total'] += (float) $row['total'];
    }
    unset($row);

    $totals['subtotal'] = inv_money($totals['subtotal']);
    $totals['total'] = inv_money($totals['total']);

    echo json_encode([
        'success' => true,
        'filters' => [
            'status' => $status,
            'participant' => $participant,
            'user_id' => $userId,
            'invoice_number' => $invoiceNumber,
            'start' => $startDate,
            'end' => $endDate
        ],
        'totals' => $totals,
        'invoices' => $rows
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch invoices', 'details' => $e->getMessage()]);
}
