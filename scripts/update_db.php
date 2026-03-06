<?php
// scripts/update_db.php
require_once __DIR__ . '/../api/db_connect.php';

try {
    $sqls = [
        "ALTER TABLE chapters ADD COLUMN icon VARCHAR(255) DEFAULT NULL",
        "ALTER TABLE levels ADD COLUMN video_url VARCHAR(512) DEFAULT NULL",
        "ALTER TABLE lessons ADD COLUMN mini_activity TEXT DEFAULT NULL",
        "ALTER TABLE lessons ADD COLUMN fun_reminder TEXT DEFAULT NULL",
        "ALTER TABLE lessons ADD COLUMN lesson_type VARCHAR(50) DEFAULT 'text'",
        "ALTER TABLE lessons ADD COLUMN structured_content JSON DEFAULT NULL",
        "ALTER TABLE quizzes ADD COLUMN explanation TEXT DEFAULT NULL"
    ];

    foreach ($sqls as $sql) {
        try {
            $pdo->exec($sql);
            echo "Executed: " . substr($sql, 0, 50) . "...\n";
        } catch (PDOException $e) {
            // Ignore "Duplicate column name" error (Code 42S21)
            if ($e->getCode() == '42S21') {
                echo "Skipped (Column exists): " . substr($sql, 0, 50) . "...\n";
            } else {
                echo "Error: " . $e->getMessage() . "\n";
            }
        }
    }
    echo "Database schema update complete.\n";

} catch (PDOException $e) {
    echo "Fatal Error: " . $e->getMessage();
}
