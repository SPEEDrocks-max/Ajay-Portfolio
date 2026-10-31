-- Phase 6: keep the original category slugs available without overwriting rows.
-- This is safe to re-run and does not migrate or modify any video records.
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

-- The original foundation used ON DELETE CASCADE for videos.category_id.
-- Replace it with RESTRICT so a concurrent video assignment can never cascade-delete.
do $$
declare
  fk record;
begin
  for fk in
    select con.conname
    from pg_constraint con
    join pg_attribute attr
      on attr.attrelid = con.conrelid
     and attr.attnum = any(con.conkey)
    where con.conrelid = 'public.videos'::regclass
      and con.confrelid = 'public.categories'::regclass
      and con.contype = 'f'
      and attr.attname = 'category_id'
  loop
    execute format('alter table public.videos drop constraint %I', fk.conname);
  end loop;

  alter table public.videos
    add constraint videos_category_id_fkey
    foreign key (category_id)
    references public.categories(id)
    on delete restrict;
end;
$$;
