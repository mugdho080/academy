<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['user_id']) || !isset($data['signature_data'])) {
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

$user_id = $data['user_id'];
$signature_data = $data['signature_data'];
$full_name = $data['full_name'] ?? '';
$dob = !empty($data['dob']) ? $data['dob'] : null;
$address = $data['address'] ?? '';
$phone = $data['phone'] ?? '';
$emergency_contact = $data['emergency_contact'] ?? '';
$ndis_number = $data['ndis_number'] ?? '';
$nominee = $data['nominee'] ?? '';
$plan_type = $data['plan_type'] ?? '';
$who_pays = $data['who_pays'] ?? '';
$plan_manager_name = $data['plan_manager_name'] ?? '';
$plan_manager_contact = $data['plan_manager_contact'] ?? '';
$plan_start_date = !empty($data['plan_start_date']) ? $data['plan_start_date'] : null;
$plan_end_date = !empty($data['plan_end_date']) ? $data['plan_end_date'] : null;

try {
    $pdo->beginTransaction();

    // 1. Save Signature Image as JPG
    $sig_filename = "sig_" . $user_id . "_" . time() . ".jpg";
    $upload_dir = __DIR__ . '/../../uploads/signatures/';

    // Ensure dir exists
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }

    // Process base64
    $img_data = str_replace(['data:image/png;base64,', 'data:image/jpeg;base64,', ' '], ['', '', '+'], $signature_data);
    $decoded_data = base64_decode($img_data);

    if (!saveSignature($upload_dir, $sig_filename, $decoded_data)) {
        throw new Exception("Failed to save signature image. Check folder permissions.");
    }

    // 2. Insert Agreement (using filename)
    $stmt = $pdo->prepare("
        INSERT INTO service_agreements 
        (user_id, signature_data, full_name, dob, address, phone, emergency_contact, ndis_number, nominee, plan_type, who_pays, plan_manager_name, plan_manager_contact, plan_start_date, plan_end_date)
        VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $user_id,
        $sig_filename,
        $full_name,
        $dob,
        $address,
        $phone,
        $emergency_contact,
        $ndis_number,
        $nominee,
        $plan_type,
        $who_pays,
        $plan_manager_name,
        $plan_manager_contact,
        $plan_start_date,
        $plan_end_date
    ]);

    // 2. Update User Status to 'pending' (Account Under Review)
    $stmt = $pdo->prepare("UPDATE users SET status = 'pending' WHERE id = ?");
    $stmt->execute([$user_id]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'error' => "Server error: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine()
    ]);
}

// Helper to safely convert/save image
function saveSignature($upload_dir, $sig_filename, $decoded_data)
{
    $full_path = $upload_dir . $sig_filename;

    // Check if GD is available
    if (function_exists('imagecreatefromstring') && function_exists('imagejpeg')) {
        try {
            $src_img = @imagecreatefromstring($decoded_data);
            if ($src_img) {
                imagejpeg($src_img, $full_path, 80);
                imagedestroy($src_img);
                return true;
            }
        } catch (Throwable $t) {
            // Fall through to file_put_contents
        }
    }

    // Fallback: save raw data (likely works if the browser sent valid base64)
    return file_put_contents($full_path, $decoded_data) !== false;
}
?>