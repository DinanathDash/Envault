-- Create project_integrations table for GitHub integration
create table project_integrations (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects on delete cascade not null,
  provider text not null check (provider in ('github')),
  owner text not null,
  repo_name text not null,
  repo_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users not null,
  
  constraint unique_project_integration unique (project_id, provider),
  constraint unique_github_repo unique (provider, owner, repo_name)
);

-- Create index for fast lookup by owner and repo_name
create index idx_project_integrations_owner_repo on project_integrations(owner, repo_name) where provider = 'github';

-- Enable RLS on project_integrations
alter table project_integrations enable row level security;

-- Policy: Users can view integrations for projects they own or are members of
create policy "project_integrations_select_policy"
  on project_integrations for select
  using (
    public.is_project_owner(project_id, auth.uid())
    or
    public.is_project_member(project_id, auth.uid())
  );

-- Policy: Only project owners can insert integrations
create policy "project_integrations_insert_policy"
  on project_integrations for insert
  with check (
    public.is_project_owner(project_id, auth.uid())
    and
    created_by = auth.uid()
  );

-- Policy: Only project owners can update integrations
create policy "project_integrations_update_policy"
  on project_integrations for update
  using (
    public.is_project_owner(project_id, auth.uid())
  );

-- Policy: Only project owners can delete integrations
create policy "project_integrations_delete_policy"
  on project_integrations for delete
  using (
    public.is_project_owner(project_id, auth.uid())
  );
