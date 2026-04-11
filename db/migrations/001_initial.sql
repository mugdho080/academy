-- Migration 001: Core schema
-- Users, chapters, levels, lessons, quizzes, progress, sessions, time_entries, activity_events, service_agreements

-- Reusable trigger function for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    ndis_number VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role        VARCHAR(16) NOT NULL DEFAULT 'learner' CHECK (role IN ('learner','admin')),
    status      VARCHAR(16) NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','pending','active')),
    points      INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Chapters
CREATE TABLE IF NOT EXISTS chapters (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    emoji       VARCHAR(20),
    order_index INTEGER NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Levels
CREATE TABLE IF NOT EXISTS levels (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chapter_id  INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    video_url   VARCHAR(255),
    is_free     BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL
);

-- Lessons
CREATE TABLE IF NOT EXISTS lessons (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    level_id    INTEGER NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    content     TEXT,
    order_index INTEGER NOT NULL
);

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lesson_id      INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    question       TEXT NOT NULL,
    options        JSONB NOT NULL,
    correct_answer INTEGER NOT NULL
);

-- Progress
CREATE TABLE IF NOT EXISTS progress (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id    INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT TRUE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, lesson_id)
);

-- Activity log (daily rollup)
CREATE TABLE IF NOT EXISTS activity_log (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date  DATE NOT NULL,
    seconds_active INTEGER DEFAULT 0,
    UNIQUE (user_id, activity_date)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_at             TIMESTAMPTZ NOT NULL,
    logout_at            TIMESTAMPTZ,
    total_seconds_active INTEGER NOT NULL DEFAULT 0,
    last_ping_at         TIMESTAMPTZ NOT NULL,
    status               VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','expired'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_login  ON sessions (user_id, login_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON sessions (user_id, status);

-- Time entries
CREATE TABLE IF NOT EXISTS time_entries (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id   INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context_type VARCHAR(16) NOT NULL CHECK (context_type IN ('dashboard','chapter','level','lesson')),
    chapter_id   INTEGER,
    level_id     INTEGER,
    lesson_id    INTEGER,
    start_at     TIMESTAMPTZ NOT NULL,
    end_at       TIMESTAMPTZ,
    seconds_active INTEGER NOT NULL DEFAULT 0,
    date_key     DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date   ON time_entries (user_id, date_key);
CREATE INDEX IF NOT EXISTS idx_time_entries_context     ON time_entries (context_type, chapter_id, level_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_session     ON time_entries (session_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_bucket      ON time_entries (session_id, date_key, context_type, chapter_id, level_id, lesson_id);

-- Activity events (idempotency)
CREATE TABLE IF NOT EXISTS activity_events (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id     VARCHAR(64) NOT NULL UNIQUE,
    session_id   INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_event VARCHAR(32) NOT NULL,
    client_ts    TIMESTAMPTZ,
    processed_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_events_session   ON activity_events (session_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_time ON activity_events (user_id, processed_at);

-- Service agreements
CREATE TABLE IF NOT EXISTS service_agreements (
    id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signed_at            TIMESTAMPTZ DEFAULT NOW(),
    signature_data       TEXT,
    full_name            VARCHAR(255),
    dob                  DATE,
    address              TEXT,
    phone                VARCHAR(50),
    emergency_contact    VARCHAR(255),
    ndis_number          VARCHAR(50),
    nominee              VARCHAR(255),
    plan_type            VARCHAR(32) CHECK (plan_type IN ('NDIA','Plan Managed','Self Managed')),
    who_pays             VARCHAR(32) CHECK (who_pays IN ('NDIA','Plan Manager','Participant')),
    plan_manager_name    VARCHAR(255),
    plan_manager_contact VARCHAR(255),
    plan_start_date      DATE,
    plan_end_date        DATE,
    line_item_code       VARCHAR(100) DEFAULT 'Innovative Community Participation | 09_008_0116_6_3',
    price                VARCHAR(50) DEFAULT '$50/hr'
);

-- Seed: initial admin account (password: 'admin')
INSERT INTO users (name, email, ndis_number, password_hash, role, status)
VALUES ('Super Admin', 'admin@admin.com', 'ADMIN001',
        '$2b$12$GybGioIw9Oo7EAWU6IS5le2kUI2LLAbUGOb8bKC55ealN/NPvk5kG', 'admin', 'active')
ON CONFLICT (email) DO NOTHING;
