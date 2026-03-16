-- Ensure account deletion audit snapshots use stable, disambiguating fallback labels.

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
