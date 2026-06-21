-- Migration: create resume related tables
CREATE TABLE IF NOT EXISTS resumes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  target_role VARCHAR(255),
  template_key VARCHAR(50) DEFAULT 'simple',
  status ENUM('draft','final') DEFAULT 'draft',
  professional_summary TEXT,
  resume_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_downloaded_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS resume_builder_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  status ENUM('in_progress','completed') DEFAULT 'in_progress',
  current_step VARCHAR(50),
  answers JSON,
  draft_resume JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS resume_downloads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resume_id INT NOT NULL,
  user_id INT NOT NULL,
  downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  format VARCHAR(20) DEFAULT 'pdf',
  template_key VARCHAR(50)
);
