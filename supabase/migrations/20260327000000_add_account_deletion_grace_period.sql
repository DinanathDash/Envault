-- Add a soft-delete scheduling column for user accounts.
-- When set, the account is scheduled for deletion and can be restored by logging in
-- before the grace period expires.

alter table public.profiles
  add column if not exists deletion_scheduled_at timestamptz;

create index if not exists idx_profiles_deletion_scheduled_at
  on public.profiles (deletion_scheduled_at)
  where deletion_scheduled_at is not null;

comment on column public.profiles.deletion_scheduled_at is
  'UTC timestamp when account deletion was scheduled; null means no deletion is pending.';
