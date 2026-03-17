-- Feature 1: Learner profile enhancements
-- Adds support for updating profile pictures and an "About Me" section.
ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(512) DEFAULT NULL;
ALTER TABLE users ADD COLUMN about_me TEXT DEFAULT NULL;

-- Note for Feature 2:
-- No database schema changes were required for the chapter completion percentage feature.
-- The progress is dynamically computed from the `completed_lessons` table which we already had.
