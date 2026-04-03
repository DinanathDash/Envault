-- 1. Updates to existing tables: profiles and projects
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS global_agent_access_enabled BOOLEAN DEFAULT false;

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS agent_access_enabled BOOLEAN DEFAULT false;


-- 2. Updates to audit_logs
-- Create the actor_type enum safely
DO $$ BEGIN
    CREATE TYPE actor_type_enum AS ENUM ('human', 'service_token', 'agent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS actor_type actor_type_enum DEFAULT 'human',
ADD COLUMN IF NOT EXISTS agent_id TEXT,
ADD COLUMN IF NOT EXISTS delegator_user_id UUID REFERENCES auth.users(id);


-- 3. Create the pending_approvals table
-- Create the status enum safely
DO $$ BEGIN
    CREATE TYPE approval_status_enum AS ENUM ('pending', 'approved', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS pending_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    payload_data JSONB NOT NULL,
    idempotency_key UUID UNIQUE NOT NULL,
    status approval_status_enum NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 4. Row Level Security (RLS) configuration

-- Enable RLS on the new table
ALTER TABLE pending_approvals ENABLE ROW LEVEL SECURITY;

-- Note: No policies are created for INSERT, UPDATE, or DELETE formats. 
-- In Supabase/Postgres, when RLS is enabled, any action without an explicit policy is denied.
-- The Service Role implicitly bypasses RLS, fulfilling the requirement that inserts/updates 
-- are strictly locked to the Service Role and client-side modifications are hard-rejected.

-- Read policy: Project Owners and Editors
-- Note: Replace `project_members` and the role check with your exact access control schema if it differs.
CREATE POLICY "Enable read access for project owners and editors"
ON pending_approvals
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_members.project_id = pending_approvals.project_id 
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('owner', 'editor')
    )
);