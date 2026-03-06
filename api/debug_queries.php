<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/db_connect.php';

$response = [];

try {
    $stmt = $pdo->query("SELECT id, question, correct_answer FROM quizzes LIMIT 5");
    $response['quizzes'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $pdo->query("SELECT id, title, LENGTH(content) as content_len FROM lessons LIMIT 5");
    $response['lessons'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $response['status'] = 'success';

} catch (PDOException $e) {
    $response['error'] = 'Database error: ' . $e->getMessage();
} catch (Exception $e) {
    $response['error'] = 'General error: ' . $e->getMessage();
}

echo json_encode($response, JSON_PRETTY_PRINT);
