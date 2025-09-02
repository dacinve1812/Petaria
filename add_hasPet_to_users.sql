-- Migration: Add hasPet column to users table
-- Date: 2025-01-27

-- Add hasPet column to users table with default value FALSE
ALTER TABLE users ADD COLUMN hasPet BOOLEAN DEFAULT FALSE AFTER role;

-- Update existing users based on whether they have pets
UPDATE users u 
SET hasPet = TRUE 
WHERE EXISTS (
    SELECT 1 FROM pets p WHERE p.owner_id = u.id
);

-- Make hasPet column NOT NULL after setting values
ALTER TABLE users MODIFY COLUMN hasPet BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for better performance when querying by hasPet
CREATE INDEX idx_users_hasPet ON users(hasPet);

-- Verify the changes
SELECT id, username, role, hasPet FROM users ORDER BY id;
