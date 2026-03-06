<?php
$data = json_encode([
    'name' => 'Adil',
    'email' => 'adil3@gmail.com',
    'ndis_number' => '4444',
    'password' => 'password123'
]);

$options = [
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $data,
        'ignore_errors' => true
    ]
];
$context = stream_context_create($options);
// Route through the index frontend so $pdo gets defined in db_connect first!
$result = file_get_contents('http://localhost/academy/api/index.php/auth/signup', false, $context);
echo "HTTP Status: " . $http_response_header[0] . "\n";
echo "Response: " . $result . "\n";
