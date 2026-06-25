-- Resume/routine builder runtime schema.
-- This migration is intentionally additive because some databases already have
-- older achievement/rank tables with different column names.

CREATE TABLE IF NOT EXISTS resumes (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER NOT NULL,
    title                VARCHAR(255) NOT NULL,
    target_role          VARCHAR(255),
    template_key         VARCHAR(50) DEFAULT 'simple',
    status               TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
    professional_summary TEXT,
    resume_data          JSONB DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    last_downloaded_at   TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes (user_id);

CREATE TABLE IF NOT EXISTS resume_builder_sessions (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL UNIQUE,
    status       TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    current_step TEXT,
    answers      JSONB DEFAULT '{}'::jsonb,
    draft_resume JSONB DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS resume_downloads (
    id            SERIAL PRIMARY KEY,
    resume_id     INTEGER NOT NULL,
    user_id       INTEGER NOT NULL,
    downloaded_at TIMESTAMPTZ DEFAULT NOW(),
    format        VARCHAR(20) DEFAULT 'pdf',
    template_key  VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_resume_downloads_resume_id ON resume_downloads (resume_id);

CREATE TABLE IF NOT EXISTS routine_builder_sessions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL UNIQUE,
    status        TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    current_step  TEXT,
    answers       JSONB DEFAULT '{}'::jsonb,
    draft_routine JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at  TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS routines (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL,
    title        VARCHAR(255) NOT NULL,
    routine_data JSONB DEFAULT '{}'::jsonb,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE routines ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines (user_id);

CREATE TABLE IF NOT EXISTS user_xp_wallet (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL UNIQUE,
    total_xp         INTEGER DEFAULT 0,
    current_coins    INTEGER DEFAULT 0,
    lifetime_coins   INTEGER DEFAULT 0,
    current_rank_key VARCHAR(50) DEFAULT 'seed_learner',
    current_streak   INTEGER DEFAULT 0,
    best_streak      INTEGER DEFAULT 0,
    last_streak_date DATE NULL,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_xp_wallet_user_id ON user_xp_wallet (user_id);

CREATE TABLE IF NOT EXISTS xp_events (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    xp_amount       INTEGER NOT NULL,
    coin_amount     INTEGER NOT NULL,
    source_type     VARCHAR(100),
    source_id       VARCHAR(100),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_xp_events_user_id ON xp_events (user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_event_type ON xp_events (event_type);

CREATE TABLE IF NOT EXISTS user_badges (
    id        SERIAL PRIMARY KEY,
    user_id   INTEGER NOT NULL,
    badge_key VARCHAR(100) NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    metadata  JSONB,
    UNIQUE (user_id, badge_key)
);

CREATE TABLE IF NOT EXISTS badge_definitions (
    id                SERIAL PRIMARY KEY,
    badge_key         VARCHAR(100) UNIQUE NOT NULL,
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    icon              VARCHAR(255),
    category          VARCHAR(100),
    requirement_type  VARCHAR(100),
    requirement_value INTEGER,
    xp_reward         INTEGER DEFAULT 0,
    coin_reward       INTEGER DEFAULT 0,
    is_active         BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS rank_definitions (
    id SERIAL PRIMARY KEY
);
ALTER TABLE rank_definitions ADD COLUMN IF NOT EXISTS rank_name VARCHAR(255);
ALTER TABLE rank_definitions ADD COLUMN IF NOT EXISTS min_points INTEGER;
ALTER TABLE rank_definitions ADD COLUMN IF NOT EXISTS max_points INTEGER;
ALTER TABLE rank_definitions ADD COLUMN IF NOT EXISTS rank_key VARCHAR(100);
ALTER TABLE rank_definitions ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE rank_definitions ADD COLUMN IF NOT EXISTS min_xp INTEGER;
ALTER TABLE rank_definitions ADD COLUMN IF NOT EXISTS icon VARCHAR(255);
ALTER TABLE rank_definitions ADD COLUMN IF NOT EXISTS theme_color VARCHAR(50);
ALTER TABLE rank_definitions ADD COLUMN IF NOT EXISTS sort_order INTEGER;

UPDATE rank_definitions
SET rank_key = COALESCE(rank_key, lower(regexp_replace(COALESCE(name, rank_name, 'rank_' || id::text), '[^a-zA-Z0-9]+', '_', 'g'))),
    name = COALESCE(name, rank_name),
    min_xp = COALESCE(min_xp, min_points, 0),
    sort_order = COALESCE(sort_order, id)
WHERE rank_key IS NULL OR name IS NULL OR min_xp IS NULL OR sort_order IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rank_definitions_rank_key ON rank_definitions (rank_key);

INSERT INTO rank_definitions (rank_key, name, min_xp, icon, theme_color, sort_order, rank_name, min_points, max_points) VALUES
    ('seed_learner', 'Seed Learner', 0, 'seed', '#4ade80', 1, 'Seed Learner', 0, 99),
    ('curious_cub', 'Curious Cub', 100, 'panda', '#3b82f6', 2, 'Curious Cub', 100, 299),
    ('focus_friend', 'Focus Friend', 300, 'star', '#f59e0b', 3, 'Focus Friend', 300, 699),
    ('skill_builder', 'Skill Builder', 700, 'tools', '#8b5cf6', 4, 'Skill Builder', 700, 1499),
    ('chapter_explorer', 'Chapter Explorer', 1500, 'compass', '#ec4899', 5, 'Chapter Explorer', 1500, 2999),
    ('knowledge_hero', 'Knowledge Hero', 3000, 'hero', '#ef4444', 6, 'Knowledge Hero', 3000, 4999),
    ('academy_champion', 'Academy Champion', 5000, 'trophy', '#eab308', 7, 'Academy Champion', 5000, NULL)
ON CONFLICT (rank_key) DO UPDATE
SET name = EXCLUDED.name,
    min_xp = EXCLUDED.min_xp,
    icon = EXCLUDED.icon,
    theme_color = EXCLUDED.theme_color,
    sort_order = EXCLUDED.sort_order,
    rank_name = EXCLUDED.rank_name,
    min_points = EXCLUDED.min_points,
    max_points = EXCLUDED.max_points;

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

INSERT INTO badge_definitions (badge_key, name, description, icon, category, requirement_type) VALUES
    ('first_step', 'First Step', 'Completed your first lesson', 'step', 'milestone', 'lesson_count'),
    ('quiz_star', 'Quiz Star', 'Completed your first quiz', 'star', 'milestone', 'quiz_count'),
    ('perfect_panda', 'Perfect Panda', 'Scored 100 percent on a quiz', 'perfect', 'milestone', 'perfect_quiz'),
    ('three_day_spark', 'Three Day Spark', 'Maintained a 3-day learning streak', 'spark', 'streak', 'streak_days'),
    ('resume_ready', 'Resume Ready', 'Built and saved your first resume', 'resume', 'milestone', 'resume_saved'),
    ('routine_hero', 'Routine Hero', 'Created your first daily routine', 'calendar', 'milestone', 'routine_saved')
ON CONFLICT (badge_key) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    category = EXCLUDED.category,
    requirement_type = EXCLUDED.requirement_type;

INSERT INTO user_xp_wallet (user_id, total_xp)
SELECT id, COALESCE(points, 0) FROM users
ON CONFLICT (user_id) DO NOTHING;
