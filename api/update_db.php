<?php
// api/update_db.php
require_once __DIR__ . '/db_connect.php';

$response = [];

try {
    $sqls = [
        "ALTER TABLE chapters ADD COLUMN icon VARCHAR(255) DEFAULT NULL",
        "ALTER TABLE levels ADD COLUMN video_url VARCHAR(512) DEFAULT NULL",
        "ALTER TABLE lessons ADD COLUMN mini_activity TEXT DEFAULT NULL",
        "ALTER TABLE lessons ADD COLUMN fun_reminder TEXT DEFAULT NULL",
        "ALTER TABLE lessons ADD COLUMN lesson_type VARCHAR(50) DEFAULT 'text'",
        "ALTER TABLE lessons ADD COLUMN structured_content JSON DEFAULT NULL",
        "ALTER TABLE quizzes ADD COLUMN explanation TEXT DEFAULT NULL",
        "CREATE TABLE IF NOT EXISTS user_time_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_id VARCHAR(100) NOT NULL,
            session_start DATETIME NOT NULL,
            session_end DATETIME NOT NULL,
            total_seconds INT NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )",
        "CREATE TABLE IF NOT EXISTS login_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_date DATE NOT NULL,
            login_time DATETIME NOT NULL,
            logout_time DATETIME NULL,
            total_seconds INT NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )",
        "CREATE TABLE IF NOT EXISTS activity_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            activity_date DATE NOT NULL,
            seconds_active INT NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )"
    ];

    foreach ($sqls as $sql) {
        try {
            $pdo->exec($sql);
            $response[] = "Executed: " . substr($sql, 0, 50) . "...";
        } catch (PDOException $e) {
            // Ignore "Duplicate column name" error (Code 42S21) which is SQLSTATE but driver dependent
            // Simplest way is check message
            if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
                $response[] = "Skipped (Column exists): " . substr($sql, 0, 50) . "...";
            } else {
                $response[] = "Error: " . $e->getMessage();
            }
        }
    }
    echo json_encode(['success' => true, 'log' => $response]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
