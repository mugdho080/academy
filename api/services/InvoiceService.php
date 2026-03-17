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
        'payment_instruction_code' => "VARCHAR(64) NULL",
        'participant_email_snapshot' => "VARCHAR(255) NULL",
        'participant_phone_snapshot' => "VARCHAR(64) NULL"
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

function inv_pdf_num(float $value): string
{
    $formatted = number_format($value, 2, '.', '');
    return rtrim(rtrim($formatted, '0'), '.');
}

function inv_pdf_text_width(string $text, float $fontSize): float
{
    $units = 0.0;
    $wide = 'WMQG@%&';
    $narrow = 'ijlI1.,:;|!\'` ';

    foreach (preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY) as $char) {
        if (strpos($wide, $char) !== false) {
            $units += 0.9;
        } elseif (strpos($narrow, $char) !== false) {
            $units += 0.28;
        } elseif (ctype_upper($char)) {
            $units += 0.68;
        } else {
            $units += 0.56;
        }
    }

    return $units * $fontSize;
}

function inv_pdf_wrap_text(string $text, float $maxWidth, float $fontSize): array
{
    $text = trim(preg_replace('/\s+/', ' ', $text));
    if ($text === '') {
        return [''];
    }

    $words = preg_split('/\s+/', $text) ?: [];
    $lines = [];
    $current = '';

    foreach ($words as $word) {
        $candidate = $current === '' ? $word : $current . ' ' . $word;
        if ($current !== '' && inv_pdf_text_width($candidate, $fontSize) > $maxWidth) {
            $lines[] = $current;
            $current = $word;
            continue;
        }
        $current = $candidate;
    }

    if ($current !== '') {
        $lines[] = $current;
    }

    return $lines ?: [''];
}

function inv_pdf_add_text(array &$pages, int $pageIndex, float $x, float $y, string $text, string $font = 'F1', float $size = 10.0, string $align = 'left'): void
{
    $width = inv_pdf_text_width($text, $size);
    if ($align === 'right') {
        $x -= $width;
    } elseif ($align === 'center') {
        $x -= $width / 2;
    }

    $pages[$pageIndex][] = sprintf(
        "BT /%s %s Tf 1 0 0 1 %s %s Tm (%s) Tj ET",
        $font,
        inv_pdf_num($size),
        inv_pdf_num($x),
        inv_pdf_num($y),
        inv_escape_pdf_text($text)
    );
}

function inv_pdf_add_line(array &$pages, int $pageIndex, float $x1, float $y1, float $x2, float $y2, float $width = 0.6): void
{
    $pages[$pageIndex][] = sprintf(
        "%s w %s %s m %s %s l S",
        inv_pdf_num($width),
        inv_pdf_num($x1),
        inv_pdf_num($y1),
        inv_pdf_num($x2),
        inv_pdf_num($y2)
    );
}

function inv_pdf_new_page(array &$pages): int
{
    $pages[] = [
        "0 0 0 rg",
        "0 0 0 RG"
    ];
    return count($pages) - 1;
}

