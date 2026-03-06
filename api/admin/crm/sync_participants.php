<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../../db_connect.php';

try {
    $pdo->beginTransaction();

    // Fetch all learners from the users table
    $stmt = $pdo->query("SELECT id, name, ndis_number FROM users WHERE role = 'learner'");
    $learners = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $syncedCount = 0;

    foreach ($learners as $learner) {
        // Check if participant already exists for this user_id
        $checkStmt = $pdo->prepare("SELECT id FROM participants WHERE user_id = ? OR ndis_number = ?");
        $checkStmt->execute([$learner['id'], $learner['ndis_number']]);
        $existing = $checkStmt->fetch();

        if (!$existing) {
            // Insert into participants
            $insertStmt = $pdo->prepare("INSERT INTO participants (user_id, full_name, ndis_number, stage) VALUES (?, ?, ?, 'lead')");
            $insertStmt->execute([$learner['id'], $learner['name'], $learner['ndis_number']]);
            $syncedCount++;
        } else {
            // If they exist but don't have the user_id linked (e.g. created by earlier seeders with same NDIS)
            $updateStmt = $pdo->prepare("UPDATE participants SET user_id = ? WHERE ndis_number = ? AND user_id IS NULL");
            $updateStmt->execute([$learner['id'], $learner['ndis_number']]);
            if ($updateStmt->rowCount() > 0) {
                $syncedCount++;
            }
        }
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => "Synchronized {$syncedCount} participants successfully."]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>