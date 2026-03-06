<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=ndis_lms;charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
function forceRecreateTable($pdo, $tableName, $createQuery)
{
    try {
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
        // If "doesn't exist in engine" but tablespace exists, a standard DROP fails. 
        // We can try dropping the table explicitly or discarding tablespace.
        echo "Attempting to drop $tableName...\n";
        try {
            $pdo->exec("DROP TABLE IF EXISTS `$tableName`");
        } catch (Exception $e) {
            echo "Drop error: " . $e->getMessage() . "\n";
        }

        echo "Attempting to create $tableName...\n";
        try {
            $pdo->exec($createQuery);
            echo "$tableName created successfully!\n";
        } catch (Exception $e) {
            echo "Create error: " . $e->getMessage() . "\n";
            if (strpos($e->getMessage(), "Tablespace") !== false) {
                // Orphaned tablespace. Usually DROP TABLE works if we recreate and discard? No, we can't create if tablespace exists.
                // An orphaned .ibd file can be deleted if we do CREATE TABLE ... followed by DISCARD TABLESPACE but CREATE TABLE itself is what failed!
                // Actually if CREATE TABLE fails because .ibd exists, we need to delete the .ibd file physically from XAMPP mysql\data\ndis_lms.
            }
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    } catch (Exception $e) {
        echo "Fatal Error: " . $e->getMessage() . "\n";
    }
}

$userSchema = "CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            ndis_number VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('learner', 'admin') DEFAULT 'learner',
            status ENUM('locked', 'pending', 'active') DEFAULT 'locked',
            points INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )";

forceRecreateTable($pdo, 'users', $userSchema);

try {
    $pdo->exec("INSERT INTO users (name, email, ndis_number, password_hash, role, status)
                VALUES ('Super Admin', 'admin@admin.com', 'ADMIN001', '$2y$12\$GybGioIw9Oo7EAWU6IS5le2kUI2LLAbUGOb8bKC55ealN/NPvk5kG', 'admin', 'active')");
    echo "Inserted admin user.\n";
} catch (Exception $e) {
    echo "Insert error: " . $e->getMessage() . "\n";
}
