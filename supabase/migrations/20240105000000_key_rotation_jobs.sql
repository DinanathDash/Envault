-- Create table for tracking key rotation jobs
create table key_rotation_jobs (
  id uuid primary key default gen_random_uuid(),
  new_key_id uuid references encryption_keys(id) not null,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  last_processed_secret_id uuid, -- Cursor for pagination (keyset pagination)
  total_secrets integer default 0,
  processed_secrets integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  error_message text
);

-- Index for looking up active jobs
create index idx_key_rotation_jobs_status on key_rotation_jobs(status);
