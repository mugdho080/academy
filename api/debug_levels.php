<?php
require_once 'db_connect.php';
$stmt = $pdo->query("SELECT id, chapter_id, title, order_index FROM levels");
$levels = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($levels, JSON_PRETTY_PRINT);
?>