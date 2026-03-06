<?php
$context = stream_context_create(['http' => ['ignore_errors' => true]]);
echo "Admin fetch_agreement:\n";
echo file_get_contents('http://localhost/academy/api/admin/fetch_agreement?user_id=1', false, $context) . "\n\n";

echo "Learner fetch_my_agreement:\n";
echo file_get_contents('http://localhost/academy/api/learner/fetch_my_agreement?user_id=1', false, $context) . "\n\n";

echo "DB Dump:\n";
require 'db_connect.php';
$stmt = $pdo->query("SELECT * FROM service_agreements");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
