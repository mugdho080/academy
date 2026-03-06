<?php
// test_time.php
$url = 'http://localhost/academy/api/learner/track_time.php';
$data = [
    'user_id' => 1,
    'session_id' => 1,
    'chunk_id' => 'test-chunk-999',
    'chunk_start' => '2026-03-03 10:00:00',
    'chunk_end' => '2026-03-03 10:15:00',
    'seconds' => 900
];

$options = [
    'http' => [
        'header' => "Content-type: application/json\r\n",
        'method' => 'POST',
        'content' => json_encode($data),
    ],
];
$context = stream_context_create($options);
$result = file_get_contents($url, false, $context);
echo "Track Result: " . $result . "\n";

$getUrl = 'http://localhost/academy/api/learner/fetch_time_logs.php?user_id=1&start_date=2026-03-03&end_date=2026-03-03';
$getResult = file_get_contents($getUrl);
echo "Fetch Result: " . $getResult . "\n";
?>