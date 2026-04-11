-- Migration 003: Invoicing

CREATE TABLE IF NOT EXISTS company_settings (
    id                           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_name                 VARCHAR(255) NOT NULL,
    logo_path                    VARCHAR(512),
    abn                          VARCHAR(64) NOT NULL,
    address                      TEXT,
    phone                        VARCHAR(64),
    email                        VARCHAR(255),
    bsb                          VARCHAR(32) NOT NULL,
    bank_account_number          VARCHAR(64) NOT NULL,
    account_name                 VARCHAR(255),
    invoice_prefix               VARCHAR(32) NOT NULL DEFAULT 'INV',
    default_due_days             INTEGER NOT NULL DEFAULT 7,
    default_currency             VARCHAR(16) NOT NULL DEFAULT 'AUD',
    default_line_item_code       VARCHAR(64) NOT NULL DEFAULT '09_008_0116_6_3',
    default_line_item_description VARCHAR(255) NOT NULL DEFAULT 'Innovative Community Participation',
    default_hourly_rate          DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    rounding_precision           INTEGER NOT NULL DEFAULT 2,
    payment_instruction_code     VARCHAR(64) NOT NULL DEFAULT 'INV_RR_006_CB',
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS invoice_sequences (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_prefix VARCHAR(32) NOT NULL,
    period_key     CHAR(6) NOT NULL,
    last_serial    INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (invoice_prefix, period_key)
);
CREATE TRIGGER trg_invoice_sequences_updated_at
    BEFORE UPDATE ON invoice_sequences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS invoices (
    id                           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_number               VARCHAR(100) NOT NULL UNIQUE,
    user_id                      INTEGER,
    participant_id               INTEGER,
    participant_name             VARCHAR(255) NOT NULL,
    participant_ndis_number      VARCHAR(64) NOT NULL,
    company_settings_id          INTEGER,
    invoice_date                 DATE NOT NULL,
    due_date                     DATE NOT NULL,
    date_from                    DATE NOT NULL,
    date_to                      DATE NOT NULL,
    status                       VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','unpaid','paid','sent','overdue')),
    currency                     VARCHAR(16) NOT NULL DEFAULT 'AUD',
    subtotal                     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total                        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount                 DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_hours                  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_seconds_raw            INTEGER NOT NULL DEFAULT 0,
    notes                        TEXT,
    source_type                  VARCHAR(64) NOT NULL DEFAULT 'activity_logs',
    created_by_admin_id          INTEGER,
    paid_at                      TIMESTAMPTZ,
    payment_date                 TIMESTAMPTZ,
    payment_reference            VARCHAR(255),
    pdf_path                     VARCHAR(512),
    company_name_snapshot        VARCHAR(255),
    company_abn_snapshot         VARCHAR(64),
    company_address_snapshot     TEXT,
    company_phone_snapshot       VARCHAR(64),
    company_email_snapshot       VARCHAR(255),
    company_bsb_snapshot         VARCHAR(32),
    company_bank_account_snapshot VARCHAR(64),
    company_account_name_snapshot VARCHAR(255),
    company_logo_snapshot        VARCHAR(512),
    payment_instruction_code     VARCHAR(64),
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_user   ON invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date   ON invoices (invoice_date);
CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS invoice_items (
    id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id            INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    service_date_from     DATE,
    service_date_to       DATE,
    line_item_code        VARCHAR(64) NOT NULL,
    line_item_description VARCHAR(255) NOT NULL,
    quantity_hours        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    rate                  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    amount                DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items (invoice_id);
CREATE TRIGGER trg_invoice_items_updated_at
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS invoice_log_sources (
    id                     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id             INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    user_id                INTEGER NOT NULL,
    source_start_date      DATE NOT NULL,
    source_end_date        DATE NOT NULL,
    total_seconds_included INTEGER NOT NULL DEFAULT 0,
    summary_json           TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoice_log_sources_invoice   ON invoice_log_sources (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_log_sources_user_date ON invoice_log_sources (user_id, source_start_date, source_end_date);
