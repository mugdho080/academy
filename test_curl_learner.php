<?php
$ch = curl_init('http://localhost/academy/api/auth/login');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['identifier' => 'adil@gmail.com', 'password' => '1234']));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type:application/json'));
curl_setopt($ch, CURLOPT_HEADER, true);
$result = curl_exec($ch);
curl_close($ch);
echo "LOGIN RESPONSE:\n$result\n\n";

// Extract session cookie
preg_match_all('/^Set-Cookie:\s*([^;]*)/mi', $result, $matches);
$cookies = array();
foreach ($matches[1] as $item) {
    parse_str($item, $cookie);
    $cookies = array_merge($cookies, $cookie);
}

$cookieStr = "";
if (isset($cookies['PHPSESSID'])) {
    $cookieStr = "PHPSESSID=" . $cookies['PHPSESSID'];
}

$ch = curl_init('http://localhost/academy/api/learner/start_session.php');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([]));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type:application/json'));
if ($cookieStr) {
    curl_setopt($ch, CURLOPT_COOKIE, $cookieStr);
}
$result = curl_exec($ch);
curl_close($ch);
echo "START SESSION RESPONSE:\n$result\n";
?>