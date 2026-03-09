<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/InvoiceService.php';

session_start();
inv_require_admin();
inv_ensure_schema($pdo);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['logo'])) {
    http_response_code(422);
    echo json_encode(['error' => 'Missing logo file']);
    exit;
}

$file = $_FILES['logo'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    http_response_code(422);
    echo json_encode(['error' => 'Logo upload failed']);
    exit;
}

$allowedExt = ['png', 'jpg', 'jpeg', 'webp'];
$originalName = (string) ($file['name'] ?? '');
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExt, true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid file extension']);
    exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = $finfo ? finfo_file($finfo, $file['tmp_name']) : '';
if ($finfo) {
    finfo_close($finfo);
}

$allowedMime = ['image/png', 'image/jpeg', 'image/webp'];
if (!in_array($mime, $allowedMime, true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid file MIME type']);
    exit;
}

$uploadDir = __DIR__ . '/../uploads/company';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0775, true);
}

$safeName = 'company_logo_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$target = $uploadDir . '/' . $safeName;

if (!move_uploaded_file($file['tmp_name'], $target)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save logo']);
    exit;
}

$logoPath = '/api/uploads/company/' . $safeName;
$settings = inv_get_company_settings($pdo);
$settingsId = (int) ($settings['id'] ?? 0);

$update = $pdo->prepare("UPDATE company_settings SET logo_path = ? WHERE id = ?");
$update->execute([$logoPath, $settingsId]);

echo json_encode([
    'success' => true,
    'logo_path' => $logoPath
]);
