<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';

try {
    // We want the total outstanding (sent + overdue) and aged buckets based on due_date.

    // 1. Mark overdue invoices (if today > due_date and status = sent)
    $pdo->exec("UPDATE invoices SET status = 'overdue' WHERE status = 'sent' AND due_date < CURDATE()");

    // 2. Fetch all outstanding invoices
    $stmt = $pdo->query("SELECT id, due_date, total_amount, status FROM invoices WHERE status IN ('sent', 'overdue')");
    $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $summary = [
        'outstanding_total' => 0,
        'aged_buckets' => [
            '0_7' => 0,
            '8_14' => 0,
            '15_30' => 0,
            '30_plus' => 0
        ]
    ];

    $now = new DateTime('now');

    foreach ($invoices as $inv) {
        $amount = (float) $inv['total_amount'];
        $summary['outstanding_total'] += $amount;

        $dueDate = new DateTime($inv['due_date']);

        // If it's overdue, calculate age
        if ($now > $dueDate) {
            $daysOverdue = $dueDate->diff($now)->days;

            if ($daysOverdue <= 7) {
                $summary['aged_buckets']['0_7'] += $amount;
            } elseif ($daysOverdue <= 14) {
                $summary['aged_buckets']['8_14'] += $amount;
            } elseif ($daysOverdue <= 30) {
                $summary['aged_buckets']['15_30'] += $amount;
            } else {
                $summary['aged_buckets']['30_plus'] += $amount;
            }
        }
    }

    echo json_encode(['success' => true, 'data' => $summary]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>