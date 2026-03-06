<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../../db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);
$action = $_GET['action'] ?? 'read';

$adminId = $data['admin_id'] ?? 1; // Default to super admin

try {
    if ($action === 'read') {
        $participant_id = $_GET['participant_id'];

        // Fetch participant
        $stmt = $pdo->prepare("SELECT * FROM participants WHERE id = ?");
        $stmt->execute([$participant_id]);
        $participant = $stmt->fetch(PDO::FETCH_ASSOC);

        // Fetch plans
        $stmt = $pdo->prepare("SELECT * FROM plans WHERE participant_id = ? ORDER BY start_date DESC");
        $stmt->execute([$participant_id]);
        $plans = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch login sessions for this specific user linked to participant
        $sessions = [];
        if ($participant['user_id']) {
            $stmt = $pdo->prepare("SELECT * FROM login_sessions WHERE user_id = ? ORDER BY login_time DESC LIMIT 30");
            $stmt->execute([$participant['user_id']]);
            $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        // Fetch line items for those plans
        foreach ($plans as &$plan) {
            $stmt = $pdo->prepare("SELECT * FROM plan_line_items WHERE plan_id = ?");
            $stmt->execute([$plan['id']]);
            $plan['line_items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        echo json_encode(['success' => true, 'participant' => $participant, 'plans' => $plans, 'login_sessions' => $sessions]);

    } elseif ($action === 'update_participant') {
        $id = $data['id'];
        // Allowed mutable fields from UI
        $fields = ['ndis_number', 'plan_type', 'stage', 'risk_flag'];
        $updates = [];
        $values = [];

        foreach ($fields as $f) {
            if (isset($data[$f])) {
                $updates[] = "$f = ?";
                $values[] = $data[$f];
            }
        }

        if (count($updates) > 0) {
            $values[] = $id;
            $stmt = $pdo->prepare("UPDATE participants SET " . implode(", ", $updates) . " WHERE id = ?");
            $stmt->execute($values);

            // Audit Log
            $auditStmt = $pdo->prepare("INSERT INTO audit_logs (user_id, entity_type, entity_id, action, after_json) VALUES (?, 'participant', ?, 'update', ?)");
            $auditStmt->execute([$adminId, $id, json_encode($data)]);
        }

        echo json_encode(['success' => true, 'message' => 'Participant updated']);

    } elseif ($action === 'save_plan') {
        $plan_id = $data['id'] ?? null;
        $participant_id = $data['participant_id'];
        $start_date = $data['start_date'];
        $end_date = $data['end_date'];
        $manager_name = $data['plan_manager_name'] ?? null;
        $manager_email = $data['plan_manager_email'] ?? null;

        if ($plan_id) {
            $stmt = $pdo->prepare("UPDATE plans SET start_date=?, end_date=?, plan_manager_name=?, plan_manager_email=? WHERE id=?");
            $stmt->execute([$start_date, $end_date, $manager_name, $manager_email, $plan_id]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO plans (participant_id, start_date, end_date, plan_manager_name, plan_manager_email) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$participant_id, $start_date, $end_date, $manager_name, $manager_email]);
            $plan_id = $pdo->lastInsertId();
        }

        echo json_encode(['success' => true, 'plan_id' => $plan_id]);

    } elseif ($action === 'save_line_item') {
        $li_id = $data['id'] ?? null;
        $plan_id = $data['plan_id'];
        $code = $data['code'];
        $category = $data['category'] ?? 'Core';
        $rate_cap = $data['rate_cap'] ?? 0;
        $approved_amount = $data['approved_amount'] ?? 0;
        $remaining_balance = $data['remaining_balance'] ?? $approved_amount;

        if ($li_id) {
            $stmt = $pdo->prepare("UPDATE plan_line_items SET code=?, category=?, rate_cap=?, approved_amount=?, remaining_balance=? WHERE id=?");
            $stmt->execute([$code, $category, $rate_cap, $approved_amount, $remaining_balance, $li_id]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO plan_line_items (plan_id, code, category, rate_cap, approved_amount, remaining_balance) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$plan_id, $code, $category, $rate_cap, $approved_amount, $remaining_balance]);
        }

        echo json_encode(['success' => true, 'message' => 'Line item saved']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>