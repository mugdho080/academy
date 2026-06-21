-- Migration: PostgreSQL-compatible resume + gamification schema
-- Replaces the broken MySQL-syntax migrations:
--   20231101_create_resume_tables.sql
--   20231102_gamification_schema.sql
-- All statements are idempotent (CREATE IF NOT EXISTS / ON CONFLICT DO NOTHING).

-- ─── Resume tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS resumes (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL,
    title               VARCHAR(255) NOT NULL,
    target_role         VARCHAR(255),
    template_key        VARCHAR(50) DEFAULT 'simple',
    status              TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
    professional_summary TEXT,
    resume_data         JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    last_downloaded_at  TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS resume_builder_sessions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL UNIQUE,
    status          TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    current_step    TEXT,
    answers         JSONB DEFAULT '{}'::jsonb,
    draft_resume    JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS resume_downloads (
    id           SERIAL PRIMARY KEY,
    resume_id    INTEGER NOT NULL,
    user_id      INTEGER NOT NULL,
    downloaded_at TIMESTAMPTZ DEFAULT NOW(),
    format       VARCHAR(20) DEFAULT 'pdf',
    template_key VARCHAR(50)
);

-- ─── Routine builder table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS routine_builder_sessions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL UNIQUE,
    status          TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    current_step    TEXT,
    answers         JSONB DEFAULT '{}'::jsonb,
    draft_routine   JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS routines (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL,
    title        VARCHAR(255) NOT NULL,
    routine_data JSONB,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Gamification tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_xp_wallet (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL UNIQUE,
    total_xp          INTEGER DEFAULT 0,
    current_coins     INTEGER DEFAULT 0,
    lifetime_coins    INTEGER DEFAULT 0,
    current_rank_key  VARCHAR(50) DEFAULT 'seed_learner',
    current_streak    INTEGER DEFAULT 0,
    best_streak       INTEGER DEFAULT 0,
    last_streak_date  DATE NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_xp_wallet_user_id ON user_xp_wallet (user_id);

CREATE TABLE IF NOT EXISTS xp_events (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL,
    event_type       VARCHAR(100) NOT NULL,
    xp_amount        INTEGER NOT NULL,
    coin_amount      INTEGER NOT NULL,
    source_type      VARCHAR(100),
    source_id        VARCHAR(100),
    idempotency_key  VARCHAR(255) UNIQUE NOT NULL,
    metadata         JSONB,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_xp_events_user_id   ON xp_events (user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_event_type ON xp_events (event_type);

CREATE TABLE IF NOT EXISTS badge_definitions (
    id                  SERIAL PRIMARY KEY,
    badge_key           VARCHAR(100) UNIQUE NOT NULL,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    icon                VARCHAR(255),
    category            VARCHAR(100),
    requirement_type    VARCHAR(100),
    requirement_value   INTEGER,
    xp_reward           INTEGER DEFAULT 0,
    coin_reward         INTEGER DEFAULT 0,
    is_active           BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS user_badges (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    badge_key  VARCHAR(100) NOT NULL,
    earned_at  TIMESTAMPTZ DEFAULT NOW(),
    metadata   JSONB,
    UNIQUE (user_id, badge_key)
);

CREATE TABLE IF NOT EXISTS rank_definitions (
    id          SERIAL PRIMARY KEY,
    rank_key    VARCHAR(100) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    min_xp      INTEGER NOT NULL,
    icon        VARCHAR(255),
    theme_color VARCHAR(50),
    sort_order  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cosmetic_shop_items (
    id           SERIAL PRIMARY KEY,
    cosmetic_key VARCHAR(100) UNIQUE NOT NULL,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    category     VARCHAR(100),
    icon         VARCHAR(255),
    coin_cost    INTEGER NOT NULL,
    is_active    BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS user_cosmetics (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL,
    cosmetic_key VARCHAR(100) NOT NULL,
    unlocked_at  TIMESTAMPTZ DEFAULT NOW(),
    equipped_at  TIMESTAMPTZ NULL,
    UNIQUE (user_id, cosmetic_key)
);

-- ─── Seed rank_definitions ────────────────────────────────────────────────────

INSERT INTO rank_definitions (rank_key, name, min_xp, icon, theme_color, sort_order) VALUES
    ('seed_learner',      'Seed Learner 🌱',        0,    '🌱', '#4ade80', 1),
    ('curious_cub',       'Curious Cub 🐼',         100,  '🐼', '#3b82f6', 2),
    ('focus_friend',      'Focus Friend ⭐',         300,  '⭐', '#f59e0b', 3),
    ('skill_builder',     'Skill Builder 🛠️',       700,  '🛠️', '#8b5cf6', 4),
    ('chapter_explorer',  'Chapter Explorer 🧭',    1500, '🧭', '#ec4899', 5),
    ('knowledge_hero',    'Knowledge Hero 🦸',      3000, '🦸', '#ef4444', 6),
    ('academy_champion',  'Academy Champion 🏆',    5000, '🏆', '#eab308', 7)
ON CONFLICT (rank_key) DO NOTHING;

-- ─── Seed badge_definitions ───────────────────────────────────────────────────

INSERT INTO badge_definitions (badge_key, name, description, icon, category, requirement_type) VALUES
    ('first_step',    'First Step',          'Completed your first lesson',          '👟', 'milestone', 'lesson_count'),
    ('quiz_star',     'Quiz Star',           'Completed your first quiz',            '⭐', 'milestone', 'quiz_count'),
    ('perfect_panda', 'Perfect Panda',       'Scored 100%% on a quiz',              '💯', 'milestone', 'perfect_quiz'),
    ('three_day_spark','Three Day Spark',    'Maintained a 3-day learning streak',   '🔥', 'streak',    'streak_days'),
    ('resume_ready',  'Resume Ready',        'Built and saved your first resume',    '📄', 'milestone', 'resume_saved'),
    ('routine_hero',  'Routine Hero',        'Created your first daily routine',     '📅', 'milestone', 'routine_saved')
ON CONFLICT (badge_key) DO NOTHING;

-- ─── Seed cosmetic_shop_items ─────────────────────────────────────────────────

INSERT INTO cosmetic_shop_items (cosmetic_key, name, description, category, icon, coin_cost) VALUES
    ('hat_tophat',    'Panda Top Hat',         'A classy top hat for your Panda avatar.',   'hat',        '🎩', 30),
    ('frame_rainbow', 'Rainbow Frame',         'A colorful frame for your profile.',        'frame',      '🌈', 50),
    ('bg_forest',     'Forest Background',     'A peaceful bamboo forest backdrop.',        'background', '🌲', 80),
    ('fx_firework',   'Firework Celebration',  'Explosive fireworks when you level up!',   'effect',     '🎆', 100)
ON CONFLICT (cosmetic_key) DO NOTHING;

-- ─── Backfill: seed wallet rows from existing users.points (safe, additive) ──

INSERT INTO user_xp_wallet (user_id, total_xp)
SELECT id, COALESCE(points, 0) FROM users
ON CONFLICT (user_id) DO NOTHING;
