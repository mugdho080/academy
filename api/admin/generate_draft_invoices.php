<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../services/InvoiceService.php';

session_start();
$admin = inv_require_admin();
inv_ensure_schema($pdo);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$payload = inv_json_input();
$userIds = $payload['user_ids'] ?? [];
$dateFrom = inv_validate_date($payload['date_from'] ?? null);
$dateTo = inv_validate_date($payload['date_to'] ?? null);
$previewOnly = !empty($payload['preview_only']);

if (!is_array($userIds) || count($userIds) === 0) {
    http_response_code(422);
    echo json_encode(['error' => 'At least one user must be selected']);
    exit;
}
if (!$dateFrom || !$dateTo) {
    http_response_code(422);
    echo json_encode(['error' => 'date_from and date_to are required in YYYY-MM-DD format']);
    exit;
}
if ($dateFrom > $dateTo) {
    http_response_code(422);
    echo json_encode(['error' => 'date_to cannot be earlier than date_from']);
    exit;
}

$userIds = array_values(array_unique(array_map('intval', $userIds)));
$userIds = array_values(array_filter($userIds, static fn($id) => $id > 0));
if (!$userIds) {
    http_response_code(422);
    echo json_encode(['error' => 'No valid user IDs provided']);
    exit;
}

$settings = inv_get_company_settings($pdo);
$invoiceDate = gmdate('Y-m-d');
$dueDays = max(1, (int) ($settings['default_due_days'] ?? 7));
$dueDate = gmdate('Y-m-d', strtotime($invoiceDate . " +{$dueDays} days"));
$roundingPrecision = max(0, min(4, (int) ($settings['rounding_precision'] ?? 2)));
$defaultRate = inv_money((float) ($settings['default_hourly_rate'] ?? 50));
$defaultCode = (string) ($settings['default_line_item_code'] ?? '09_008_0116_6_3');
$defaultDescription = (string) ($settings['default_line_item_description'] ?? 'Innovative Community Participation');
$currency = (string) ($settings['default_currency'] ?? 'AUD');

