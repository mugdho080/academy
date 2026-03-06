<?php
require_once __DIR__ . '/../db_connect.php';

$sqls = [
    // 1. Leads
    "CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        status ENUM('new', 'qualified', 'agreement_sent', 'converted') DEFAULT 'new',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
    )",

    // 2. Participants (Extended from users or separate? The prompt says "Participants". We will create a participants table to keep it clean, linking to user_id or acting as the main profile if they are users).
    // Prompt asks for participants: id, full_name, ndis_number, email, phone, plan_type, stage, risk_flag. 
    // We already have a 'users' table which learners use to login. Let's merge or map?
    // "Participants" table as per prompt:
    "CREATE TABLE IF NOT EXISTS participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL COMMENT 'Link to users table if they have login',
        full_name VARCHAR(255) NOT NULL,
        ndis_number VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        plan_type ENUM('NDIA', 'PLAN_MANAGED', 'SELF') DEFAULT 'NDIA',
        stage ENUM('lead', 'active', 'claim_ready', 'submitted', 'paid', 'rejected') DEFAULT 'lead',
        risk_flag BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_stage (stage),
        INDEX idx_risk (risk_flag)
    )",

    // 3. Plans
    "CREATE TABLE IF NOT EXISTS plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        participant_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        plan_manager_name VARCHAR(255) NULL,
        plan_manager_email VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    )",

    // 4. Plan Line Items
    "CREATE TABLE IF NOT EXISTS plan_line_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL,
        code VARCHAR(255) NOT NULL,
        category VARCHAR(255),
        unit_type VARCHAR(50),
        rate_cap DECIMAL(10,2) NOT NULL,
        approved_amount DECIMAL(10,2) NOT NULL,
        remaining_balance DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    )",

    // 5. Service Agreements (Replacement / Extension for existing)
    "CREATE TABLE IF NOT EXISTS crm_service_agreements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        participant_id INT NOT NULL,
        version VARCHAR(50) DEFAULT '1.0',
        signed_at TIMESTAMP NULL DEFAULT NULL,
        signer_name VARCHAR(255),
        pdf_path VARCHAR(512),
        pdf_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    )",

    // 6. Consents
    "CREATE TABLE IF NOT EXISTS consents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        participant_id INT NOT NULL,
        consent_type VARCHAR(100) NOT NULL,
        signed BOOLEAN DEFAULT FALSE,
        signed_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    )",

    // 7. CRM Sessions
    "CREATE TABLE IF NOT EXISTS crm_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        participant_id INT NOT NULL,
        line_item_id INT NOT NULL,
        session_date DATE NOT NULL,
        duration_minutes INT NOT NULL,
        attendance_status ENUM('attended', 'no_show', 'cancelled') DEFAULT 'attended',
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
        FOREIGN KEY (line_item_id) REFERENCES plan_line_items(id) ON DELETE CASCADE
    )",

    // 8. Evidence
    "CREATE TABLE IF NOT EXISTS evidence (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        session_note TEXT,
        attendance_confirmation BOOLEAN DEFAULT FALSE,
        outcome_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (session_id) REFERENCES crm_sessions(id) ON DELETE CASCADE
    )",

    // 9. Claims
    "CREATE TABLE IF NOT EXISTS claims (
        id INT AUTO_INCREMENT PRIMARY KEY,
        participant_id INT NOT NULL,
        payer_type ENUM('NDIA', 'PLAN_MANAGER', 'SELF') NOT NULL,
        status ENUM('draft', 'ready', 'submitted', 'paid', 'rejected') DEFAULT 'draft',
        submitted_at TIMESTAMP NULL DEFAULT NULL,
        paid_at TIMESTAMP NULL DEFAULT NULL,
        rejection_reason TEXT,
        remittance_reference VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
        INDEX idx_claim_status (status)
    )",

    // 10. Claim Lines
    "CREATE TABLE IF NOT EXISTS claim_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        claim_id INT NOT NULL,
        session_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES crm_sessions(id) ON DELETE CASCADE
    )",

    // 11. Invoices
    "CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        participant_id INT NOT NULL,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        due_date DATE NOT NULL,
        status ENUM('sent', 'paid', 'overdue') DEFAULT 'sent',
        total_amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
        INDEX idx_invoice_status (status)
    )",

    // 12. Audit Logs
    "CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        before_json JSON NULL,
        after_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )"
];

$response = [];
foreach ($sqls as $sql) {
    try {
        $pdo->exec($sql);
        $response[] = "Executed: " . substr(trim($sql), 0, 50) . "...";
    } catch (PDOException $e) {
        $response[] = "Error on " . substr(trim($sql), 0, 50) . "... : " . $e->getMessage();
    }
}

// Ensure default super admin exists
try {
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = 'admin@admin.com'");
    $stmt->execute();
    if (!$stmt->fetch()) {
        $hash = password_hash('admin', PASSWORD_DEFAULT);
        $insert = $pdo->prepare("INSERT INTO users (name, email, ndis_number, password_hash, role, status) VALUES ('Super Admin', 'admin@admin.com', 'ADMIN_SUPER', ?, 'admin', 'active')");
        $insert->execute([$hash]);
        $response[] = "Created super admin user.";
    } else {
        $response[] = "Super admin user already exists.";
    }
} catch (PDOException $e) {
    $response[] = "Super admin check error: " . $e->getMessage();
}

echo json_encode(['success' => true, 'log' => $response], JSON_PRETTY_PRINT);
?>
