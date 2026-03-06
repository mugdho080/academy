<?php
// auth/signup.php
if (!isset($pdo)) {
    require_once __DIR__ . '/../db_connect.php';
}
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['name']) || !isset($data['email']) || !isset($data['ndis_number']) || !isset($data['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'All fields are required']);
    exit;
}

$name = $data['name'];
$email = $data['email'];
$ndis = $data['ndis_number'];
$password = password_hash($data['password'], PASSWORD_BCRYPT);

try {
    $stmt = $pdo->prepare("INSERT INTO users (name, email, ndis_number, password_hash, role, status) VALUES (?, ?, ?, ?, 'learner', 'locked')");
    $stmt->execute([$name, $email, $ndis, $password]);
    $userId = $pdo->lastInsertId();

    // Auto-create CRM Participant record
    $stmt = $pdo->prepare("INSERT INTO participants (user_id, full_name, ndis_number, stage) VALUES (?, ?, ?, 'lead')");
    $stmt->execute([$userId, $name, $ndis]);

    echo json_encode([
        'success' => true,
        'message' => 'Account created successfully! Please log in.'
    ]);
} catch (\PDOException $e) {
    if ($e->getCode() == 23000) {
        http_response_code(409);
        echo json_encode(['error' => 'Email or NDIS number already exists']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Registration failed: ' . $e->getMessage()]);
    }
}
?>
