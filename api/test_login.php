<?php
$url = 'http://localhost/academy/api/auth/login';
$data = json_encode(['identifier' => 'admin@admin.com', 'password' => 'admin']);
$options = [
    'http' => [
        'header' => "Content-type: application/json\r\n",
        'method' => 'POST',
        'content' => $data,
        'ignore_errors' => true
    ]
];
$context = stream_context_create($options);
$result = file_get_contents($url, false, $context);
echo "HTTP response: " . $http_response_header[0] . "\n";
echo "Response body: " . $result . "\n";
