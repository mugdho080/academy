<?php
require_once __DIR__ . '/../db_connect.php';

try {
    $sql = "CREATE TABLE IF NOT EXISTS completed_lessons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        lesson_id INT NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (user_id),
        INDEX (lesson_id),
        UNIQUE KEY user_lesson_unique (user_id, lesson_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    $pdo->exec($sql);
    echo "Completed lessons schema created successfully.\n";
} catch (\PDOException $e) {
    echo "Error creating schema: " . $e->getMessage() . "\n";
}
?>