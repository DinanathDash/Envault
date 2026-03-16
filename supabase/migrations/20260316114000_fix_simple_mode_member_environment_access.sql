-- In simple mode, environment restrictions should not be persisted.
-- Normalize all simple-mode memberships to unrestricted access.

update public.project_members pm
set allowed_environments = null
from public.projects p
where pm.project_id = p.id
  and coalesce(p.ui_mode, 'simple') = 'simple'
  and pm.allowed_environments is not null;
