-- Fix Supabase database linter advisories:
-- 1) auth_rls_initplan on pending_approvals SELECT policy
-- 2) unindexed foreign keys on audit_logs.delegator_user_id and pending_approvals.project_id

-- Avoid per-row re-evaluation of auth.uid() in RLS by using SELECT-wrapped call.
ALTER POLICY "Enable read access for project owners and editors"
ON public.pending_approvals
USING (
  EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_members.project_id = pending_approvals.project_id
      AND project_members.user_id = (SELECT auth.uid())
      AND project_members.role IN ('owner', 'editor')
  )
);

-- Add covering indexes for foreign keys flagged by linter.
CREATE INDEX IF NOT EXISTS idx_audit_logs_delegator_user_id
  ON public.audit_logs (delegator_user_id);

CREATE INDEX IF NOT EXISTS idx_pending_approvals_project_id
  ON public.pending_approvals (project_id);
