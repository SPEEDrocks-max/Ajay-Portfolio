-- Phase 9: independent section structure drafts and published configurations.
-- Does not write to public.pages or the Home/About content draft tables.

create table if not exists public.page_section_configs (
  target_key text primary key check (target_key ~ '^(home|about|work|contact|category-detail|category:[a-z0-9]+(?:-[a-z0-9]+)*)$'),
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.page_section_drafts (
  target_key text primary key check (target_key ~ '^(home|about|work|contact|category-detail|category:[a-z0-9]+(?:-[a-z0-9]+)*)$'),
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.page_section_configs enable row level security;
alter table public.page_section_drafts enable row level security;
revoke all on public.page_section_configs from anon, authenticated;
revoke all on public.page_section_drafts from anon, authenticated;
grant select on public.page_section_configs to anon, authenticated;
grant select, insert, update, delete on public.page_section_configs to authenticated;
grant select, insert, update, delete on public.page_section_drafts to authenticated;

drop policy if exists "Public read published page sections" on public.page_section_configs;
create policy "Public read published page sections" on public.page_section_configs
  for select to anon, authenticated using (is_published);
drop policy if exists "Admins manage page section configs" on public.page_section_configs;
create policy "Admins manage page section configs" on public.page_section_configs
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists "Admins manage page section drafts" on public.page_section_drafts;
create policy "Admins manage page section drafts" on public.page_section_drafts
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop trigger if exists page_section_configs_set_updated_at on public.page_section_configs;
create trigger page_section_configs_set_updated_at before update on public.page_section_configs
  for each row execute function private.set_updated_at();
drop trigger if exists page_section_drafts_set_updated_at on public.page_section_drafts;
create trigger page_section_drafts_set_updated_at before update on public.page_section_drafts
  for each row execute function private.set_updated_at();
