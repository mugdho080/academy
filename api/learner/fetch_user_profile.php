<?php
// api/learner/fetch_user_profile.php
require_once __DIR__ . '/../db_connect.php';

header('Content-Type: application/json');

$user_id = $_GET['user_id'] ?? null;

if (!$user_id) {
    echo json_encode(['error' => 'User ID is required']);
    exit;
}

$stmt = $pdo->prepare("SELECT id, name, email, ndis_number, role, avatar, points, status, profile_image_url, about_me FROM users WHERE id = ?");
$stmt->execute([$user_id]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user) {
    echo json_encode(['success' => true, 'user' => $user]);
} else {
    echo json_encode(['error' => 'User not found']);
}
?>
