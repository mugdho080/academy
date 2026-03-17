<?php
// api/learner/update_profile_text.php
require_once __DIR__ . '/../db_connect.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(['error' => 'Invalid JSON input']);
    exit;
}

$user_id = $data['user_id'] ?? null;
$about_me = $data['about_me'] ?? '';

if (!$user_id) {
    echo json_encode(['error' => 'User ID is required']);
    exit;
}

$stmt = $pdo->prepare("UPDATE users SET about_me = ? WHERE id = ?");
if ($stmt->execute([$about_me, $user_id])) {
    $stmt2 = $pdo->prepare("SELECT id, name, email, ndis_number, role, avatar, points, status, profile_image_url, about_me FROM users WHERE id = ?");
    $stmt2->execute([$user_id]);
    $user = $stmt2->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode(['success' => true, 'about_me' => $about_me, 'user' => $user]);
} else {
    echo json_encode(['error' => 'Failed to update profile text']);
}
?>
