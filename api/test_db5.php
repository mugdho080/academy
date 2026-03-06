<?php
require 'db_connect.php';
$stmt = $pdo->query('SELECT * FROM sessions ORDER BY id DESC LIMIT 5');
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
?>