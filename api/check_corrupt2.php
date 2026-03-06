<?php
$host = '127.0.0.1';
$db = 'ndis_lms';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];
try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    die("Connection failed: " . $e->getMessage());
}

try {
    $stmt = $pdo->query('SHOW TABLES');
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $corrupted = [];
    foreach ($tables as $table) {
        try {
            $pdo->query("SELECT 1 FROM `$table` LIMIT 1");
        } catch (Exception $e) {
            if (strpos($e->getMessage(), "doesn't exist in engine") !== false || strpos($e->getMessage(), "doesn't exist") !== false) {
                $corrupted[] = $table;
            }
        }
    }

    echo "Corrupted tables detected: " . implode(', ', $corrupted) . "\n";

    if (in_array('users', $corrupted)) {
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
        try {
            $pdo->exec("DROP TABLE IF EXISTS users");
        } catch (Exception $e) {
            echo "Failed to drop users: " . $e->getMessage() . "\n";
        }

        $pdo->exec("CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            ndis_number VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('learner', 'admin') DEFAULT 'learner',
            status ENUM('locked', 'pending', 'active') DEFAULT 'locked',
            points INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $pdo->exec("INSERT INTO users (name, email, ndis_number, password_hash, role, status)
            VALUES ('Super Admin', 'admin@admin.com', 'ADMIN001', '$2y$12\$GybGioIw9Oo7EAWU6IS5le2kUI2LLAbUGOb8bKC55ealN/NPvk5kG', 'admin', 'active')");

        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        echo "Recreated users table and inserted Admin.\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
