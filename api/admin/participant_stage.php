<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/StageService.php';

if (!isset($_GET['id'])) {
    echo json_encode(['error' => 'Participant ID required']);
    exit;
}

$stageService = new StageService($pdo);
$result = $stageService->evaluateParticipant($_GET['id']);

echo json_encode($result);
?>