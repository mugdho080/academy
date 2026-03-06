CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    login_at DATETIME NOT NULL,
    logout_at DATETIME NULL,
    total_seconds_active INT NOT NULL DEFAULT 0,
    last_ping_at DATETIME NOT NULL,
    status ENUM('active','closed','expired') NOT NULL DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sessions_user_login (user_id, login_at),
    INDEX idx_sessions_user_status (user_id, status)
);

CREATE TABLE IF NOT EXISTS time_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    user_id INT NOT NULL,
    context_type ENUM('dashboard','chapter','level','lesson') NOT NULL,
    chapter_id INT NULL,
    level_id INT NULL,
    lesson_id INT NULL,
    start_at DATETIME NOT NULL,
    end_at DATETIME NULL,
    seconds_active INT NOT NULL DEFAULT 0,
    date_key DATE NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_time_entries_user_date (user_id, date_key),
    INDEX idx_time_entries_context (context_type, chapter_id, level_id, lesson_id),
    INDEX idx_time_entries_session (session_id),
    INDEX idx_time_entries_bucket (session_id, date_key, context_type, chapter_id, level_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS activity_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL,
    session_id INT NOT NULL,
    user_id INT NOT NULL,
    client_event VARCHAR(32) NOT NULL,
    client_ts DATETIME NULL,
    processed_at DATETIME NOT NULL,
    UNIQUE KEY uniq_activity_event_id (event_id),
    INDEX idx_activity_events_session (session_id),
    INDEX idx_activity_events_user_time (user_id, processed_at),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
