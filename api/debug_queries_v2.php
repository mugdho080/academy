<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once __DIR__ . '/db_connect.php';

$response = [];
$response['timestamp'] = time();

try {
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM quizzes");
    $response['quiz_count'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

    $stmt = $pdo->query("SELECT id, question, correct_answer FROM quizzes ORDER BY id DESC LIMIT 5");
    $response['latest_quizzes'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $response['status'] = 'success';
} catch (Exception $e) {
    $response['error'] = $e->getMessage();
}

header('Content-Type: application/json');
echo json_encode($response, JSON_PRETTY_PRINT);
