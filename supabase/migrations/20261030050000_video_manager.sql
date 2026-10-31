-- Phase 7: private video drafts, supported provider values and safe data import.
-- Apply after 20261030040000_work_category_safety.sql.

alter table public.videos drop constraint if exists videos_provider_check;
alter table public.videos add constraint videos_provider_check
  check (provider in ('youtube', 'vimeo', 'google_drive', 'direct', 'cloudflare'));

alter table public.site_settings
  add column if not exists video_catalog_migrated boolean not null default false;

create table if not exists public.video_drafts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid unique references public.videos(id) on delete cascade,
  title text not null,
  description text,
  provider text not null check (provider in ('youtube', 'vimeo', 'google_drive', 'direct', 'cloudflare')),
  video_url text not null,
  video_id_external text,
  thumbnail_url text,
  category_id uuid not null references public.categories(id) on delete restrict,
  playback_id text,
  processing_status text not null default 'ready'
    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  is_featured boolean not null default false,
  display_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_drafts_updated_idx on public.video_drafts (updated_at desc);
create index if not exists video_drafts_category_idx on public.video_drafts (category_id);
alter table public.video_drafts enable row level security;
revoke all on public.video_drafts from anon;
grant select, insert, update, delete on public.video_drafts to authenticated;
drop policy if exists "Admins manage video drafts" on public.video_drafts;
create policy "Admins manage video drafts" on public.video_drafts
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Processing Cloudflare uploads are not public until Stream says they are ready.
drop policy if exists "Public read visible videos in visible categories" on public.videos;
create policy "Public read visible videos in visible categories" on public.videos
  for select to anon, authenticated using (
    is_visible and processing_status = 'ready' and exists (
      select 1 from public.categories c
      where c.id = videos.category_id and c.is_visible
    )
  );

drop trigger if exists video_drafts_set_updated_at on public.video_drafts;
create trigger video_drafts_set_updated_at before update on public.video_drafts
  for each row execute function private.set_updated_at();

