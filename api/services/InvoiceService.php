<?php

function inv_json_input(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function inv_require_admin(): array
{
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized. Admin access required.']);
        exit;
    }

    return [
        'user_id' => (int) $_SESSION['user_id'],
        'role' => $_SESSION['role']
    ];
}

function inv_require_user(): array
{
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    return [
        'user_id' => (int) $_SESSION['user_id'],
        'role' => $_SESSION['role'] ?? 'learner'
    ];
}

function inv_validate_date($value, ?string $fallback = null): ?string
{
    if (!is_string($value) || trim($value) === '') {
        return $fallback;
    }

    $date = trim($value);
    $dt = DateTime::createFromFormat('Y-m-d', $date);
    if (!$dt || $dt->format('Y-m-d') !== $date) {
        return $fallback;
    }

    return $date;
}

function inv_round_hours(int $seconds, int $precision = 2): float
{
    if ($seconds <= 0) {
        return 0.0;
    }
    return round($seconds / 3600, $precision);
}

function inv_money(float $value): float
{
    return round($value, 2);
}

function inv_format_money(float $value): string
{
    return number_format(inv_money($value), 2, '.', '');
}

function inv_ensure_schema(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $tableExists = static function (string $table) use ($pdo): bool {
        $q = $pdo->quote($table);
        $stmt = $pdo->query("SHOW TABLES LIKE {$q}");
        return (bool) $stmt->fetchColumn();
    };

    $columnExists = static function (string $table, string $column) use ($pdo): bool {
        if (!$table) return false;
        $q = $pdo->quote($column);
        $stmt = $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE {$q}");
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    };

    $indexExists = static function (string $table, string $indexName) use ($pdo): bool {
        $q = $pdo->quote($indexName);
        $stmt = $pdo->query("SHOW INDEX FROM `{$table}` WHERE Key_name = {$q}");
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    };

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS company_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_name VARCHAR(255) NOT NULL,
            logo_path VARCHAR(512) NULL,
            abn VARCHAR(64) NOT NULL,
            address TEXT NULL,
            phone VARCHAR(64) NULL,
            email VARCHAR(255) NULL,
            bsb VARCHAR(32) NOT NULL,
            bank_account_number VARCHAR(64) NOT NULL,
            account_name VARCHAR(255) NULL,
            invoice_prefix VARCHAR(32) NOT NULL DEFAULT 'INV',
            default_due_days INT NOT NULL DEFAULT 7,
            default_currency VARCHAR(16) NOT NULL DEFAULT 'AUD',
            default_line_item_code VARCHAR(64) NOT NULL DEFAULT '09_008_0116_6_3',
            default_line_item_description VARCHAR(255) NOT NULL DEFAULT 'Innovative Community Participation',
            default_hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 50.00,
            rounding_precision INT NOT NULL DEFAULT 2,
            payment_instruction_code VARCHAR(64) NOT NULL DEFAULT 'INV_RR_006_CB',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS invoice_sequences (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_prefix VARCHAR(32) NOT NULL,
            period_key CHAR(6) NOT NULL,
            last_serial INT NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_invoice_sequence (invoice_prefix, period_key)
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS invoices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_number VARCHAR(100) NOT NULL,
            user_id INT NULL,
            participant_id INT NULL,
            participant_name VARCHAR(255) NOT NULL,
            participant_ndis_number VARCHAR(64) NOT NULL,
            company_settings_id INT NULL,
            invoice_date DATE NOT NULL,
            due_date DATE NOT NULL,
            date_from DATE NOT NULL,
            date_to DATE NOT NULL,
            status ENUM('draft','unpaid','paid','sent','overdue') NOT NULL DEFAULT 'draft',
            currency VARCHAR(16) NOT NULL DEFAULT 'AUD',
            subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            total_hours DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            total_seconds_raw INT NOT NULL DEFAULT 0,
            notes TEXT NULL,
            source_type VARCHAR(64) NOT NULL DEFAULT 'activity_logs',
            created_by_admin_id INT NULL,
            paid_at DATETIME NULL,
            payment_date DATETIME NULL,
            payment_reference VARCHAR(255) NULL,
            pdf_path VARCHAR(512) NULL,
            company_name_snapshot VARCHAR(255) NULL,
            company_abn_snapshot VARCHAR(64) NULL,
            company_address_snapshot TEXT NULL,
            company_phone_snapshot VARCHAR(64) NULL,
            company_email_snapshot VARCHAR(255) NULL,
            company_bsb_snapshot VARCHAR(32) NULL,
            company_bank_account_snapshot VARCHAR(64) NULL,
            company_account_name_snapshot VARCHAR(255) NULL,
            company_logo_snapshot VARCHAR(512) NULL,
            payment_instruction_code VARCHAR(64) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_invoice_number (invoice_number),
            INDEX idx_invoices_status (status),
            INDEX idx_invoices_user (user_id),
            INDEX idx_invoices_date (invoice_date)
        )
    ");

    $invoiceColumns = [
        'invoice_number' => "VARCHAR(100) NOT NULL DEFAULT ''",
        'user_id' => "INT NULL",
        'participant_name' => "VARCHAR(255) NOT NULL DEFAULT ''",
        'participant_ndis_number' => "VARCHAR(64) NOT NULL DEFAULT ''",
        'company_settings_id' => "INT NULL",
        'invoice_date' => "DATE NULL",
        'date_from' => "DATE NULL",
        'date_to' => "DATE NULL",
        'currency' => "VARCHAR(16) NOT NULL DEFAULT 'AUD'",
        'subtotal' => "DECIMAL(12,2) NOT NULL DEFAULT 0.00",
        'total' => "DECIMAL(12,2) NOT NULL DEFAULT 0.00",
        'total_amount' => "DECIMAL(12,2) NOT NULL DEFAULT 0.00",
        'total_hours' => "DECIMAL(10,2) NOT NULL DEFAULT 0.00",
        'total_seconds_raw' => "INT NOT NULL DEFAULT 0",
        'notes' => "TEXT NULL",
        'source_type' => "VARCHAR(64) NOT NULL DEFAULT 'activity_logs'",
        'created_by_admin_id' => "INT NULL",
        'paid_at' => "DATETIME NULL",
        'payment_date' => "DATETIME NULL",
        'payment_reference' => "VARCHAR(255) NULL",
        'pdf_path' => "VARCHAR(512) NULL",
        'company_name_snapshot' => "VARCHAR(255) NULL",
        'company_abn_snapshot' => "VARCHAR(64) NULL",
        'company_address_snapshot' => "TEXT NULL",
        'company_phone_snapshot' => "VARCHAR(64) NULL",
        'company_email_snapshot' => "VARCHAR(255) NULL",
        'company_bsb_snapshot' => "VARCHAR(32) NULL",
        'company_bank_account_snapshot' => "VARCHAR(64) NULL",
        'company_account_name_snapshot' => "VARCHAR(255) NULL",
        'company_logo_snapshot' => "VARCHAR(512) NULL",
        'payment_instruction_code' => "VARCHAR(64) NULL"
    ];

    foreach ($invoiceColumns as $name => $definition) {
        if (!$columnExists('invoices', $name)) {
            $pdo->exec("ALTER TABLE invoices ADD COLUMN {$name} {$definition}");
        }
    }

    $pdo->exec("
        ALTER TABLE invoices
        MODIFY COLUMN status ENUM('draft','unpaid','paid','sent','overdue') NOT NULL DEFAULT 'draft'
    ");

    if (!$indexExists('invoices', 'uniq_invoice_number')) {
        $pdo->exec("CREATE UNIQUE INDEX uniq_invoice_number ON invoices (invoice_number)");
    }
    if (!$indexExists('invoices', 'idx_invoices_status')) {
        $pdo->exec("CREATE INDEX idx_invoices_status ON invoices (status)");
    }
    if (!$indexExists('invoices', 'idx_invoices_user')) {
        $pdo->exec("CREATE INDEX idx_invoices_user ON invoices (user_id)");
    }
    if (!$indexExists('invoices', 'idx_invoices_date')) {
        $pdo->exec("CREATE INDEX idx_invoices_date ON invoices (invoice_date)");
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS invoice_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_id INT NOT NULL,
            service_date_from DATE NULL,
            service_date_to DATE NULL,
            line_item_code VARCHAR(64) NOT NULL,
            line_item_description VARCHAR(255) NOT NULL,
            quantity_hours DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
            INDEX idx_invoice_items_invoice (invoice_id)
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS invoice_log_sources (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_id INT NOT NULL,
            user_id INT NOT NULL,
            source_start_date DATE NOT NULL,
            source_end_date DATE NOT NULL,
            total_seconds_included INT NOT NULL DEFAULT 0,
            summary_json LONGTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_invoice_log_sources_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
            INDEX idx_invoice_log_sources_invoice (invoice_id),
            INDEX idx_invoice_log_sources_user_date (user_id, source_start_date, source_end_date)
        )
    ");

    $settingsCount = (int) $pdo->query("SELECT COUNT(*) FROM company_settings")->fetchColumn();
    if ($settingsCount === 0) {
        $insertDefaultSettings = $pdo->prepare("
            INSERT INTO company_settings (
                company_name,
                abn,
                bsb,
                bank_account_number,
                account_name,
                invoice_prefix,
                default_due_days,
                default_currency,
                default_line_item_code,
                default_line_item_description,
                default_hourly_rate,
                rounding_precision,
                payment_instruction_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $insertDefaultSettings->execute([
            'Goodwill Care Academy',
            'ABN Pending',
            '000-000',
            '00000000',
            'Goodwill Care Academy',
            'INV',
            7,
            'AUD',
            '09_008_0116_6_3',
            'Innovative Community Participation',
            50.00,
            2,
            'INV_RR_006_CB'
        ]);
    }

    $ready = true;
}

function inv_get_company_settings(PDO $pdo): array
{
    $stmt = $pdo->query("
        SELECT *
        FROM company_settings
        ORDER BY id ASC
        LIMIT 1
    ");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: [];
}

function inv_generate_invoice_number(PDO $pdo, string $invoicePrefix, string $invoiceDate): string
{
    $prefix = strtoupper(trim($invoicePrefix ?: 'INV'));
    $prefix = preg_replace('/[^A-Z0-9_-]/', '', $prefix);
    if ($prefix === '') {
        $prefix = 'INV';
    }

    $period = date('Ym', strtotime($invoiceDate));
    $select = $pdo->prepare("
        SELECT id, last_serial
        FROM invoice_sequences
        WHERE invoice_prefix = ? AND period_key = ?
        FOR UPDATE
    ");
    $select->execute([$prefix, $period]);
    $seq = $select->fetch(PDO::FETCH_ASSOC);

    if (!$seq) {
        $insert = $pdo->prepare("
            INSERT INTO invoice_sequences (invoice_prefix, period_key, last_serial)
            VALUES (?, ?, 0)
        ");
        $insert->execute([$prefix, $period]);

        $select->execute([$prefix, $period]);
        $seq = $select->fetch(PDO::FETCH_ASSOC);
    }

    $nextSerial = ((int) ($seq['last_serial'] ?? 0)) + 1;
    $update = $pdo->prepare("UPDATE invoice_sequences SET last_serial = ? WHERE id = ?");
    $update->execute([$nextSerial, (int) $seq['id']]);

    return sprintf('%s-%s-%04d', $prefix, $period, $nextSerial);
}

function inv_fetch_billable_seconds(PDO $pdo, int $userId, string $dateFrom, string $dateTo): int
{
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(seconds_active), 0) AS total_seconds
        FROM time_entries
        WHERE user_id = ?
          AND date_key BETWEEN ? AND ?
    ");
    $stmt->execute([$userId, $dateFrom, $dateTo]);
    return (int) $stmt->fetchColumn();
}

function inv_resolve_participant_id(PDO $pdo, int $userId, string $participantName, string $ndisNumber): ?int
{
    static $participantsTableExists = null;
    if ($participantsTableExists === null) {
        $stmt = $pdo->query("SHOW TABLES LIKE 'participants'");
        $participantsTableExists = (bool) $stmt->fetchColumn();
    }

    if (!$participantsTableExists) {
        return null;
    }

    $find = $pdo->prepare("
        SELECT id
        FROM participants
        WHERE user_id = ? OR ndis_number = ?
        ORDER BY id ASC
        LIMIT 1
    ");
    $find->execute([$userId, $ndisNumber]);
    $id = $find->fetchColumn();
    if ($id) {
        return (int) $id;
    }

    try {
        $insert = $pdo->prepare("
            INSERT INTO participants (user_id, full_name, ndis_number, stage)
            VALUES (?, ?, ?, 'active')
        ");
        $insert->execute([$userId, $participantName, $ndisNumber]);
        return (int) $pdo->lastInsertId();
    } catch (\Throwable $e) {
        $find->execute([$userId, $ndisNumber]);
        $existing = $find->fetchColumn();
        return $existing ? (int) $existing : null;
    }
}

function inv_recalculate_totals(PDO $pdo, int $invoiceId): array
{
    $sumStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(amount), 0) AS subtotal,
            COALESCE(SUM(quantity_hours), 0) AS total_hours
        FROM invoice_items
        WHERE invoice_id = ?
    ");
    $sumStmt->execute([$invoiceId]);
    $sum = $sumStmt->fetch(PDO::FETCH_ASSOC) ?: ['subtotal' => 0, 'total_hours' => 0];

    $subtotal = inv_money((float) $sum['subtotal']);
    $total = $subtotal;
    $hours = round((float) $sum['total_hours'], 2);

    $update = $pdo->prepare("
        UPDATE invoices
        SET subtotal = ?, total = ?, total_amount = ?, total_hours = ?
        WHERE id = ?
    ");
    $update->execute([$subtotal, $total, $total, $hours, $invoiceId]);

    return [
        'subtotal' => $subtotal,
        'total' => $total,
        'total_hours' => $hours
    ];
}

function inv_escape_pdf_text(string $text): string
{
    $escaped = str_replace('\\', '\\\\', $text);
    $escaped = str_replace('(', '\\(', $escaped);
    $escaped = str_replace(')', '\\)', $escaped);
    return $escaped;
}

function inv_build_pdf_stream(array $lines): string
{
    $stream = "BT\n/F1 11 Tf\n";
    $y = 810;

    foreach ($lines as $line) {
        if ($y < 40) {
            break;
        }
        $stream .= sprintf("1 0 0 1 40 %d Tm (%s) Tj\n", $y, inv_escape_pdf_text($line));
        $y -= 16;
    }

    $stream .= "ET";
    return $stream;
}

function inv_write_simple_pdf(string $filePath, array $lines): void
{
    $content = inv_build_pdf_stream($lines);
    $length = strlen($content);

    $objects = [];
    $objects[] = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj";
    $objects[] = "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj";
    $objects[] = "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj";
    $objects[] = "4 0 obj << /Length {$length} >> stream\n{$content}\nendstream endobj";
    $objects[] = "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj";

    $pdf = "%PDF-1.4\n";
    $offsets = [0];
    foreach ($objects as $obj) {
        $offsets[] = strlen($pdf);
        $pdf .= $obj . "\n";
    }

    $xrefPos = strlen($pdf);
    $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
    $pdf .= "0000000000 65535 f \n";
    for ($i = 1; $i <= count($objects); $i++) {
        $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
    }

    $pdf .= "trailer << /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
    $pdf .= "startxref\n{$xrefPos}\n%%EOF";

    file_put_contents($filePath, $pdf);
}

function inv_generate_invoice_pdf_file(array $invoice, array $items, array $company): string
{
    $baseDir = __DIR__ . '/../uploads/invoices';
    if (!is_dir($baseDir)) {
        mkdir($baseDir, 0775, true);
    }

    $safeNumber = preg_replace('/[^A-Za-z0-9_-]/', '_', $invoice['invoice_number'] ?? ('INV_' . $invoice['id']));
    $safeParticipant = preg_replace('/[^A-Za-z0-9_-]/', '_', $invoice['participant_name'] ?? 'participant');
    $filename = sprintf('%s-%s.pdf', $safeNumber, $safeParticipant);
    $fullPath = $baseDir . '/' . $filename;

    $companyName = $invoice['company_name_snapshot'] ?: ($company['company_name'] ?? 'Goodwill Care Academy');
    $companyAbn = $invoice['company_abn_snapshot'] ?: ($company['abn'] ?? '');
    $companyEmail = $invoice['company_email_snapshot'] ?: ($company['email'] ?? '');
    $companyPhone = $invoice['company_phone_snapshot'] ?: ($company['phone'] ?? '');
    $companyAddress = $invoice['company_address_snapshot'] ?: ($company['address'] ?? '');
    $companyLogo = $invoice['company_logo_snapshot'] ?: ($company['logo_path'] ?? '');
    $bsb = $invoice['company_bsb_snapshot'] ?: ($company['bsb'] ?? '');
    $bankAccount = $invoice['company_bank_account_snapshot'] ?: ($company['bank_account_number'] ?? '');
    $accountName = $invoice['company_account_name_snapshot'] ?: ($company['account_name'] ?? '');
    $paymentCode = $invoice['payment_instruction_code'] ?: ($company['payment_instruction_code'] ?? 'INV_RR_006_CB');

    $lines = [];
    $lines[] = $companyName;
    $lines[] = 'ABN: ' . $companyAbn;
    $lines[] = trim('Email: ' . $companyEmail . '  Phone: ' . $companyPhone);
    if ($companyAddress) {
        $lines[] = 'Address: ' . $companyAddress;
    }
    if ($companyLogo) {
        $lines[] = 'Logo: ' . $companyLogo;
    }
    $lines[] = str_repeat('-', 90);
    $lines[] = 'Invoice Number: ' . ($invoice['invoice_number'] ?? '');
    $lines[] = 'Invoice Date: ' . ($invoice['invoice_date'] ?? '');
    $lines[] = 'Due Date: ' . ($invoice['due_date'] ?? '');
    $lines[] = 'Participant: ' . ($invoice['participant_name'] ?? '');
    $lines[] = 'NDIS Number: ' . ($invoice['participant_ndis_number'] ?? '');
    $lines[] = 'Service Date Range: ' . ($invoice['date_from'] ?? '') . ' to ' . ($invoice['date_to'] ?? '');
    $lines[] = str_repeat('-', 90);
    $lines[] = 'Items';
    $lines[] = 'Date Range | Line Item | Hours | Rate | Amount';

    foreach ($items as $item) {
        $range = ($item['service_date_from'] ?? '') . ' to ' . ($item['service_date_to'] ?? '');
        $lineItem = trim(($item['line_item_code'] ?? '') . ' ' . ($item['line_item_description'] ?? ''));
        $hours = inv_format_money((float) ($item['quantity_hours'] ?? 0));
        $rate = inv_format_money((float) ($item['rate'] ?? 0));
        $amount = inv_format_money((float) ($item['amount'] ?? 0));
        $lines[] = sprintf('%s | %s | %s | %s | %s', $range, $lineItem, $hours, $rate, $amount);
    }

    $lines[] = str_repeat('-', 90);
    $lines[] = 'Subtotal: AUD ' . inv_format_money((float) ($invoice['subtotal'] ?? 0));
    $lines[] = 'Total: AUD ' . inv_format_money((float) ($invoice['total'] ?? 0));
    $lines[] = str_repeat('-', 90);
    $lines[] = 'Payment Details';
    $lines[] = 'Account Name: ' . $accountName;
    $lines[] = 'BSB: ' . $bsb;
    $lines[] = 'Account Number: ' . $bankAccount;
    $lines[] = 'Reference: ' . $paymentCode;

    if (!empty($invoice['notes'])) {
        $lines[] = str_repeat('-', 90);
        $lines[] = 'Notes: ' . $invoice['notes'];
    }

    inv_write_simple_pdf($fullPath, $lines);
    return '/api/uploads/invoices/' . $filename;
}
