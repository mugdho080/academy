-- NDIS LMS Database Schema

CREATE DATABASE IF NOT EXISTS ndis_lms;
USE ndis_lms;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    ndis_number VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('learner', 'admin') DEFAULT 'learner',
    status ENUM('locked', 'pending', 'active') DEFAULT 'locked',
    points INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chapters table
CREATE TABLE IF NOT EXISTS chapters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    emoji VARCHAR(20),
    order_index INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Levels table
CREATE TABLE IF NOT EXISTS levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chapter_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    video_url VARCHAR(255),
    is_free BOOLEAN DEFAULT FALSE,
    order_index INT NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

-- Lessons table (Swipable content)
CREATE TABLE IF NOT EXISTS lessons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    level_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT, -- Markdown or HTML content
    order_index INT NOT NULL,
    FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
);

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lesson_id INT NOT NULL,
    question TEXT NOT NULL,
    options JSON NOT NULL, -- Array of strings
    correct_answer INT NOT NULL, -- Index of correct option
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

-- Progress table
CREATE TABLE IF NOT EXISTS progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lesson_id INT NOT NULL,
    is_completed BOOLEAN DEFAULT TRUE,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    UNIQUE KEY user_lesson (user_id, lesson_id)
);

-- Activity table (Time tracking)
CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    activity_date DATE NOT NULL,
    seconds_active INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY user_date (user_id, activity_date)
);

-- Canonical learner tracking sessions
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

-- Granular per-context time entries (chapter/level/lesson/dashboard)
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

-- Idempotency keys for delta logging
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

-- Service Agreements
CREATE TABLE IF NOT EXISTS service_agreements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    signature_data MEDIUMTEXT, -- Base64 encoded signature
    
    -- Personal Details
    full_name VARCHAR(255),
    dob DATE,
    address TEXT,
    phone VARCHAR(50),
    emergency_contact VARCHAR(255),
    
    -- NDIS Details
    ndis_number VARCHAR(50),
    nominee VARCHAR(255),
    plan_type ENUM('NDIA', 'Plan Managed', 'Self Managed'),
    who_pays ENUM('NDIA', 'Plan Manager', 'Participant'),
    
    -- Plan Manager Details (if applicable)
    plan_manager_name VARCHAR(255),
    plan_manager_contact VARCHAR(255),
    
    -- Plan Dates
    plan_start_date DATE,
    plan_end_date DATE,
    
    -- Fixed Details
    line_item_code VARCHAR(100) DEFAULT 'Innovative Community Participation | 09_008_0116_6_3',
    price VARCHAR(50) DEFAULT '$50/hr',

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Initial Admin Account
INSERT INTO users (name, email, ndis_number, password_hash, role, status)
VALUES ('Super Admin', 'admin@admin.com', 'ADMIN001', '$2y$12$GybGioIw9Oo7EAWU6IS5le2kUI2LLAbUGOb8bKC55ealN/NPvk5kG', 'admin', 'active');
-- Note: password_hash above is for 'admin'
