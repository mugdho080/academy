<?php
require_once __DIR__ . '/db_connect.php';

try {
    echo "--- Quizzes Check ---\n";
    $stmt = $pdo->query("SELECT id, question, correct_answer FROM quizzes LIMIT 10");
    $quizzes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($quizzes as $q) {
        echo "Q{$q['id']}: Index {$q['correct_answer']} - {$q['question']}\n";
    }

    echo "\n--- Lessons Duplication Check ---\n";
    $stmt = $pdo->query("SELECT id, title, LENGTH(content) as len FROM lessons LIMIT 5");
    $lessons = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($lessons as $l) {
        echo "L{$l['id']}: {$l['title']} (Length: {$l['len']})\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}