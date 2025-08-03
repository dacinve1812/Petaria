-- Migration: Add role column to users table
-- Date: 2025-01-27

-- Add role column to users table
ALTER TABLE users ADD COLUMN role ENUM('user', 'admin', 'moderator') DEFAULT 'user' AFTER password;

-- Update existing admin user
UPDATE users SET role = 'admin' WHERE username = 'admin';

-- Update other users to have 'user' role (default)
UPDATE users SET role = 'user' WHERE role IS NULL;

-- Make role column NOT NULL after setting default values
ALTER TABLE users MODIFY COLUMN role ENUM('user', 'admin', 'moderator') NOT NULL DEFAULT 'user';

-- Add index for better performance when querying by role
CREATE INDEX idx_users_role ON users(role);

-- Verify the changes
SELECT id, username, role FROM users ORDER BY id; 