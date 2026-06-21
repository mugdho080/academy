-- Gamification System Schema

-- user_xp_wallet tracks the total progression state for each learner
CREATE TABLE IF NOT EXISTS user_xp_wallet (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    total_xp INT DEFAULT 0,
    current_coins INT DEFAULT 0,
    lifetime_coins INT DEFAULT 0,
    current_rank_key VARCHAR(50) DEFAULT 'seed_learner',
    current_streak INT DEFAULT 0,
    best_streak INT DEFAULT 0,
    last_streak_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (user_id)
);

-- xp_events logs all verifiable learning activities that yield XP and Coins
CREATE TABLE IF NOT EXISTS xp_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    xp_amount INT NOT NULL,
    coin_amount INT NOT NULL,
    source_type VARCHAR(100),
    source_id VARCHAR(100),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (user_id),
    INDEX (event_type)
);

-- badge_definitions holds static info about achievements
CREATE TABLE IF NOT EXISTS badge_definitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    badge_key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    category VARCHAR(100),
    requirement_type VARCHAR(100),
    requirement_value INT,
    xp_reward INT DEFAULT 0,
    coin_reward INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- user_badges tracks earned badges
CREATE TABLE IF NOT EXISTS user_badges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    badge_key VARCHAR(100) NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    UNIQUE (user_id, badge_key)
);

-- rank_definitions represents the XP ladder
CREATE TABLE IF NOT EXISTS rank_definitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rank_key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    min_xp INT NOT NULL,
    icon VARCHAR(255),
    theme_color VARCHAR(50),
    sort_order INT NOT NULL
);

-- cosmetic_shop_items represents rewards purchasable with Coins
CREATE TABLE IF NOT EXISTS cosmetic_shop_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cosmetic_key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    icon VARCHAR(255),
    coin_cost INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- user_cosmetics tracks unlocked rewards
CREATE TABLE IF NOT EXISTS user_cosmetics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    cosmetic_key VARCHAR(100) NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    equipped_at TIMESTAMP NULL,
    UNIQUE (user_id, cosmetic_key)
);

-- Seed initial ranks
INSERT IGNORE INTO rank_definitions (rank_key, name, min_xp, icon, theme_color, sort_order) VALUES
('seed_learner', 'Seed Learner 🌱', 0, '🌱', '#4ade80', 1),
('curious_cub', 'Curious Cub 🐼', 100, '🐼', '#3b82f6', 2),
('focus_friend', 'Focus Friend ⭐', 300, '⭐', '#f59e0b', 3),
('skill_builder', 'Skill Builder 🛠️', 700, '🛠️', '#8b5cf6', 4),
('chapter_explorer', 'Chapter Explorer 🧭', 1500, '🧭', '#ec4899', 5),
('knowledge_hero', 'Knowledge Hero 🦸', 3000, '🦸', '#ef4444', 6),
('academy_champion', 'Academy Champion 🏆', 5000, '🏆', '#eab308', 7);

-- Seed initial badges
INSERT IGNORE INTO badge_definitions (badge_key, name, description, icon, category, requirement_type) VALUES
('first_step', 'First Step', 'Completed your first lesson', '👟', 'milestone', 'lesson_count'),
('quiz_star', 'Quiz Star', 'Completed your first quiz', '⭐', 'milestone', 'quiz_count'),
('perfect_panda', 'Perfect Panda', 'Scored 100% on a quiz', '💯', 'milestone', 'perfect_quiz'),
('three_day_spark', 'Three Day Spark', 'Maintained a 3-day learning streak', '🔥', 'streak', 'streak_days');

-- Seed initial cosmetics
INSERT IGNORE INTO cosmetic_shop_items (cosmetic_key, name, description, category, icon, coin_cost) VALUES
('hat_tophat', 'Panda Top Hat', 'A classy top hat for your Panda avatar.', 'hat', '🎩', 30),
('frame_rainbow', 'Rainbow Frame', 'A colorful frame for your profile.', 'frame', '🌈', 50),
('bg_forest', 'Forest Background', 'A peaceful bamboo forest backdrop.', 'background', '🌲', 80),
('fx_firework', 'Firework Celebration', 'Explosive fireworks when you level up!', 'effect', '🎆', 100);

-- Migrate old points (if any)
-- We check if `users` table has `points` column. If so, copy to user_xp_wallet
INSERT IGNORE INTO user_xp_wallet (user_id, total_xp)
SELECT id, IFNULL(points, 0) FROM users;
