-- Ajay Mehta portfolio Supabase foundation.
-- Safe to re-run: tables, indexes, triggers, policies, buckets and seed rows
-- are created idempotently and existing category/page rows are not overwritten.

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_title text,
  global_font text,
  heading_font text,
  background_color text,
  text_color text,
  secondary_text_color text,
  accent_color text,
  background_image_url text,
  background_texture_url text,
  updated_at timestamptz not null default now()
);

-- A unique constant expression allows at most one global settings row.
create unique index if not exists site_settings_single_record_idx
  on public.site_settings ((true));

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_published boolean not null default false,
  seo_title text,
  seo_description text,
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  thumbnail_url text,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  provider text not null check (provider in ('youtube', 'vimeo', 'google_drive', 'cloudflare')),
  video_url text not null,
  video_id text,
  thumbnail_url text,
  category_id uuid not null references public.categories(id) on delete cascade,
  playback_id text,
  processing_status text not null default 'ready'
    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  is_featured boolean not null default false,
  is_visible boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.experience (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  role text,
  start_date date,
  end_date date,
  description text,
  logo_url text,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  category text,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.specializations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin access is granted per Auth user ID. Add the first admin manually after
-- creating that user in Supabase Auth; no user is trusted by default.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists pages_published_slug_idx
  on public.pages (slug) where is_published;
create index if not exists categories_visible_order_idx
  on public.categories (display_order, slug) where is_visible;
create index if not exists videos_category_order_idx
  on public.videos (category_id, display_order) where is_visible;
create index if not exists videos_featured_idx
  on public.videos (is_featured) where is_visible and is_featured;
create index if not exists experience_visible_order_idx
  on public.experience (display_order) where is_visible;
create index if not exists tools_visible_order_idx
  on public.tools (display_order) where is_visible;
create index if not exists specializations_visible_order_idx
  on public.specializations (display_order) where is_visible;

-- Keep privileged helper functions outside Supabase's exposed API schemas.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at before update on public.site_settings
  for each row execute function private.set_updated_at();
drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at before update on public.pages
  for each row execute function private.set_updated_at();
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at before update on public.videos
  for each row execute function private.set_updated_at();
drop trigger if exists experience_set_updated_at on public.experience;
create trigger experience_set_updated_at before update on public.experience
  for each row execute function private.set_updated_at();
drop trigger if exists tools_set_updated_at on public.tools;
create trigger tools_set_updated_at before update on public.tools
  for each row execute function private.set_updated_at();
drop trigger if exists specializations_set_updated_at on public.specializations;
create trigger specializations_set_updated_at before update on public.specializations
  for each row execute function private.set_updated_at();
revoke all on function private.set_updated_at() from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users au where au.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_admin() from anon;
grant execute on function private.is_admin() to authenticated;

alter table public.site_settings enable row level security;
alter table public.pages enable row level security;
alter table public.categories enable row level security;
alter table public.videos enable row level security;
alter table public.experience enable row level security;
alter table public.tools enable row level security;
alter table public.specializations enable row level security;
alter table public.admin_users enable row level security;

grant select on public.site_settings, public.pages, public.categories, public.videos,
  public.experience, public.tools, public.specializations to anon, authenticated;
grant insert, update, delete on public.site_settings, public.pages, public.categories,
  public.videos, public.experience, public.tools, public.specializations to authenticated;
grant select on public.admin_users to authenticated;
revoke insert, update, delete on public.admin_users from anon, authenticated;

drop policy if exists "Public read site settings" on public.site_settings;
create policy "Public read site settings" on public.site_settings
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings" on public.site_settings
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "Public read published pages" on public.pages;
create policy "Public read published pages" on public.pages
  for select to anon, authenticated using (is_published);
drop policy if exists "Admins manage pages" on public.pages;
create policy "Admins manage pages" on public.pages
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "Public read visible categories" on public.categories;
create policy "Public read visible categories" on public.categories
  for select to anon, authenticated using (is_visible);
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "Public read visible videos in visible categories" on public.videos;
create policy "Public read visible videos in visible categories" on public.videos
  for select to anon, authenticated using (
    is_visible and exists (
      select 1 from public.categories c
      where c.id = videos.category_id and c.is_visible
    )
  );
drop policy if exists "Admins manage videos" on public.videos;
create policy "Admins manage videos" on public.videos
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "Public read visible experience" on public.experience;
create policy "Public read visible experience" on public.experience
  for select to anon, authenticated using (is_visible);
drop policy if exists "Admins manage experience" on public.experience;
create policy "Admins manage experience" on public.experience
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "Public read visible tools" on public.tools;
create policy "Public read visible tools" on public.tools
  for select to anon, authenticated using (is_visible);
drop policy if exists "Admins manage tools" on public.tools;
create policy "Admins manage tools" on public.tools
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "Public read visible specializations" on public.specializations;
create policy "Public read visible specializations" on public.specializations
  for select to anon, authenticated using (is_visible);
drop policy if exists "Admins manage specializations" on public.specializations;
create policy "Admins manage specializations" on public.specializations
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "Users read own admin membership" on public.admin_users;
create policy "Users read own admin membership" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Admins manage admin membership" on public.admin_users;

-- Supabase manages the storage schema and RLS. Create buckets in the Storage
-- Dashboard as documented in supabase/SETUP.md; these policies control objects.
drop policy if exists "Public read portfolio assets" on storage.objects;
create policy "Public read portfolio assets" on storage.objects
  for select to anon, authenticated using (
    bucket_id in ('thumbnails', 'images', 'logos', 'backgrounds', 'fonts')
  );
drop policy if exists "Admins upload portfolio assets" on storage.objects;
create policy "Admins upload portfolio assets" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('thumbnails', 'images', 'logos', 'backgrounds', 'fonts')
    and private.is_admin()
  );
drop policy if exists "Admins update portfolio assets" on storage.objects;
create policy "Admins update portfolio assets" on storage.objects
  for update to authenticated using (
    bucket_id in ('thumbnails', 'images', 'logos', 'backgrounds', 'fonts')
    and private.is_admin()
  ) with check (
    bucket_id in ('thumbnails', 'images', 'logos', 'backgrounds', 'fonts')
    and private.is_admin()
  );
drop policy if exists "Admins delete portfolio assets" on storage.objects;
create policy "Admins delete portfolio assets" on storage.objects
  for delete to authenticated using (
    bucket_id in ('thumbnails', 'images', 'logos', 'backgrounds', 'fonts')
    and private.is_admin()
  );

-- Create unpublished page shells, but do not migrate or invent page content.
insert into public.pages (title, slug, is_published, sections)
values
  ('Home', 'home', false, '[]'::jsonb),
  ('About', 'about', false, '[]'::jsonb),
  ('Work', 'work', false, '[]'::jsonb),
  ('Contact', 'contact', false, '[]'::jsonb)
on conflict (slug) do nothing;

-- These names/slugs mirror the existing site's category list. No video records
-- or other hardcoded page content are imported in this phase.
insert into public.categories (title, slug, display_order, is_visible)
values
  ('AI Videos', 'ai-videos', 1, true),
  ('Motion Graphics', 'motion-graphics', 2, true),
  ('Reels / Shorts', 'reels-shorts', 3, true),
  ('Explainer Videos', 'explainer-videos', 4, true),
  ('Launching Videos', 'launching-videos', 5, true),
  ('Shows / Interviews', 'shows-interviews', 6, true),
  ('Animation Videos', 'animation-videos', 7, true),
  ('Product Videos', 'product-videos', 8, true)
on conflict (slug) do nothing;
