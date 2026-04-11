-- Migration 004: Panda Coach

CREATE TABLE IF NOT EXISTS learner_profiles (
    id                             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    age_band                       VARCHAR(16) NOT NULL DEFAULT 'age_20_40' CHECK (age_band IN ('under_20','age_20_40','age_40_plus')),
    sensory_mode                   VARCHAR(16) NOT NULL DEFAULT 'calm' CHECK (sensory_mode IN ('quiet','calm','standard')),
    preferred_tone                 VARCHAR(64) NOT NULL DEFAULT 'supportive',
    preferred_session_length_minutes INTEGER NOT NULL DEFAULT 20,
    favorite_topics_json           TEXT,
    support_intensity              VARCHAR(16) NOT NULL DEFAULT 'medium' CHECK (support_intensity IN ('low','medium','high')),
    coach_enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
    voice_enabled                  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);
CREATE TRIGGER trg_learner_profiles_updated_at
    BEFORE UPDATE ON learner_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS coach_state (
    id                       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_route               VARCHAR(255),
    last_chapter_id          INTEGER,
    last_level_id            INTEGER,
    last_lesson_id           INTEGER,
    last_message_type        VARCHAR(64),
    last_message_text        TEXT,
    last_intervention_level  SMALLINT NOT NULL DEFAULT 0,
    frustration_score        INTEGER NOT NULL DEFAULT 0,
    engagement_score         INTEGER NOT NULL DEFAULT 5,
    streak_days              INTEGER NOT NULL DEFAULT 0,
    last_seen_at             TIMESTAMPTZ,
    last_completed_lesson_id INTEGER,
    last_recommendation_json TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);
CREATE TRIGGER trg_coach_state_updated_at
    BEFORE UPDATE ON coach_state
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS coach_events (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id   INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
    event_type   VARCHAR(64) NOT NULL,
    route        VARCHAR(255),
    chapter_id   INTEGER,
    level_id     INTEGER,
    lesson_id    INTEGER,
    payload_json TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_events_user_time  ON coach_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_coach_events_type_time  ON coach_events (event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_coach_events_route      ON coach_events (route);

CREATE TABLE IF NOT EXISTS coach_recommendations (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    route               VARCHAR(255),
    recommendation_type VARCHAR(64) NOT NULL,
    recommendation_json TEXT NOT NULL,
    was_shown           BOOLEAN NOT NULL DEFAULT FALSE,
    was_accepted        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_recommendations_user_time   ON coach_recommendations (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_coach_recommendations_route_type  ON coach_recommendations (route, recommendation_type);

CREATE TABLE IF NOT EXISTS coach_interventions (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    intervention_level   SMALLINT NOT NULL DEFAULT 0,
    trigger_type         VARCHAR(64) NOT NULL,
    trigger_details_json TEXT,
    response_type        VARCHAR(64),
    response_text        TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_interventions_user_time ON coach_interventions (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_coach_interventions_level     ON coach_interventions (intervention_level);
