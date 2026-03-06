<?php
require_once __DIR__ . '/db_connect.php';

try {
    // 1. Disable Foreign Keys
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

    // 2. Try to Drop the problematic tables
    echo "Attempting to drop tables...\n";
    try {
        $pdo->exec("DROP TABLE IF EXISTS progress");
        echo "progress dropped\n";
    } catch (Exception $e) {
        echo "Drop progress failed: " . $e->getMessage() . "\n";
    }
    try {
        $pdo->exec("DROP TABLE IF EXISTS quizzes");
        echo "quizzes dropped\n";
    } catch (Exception $e) {
        echo "Drop quizzes failed: " . $e->getMessage() . "\n";
    }
    try {
        $pdo->exec("DROP TABLE IF EXISTS lessons");
        echo "lessons dropped\n";
    } catch (Exception $e) {
        echo "Drop lessons failed: " . $e->getMessage() . "\n";
    }

    // 3. Recreate lessons
    echo "\nRecreating lessons...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS lessons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        order_index INT NOT NULL,
        mini_activity TEXT DEFAULT NULL,
        fun_reminder TEXT DEFAULT NULL,
        lesson_type VARCHAR(50) DEFAULT 'text',
        structured_content JSON DEFAULT NULL,
        FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
    )");

    // 4. Recreate quizzes
    echo "Recreating quizzes...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS quizzes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lesson_id INT NOT NULL,
        question TEXT NOT NULL,
        options JSON NOT NULL,
        correct_answer INT NOT NULL,
        explanation TEXT DEFAULT NULL,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )");

    // 5. Recreate progress
    echo "Recreating progress...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        lesson_id INT NOT NULL,
        is_completed BOOLEAN DEFAULT TRUE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
        UNIQUE KEY user_lesson (user_id, lesson_id)
    )");

    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    echo "\nAll tables recreated successfully.\n";

    // Check if login_sessions exists and works
    $stmt = $pdo->query("SHOW TABLES LIKE 'login_sessions'");
    if ($stmt->rowCount() > 0) {
        echo "login_sessions table exists.\n";
    } else {
        echo "login_sessions table is MISSING! Recreating...\n";
        $pdo->exec("CREATE TABLE IF NOT EXISTS login_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_date DATE NOT NULL,
            login_time DATETIME NOT NULL,
            logout_time DATETIME NULL,
            total_seconds INT NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )");
        echo "login_sessions created.\n";
    }

} catch (Exception $e) {
    echo "Fatal Error: " . $e->getMessage() . "\n";
}
