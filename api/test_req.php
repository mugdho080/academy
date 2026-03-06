<?php
$data = json_encode(['identifier' => 'admin@admin.com', 'password' => 'admin']);
$options = [
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => $data,
        'ignore_errors' => true
    ]
];
$context = stream_context_create($options);
$result = file_get_contents('http://localhost/academy/api/auth/login', false, $context);
file_put_contents('test_out.txt', $result);
echo "Done";
