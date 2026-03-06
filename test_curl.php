<?php
$data = file_get_contents(__DIR__ . '/payload.json');
$options = [
    'http' => [
        'header' => "Content-type: application/json\r\n",
        'method' => 'POST',
        'content' => $data,
        'ignore_errors' => true
    ]
];
$context = stream_context_create($options);
$result = file_get_contents('http://localhost/academy/api/learner/submit_agreement.php', false, $context);
file_put_contents(__DIR__ . '/api_response.log', "Headers:\n" . print_r($http_response_header, true) . "\n\nBody:\n" . $result);
