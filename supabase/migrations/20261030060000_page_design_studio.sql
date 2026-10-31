-- Phase 8: independent page-scoped design profiles and private drafts.
-- Design publication is separate from public.pages content publication.

create table if not exists public.page_designs (
  target_key text primary key check (target_key ~ '^(home|about|work|contact|category-detail|category:[a-z0-9]+(?:-[a-z0-9]+)*)$'),
  design jsonb not null default '{}'::jsonb check (jsonb_typeof(design) = 'object'),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.page_design_drafts (
  target_key text primary key check (target_key ~ '^(home|about|work|contact|category-detail|category:[a-z0-9]+(?:-[a-z0-9]+)*)$'),
  design jsonb not null default '{}'::jsonb check (jsonb_typeof(design) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.page_designs enable row level security;
alter table public.page_design_drafts enable row level security;
revoke all on public.page_designs from anon, authenticated;
revoke all on public.page_design_drafts from anon, authenticated;
grant select on public.page_designs to anon, authenticated;
grant select, insert, update, delete on public.page_designs to authenticated;
grant select, insert, update, delete on public.page_design_drafts to authenticated;

drop policy if exists "Public read published page designs" on public.page_designs;
create policy "Public read published page designs" on public.page_designs
  for select to anon, authenticated using (is_published);
drop policy if exists "Admins manage page designs" on public.page_designs;
create policy "Admins manage page designs" on public.page_designs
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists "Admins manage page design drafts" on public.page_design_drafts;
create policy "Admins manage page design drafts" on public.page_design_drafts
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop trigger if exists page_designs_set_updated_at on public.page_designs;
create trigger page_designs_set_updated_at before update on public.page_designs
  for each row execute function private.set_updated_at();
drop trigger if exists page_design_drafts_set_updated_at on public.page_design_drafts;
create trigger page_design_drafts_set_updated_at before update on public.page_design_drafts
  for each row execute function private.set_updated_at();
