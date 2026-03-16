-- Persist user identity snapshots on user-linked records before account deletion,
-- so project/audit UX can still distinguish departed users.

alter table public.secrets
  add column if not exists created_by_user_id_snapshot uuid,
  add column if not exists created_by_name text,
  add column if not exists created_by_email text,
  add column if not exists last_updated_by_user_id_snapshot uuid,
  add column if not exists last_updated_by_name text,
  add column if not exists last_updated_by_email text;

-- Backfill creator snapshots for existing rows.
update public.secrets s
set
  created_by_user_id_snapshot = coalesce(s.created_by_user_id_snapshot, s.user_id),
  created_by_name = coalesce(
    s.created_by_name,
    p.username,
    split_part(coalesce(u.email, ''), '@', 1),
    concat('user-', left(coalesce(s.created_by_user_id_snapshot, s.user_id)::text, 8))
  ),
  created_by_email = coalesce(s.created_by_email, u.email, '')
from auth.users u
left join public.profiles p on p.id = u.id
where u.id = s.user_id
  and (
    s.created_by_user_id_snapshot is null
    or s.created_by_name is null
    or s.created_by_email is null
  );

-- Final creator fallback when auth row is not available.
update public.secrets s
set
  created_by_user_id_snapshot = coalesce(s.created_by_user_id_snapshot, s.user_id),
  created_by_name = coalesce(
    s.created_by_name,
    split_part(coalesce(s.created_by_email, ''), '@', 1),
    concat('user-', left(coalesce(s.created_by_user_id_snapshot, s.user_id)::text, 8))
  ),
  created_by_email = coalesce(s.created_by_email, '')
where s.created_by_user_id_snapshot is null
   or s.created_by_name is null
   or s.created_by_email is null;

-- Backfill updater snapshots for existing rows.
update public.secrets s
set
  last_updated_by_user_id_snapshot = coalesce(s.last_updated_by_user_id_snapshot, s.last_updated_by),
  last_updated_by_name = coalesce(
    s.last_updated_by_name,
    p.username,
    split_part(coalesce(u.email, ''), '@', 1),
    concat('user-', left(coalesce(s.last_updated_by_user_id_snapshot, s.last_updated_by)::text, 8))
  ),
  last_updated_by_email = coalesce(s.last_updated_by_email, u.email, '')
from auth.users u
left join public.profiles p on p.id = u.id
where s.last_updated_by is not null
  and u.id = s.last_updated_by
  and (
    s.last_updated_by_user_id_snapshot is null
    or s.last_updated_by_name is null
    or s.last_updated_by_email is null
  );

-- Final updater fallback when auth row is not available.
update public.secrets s
set
  last_updated_by_user_id_snapshot = coalesce(s.last_updated_by_user_id_snapshot, s.last_updated_by),
  last_updated_by_name = coalesce(
    s.last_updated_by_name,
    split_part(coalesce(s.last_updated_by_email, ''), '@', 1),
    concat('user-', left(coalesce(s.last_updated_by_user_id_snapshot, s.last_updated_by)::text, 8))
  ),
  last_updated_by_email = coalesce(s.last_updated_by_email, '')
where s.last_updated_by is not null
  and (
    s.last_updated_by_user_id_snapshot is null
    or s.last_updated_by_name is null
    or s.last_updated_by_email is null
  );

create or replace function public.prepare_user_account_deletion(
  p_user_id uuid,
  p_actor_name text default null,
  p_actor_email text default null
)
returns table (
  reassigned_secrets bigint,
  nulled_last_updated_by bigint,
  reassigned_added_by bigint,
  updated_audit_logs bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reassigned_secrets bigint := 0;
  v_nulled_last_updated_by bigint := 0;
  v_reassigned_added_by bigint := 0;
  v_updated_audit_logs bigint := 0;
  v_effective_name text;
  v_effective_email text;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  v_effective_email := coalesce(nullif(p_actor_email, ''), '');
  v_effective_name := coalesce(
    nullif(p_actor_name, ''),
    nullif(split_part(v_effective_email, '@', 1), ''),
    concat('user-', left(p_user_id::text, 8))
  );

  -- Snapshot creator identity before ownership reassignment.
  update public.secrets s
  set
    created_by_user_id_snapshot = coalesce(s.created_by_user_id_snapshot, p_user_id),
    created_by_name = coalesce(s.created_by_name, v_effective_name),
    created_by_email = coalesce(s.created_by_email, v_effective_email)
  where s.user_id = p_user_id;

  -- Snapshot updater identity before nulling updater reference.
  update public.secrets s
  set
    last_updated_by_user_id_snapshot = coalesce(s.last_updated_by_user_id_snapshot, p_user_id),
    last_updated_by_name = coalesce(s.last_updated_by_name, v_effective_name),
    last_updated_by_email = coalesce(s.last_updated_by_email, v_effective_email)
  where s.last_updated_by = p_user_id;

  with reassigned as (
    update public.secrets s
    set user_id = p.user_id
    from public.projects p
    where s.project_id = p.id
      and s.user_id = p_user_id
      and p.user_id <> p_user_id
    returning s.id
  )
  select count(*) into v_reassigned_secrets from reassigned;

  update public.secrets
  set last_updated_by = null
  where last_updated_by = p_user_id;
  get diagnostics v_nulled_last_updated_by = row_count;

  with reassigned_members as (
    update public.project_members pm
    set added_by = p.user_id
    from public.projects p
    where pm.project_id = p.id
      and pm.added_by = p_user_id
      and p.user_id <> p_user_id
    returning pm.id
  )
  select count(*) into v_reassigned_added_by from reassigned_members;

  update public.audit_logs al
  set metadata = jsonb_set(
    jsonb_set(
      coalesce(al.metadata, '{}'::jsonb),
      '{actor_name}',
      to_jsonb(
        coalesce(
          nullif(al.metadata ->> 'actor_name', ''),
          v_effective_name
        )
      ),
      true
    ),
    '{actor_email}',
    to_jsonb(
      coalesce(
        nullif(al.metadata ->> 'actor_email', ''),
        v_effective_email,
        ''
      )
    ),
    true
  )
  where al.actor_type = 'user'
    and al.actor_id = p_user_id;
  get diagnostics v_updated_audit_logs = row_count;

  return query
  select
    v_reassigned_secrets,
    v_nulled_last_updated_by,
    v_reassigned_added_by,
    v_updated_audit_logs;
end;
$$;

revoke all on function public.prepare_user_account_deletion(uuid, text, text) from public;
revoke all on function public.prepare_user_account_deletion(uuid, text, text) from anon;
revoke all on function public.prepare_user_account_deletion(uuid, text, text) from authenticated;
grant execute on function public.prepare_user_account_deletion(uuid, text, text) to service_role;
