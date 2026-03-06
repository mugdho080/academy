<?php
require_once __DIR__ . '/../db_connect.php';

$sqls = [
    "CREATE TABLE IF NOT EXISTS line_item_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        line_item_code VARCHAR(100) UNIQUE NOT NULL,
        virtual_allowed BOOLEAN DEFAULT FALSE,
        required_evidence JSON NOT NULL,
        claim_note_template TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )",

    // Insert dummy rules
    "INSERT IGNORE INTO line_item_rules (line_item_code, virtual_allowed, required_evidence, claim_note_template) 
     VALUES ('09_008_0116_6_3', 1, '[\"session_note\", \"attendance_confirmation\"]', 'Community Innovation session delivered on {date}. Goals progressed.')"
];

$response = [];
foreach ($sqls as $sql) {
    try {
        $pdo->exec($sql);
        $response[] = "Executed: " . substr(trim($sql), 0, 50) . "...";
    } catch (PDOException $e) {
        $response[] = "Error: " . $e->getMessage();
    }
}

echo json_encode(['success' => true, 'log' => $response], JSON_PRETTY_PRINT);
?>