<?php
require_once __DIR__ . '/api/db_connect.php';
try {
    $stmt = $pdo->query("SHOW TABLES LIKE 'user_time_logs'");
    $tableExists = $stmt->fetch();
    if ($tableExists) {
        echo "Table user_time_logs exists.\n";
        $stmt = $pdo->query("DESCRIBE user_time_logs");
        print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
    } else {
        echo "Table user_time_logs does NOT exist.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>