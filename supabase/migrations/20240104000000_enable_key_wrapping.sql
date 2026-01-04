-- Create the encryption_keys table
create table if not exists encryption_keys (
  id uuid primary key default gen_random_uuid(),
  encrypted_key text not null, -- The Data Key encrypted by the Master Key
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null check (status in ('active', 'retired', 'migrating'))
);

-- Init encryption_keys with a dummy active key 
-- (NOTE: The app will lazy-init the real first key if not found, 
-- but it's good practice to have the structure ready.
-- In a real migration, we would backfill this with the current ENCRYPTION_KEY if we could,
-- but since we can't encrypt the current key *with itself* easily in SQL without the raw value,
-- we will let the app handle the first initialization or use a specific script.
-- For now, we just create the table.)

-- Add key_id to secrets table if it doesn't exist
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'secrets' and column_name = 'key_id') then
        alter table secrets add column key_id uuid references encryption_keys(id);
        create index idx_secrets_key_id on secrets(key_id);
    end if;
end $$;

-- Create index for encryption_keys status if not exists
create index if not exists idx_encryption_keys_status on encryption_keys(status);
