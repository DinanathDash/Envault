-- Add RLS policies for project_environments table
-- This fixes the security issue: RLS enabled but no policies exist

-- Enable RLS on project_environments
ALTER TABLE project_environments ENABLE ROW LEVEL SECURITY;

-- Allow users to SELECT project environments if they own or are a member of the project
CREATE POLICY "project_environments_select_policy" ON project_environments FOR SELECT 
USING (
  public.user_owns_project(project_id, (SELECT auth.uid())) OR 
  public.user_is_project_member(project_id, (SELECT auth.uid()))
);

-- Allow users to INSERT environments into their own projects or if they're an editor
CREATE POLICY "project_environments_insert_policy" ON project_environments FOR INSERT 
WITH CHECK (
  public.user_owns_project(project_id, (SELECT auth.uid())) OR 
  public.user_is_project_editor(project_id, (SELECT auth.uid()))
);

-- Allow users to UPDATE environments if they own or are an editor of the project
CREATE POLICY "project_environments_update_policy" ON project_environments FOR UPDATE 
USING (
  public.user_owns_project(project_id, (SELECT auth.uid())) OR 
  public.user_is_project_editor(project_id, (SELECT auth.uid()))
);

-- Allow users to DELETE environments if they own the project
CREATE POLICY "project_environments_delete_policy" ON project_environments FOR DELETE 
USING (
  public.user_owns_project(project_id, (SELECT auth.uid()))
);
