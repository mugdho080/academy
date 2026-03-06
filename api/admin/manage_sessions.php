<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);
$action = $_GET['action'] ?? 'read';

$adminId = $data['admin_id'] ?? null;

try {
    if ($action === 'create') {
        $participant_id = $data['participant_id'];
        $line_item_id = $data['line_item_id'];
        $session_date = $data['session_date'];
        $duration = $data['duration_minutes'];
        $status = $data['attendance_status'] ?? 'attended';

        $stmt = $pdo->prepare("INSERT INTO crm_sessions (participant_id, line_item_id, session_date, duration_minutes, attendance_status) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$participant_id, $line_item_id, $session_date, $duration, $status]);
        $sessionId = $pdo->lastInsertId();

        $auditStmt = $pdo->prepare("INSERT INTO audit_logs (user_id, entity_type, entity_id, action, after_json) VALUES (?, 'session', ?, 'create', ?)");
        $auditStmt->execute([$adminId, $sessionId, json_encode($data)]);

        echo json_encode(['success' => true, 'session_id' => $sessionId]);

    } elseif ($action === 'verify' || $action === 'evidence') {
        // Submit evidence and mark verified
        $session_id = $data['session_id'];
        $note = $data['session_note'];
        $attendance = $data['attendance_confirmation'] ?? 1;
        $outcome = $data['outcome_summary'] ?? '';

        // Insert evidence
        $stmt = $pdo->prepare("INSERT INTO evidence (session_id, session_note, attendance_confirmation, outcome_summary) VALUES (?, ?, ?, ?)");
        $stmt->execute([$session_id, $note, $attendance, $outcome]);

        // Mark session verified
        $stmt = $pdo->prepare("UPDATE crm_sessions SET verified = 1, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$session_id]);

        $auditStmt = $pdo->prepare("INSERT INTO audit_logs (user_id, entity_type, entity_id, action, after_json) VALUES (?, 'session', ?, 'verify', ?)");
        $auditStmt->execute([$adminId, $session_id, json_encode(['verified' => 1])]);

        echo json_encode(['success' => true, 'message' => 'Session verified with evidence.']);

    } elseif ($action === 'read') {
        $stmt = $pdo->query("SELECT s.*, p.full_name as participant, pli.code as line_item, e.id as evidence_id FROM crm_sessions s JOIN participants p ON s.participant_id = p.id JOIN plan_line_items pli ON s.line_item_id = pli.id LEFT JOIN evidence e ON s.id = e.session_id ORDER BY s.session_date DESC LIMIT 50");
        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'sessions' => $sessions]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
