<?php
// api/learner/upload_profile_image.php
require_once __DIR__ . '/../db_connect.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['error' => 'Invalid request method']);
    exit;
}

$user_id = $_POST['user_id'] ?? null;
if (!$user_id) {
    echo json_encode(['error' => 'User ID is required']);
    exit;
}

if (!isset($_FILES['profile_image']) || $_FILES['profile_image']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['error' => 'No image uploaded or upload error.']);
    exit;
}

$fileInfo = pathinfo($_FILES['profile_image']['name']);
$ext = strtolower($fileInfo['extension'] ?? '');
$allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

if (!in_array($ext, $allowed)) {
    echo json_encode(['error' => 'Invalid file format. Only JPG, PNG, WEBP, GIF allowed.']);
    exit;
}

// Check size (max 5MB)
if ($_FILES['profile_image']['size'] > 5 * 1024 * 1024) {
    echo json_encode(['error' => 'File size exceeds 5MB limit.']);
    exit;
}

// Upload dir
$uploadDir = __DIR__ . '/../../uploads/profiles/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Safe unique filename
$filename = 'profile_' . (int)$user_id . '_' . time() . '.' . $ext;
$targetPath = $uploadDir . $filename;

if (move_uploaded_file($_FILES['profile_image']['tmp_name'], $targetPath)) {
    // Save to DB
    $publicPath = '/uploads/profiles/' . $filename; // VITE proxy or GoDaddy straight URL handles it
    
    $stmt = $pdo->prepare("UPDATE users SET profile_image_url = ? WHERE id = ?");
    if($stmt->execute([$publicPath, $user_id])) {
        // Fetch updated user to return
        $stmt2 = $pdo->prepare("SELECT id, name, email, ndis_number, role, avatar, points, status, profile_image_url, about_me FROM users WHERE id = ?");
        $stmt2->execute([$user_id]);
        $user = $stmt2->fetch(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'profile_image_url' => $publicPath, 'user' => $user]);
    } else {
        echo json_encode(['error' => 'Failed to update database.']);
    }
} else {
    echo json_encode(['error' => 'Failed to move uploaded file.']);
}
?>
