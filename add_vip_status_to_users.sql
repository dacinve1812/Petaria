-- Migration: Add VIP status to users table
-- Date: 2025-01-27

-- Add VIP status column to users table
ALTER TABLE users ADD COLUMN is_vip BOOLEAN DEFAULT FALSE AFTER role;

-- Add VIP expiration date (optional, for future use)
ALTER TABLE users ADD COLUMN vip_expires_at DATETIME NULL AFTER is_vip;

-- Add index for better performance when querying VIP users
CREATE INDEX idx_users_is_vip ON users(is_vip);

-- Verify the changes
SELECT id, username, role, is_vip, vip_expires_at FROM users ORDER BY id;
