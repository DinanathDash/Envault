create table if not exists public.design_partner_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  work_email text not null,
  company_name text not null,
  company_type text not null check (
    company_type in ('startup', 'dev_agency', 'open_source', 'other')
  ),
  pain_point text not null,
  created_at timestamptz not null default now()
);

alter table public.design_partner_applications enable row level security;

revoke all on table public.design_partner_applications from anon;
revoke all on table public.design_partner_applications from authenticated;

grant insert on table public.design_partner_applications to anon;
grant insert on table public.design_partner_applications to authenticated;

drop policy if exists "Public can insert design partner applications"
on public.design_partner_applications;
create policy "Public can insert design partner applications"
on public.design_partner_applications
for insert
to anon, authenticated
with check (true);

drop policy if exists "Service role can read design partner applications"
on public.design_partner_applications;
create policy "Service role can read design partner applications"
on public.design_partner_applications
for select
to service_role
using (true);
