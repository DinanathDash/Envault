-- Fix unindexed foreign keys for performance optimization
-- Addresses Supabase linter issues for passkeys and secrets tables

-- ============================================================================
-- 1. PASSKEYS - Add index on user_id foreign key
-- ============================================================================
-- This covers the passkeys_user_id_fkey constraint
-- Foreign key indexes improve performance for:
--   - DELETE CASCADE operations when a user is deleted
--   - JOINs between passkeys and auth.users
--   - RLS policy evaluation
CREATE INDEX IF NOT EXISTS idx_passkeys_user_id 
ON passkeys(user_id);

-- ============================================================================
-- 2. SECRETS - Add index on environment_id foreign key
-- ============================================================================
-- This covers the secrets_environment_id_fkey constraint
-- Foreign key indexes improve performance for:
--   - DELETE CASCADE operations when an environment is deleted
--   - JOINs and filtering by environment
--   - Environment-scoped secret queries
CREATE INDEX IF NOT EXISTS idx_secrets_environment_id 
ON secrets(environment_id);

-- ============================================================================
-- 3. NOTES ON UNUSED INDEXES
-- ============================================================================
-- The following indexes are reported as "unused" by the linter, but should
-- be retained as they are actively used by RLS policies or will be needed
-- for application queries:
--
-- KEEP THESE INDEXES:
-- - idx_key_rotation_jobs_status: Used when querying for pending/processing jobs
-- - idx_device_flow_sessions_user_id: Used for device flow cleanup and user queries
-- - idx_key_rotation_jobs_new_key_id: Used for key rotation job lookups
-- - idx_notifications_user_unread: Partial index for unread notification queries
-- - idx_notifications_expires: Partial index for cleanup of expired notifications
-- - idx_notifications_archived: Partial index for archived notification filtering
-- - idx_projects_user_id: Used by RLS policies for user ownership checks
--
-- These indexes will show usage once the application processes queries through
-- these code paths. The linter may report them as unused because:
-- 1. New database with minimal historical query traffic
-- 2. Some features (like key rotation, device flow) may not have been exercised
-- 3. Partial indexes may not be captured by query analysis