$placeholders = implode(',', array_fill(0, count($userIds), '?'));
$eligibleStmt = $pdo->prepare("
    SELECT
        u.id,
        u.name,
        u.email,
        u.ndis_number,
        sa.phone
    FROM users u
    INNER JOIN (
        SELECT user_id, MAX(signed_at) AS signed_at
        FROM service_agreements
        GROUP BY user_id
    ) latest_sa ON latest_sa.user_id = u.id
    LEFT JOIN service_agreements sa
        ON sa.user_id = latest_sa.user_id
       AND sa.signed_at = latest_sa.signed_at
    WHERE u.id IN ({$placeholders})
      AND u.role = 'learner'
      AND u.status = 'active'
    ORDER BY u.id ASC
");
$eligibleStmt->execute($userIds);
$eligibleUsers = $eligibleStmt->fetchAll(PDO::FETCH_ASSOC);

if (!$eligibleUsers) {
    http_response_code(422);
    echo json_encode(['error' => 'No eligible signed active participants found for selection']);
    exit;
}

$userById = [];
foreach ($eligibleUsers as $row) {
    $userById[(int) $row['id']] = $row;
}

$previewRows = [];
$createdInvoices = [];
$skipped = [];

try {
    if (!$previewOnly) {
        $pdo->beginTransaction();
    }

    foreach ($userIds as $userId) {
        if (!isset($userById[$userId])) {
            $skipped[] = ['user_id' => $userId, 'reason' => 'Not eligible (missing signed agreement or inactive)'];
            continue;
        }

        $user = $userById[$userId];
        $seconds = inv_fetch_billable_seconds($pdo, $userId, $dateFrom, $dateTo);
        $hours = round($seconds / 3600, $roundingPrecision);
        $amount = inv_money($hours * $defaultRate);
        $participantId = inv_resolve_participant_id($pdo, $userId, (string) $user['name'], (string) $user['ndis_number']);

        $previewRows[] = [
            'user_id' => $userId,
            'participant_name' => $user['name'],
            'participant_ndis_number' => $user['ndis_number'],
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'total_seconds_raw' => $seconds,
            'total_hours' => $hours,
            'rate' => $defaultRate,
            'amount' => $amount
        ];

        if ($previewOnly) {
            continue;
        }

        $invoiceNumber = inv_generate_invoice_number($pdo, (string) ($settings['invoice_prefix'] ?? 'INV'), $invoiceDate);

        $insertInvoice = $pdo->prepare("
            INSERT INTO invoices (
                invoice_number,
                user_id,
                participant_id,
                participant_name,
                participant_ndis_number,
                company_settings_id,
                invoice_date,
                due_date,
                date_from,
                date_to,
                status,
                currency,
                subtotal,
                total,
                total_amount,
                total_hours,
                total_seconds_raw,
                notes,
                source_type,
                created_by_admin_id,
                company_name_snapshot,
                company_abn_snapshot,
                company_address_snapshot,
                company_phone_snapshot,
                company_email_snapshot,
                company_bsb_snapshot,
                company_bank_account_snapshot,
                company_account_name_snapshot,
                company_logo_snapshot,
                payment_instruction_code,
                participant_email_snapshot,
                participant_phone_snapshot
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, 'activity_logs', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $insertInvoice->execute([
            $invoiceNumber,
            $userId,
            $participantId,
            $user['name'],
            $user['ndis_number'],
            (int) ($settings['id'] ?? 0),
            $invoiceDate,
            $dueDate,
            $dateFrom,
            $dateTo,
            $currency,
            $amount,
            $amount,
            $amount,
            $hours,
            $seconds,
            '',
            $admin['user_id'],
            $settings['company_name'] ?? 'Goodwill Care Academy',
            $settings['abn'] ?? '',
            $settings['address'] ?? '',
            $settings['phone'] ?? '',
            $settings['email'] ?? '',
            $settings['bsb'] ?? '',
            $settings['bank_account_number'] ?? '',
            $settings['account_name'] ?? '',
            $settings['logo_path'] ?? null,
            $settings['payment_instruction_code'] ?? 'INV_RR_006_CB',
            $user['email'] ?? '',
            $user['phone'] ?? ''
        ]);
        $invoiceId = (int) $pdo->lastInsertId();

        $insertItem = $pdo->prepare("
            INSERT INTO invoice_items (
                invoice_id,
                service_date_from,
                service_date_to,
                line_item_code,
                line_item_description,
                quantity_hours,
                rate,
                amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $insertItem->execute([
            $invoiceId,
            $dateFrom,
            $dateTo,
            $defaultCode,
            $defaultDescription,
            $hours,
            $defaultRate,
            $amount
        ]);

        $dailyStmt = $pdo->prepare("
            SELECT date_key, SUM(seconds_active) AS total_seconds
            FROM time_entries
            WHERE user_id = ?
              AND date_key BETWEEN ? AND ?
            GROUP BY date_key
            ORDER BY date_key ASC
        ");
        $dailyStmt->execute([$userId, $dateFrom, $dateTo]);
        $dailyTotals = $dailyStmt->fetchAll(PDO::FETCH_ASSOC);

        $contextStmt = $pdo->prepare("
            SELECT context_type, SUM(seconds_active) AS total_seconds
            FROM time_entries
            WHERE user_id = ?
              AND date_key BETWEEN ? AND ?
            GROUP BY context_type
        ");
        $contextStmt->execute([$userId, $dateFrom, $dateTo]);
        $contextTotals = $contextStmt->fetchAll(PDO::FETCH_ASSOC);

        $insertSource = $pdo->prepare("
            INSERT INTO invoice_log_sources (
                invoice_id,
                user_id,
                source_start_date,
                source_end_date,
                total_seconds_included,
                summary_json
            ) VALUES (?, ?, ?, ?, ?, ?)
        ");
        $insertSource->execute([
            $invoiceId,
            $userId,
            $dateFrom,
            $dateTo,
            $seconds,
            json_encode([
                'daily_totals' => $dailyTotals,
                'context_totals' => $contextTotals
            ])
        ]);

        $createdInvoices[] = [
            'invoice_id' => $invoiceId,
            'invoice_number' => $invoiceNumber,
            'user_id' => $userId,
            'participant_name' => $user['name'],
            'participant_ndis_number' => $user['ndis_number'],
            'total_seconds_raw' => $seconds,
            'total_hours' => $hours,
            'rate' => $defaultRate,
            'total' => $amount,
            'status' => 'draft'
        ];
    }

    if (!$previewOnly) {
        $pdo->commit();
    }

    echo json_encode([
        'success' => true,
        'preview_only' => $previewOnly,
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
        'preview' => $previewRows,
        'created' => $createdInvoices,
        'skipped' => $skipped
    ]);
} catch (Throwable $e) {
    if (!$previewOnly && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Failed to generate draft invoices', 'details' => $e->getMessage()]);
}
