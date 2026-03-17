<?php
// auth/login.php
if (!isset($pdo)) {
    require_once __DIR__ . '/../db_connect.php';
}
session_start();
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['identifier']) || !isset($data['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Email/NDIS and Password required']);
    exit;
}

$identifier = $data['identifier'];
$password = $data['password'];

try {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? OR ndis_number = ?");
    $stmt->execute([$identifier, $identifier]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role'] = $user['role'];

        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'ndis_number' => $user['ndis_number'],
                'role' => $user['role'],
                'status' => $user['status'] ?? null,
                'points' => $user['points'] ?? 0,
                'avatar' => $user['avatar'] ?? null,
                'profile_image_url' => $user['profile_image_url'] ?? null,
                'about_me' => $user['about_me'] ?? null
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
?>
