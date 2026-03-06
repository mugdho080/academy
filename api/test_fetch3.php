<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$context = stream_context_create(['http' => ['ignore_errors' => true]]);
echo "--- Admin ---\n";
echo file_get_contents('http://localhost/academy/api/admin/fetch_agreement?user_id=1', false, $context) . "\n";

echo "--- Learner ---\n";
echo file_get_contents('http://localhost/academy/api/learner/fetch_my_agreement?user_id=1', false, $context) . "\n";
