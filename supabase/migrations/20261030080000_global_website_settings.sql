-- Phase 10: published global website information plus private admin drafts.
-- Existing visual settings and their policies remain unchanged.

alter table public.site_settings
  add column if not exists public_content jsonb not null default '{}'::jsonb
  check (jsonb_typeof(public_content) = 'object');

create table if not exists public.site_settings_drafts (
  id boolean primary key default true check (id),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.site_settings_drafts enable row level security;
revoke all on public.site_settings_drafts from anon, authenticated;
grant select, insert, update, delete on public.site_settings_drafts to authenticated;

drop policy if exists "Admins manage global settings drafts" on public.site_settings_drafts;
create policy "Admins manage global settings drafts" on public.site_settings_drafts
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop trigger if exists site_settings_drafts_set_updated_at on public.site_settings_drafts;
create trigger site_settings_drafts_set_updated_at before update on public.site_settings_drafts
  for each row execute function private.set_updated_at();
