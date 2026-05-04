-- Design note:
-- Restore only function execute permissions required by app/runtime flows.
-- Do NOT re-open these to PUBLIC.

-- Optional audit query (run manually before/after if needed):
-- select routine_schema, routine_name, grantee, privilege_type
-- from information_schema.routine_privileges
-- where routine_schema = 'public'
--   and routine_name in (
--     'user_owns_project',
--     'user_is_project_member',
--     'user_is_project_editor',
--     'user_has_granular_secret_share',
--     'user_can_manage_secret_shares',
--     'has_secret_share',
--     'rotate_secret',
--     'create_notification',
--     'cleanup_old_notifications'
--   )
-- order by routine_name, grantee;

-- Core RPC + RLS helper functions used by authenticated users.
grant execute on function public.user_owns_project(uuid, uuid) to authenticated;
grant execute on function public.user_is_project_member(uuid, uuid) to authenticated;
grant execute on function public.user_is_project_editor(uuid, uuid) to authenticated;
grant execute on function public.user_has_granular_secret_share(uuid, uuid) to authenticated;
grant execute on function public.user_can_manage_secret_shares(uuid, uuid) to authenticated;
grant execute on function public.has_secret_share(uuid, uuid) to authenticated;
grant execute on function public.rotate_secret(uuid, text, uuid) to authenticated;

-- Notification write path helper should be service-side only.
grant execute on function public.create_notification(
  uuid,
  character varying,
  character varying,
  text,
  character varying,
  character varying,
  jsonb,
  character varying,
  character varying
) to service_role;

-- Maintenance function should not be callable by anon/authenticated.
grant execute on function public.cleanup_old_notifications() to service_role;
