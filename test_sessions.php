<?php
require 'api/db_connect.php';
$stmt = $pdo->query('SELECT * FROM sessions ORDER BY id DESC LIMIT 5');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>