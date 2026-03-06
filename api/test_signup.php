<?php
$data = json_encode([
    'name' => 'Adil',
    'email' => 'adil@gmail.com',
    'ndis_number' => '21e2121',
    'password' => 'password123'
]);

$options = [
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => $data,
        'ignore_errors' => true
    ]
];
$context = stream_context_create($options);
$result = file_get_contents('http://localhost/academy/api/auth/signup.php', false, $context);
echo "HTTP Status: " . $http_response_header[0] . "\n";
echo "Response: " . $result . "\n";