function inv_pdf_write_document(string $filePath, array $pages): void
{
    $objects = [];
    $objects[] = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj";

    $pageCount = count($pages);
    $kids = [];
    $nextObjectId = 3;
    $pageObjectIds = [];
    $contentObjectIds = [];

    for ($i = 0; $i < $pageCount; $i++) {
        $pageObjectIds[$i] = $nextObjectId++;
        $contentObjectIds[$i] = $nextObjectId++;
        $kids[] = $pageObjectIds[$i] . ' 0 R';
    }

    $objects[] = "2 0 obj << /Type /Pages /Count {$pageCount} /Kids [" . implode(' ', $kids) . "] >> endobj";

    for ($i = 0; $i < $pageCount; $i++) {
        $objects[] = sprintf(
            "%d 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R /F2 %d 0 R >> >> >> endobj",
            $pageObjectIds[$i],
            $contentObjectIds[$i],
            $nextObjectId,
            $nextObjectId + 1
        );

        $content = implode("\n", $pages[$i]);
        $length = strlen($content);
        $objects[] = sprintf("%d 0 obj << /Length %d >> stream\n%s\nendstream endobj", $contentObjectIds[$i], $length, $content);
    }

    $objects[] = sprintf("%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj", $nextObjectId);
    $objects[] = sprintf("%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj", $nextObjectId + 1);

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

function inv_format_invoice_display_date(?string $date, string $format = 'd-M-Y'): string
{
    if (!$date) {
        return '';
    }

    $ts = strtotime($date);
    if ($ts === false) {
        return (string) $date;
    }

    return date($format, $ts);
}

function inv_resolve_invoice_recipient(PDO $pdo, array $invoice): array
{
    $email = trim((string) ($invoice['participant_email_snapshot'] ?? ''));
    $phone = trim((string) ($invoice['participant_phone_snapshot'] ?? ''));
    $userId = (int) ($invoice['user_id'] ?? 0);

    if ($userId > 0 && ($email === '' || $phone === '')) {
        $stmt = $pdo->prepare("
            SELECT
                u.email,
                (
                    SELECT sa.phone
                    FROM service_agreements sa
                    WHERE sa.user_id = u.id
                    ORDER BY sa.signed_at DESC, sa.id DESC
                    LIMIT 1
                ) AS phone
            FROM users u
            WHERE u.id = ?
            LIMIT 1
        ");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        if ($email === '') {
            $email = trim((string) ($row['email'] ?? ''));
        }
        if ($phone === '') {
            $phone = trim((string) ($row['phone'] ?? ''));
        }
    }

    return [
        'email' => $email,
        'phone' => $phone
    ];
}

function inv_render_invoice_header(array &$pages, int $pageIndex, float $left, float $right, array $companyLines, array $recipientLines, array $metaRows): float
{
    inv_pdf_add_text($pages, $pageIndex, $left, 794, 'INVOICE', 'F2', 21);

    $y = 764;
    foreach ($companyLines as $index => $line) {
        inv_pdf_add_text($pages, $pageIndex, $left, $y, $line, $index === 0 ? 'F2' : 'F1', $index === 0 ? 12 : 10);
        $y -= $index === 0 ? 18 : 14;
    }

    $recipientTop = 690;
    foreach ($recipientLines as $index => $line) {
        inv_pdf_add_text($pages, $pageIndex, $left, $recipientTop - ($index * 15), $line, $index === 0 ? 'F2' : 'F1', 10);
    }

    $metaLabelX = 380;
    $metaValueX = $right;
    $metaY = 760;
    foreach ($metaRows as $row) {
        inv_pdf_add_text($pages, $pageIndex, $metaLabelX, $metaY, $row['label'], 'F2', 10);
        inv_pdf_add_text($pages, $pageIndex, $metaValueX, $metaY, $row['value'], 'F1', 10, 'right');
        $metaY -= 16;
    }

    return 626;
}

function inv_generate_invoice_pdf_file(PDO $pdo, array $invoice, array $items, array $company): string
{
    $baseDir = __DIR__ . '/../uploads/invoices';
    if (!is_dir($baseDir)) {
        mkdir($baseDir, 0775, true);
    }

    $safeNumber = preg_replace('/[^A-Za-z0-9_-]/', '_', $invoice['invoice_number'] ?? ('INV_' . $invoice['id']));
    $safeParticipant = preg_replace('/[^A-Za-z0-9_-]/', '_', $invoice['participant_name'] ?? 'participant');
    $filename = sprintf('%s-%s.pdf', $safeNumber, $safeParticipant);
    $fullPath = $baseDir . '/' . $filename;

    $defaults = [
        'company_name' => 'Goodwill Care',
        'abn' => '41 633 362 893',
        'address' => '132 Tower Street, Panania, Panania, NSW-2213, Australia.',
        'phone' => '1800 070 872',
        'email' => 'accounts@goodwillcare.com.au',
        'bsb' => '062-334',
        'bank_account_number' => '1180 4799',
        'account_name' => 'Goodwill Care'
    ];

    $companyName = trim((string) (($invoice['company_name_snapshot'] ?: ($company['company_name'] ?? '')) ?: $defaults['company_name']));
    $companyAbn = trim((string) (($invoice['company_abn_snapshot'] ?: ($company['abn'] ?? '')) ?: $defaults['abn']));
    $companyEmail = trim((string) (($invoice['company_email_snapshot'] ?: ($company['email'] ?? '')) ?: $defaults['email']));
    $companyPhone = trim((string) (($invoice['company_phone_snapshot'] ?: ($company['phone'] ?? '')) ?: $defaults['phone']));
    $companyAddress = trim((string) (($invoice['company_address_snapshot'] ?: ($company['address'] ?? '')) ?: $defaults['address']));
    $bsb = trim((string) (($invoice['company_bsb_snapshot'] ?: ($company['bsb'] ?? '')) ?: $defaults['bsb']));
    $bankAccount = trim((string) (($invoice['company_bank_account_snapshot'] ?: ($company['bank_account_number'] ?? '')) ?: $defaults['bank_account_number']));
    $accountName = trim((string) (($invoice['company_account_name_snapshot'] ?: ($company['account_name'] ?? '')) ?: $defaults['account_name']));

    $recipient = inv_resolve_invoice_recipient($pdo, $invoice);

    $left = 36.0;
    $right = 559.0;
    $tableTop = 0.0;
    $pages = [];
    $pageIndex = inv_pdf_new_page($pages);

    $companyLines = [
        $companyName,
        'ABN ' . $companyAbn,
        'Address: ' . $companyAddress,
        'Phone: ' . $companyPhone,
        'Email: ' . $companyEmail
    ];

    $recipientLines = [
        'To: ' . (string) ($invoice['participant_name'] ?? ''),
        'Ph: ' . $recipient['phone'],
        'Email: ' . $recipient['email']
    ];

    $metaRows = [
        ['label' => 'Invoice Number:', 'value' => (string) ($invoice['invoice_number'] ?? '')],
        ['label' => 'Invoice Date:', 'value' => inv_format_invoice_display_date($invoice['invoice_date'] ?? null)],
        ['label' => 'Due Date:', 'value' => inv_format_invoice_display_date($invoice['due_date'] ?? null)],
        ['label' => 'NDIS Participant:', 'value' => (string) ($invoice['participant_name'] ?? '')],
        ['label' => 'NDIS Number:', 'value' => (string) ($invoice['participant_ndis_number'] ?? '')]
    ];

    $tableTop = inv_render_invoice_header($pages, $pageIndex, $left, $right, $companyLines, $recipientLines, $metaRows);

    $columns = [
        ['label' => 'Dt.From', 'x' => 36.0, 'w' => 52.0, 'align' => 'left'],
        ['label' => 'Dt.To', 'x' => 88.0, 'w' => 52.0, 'align' => 'left'],
        ['label' => 'Description', 'x' => 140.0, 'w' => 176.0, 'align' => 'left'],
        ['label' => 'NDIS S.L.Item', 'x' => 316.0, 'w' => 92.0, 'align' => 'left'],
        ['label' => 'Frequency', 'x' => 408.0, 'w' => 44.0, 'align' => 'center'],
        ['label' => 'Rate', 'x' => 452.0, 'w' => 45.0, 'align' => 'right'],
        ['label' => 'Amount', 'x' => 497.0, 'w' => 62.0, 'align' => 'right']
    ];

    $drawTableHeader = static function (array &$pdfPages, int $idx, float $y) use ($columns, $left, $right): float {
        inv_pdf_add_line($pdfPages, $idx, $left, $y + 4, $right, $y + 4, 0.9);
        foreach ($columns as $column) {
            $textX = $column['align'] === 'right'
                ? $column['x'] + $column['w'] - 1
                : ($column['align'] === 'center' ? $column['x'] + ($column['w'] / 2) : $column['x']);
            inv_pdf_add_text($pdfPages, $idx, $textX, $y - 8, $column['label'], 'F2', 9, $column['align']);
        }
        inv_pdf_add_line($pdfPages, $idx, $left, $y - 14, $right, $y - 14, 0.8);
        return $y - 28;
    };

    $y = $drawTableHeader($pages, $pageIndex, $tableTop);

    foreach ($items as $item) {
        $from = inv_format_invoice_display_date($item['service_date_from'] ?? null, 'd-m-Y');
        $to = inv_format_invoice_display_date($item['service_date_to'] ?? null, 'd-m-Y');
        $descLines = inv_pdf_wrap_text((string) ($item['line_item_description'] ?? ''), 172, 9.5);
        $codeLines = inv_pdf_wrap_text((string) ($item['line_item_code'] ?? ''), 88, 9.5);
        $rowLines = max(count($descLines), count($codeLines), 1);
        $rowHeight = max(18.0, ($rowLines * 12.0) + 4.0);

        if ($y - $rowHeight < 120) {
            $pageIndex = inv_pdf_new_page($pages);
            $y = inv_render_invoice_header($pages, $pageIndex, $left, $right, $companyLines, $recipientLines, $metaRows);
            $y = $drawTableHeader($pages, $pageIndex, $y);
        }

        inv_pdf_add_text($pages, $pageIndex, 36.0, $y, $from, 'F1', 9.5);
        inv_pdf_add_text($pages, $pageIndex, 88.0, $y, $to, 'F1', 9.5);

        foreach ($descLines as $lineIndex => $line) {
            inv_pdf_add_text($pages, $pageIndex, 140.0, $y - ($lineIndex * 12), $line, 'F1', 9.5);
        }
        foreach ($codeLines as $lineIndex => $line) {
            inv_pdf_add_text($pages, $pageIndex, 316.0, $y - ($lineIndex * 12), $line, 'F1', 9.5);
        }

        inv_pdf_add_text($pages, $pageIndex, 430.0, $y, inv_format_money((float) ($item['quantity_hours'] ?? 0)), 'F1', 9.5, 'center');
        inv_pdf_add_text($pages, $pageIndex, 496.0, $y, inv_format_money((float) ($item['rate'] ?? 0)), 'F1', 9.5, 'right');
        inv_pdf_add_text($pages, $pageIndex, 557.0, $y, inv_format_money((float) ($item['amount'] ?? 0)), 'F1', 9.5, 'right');

        $bottomLineY = $y - $rowHeight + 5;
        inv_pdf_add_line($pages, $pageIndex, $left, $bottomLineY, $right, $bottomLineY, 0.35);
        $y -= $rowHeight;
    }

    $totalY = $y - 8;
    if ($totalY < 140) {
        $pageIndex = inv_pdf_new_page($pages);
        $totalY = 760;
    }

    inv_pdf_add_line($pages, $pageIndex, 390, $totalY + 12, 559, $totalY + 12, 0.8);
    inv_pdf_add_text($pages, $pageIndex, 455, $totalY, 'Invoice Total', 'F2', 11, 'right');
    inv_pdf_add_text($pages, $pageIndex, 557, $totalY, inv_format_money((float) ($invoice['total'] ?? 0)), 'F2', 11, 'right');

    $paymentY = $totalY - 40;
    inv_pdf_add_text($pages, $pageIndex, $left, $paymentY, 'PLEASE MAKE PAYMENT TO:', 'F2', 10.5);
    inv_pdf_add_text($pages, $pageIndex, $left, $paymentY - 18, 'ACCOUNT NAME: ' . $accountName, 'F1', 10);
    inv_pdf_add_text($pages, $pageIndex, $left, $paymentY - 34, 'BSB: ' . $bsb, 'F1', 10);
    inv_pdf_add_text($pages, $pageIndex, $left, $paymentY - 50, 'ACCOUNT: ' . $bankAccount, 'F1', 10);

    $footerText = 'A full list of codes and description of these line items can be found in the Price Guide of the NDIS, available at https://www.ndis.gov.au/providers/pricing-and-payment.html';
    $footerLines = inv_pdf_wrap_text($footerText, 520, 9);
    $footerY = max(56, $paymentY - 96);
    foreach ($footerLines as $index => $line) {
        inv_pdf_add_text($pages, $pageIndex, $left, $footerY - ($index * 12), $line, 'F1', 9);
    }

    inv_pdf_write_document($fullPath, $pages);
    return '/api/uploads/invoices/' . $filename;
}
