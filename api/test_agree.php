<?php
$data = json_encode([
    'user_id' => 1,
    'full_name' => 'Super Admin',
    'dob' => '1990-01-01',
    'address' => '123 Admin St',
    'phone' => '1234567890',
    'emergency_contact' => '0987654321',
    'ndis_number' => 'ADMIN001',
    'plan_type' => 'Self Managed',
    'who_pays' => 'Participant',
    'signature_data' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
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
$result = file_get_contents('http://localhost/academy/api/learner/submit_agreement.php', false, $context);
echo "HTTP Status: " . $http_response_header[0] . "\n";
echo "Response: " . $result . "\n";
