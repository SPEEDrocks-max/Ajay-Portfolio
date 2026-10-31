-- Extend the existing private page-draft row to the About page.
-- No public grants or RLS policies are changed by this migration.
alter table public.home_page_drafts
  drop constraint if exists home_page_drafts_home_only;

alter table public.home_page_drafts
  drop constraint if exists home_page_drafts_supported_page;

alter table public.home_page_drafts
  add constraint home_page_drafts_supported_page
  check (page_slug in ('home', 'about'));
