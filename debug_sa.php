<?php
require_once __DIR__ . '/api/db_connect.php';
$stmt = $pdo->query('DESCRIBE service_agreements');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