-- Source inventory is imported with original order and thumbnail values.
-- The task's named inventory contains 13; the checked-in category JSON currently
-- contains 29 total records, so the remaining 16 are imported as well to avoid
-- dropping existing public work when the database catalog is enabled.
with source(category_slug, title, provider, video_url, external_id, thumbnail_url, display_order) as (
  values
    ('ai-videos', 'Onida — YouTube', 'youtube', 'https://youtu.be/7LyloynByho?si=zsF5Oj-QULvRjQDZ', '7LyloynByho', null, 1),
    ('ai-videos', 'HMD', 'google_drive', 'https://drive.google.com/file/d/1FKwah07-LWgqOa_dCDmMFmlW1uO3ojMt/view?usp=sharing', '1FKwah07-LWgqOa_dCDmMFmlW1uO3ojMt', 'https://drive.google.com/thumbnail?id=1FKwah07-LWgqOa_dCDmMFmlW1uO3ojMt&sz=w1280', 2),
    ('ai-videos', 'Decostyle', 'google_drive', 'https://drive.google.com/file/d/1oC05qqTkdk_1vvMdYD0bpcGvaR5FwcuD/view?usp=sharing', '1oC05qqTkdk_1vvMdYD0bpcGvaR5FwcuD', 'https://drive.google.com/thumbnail?id=1oC05qqTkdk_1vvMdYD0bpcGvaR5FwcuD&sz=w1280', 3),
    ('ai-videos', 'Bajaj General Insurance', 'google_drive', 'https://drive.google.com/file/d/13Y64W5sFPod4TiV51uQZrTV8ek7iLepe/view?usp=sharing', '13Y64W5sFPod4TiV51uQZrTV8ek7iLepe', 'https://drive.google.com/thumbnail?id=13Y64W5sFPod4TiV51uQZrTV8ek7iLepe&sz=w1280', 4),
    ('ai-videos', 'Onida — Google Drive Version', 'google_drive', 'https://drive.google.com/file/d/12De-to3azn3TvCV2vC6GFkVaNUUYzK2l/view?usp=sharing', '12De-to3azn3TvCV2vC6GFkVaNUUYzK2l', 'https://drive.google.com/thumbnail?id=12De-to3azn3TvCV2vC6GFkVaNUUYzK2l&sz=w1280', 5),
    ('ai-videos', 'TMB', 'vimeo', 'https://vimeo.com/1150840402?fl=tl&fe=ec', '1150840402', 'https://vumbnail.com/1150840402_large.jpg', 6),
    ('animation-videos', 'Animation Video 01', 'youtube', 'https://youtube.com/shorts/KaH_WOG023w', 'KaH_WOG023w', null, 1),
    ('animation-videos', 'Animation Video 02', 'youtube', 'https://youtu.be/aHEejmSBOlw', 'aHEejmSBOlw', null, 2),
    ('animation-videos', 'Animation Video 03', 'youtube', 'https://youtu.be/4Snd5-0XHJ4', '4Snd5-0XHJ4', null, 3),
    ('animation-videos', 'Animation 1', 'vimeo', 'https://vimeo.com/1150837556?fl=tl&fe=ec', '1150837556', 'https://vumbnail.com/1150837556_large.jpg', 4),
    ('animation-videos', 'Animation 2', 'vimeo', 'https://vimeo.com/1150837924?fl=tl&fe=ec', '1150837924', 'https://vumbnail.com/1150837924_large.jpg', 5),
    ('explainer-videos', 'Explainer Video 01', 'youtube', 'https://www.youtube.com/watch?v=_lJ7Knn2YFM', '_lJ7Knn2YFM', null, 1),
    ('explainer-videos', 'Explainer Video 02', 'youtube', 'https://www.youtube.com/watch?v=-z-k-Qk32No', '-z-k-Qk32No', null, 2),
    ('explainer-videos', 'Explainer Video 03', 'youtube', 'https://www.youtube.com/watch?v=FWI27zS6Yro', 'FWI27zS6Yro', null, 3),
    ('explainer-videos', 'Explainer Video 04', 'youtube', 'https://youtu.be/sHmlsopUP5M', 'sHmlsopUP5M', null, 4),
    ('launching-videos', 'Launching Video 01', 'youtube', 'https://youtu.be/Ky9lpDYPiQg', 'Ky9lpDYPiQg', null, 1),
    ('launching-videos', 'Launching Video 02', 'youtube', 'https://youtu.be/JC9i6XxS0jc?si=4GYhiRwJ8E0SyAjN', 'JC9i6XxS0jc', null, 2),
    ('motion-graphics', 'Motion Graphic 01', 'youtube', 'https://youtu.be/5l_aOZgvEwA?si=RMIYaEBCe6meJIkz', '5l_aOZgvEwA', null, 1),
    ('motion-graphics', 'Motion Graphic 02', 'youtube', 'https://youtu.be/nElTRp7fTbs', 'nElTRp7fTbs', null, 2),
    ('product-videos', 'Product Video 01', 'youtube', 'https://youtu.be/7LyloynByho?si=zsF5Oj-QULvRjQDZ', '7LyloynByho', null, 1),
    ('reels-shorts', 'Reel / Short 01', 'youtube', 'https://youtube.com/shorts/TsMoh4OQ4M0?si=b7LVH-cxV2BPSmF4', 'TsMoh4OQ4M0', null, 1),
    ('reels-shorts', 'Reel / Short 02', 'youtube', 'https://youtube.com/shorts/hNHtJ5j0iX0?si=MGz9y39xe1qopGnK', 'hNHtJ5j0iX0', null, 2),
    ('reels-shorts', 'Reel 1', 'vimeo', 'https://vimeo.com/1153208167?share=copy&fl=sv&fe=ci', '1153208167', 'https://vumbnail.com/1153208167_large.jpg', 3),
    ('reels-shorts', 'Reel 2', 'vimeo', 'https://vimeo.com/1153211720?fl=tl&fe=ec', '1153211720', 'https://vumbnail.com/1153211720_large.jpg', 4),
    ('shows-interviews', 'Show / Interview 01', 'youtube', 'https://youtu.be/hmLwQYNJ9y4?si=G-paUsbj-FWc24Rt', 'hmLwQYNJ9y4', null, 1),
    ('shows-interviews', 'Show / Interview 02', 'youtube', 'https://youtu.be/XDcY5zx3To8', 'XDcY5zx3To8', null, 2),
    ('shows-interviews', 'Online Interview 1', 'vimeo', 'https://vimeo.com/1123654303/a47707b911?share=copy&fl=cl&fe=ci', '1123654303', 'https://vumbnail.com/1123654303_large.jpg', 3),
    ('shows-interviews', 'Online Interview 2', 'vimeo', 'https://vimeo.com/1126750326/f4629ef5f3?share=copy&fl=cl&fe=ci', '1126750326', 'https://vumbnail.com/1126750326_large.jpg', 4),
    ('shows-interviews', 'Online Interview 3', 'vimeo', 'https://vimeo.com/1076406284/68650bd516?share=copy&fl=cl&fe=ci', '1076406284', 'https://vumbnail.com/1076406284_large.jpg', 5)
)
insert into public.videos (title, provider, video_url, video_id, thumbnail_url, category_id, display_order, is_featured, is_visible, processing_status)
select source.title, source.provider, source.video_url, source.external_id, source.thumbnail_url,
       category.id, source.display_order, false, true, 'ready'
from source
join public.categories category on category.slug = source.category_slug
where not exists (
  select 1 from public.videos existing
  where existing.category_id = category.id
    and existing.provider = source.provider
    and (existing.video_url = source.video_url or (source.external_id is not null and (
      existing.video_id = source.external_id
      or (source.provider = 'youtube' and lower(existing.video_id) = lower(source.external_id))
      or (source.provider = 'youtube' and (
        existing.video_url like ('%watch?v=' || source.external_id || '%')
        or existing.video_url like ('%youtu.be/' || source.external_id || '%')
        or existing.video_url like ('%/shorts/' || source.external_id || '%')
        or existing.video_url like ('%/embed/' || source.external_id || '%')
        or existing.video_url like ('%/live/' || source.external_id || '%')
      ))
      or (source.provider = 'vimeo' and existing.video_url like ('%vimeo.com/' || source.external_id || '%'))
    )))
);

-- Mark the database catalog authoritative only after the idempotent import.
insert into public.site_settings (video_catalog_migrated)
values (true)
on conflict ((true)) do update set video_catalog_migrated = true;
