-- Panda Coach schema for Goodwill Care Academy
USE ndis_lms;

CREATE TABLE IF NOT EXISTS learner_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    age_band ENUM('under_20','age_20_40','age_40_plus') NOT NULL DEFAULT 'age_20_40',
    sensory_mode ENUM('quiet','calm','standard') NOT NULL DEFAULT 'calm',
    preferred_tone VARCHAR(64) NOT NULL DEFAULT 'supportive',
    preferred_session_length_minutes INT NOT NULL DEFAULT 20,
    favorite_topics_json LONGTEXT NULL,
    support_intensity ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    coach_enabled TINYINT(1) NOT NULL DEFAULT 1,
    voice_enabled TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_learner_profiles_user (user_id),
    CONSTRAINT fk_learner_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coach_state (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    last_route VARCHAR(255) NULL,
    last_chapter_id INT NULL,
    last_level_id INT NULL,
    last_lesson_id INT NULL,
    last_message_type VARCHAR(64) NULL,
    last_message_text TEXT NULL,
    last_intervention_level TINYINT NOT NULL DEFAULT 0,
    frustration_score INT NOT NULL DEFAULT 0,
    engagement_score INT NOT NULL DEFAULT 5,
    streak_days INT NOT NULL DEFAULT 0,
    last_seen_at DATETIME NULL,
    last_completed_lesson_id INT NULL,
    last_recommendation_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_coach_state_user (user_id),
    CONSTRAINT fk_coach_state_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coach_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_id INT NULL,
    event_type VARCHAR(64) NOT NULL,
    route VARCHAR(255) NULL,
    chapter_id INT NULL,
    level_id INT NULL,
    lesson_id INT NULL,
    payload_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coach_events_user_time (user_id, created_at),
    INDEX idx_coach_events_type_time (event_type, created_at),
    INDEX idx_coach_events_route (route),
    CONSTRAINT fk_coach_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_coach_events_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS coach_recommendations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    route VARCHAR(255) NULL,
    recommendation_type VARCHAR(64) NOT NULL,
    recommendation_json LONGTEXT NOT NULL,
    was_shown TINYINT(1) NOT NULL DEFAULT 0,
    was_accepted TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coach_recommendations_user_time (user_id, created_at),
    INDEX idx_coach_recommendations_route_type (route, recommendation_type),
    CONSTRAINT fk_coach_recommendations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coach_interventions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    intervention_level TINYINT NOT NULL DEFAULT 0,
    trigger_type VARCHAR(64) NOT NULL,
    trigger_details_json LONGTEXT NULL,
    response_type VARCHAR(64) NULL,
    response_text TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coach_interventions_user_time (user_id, created_at),
    INDEX idx_coach_interventions_level (intervention_level),
    CONSTRAINT fk_coach_interventions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
