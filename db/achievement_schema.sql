CREATE TABLE IF NOT EXISTS completed_lessons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lesson_id INT NOT NULL,
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY user_lesson_unique (user_id, lesson_id),
    INDEX idx_completed_lessons_user_time (user_id, completed_at),
    CONSTRAINT fk_completed_lessons_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_completed_lessons_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS completed_quizzes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    quiz_id INT NOT NULL,
    lesson_id INT NULL,
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_completed_quiz_user (user_id, quiz_id),
    INDEX idx_completed_quizzes_user_time (user_id, completed_at),
    CONSTRAINT fk_completed_quizzes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_completed_quizzes_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS completed_levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    level_id INT NOT NULL,
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_completed_level_user (user_id, level_id),
    INDEX idx_completed_levels_user_time (user_id, completed_at),
    CONSTRAINT fk_completed_levels_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_completed_levels_level FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS completed_chapters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    chapter_id INT NOT NULL,
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_completed_chapter_user (user_id, chapter_id),
    INDEX idx_completed_chapters_user_time (user_id, completed_at),
    CONSTRAINT fk_completed_chapters_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_completed_chapters_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    quiz_id INT NOT NULL,
    lesson_id INT NULL,
    is_correct TINYINT(1) NOT NULL DEFAULT 0,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_quiz_attempts_user_quiz (user_id, quiz_id),
    INDEX idx_quiz_attempts_user_time (user_id, attempted_at),
    CONSTRAINT fk_quiz_attempts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_quiz_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_points INT NOT NULL DEFAULT 0,
    current_rank VARCHAR(64) NOT NULL DEFAULT 'Seed',
    best_rank VARCHAR(64) NOT NULL DEFAULT 'Seed',
    current_streak_days INT NOT NULL DEFAULT 0,
    best_streak_days INT NOT NULL DEFAULT 0,
    total_lessons_completed INT NOT NULL DEFAULT 0,
    total_levels_completed INT NOT NULL DEFAULT 0,
    total_quizzes_completed INT NOT NULL DEFAULT 0,
    total_active_minutes INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_points_user (user_id),
    CONSTRAINT fk_user_points_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS points_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action_code VARCHAR(64) NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    source_id VARCHAR(128) NULL,
    points_awarded INT NOT NULL DEFAULT 0,
    metadata_json LONGTEXT NULL,
    dedupe_key VARCHAR(191) NULL,
    awarded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_points_log_user_time (user_id, awarded_at),
    INDEX idx_points_log_action (action_code, awarded_at),
    UNIQUE KEY uniq_points_log_dedupe (user_id, dedupe_key),
    CONSTRAINT fk_points_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS achievement_definitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(512) NOT NULL,
    icon VARCHAR(255) NULL,
    category VARCHAR(64) NOT NULL,
    points_reward INT NOT NULL DEFAULT 0,
    threshold_value INT NOT NULL DEFAULT 1,
    threshold_type VARCHAR(64) NOT NULL,
    is_repeatable TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_achievement_code (code)
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    achievement_id INT NOT NULL,
    unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    progress_value INT NULL,
    metadata_json LONGTEXT NULL,
    UNIQUE KEY uniq_user_achievement (user_id, achievement_id),
    INDEX idx_user_achievements_user_time (user_id, unlocked_at),
    CONSTRAINT fk_user_achievements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_achievements_definition FOREIGN KEY (achievement_id) REFERENCES achievement_definitions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weekly_targets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    target_minutes INT NOT NULL DEFAULT 90,
    target_lessons INT NOT NULL DEFAULT 3,
    target_quizzes INT NOT NULL DEFAULT 1,
    progress_minutes INT NOT NULL DEFAULT 0,
    progress_lessons INT NOT NULL DEFAULT 0,
    progress_quizzes INT NOT NULL DEFAULT 0,
    achieved_flag TINYINT(1) NOT NULL DEFAULT 0,
    achieved_at DATETIME NULL,
    reward_points INT NOT NULL DEFAULT 100,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_weekly_target_user_week (user_id, week_start),
    INDEX idx_weekly_target_user_time (user_id, week_start),
    CONSTRAINT fk_weekly_targets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chapter_mastery (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    chapter_id INT NOT NULL,
    chapter_points INT NOT NULL DEFAULT 0,
    completed_lessons INT NOT NULL DEFAULT 0,
    completed_levels INT NOT NULL DEFAULT 0,
    mastery_rank VARCHAR(32) NOT NULL DEFAULT 'Beginner',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_chapter_mastery_user (user_id, chapter_id),
    INDEX idx_chapter_mastery_user_rank (user_id, mastery_rank),
    CONSTRAINT fk_chapter_mastery_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_chapter_mastery_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rank_definitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rank_name VARCHAR(64) NOT NULL,
    min_points INT NOT NULL,
    max_points INT NULL,
    sort_order INT NOT NULL,
    UNIQUE KEY uniq_rank_name (rank_name),
    UNIQUE KEY uniq_rank_sort (sort_order)
);
