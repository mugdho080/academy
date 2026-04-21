-- Migration 006: Runtime compatibility columns used by current API/frontend

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
    ADD COLUMN IF NOT EXISTS about_me TEXT;

