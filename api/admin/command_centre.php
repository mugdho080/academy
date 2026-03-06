<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';

try {
    $dashboard = [
        'blocking_revenue' => [
            'total_value' => 0,
            'count' => 0,
            'sessions' => []
        ],
        'claims_board' => [
            'draft' => 0,
            'ready' => 0,
            'submitted' => 0,
            'paid' => 0,
            'rejected' => 0
        ],
        'participants_at_risk' => [],
        'money_today' => 0
    ];

    // 1. Blocking Revenue (Unverified Sessions value)
    $stmt = $pdo->query("
        SELECT s.id, s.session_date, (s.duration_minutes / 60) * pli.rate_cap as total_value, p.full_name as participant
        FROM crm_sessions s
        JOIN plan_line_items pli ON s.line_item_id = pli.id
        JOIN participants p ON s.participant_id = p.id
        WHERE s.attendance_status = 'attended' AND s.verified = 0
    ");
    $unverified = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($unverified as $u) {
        $dashboard['blocking_revenue']['total_value'] += (float) $u['total_value'];
        $dashboard['blocking_revenue']['count']++;
        if ($dashboard['blocking_revenue']['count'] <= 5) {
            $dashboard['blocking_revenue']['sessions'][] = $u; // sample list
        }
    }

    // 2. Claims Board
    $stmt = $pdo->query("SELECT status, COUNT(*) as count, SUM((SELECT SUM(amount) FROM claim_lines WHERE claim_id = claims.id)) as total_value FROM claims GROUP BY status");
    $claims = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($claims as $c) {
        $status = $c['status'] ?: 'draft';
        $dashboard['claims_board'][$status] = [
            'count' => (int) $c['count'],
            'value' => (float) $c['total_value']
        ];
    }

    // 3. Participants At Risk
    $stmt = $pdo->query("SELECT id, full_name, ndis_number FROM participants WHERE risk_flag = 1 LIMIT 10");
    $dashboard['participants_at_risk'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Money Today (Paid Claims or Paid Invoices Today)
    $stmt = $pdo->query("
        SELECT SUM((SELECT SUM(amount) FROM claim_lines WHERE claim_id = claims.id)) as money_today 
        FROM claims 
        WHERE status = 'paid' AND DATE(paid_at) = CURDATE()
    ");
    $moneyToday = $stmt->fetchColumn();
    $dashboard['money_today'] = (float) $moneyToday;

    echo json_encode(['success' => true, 'data' => $dashboard]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
