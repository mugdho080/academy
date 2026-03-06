<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';

$action = $_GET['action'] ?? 'list';
$data = json_decode(file_get_contents("php://input"), true);

try {
    if ($action === 'list') {
        $stmt = $pdo->query("SELECT i.*, p.full_name as participant_name FROM incidents i JOIN participants p ON i.participant_id = p.id WHERE i.status != 'resolved' ORDER BY i.created_at DESC");
        echo json_encode(['success' => true, 'incidents' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

    } elseif ($action === 'flag_risk') {
        $participant_id = $data['participant_id'];
        $risk_flag = $data['risk_flag'] ?? 1;

        $stmt = $pdo->prepare("UPDATE participants SET risk_flag = ? WHERE id = ?");
        $stmt->execute([$risk_flag, $participant_id]);

        echo json_encode(['success' => true, 'message' => 'Risk flag updated']);

    } elseif ($action === 'create') {
        $participant_id = $data['participant_id'];
        $severity = $data['severity'] ?? 'medium';
        $notes = $data['notes'] ?? '';

        $stmt = $pdo->prepare("INSERT INTO incidents (participant_id, severity, status, notes) VALUES (?, ?, 'open', ?)");
        $stmt->execute([$participant_id, $severity, $notes]);

        // Auto-flag participant if severity is high/critical
        if ($severity === 'high' || $severity === 'critical') {
            $pdo->prepare("UPDATE participants SET risk_flag = 1 WHERE id = ?")->execute([$participant_id]);
        }

        echo json_encode(['success' => true, 'incident_id' => $pdo->lastInsertId()]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>