<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=ndis_lms;charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$stmt = $pdo->query("SELECT @@datadir as dir");
$datadir = $stmt->fetch()['dir'];
echo "Datadir: $datadir\n";

$ibdFile = $datadir . 'ndis_lms/users.ibd';
if (file_exists($ibdFile)) {
    echo "Found orphaned $ibdFile. Deleting...\n";
    if (unlink($ibdFile)) {
        echo "Deleted $ibdFile successfully.\n";
    } else {
        echo "Failed to delete $ibdFile.\n";
    }
} else {
    echo "$ibdFile not found.\n";
}

// Now try creating again
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

try {
    $pdo->exec($userSchema);
    echo "users created successfully!\n";

    $pdo->exec("INSERT INTO users (name, email, ndis_number, password_hash, role, status)
                VALUES ('Super Admin', 'admin@admin.com', 'ADMIN001', '$2y$12\$GybGioIw9Oo7EAWU6IS5le2kUI2LLAbUGOb8bKC55ealN/NPvk5kG', 'admin', 'active')");
    echo "Inserted admin user.\n";
} catch (Exception $e) {
    echo "Create error: " . $e->getMessage() . "\n";
}
