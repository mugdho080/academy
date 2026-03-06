<?php
require_once __DIR__ . '/../db_connect.php';

try {
    $pdo->beginTransaction();

    // 1. Create 10 Participants
    $names = ['Sarah Jones', 'Michael Chen', 'Emily Davis', 'James Wilson', 'Olivia Brown', 'David Lee', 'Sophia Taylor', 'Liam Martinez', 'Isabella Anderson', 'Noah Thomas'];
    $participants = [];

    foreach ($names as $i => $name) {
        $ndis = 'NDIS' . rand(100000000, 999999999);
        $risk = ($i == 2 || $i == 7) ? 1 : 0; // Emily and Liam at risk
        $stmt = $pdo->prepare("INSERT INTO participants (full_name, ndis_number, stage, risk_flag) VALUES (?, ?, 'active', ?)");
        $stmt->execute([$name, $ndis, $risk]);
        $participants[] = $pdo->lastInsertId();
    }

    // 2. Create Plans & Agreements
    $lineItemIds = [];
    foreach ($participants as $i => $pid) {
        // Only 8 get agreements (2 missing)
        if ($i < 8) {
            $pdo->prepare("INSERT INTO crm_service_agreements (participant_id, signed_at, signer_name, pdf_path) VALUES (?, NOW(), ?, '/uploads/doc.pdf')")->execute([$pid, $names[$i]]);
        }

        // Plans for everyone
        $stmt = $pdo->prepare("INSERT INTO plans (participant_id, start_date, end_date) VALUES (?, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), DATE_ADD(CURDATE(), INTERVAL 10 MONTH))");
        $stmt->execute([$pid]);
        $planId = $pdo->lastInsertId();

        // Line item for the plan
        $stmt = $pdo->prepare("INSERT INTO plan_line_items (plan_id, code, rate_cap, approved_amount, remaining_balance) VALUES (?, '09_008_0116_6_3', 50.00, 5000.00, 4000.00)");
        $stmt->execute([$planId]);
        $lineItemIds[$pid] = $pdo->lastInsertId();
    }

    // 3. Create Sessions & Evidence
    foreach ($participants as $i => $pid) {
        $liId = $lineItemIds[$pid];

        // Good session (verified)
        $pdo->prepare("INSERT INTO crm_sessions (participant_id, line_item_id, session_date, duration_minutes, attendance_status, verified) VALUES (?, ?, CURDATE(), 60, 'attended', 1)")->execute([$pid, $liId]);
        $pdo->prepare("INSERT INTO evidence (session_id, session_note, attendance_confirmation) VALUES (?, 'Great progress today', 1)")->execute([$pdo->lastInsertId()]);

        // Unverified session (Blocking Revenue - Red list)
        if ($i % 2 == 0) { // Half of them have unverified sessions
            $pdo->prepare("INSERT INTO crm_sessions (participant_id, line_item_id, session_date, duration_minutes, attendance_status, verified) VALUES (?, ?, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 120, 'attended', 0)")->execute([$pid, $liId]);
        }
    }

    // 4. Create Claims (For the claims board)
    // 2 Draft, 3 Ready, 2 Submitted, 1 Paid, 2 Rejected
    $statuses = ['draft', 'draft', 'ready', 'ready', 'ready', 'submitted', 'submitted', 'paid', 'rejected', 'rejected'];
    foreach ($participants as $i => $pid) {
        $status = $statuses[$i];
        $paid_at = ($status === 'paid') ? "NOW()" : "NULL";

        $pdo->exec("INSERT INTO claims (participant_id, payer_type, status, paid_at) VALUES ($pid, 'NDIA', '$status', $paid_at)");
        $claimId = $pdo->lastInsertId();

        // Find their verified session
        $stmt = $pdo->query("SELECT id FROM crm_sessions WHERE participant_id = $pid AND verified = 1 LIMIT 1");
        $sessionId = $stmt->fetchColumn();

        if ($sessionId) {
            $pdo->exec("INSERT INTO claim_lines (claim_id, session_id, amount) VALUES ($claimId, $sessionId, 50.00)");
        }
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'message' => "Demo Database Seeded Successfully!"]);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
