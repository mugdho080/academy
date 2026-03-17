<?php
// scripts/setup_profile_features.php
require_once __DIR__ . '/../api/db_connect.php';

try {
    $sqls = [
        "ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(512) DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN about_me TEXT DEFAULT NULL"
    ];

    foreach ($sqls as $sql) {
        try {
            $pdo->exec($sql);
            echo "Executed: " . $sql . "\n";
        } catch (PDOException $e) {
            if ($e->getCode() == '42S21') { // Duplicate column
                echo "Skipped (Column exists): " . $sql . "\n";
            } else {
                echo "Error: " . $e->getMessage() . "\n";
            }
        }
    }
    echo "Profile schema update complete.\n";
} catch (PDOException $e) {
    echo "Fatal Error: " . $e->getMessage();
}
