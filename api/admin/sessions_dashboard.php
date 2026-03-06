<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';

try {
    $dashboard = [
        'delivered_today' => 0,
        'delivered_this_week' => 0,
        'no_show' => 0,
        'cancelled' => 0,
        'unverified_sessions' => []
    ];

    // 1. Fetch counters
    $stmt = $pdo->query("
        SELECT attendance_status, session_date 
        FROM crm_sessions
    ");
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $today = new DateTime('today');
    $startOfWeek = (new DateTime('monday this week'))->setTime(0, 0);
    $endOfWeek = clone $startOfWeek;
    $endOfWeek->modify('+6 days');

    foreach ($sessions as $s) {
        if ($s['attendance_status'] === 'no_show') {
            $dashboard['no_show']++;
        } elseif ($s['attendance_status'] === 'cancelled') {
            $dashboard['cancelled']++;
        } elseif ($s['attendance_status'] === 'attended') {
            $sDate = new DateTime($s['session_date']);
            if ($sDate->format('Y-m-d') === $today->format('Y-m-d')) {
                $dashboard['delivered_today']++;
            }
            if ($sDate >= $startOfWeek && $sDate <= $endOfWeek) {
                $dashboard['delivered_this_week']++;
            }
        }
    }

    // 2. Fetch unverified sessions (attended but verified=0 or evidence missing)
    $stmt = $pdo->query("
        SELECT s.id, s.session_date, p.full_name as participant, li.code as line_item
        FROM crm_sessions s
        JOIN participants p ON s.participant_id = p.id
        JOIN plan_line_items li ON s.line_item_id = li.id
        WHERE s.attendance_status = 'attended' AND s.verified = 0
        ORDER BY s.session_date ASC
    ");
    $dashboard['unverified_sessions'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $dashboard]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
