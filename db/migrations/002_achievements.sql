-- Migration 002: Achievements, points, rankings

CREATE TABLE IF NOT EXISTS completed_lessons (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id    INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_completed_lessons_user_time ON completed_lessons (user_id, completed_at);

CREATE TABLE IF NOT EXISTS completed_quizzes (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id      INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    lesson_id    INTEGER,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, quiz_id)
);
CREATE INDEX IF NOT EXISTS idx_completed_quizzes_user_time ON completed_quizzes (user_id, completed_at);

CREATE TABLE IF NOT EXISTS completed_levels (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level_id     INTEGER NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, level_id)
);
CREATE INDEX IF NOT EXISTS idx_completed_levels_user_time ON completed_levels (user_id, completed_at);

CREATE TABLE IF NOT EXISTS completed_chapters (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chapter_id   INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, chapter_id)
);
CREATE INDEX IF NOT EXISTS idx_completed_chapters_user_time ON completed_chapters (user_id, completed_at);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id      INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    lesson_id    INTEGER,
    is_correct   BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON quiz_attempts (user_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_time ON quiz_attempts (user_id, attempted_at);

CREATE TABLE IF NOT EXISTS user_points (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_points            INTEGER NOT NULL DEFAULT 0,
    current_rank            VARCHAR(64) NOT NULL DEFAULT 'Seed',
    best_rank               VARCHAR(64) NOT NULL DEFAULT 'Seed',
    current_streak_days     INTEGER NOT NULL DEFAULT 0,
    best_streak_days        INTEGER NOT NULL DEFAULT 0,
    total_lessons_completed INTEGER NOT NULL DEFAULT 0,
    total_levels_completed  INTEGER NOT NULL DEFAULT 0,
    total_quizzes_completed INTEGER NOT NULL DEFAULT 0,
    total_active_minutes    INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);
CREATE TRIGGER trg_user_points_updated_at
    BEFORE UPDATE ON user_points
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS points_log (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_code    VARCHAR(64) NOT NULL,
    source_type    VARCHAR(64) NOT NULL,
    source_id      VARCHAR(128),
    points_awarded INTEGER NOT NULL DEFAULT 0,
    metadata_json  TEXT,
    dedupe_key     VARCHAR(191),
    awarded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_points_log_user_time ON points_log (user_id, awarded_at);
CREATE INDEX IF NOT EXISTS idx_points_log_action    ON points_log (action_code, awarded_at);

CREATE TABLE IF NOT EXISTS achievement_definitions (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code             VARCHAR(64) NOT NULL UNIQUE,
    title            VARCHAR(255) NOT NULL,
    description      VARCHAR(512) NOT NULL,
    icon             VARCHAR(255),
    category         VARCHAR(64) NOT NULL,
    points_reward    INTEGER NOT NULL DEFAULT 0,
    threshold_value  INTEGER NOT NULL DEFAULT 1,
    threshold_type   VARCHAR(64) NOT NULL,
    is_repeatable    BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_achievement_definitions_updated_at
    BEFORE UPDATE ON achievement_definitions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS user_achievements (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
    unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    progress_value INTEGER,
    metadata_json  TEXT,
    UNIQUE (user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_time ON user_achievements (user_id, unlocked_at);

CREATE TABLE IF NOT EXISTS weekly_targets (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start       DATE NOT NULL,
    week_end         DATE NOT NULL,
    target_minutes   INTEGER NOT NULL DEFAULT 90,
    target_lessons   INTEGER NOT NULL DEFAULT 3,
    target_quizzes   INTEGER NOT NULL DEFAULT 1,
    progress_minutes INTEGER NOT NULL DEFAULT 0,
    progress_lessons INTEGER NOT NULL DEFAULT 0,
    progress_quizzes INTEGER NOT NULL DEFAULT 0,
    achieved_flag    BOOLEAN NOT NULL DEFAULT FALSE,
    achieved_at      TIMESTAMPTZ,
    reward_points    INTEGER NOT NULL DEFAULT 100,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_target_user_time ON weekly_targets (user_id, week_start);
CREATE TRIGGER trg_weekly_targets_updated_at
    BEFORE UPDATE ON weekly_targets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS chapter_mastery (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chapter_id        INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    chapter_points    INTEGER NOT NULL DEFAULT 0,
    completed_lessons INTEGER NOT NULL DEFAULT 0,
    completed_levels  INTEGER NOT NULL DEFAULT 0,
    mastery_rank      VARCHAR(32) NOT NULL DEFAULT 'Beginner',
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, chapter_id)
);
CREATE INDEX IF NOT EXISTS idx_chapter_mastery_user_rank ON chapter_mastery (user_id, mastery_rank);
CREATE TRIGGER trg_chapter_mastery_updated_at
    BEFORE UPDATE ON chapter_mastery
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS rank_definitions (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rank_name  VARCHAR(64) NOT NULL UNIQUE,
    min_points INTEGER NOT NULL,
    max_points INTEGER,
    sort_order INTEGER NOT NULL UNIQUE
);
