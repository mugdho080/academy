<?php
require_once __DIR__ . '/api/db_connect.php';
try {
    $stmt = $pdo->query("SHOW TABLES LIKE 'login_sessions'");
    $tableExists = $stmt->fetch();
    if ($tableExists) {
        echo "Table login_sessions exists.\n";
    } else {
        echo "Table login_sessions does NOT exist.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>