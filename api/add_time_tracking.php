<?php
require_once 'db_connect.php';

$queries = [
    "CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        login_at DATETIME NOT NULL,
        logout_at DATETIME NULL,
        total_seconds_active INT DEFAULT 0,
        last_ping_at DATETIME NOT NULL,
        status ENUM('active','closed','expired') DEFAULT 'active',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_session_user_date (user_id, login_at)
    )",
    "CREATE TABLE IF NOT EXISTS time_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        user_id INT NOT NULL,
        context_type ENUM('dashboard','chapter','level','lesson') NOT NULL,
        chapter_id INT NULL,
        level_id INT NULL,
        lesson_id INT NULL,
        start_at DATETIME NOT NULL,
        end_at DATETIME NULL,
        seconds_active INT DEFAULT 0,
        date_key DATE NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_time_user_date (user_id, date_key),
        INDEX idx_time_context (context_type, chapter_id, level_id, lesson_id),
        INDEX idx_time_session (session_id)
    )"
];

foreach ($queries as $query) {
    try {
        $pdo->exec($query);
        echo "Successfully executed: " . substr($query, 0, 50) . "...\n";
    } catch (\PDOException $e) {
        echo "Error executing query: " . $e->getMessage() . "\n";
    }
}
echo "Time tracking schema applied successfully.\n";
?>