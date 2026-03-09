<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/InvoiceService.php';

session_start();
$admin = inv_require_admin();
inv_ensure_schema($pdo);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $settings = inv_get_company_settings($pdo);
    echo json_encode([
        'success' => true,
        'settings' => $settings
    ]);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$payload = inv_json_input();
$settings = inv_get_company_settings($pdo);
$settingsId = (int) ($settings['id'] ?? 0);

$companyName = trim((string) ($payload['company_name'] ?? ''));
$abn = trim((string) ($payload['abn'] ?? ''));
$bsb = trim((string) ($payload['bsb'] ?? ''));
$bankAccount = trim((string) ($payload['bank_account_number'] ?? ''));

if ($companyName === '' || $abn === '' || $bsb === '' || $bankAccount === '') {
    http_response_code(422);
    echo json_encode([
        'error' => 'Validation failed',
        'details' => 'company_name, abn, bsb, bank_account_number are required'
    ]);
    exit;
}

$defaultDueDays = max(1, (int) ($payload['default_due_days'] ?? 7));
$defaultHourlyRate = inv_money((float) ($payload['default_hourly_rate'] ?? 50));
$roundingPrecision = max(0, min(4, (int) ($payload['rounding_precision'] ?? 2)));

$update = $pdo->prepare("
    UPDATE company_settings
    SET company_name = ?,
        abn = ?,
        address = ?,
        phone = ?,
        email = ?,
        bsb = ?,
        bank_account_number = ?,
        account_name = ?,
        invoice_prefix = ?,
        default_due_days = ?,
        default_currency = ?,
        default_line_item_code = ?,
        default_line_item_description = ?,
        default_hourly_rate = ?,
        rounding_precision = ?,
        payment_instruction_code = ?
    WHERE id = ?
");

$update->execute([
    $companyName,
    $abn,
    trim((string) ($payload['address'] ?? '')),
    trim((string) ($payload['phone'] ?? '')),
    trim((string) ($payload['email'] ?? '')),
    $bsb,
    $bankAccount,
    trim((string) ($payload['account_name'] ?? '')),
    strtoupper(trim((string) ($payload['invoice_prefix'] ?? 'INV'))),
    $defaultDueDays,
    strtoupper(trim((string) ($payload['default_currency'] ?? 'AUD'))),
    trim((string) ($payload['default_line_item_code'] ?? '09_008_0116_6_3')),
    trim((string) ($payload['default_line_item_description'] ?? 'Innovative Community Participation')),
    $defaultHourlyRate,
    $roundingPrecision,
    trim((string) ($payload['payment_instruction_code'] ?? 'INV_RR_006_CB')),
    $settingsId
]);

$fresh = inv_get_company_settings($pdo);
echo json_encode([
    'success' => true,
    'updated_by_admin_id' => $admin['user_id'],
    'settings' => $fresh
]);
