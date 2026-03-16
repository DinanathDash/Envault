-- Preserve shared project data when an account is deleted.
-- 1) Reassign secrets authored by the deleting user to each project's owner.
-- 2) Reassign project_members.added_by references to each project's owner.
-- 3) Snapshot actor identity inside audit_logs.metadata to keep historical attribution.
-- 4) Ensure audit_logs.actor_id never has a hard FK to auth.users.

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
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  -- Reassign secrets in shared projects to each project's owner.
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

  -- If this user was the last updater, null the pointer.
  update public.secrets
  set last_updated_by = null
  where last_updated_by = p_user_id;
  get diagnostics v_nulled_last_updated_by = row_count;

  -- Preserve project memberships created by this user in shared projects.
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

  -- Preserve actor identity even after auth user deletion.
  update public.audit_logs al
  set metadata = jsonb_set(
    jsonb_set(
      coalesce(al.metadata, '{}'::jsonb),
      '{actor_name}',
      to_jsonb(
        coalesce(
          nullif(al.metadata ->> 'actor_name', ''),
          nullif(p_actor_name, ''),
          nullif(split_part(coalesce(p_actor_email, ''), '@', 1), ''),
          concat('user-', left(p_user_id::text, 8))
        )
      ),
      true
    ),
    '{actor_email}',
    to_jsonb(
      coalesce(
        nullif(al.metadata ->> 'actor_email', ''),
        nullif(p_actor_email, ''),
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

-- Defensive guard: keep actor_id as a non-FK UUID so auth user deletion never removes audit logs.
do $$
declare
  fk record;
begin
  for fk in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'audit_logs'
      and con.contype = 'f'
      and con.conkey = array[(
        select attnum
        from pg_attribute
        where attrelid = rel.oid
          and attname = 'actor_id'
          and not attisdropped
        limit 1
      )]
  loop
    execute format('alter table public.audit_logs drop constraint if exists %I', fk.conname);
  end loop;
end
$$;

comment on column public.audit_logs.actor_id is
  'Identifier of acting principal. Intentionally no FK to auth.users so audit history survives account deletion.';
