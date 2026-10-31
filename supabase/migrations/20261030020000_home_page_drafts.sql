-- Keep unpublished homepage content in a separate admin-only table.
-- public.pages.sections remains the only source read by public visitors.
create table if not exists public.home_page_drafts (
  page_slug text primary key references public.pages(slug) on delete cascade,
  sections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sections) = 'array'),
  updated_at timestamptz not null default now(),
  constraint home_page_drafts_home_only check (page_slug = 'home')
);

alter table public.home_page_drafts enable row level security;
revoke all on public.home_page_drafts from anon, authenticated;
grant select, insert, update on public.home_page_drafts to authenticated;

drop policy if exists "Admins read home page draft" on public.home_page_drafts;
create policy "Admins read home page draft" on public.home_page_drafts
  for select to authenticated using (private.is_admin());

drop policy if exists "Admins create home page draft" on public.home_page_drafts;
create policy "Admins create home page draft" on public.home_page_drafts
  for insert to authenticated with check (private.is_admin());

drop policy if exists "Admins update home page draft" on public.home_page_drafts;
create policy "Admins update home page draft" on public.home_page_drafts
  for update to authenticated using (private.is_admin())
  with check (private.is_admin());

drop trigger if exists home_page_drafts_set_updated_at on public.home_page_drafts;
create trigger home_page_drafts_set_updated_at before update on public.home_page_drafts
  for each row execute function private.set_updated_at();
