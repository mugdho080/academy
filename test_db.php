<?php
require_once __DIR__ . '/api/db_connect.php';

try {
    echo "--- Sessions Check ---\n";
    $stmt = $pdo->query("SELECT * FROM sessions ORDER BY id DESC LIMIT 5");
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($sessions);

    echo "\n--- Time Entries Check ---\n";
    $stmt = $pdo->query("SELECT * FROM time_entries ORDER BY id DESC LIMIT 5");
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($entries);

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}