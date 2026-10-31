# Supabase Phase 1 setup

This phase adds the Supabase client, database schema, row-level security, and public asset buckets. It does not connect Supabase to the portfolio UI or migrate existing videos/content.

## 1. Add local project credentials

Copy `.env.example` to `.env.local` and fill in:

- `VITE_SUPABASE_URL`: Supabase Dashboard **Connect** dialog or project API settings → Project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: use the `sb_publishable_...` key from **Project Settings → API Keys** or the Connect dialog when available.
- `VITE_SUPABASE_ANON_KEY`: legacy fallback when the project only has an `anon` key. Leave this blank when using the publishable key.

The browser client accepts either publishable or legacy anon key. These are public client keys; RLS is the security boundary. Never place a `service_role` or secret key in a `VITE_` variable or frontend code. `.env.local` is ignored by Git.

Restart Vite after changing environment values. `src/lib/supabase.js` exports `isSupabaseConfigured`, `supabase` (null until configured), and `requireSupabase()` for later phases. No network connection is attempted when credentials are missing.

For Vercel, add the same `VITE_SUPABASE_URL` and one client key to **Project Settings → Environment Variables** for the environments you use, then redeploy. Do not add a service-role/secret key there under a `VITE_` name.

## 2. Create Storage buckets

In **Storage → New bucket**, create these public buckets (do not create a video bucket):

| Bucket | Max file size | Allowed MIME types |
| --- | ---: | --- |
| `thumbnails` | 5 MB | `image/jpeg`, `image/png`, `image/webp`, `image/avif` |
| `images` | 10 MB | `image/jpeg`, `image/png`, `image/webp`, `image/avif` |
| `logos` | 2 MB | `image/jpeg`, `image/png`, `image/webp`, `image/avif` |
| `backgrounds` | 20 MB | `image/jpeg`, `image/png`, `image/webp`, `image/avif` |
| `fonts` | 10 MB | `font/woff`, `font/woff2`, `font/ttf`, `font/otf` |

Enable **Public bucket** for these published portfolio assets. Public buckets allow URL-based reads; their upload, replace, and delete operations remain governed by Storage RLS policies. Do not upload video files.

## 3. Apply the database migrations

In Supabase Dashboard, open **SQL Editor → New query**, paste and run these files in order:

1. `migrations/20261030000000_initial_schema.sql`
2. `migrations/20261030010000_admin_membership_read_own.sql`

The first migration creates the schema. The second hardens the `admin_users` allowlist for custom admin authentication. Both are safe to rerun.

It creates the seven requested content tables plus `admin_users`, a UUID allowlist used to securely authorize admins. It inserts unpublished page shells for `home`, `about`, `work`, and `contact`, and the eight existing category names/slugs. It creates no video records and imports no other portfolio content. It also installs object policies for the five buckets created in the prior step. Supabase manages the `storage` schema, so the migration does not edit its bucket tables.

## 4. Create the first authorized admin

1. In Supabase Dashboard, open **Authentication → Users** and invite/create the intended admin account.
2. Copy that user's UUID from the Users list.
3. In SQL Editor, run this after replacing the UUID:

   ```sql
   insert into public.admin_users (user_id)
   values ('00000000-0000-0000-0000-000000000000')
   on conflict (user_id) do nothing;
   ```

Only users explicitly listed in `public.admin_users` can pass the `/admin` authorization check. Frontend sessions can select only their own `user_id`; `anon` and `authenticated` cannot insert, update, or delete allowlist rows. Add/remove admins only through trusted Supabase Dashboard SQL. Do not create a broad authenticated-user policy or expose a service-role key to the browser.

## 5. Admin panel

After both migrations are applied and an admin account is in **Authentication → Users** and `public.admin_users`, set the frontend environment values from section 1 and open `/admin`. The panel uses Supabase Auth email/password login and signs out authenticated accounts that are not on the allowlist. There is no public signup route. Child routes are protected by the same guard; modules other than Overview are placeholders for later phases.

## 6. Verification and current limits

Run `npm run lint` and `npm run build`. Local frontend configuration does not establish that the migrations have been applied or that an authorized and unauthorized test account exists. Those live login, logout, database-count, and policy checks must be performed against the configured Supabase project. Public website routes do not load the admin dashboard bundle.

## 7. Homepage drafts and publishing (Phase 4)

Before using **Admin → Home Editor**, run `migrations/20261030020000_home_page_drafts.sql` in the Supabase SQL Editor. This creates `public.home_page_drafts` with admin-only read, insert, and update policies. It does not seed or replace content. Draft homepage sections stay in this table; public visitors read only `public.pages.sections` from the published `home` row. Publishing explicitly copies the selected draft into that existing row. The Home Editor does not create a missing `pages` row.

## 8. About drafts (Phase 5)

After the Phase 4 draft-table migration, run `migrations/20261030030000_enable_about_page_drafts.sql` in SQL Editor. It extends the existing private draft table to allow the `about` page slug; it adds no table, grant, or RLS policy. The About Editor stores draft content under `page_slug = 'about'` and publishes only to the existing `pages` row whose slug is `about`. Apply the Phase 4 and Phase 5 migrations in that order before using About Editor. Neither migration is run automatically by the application.
## Phase 6 — Work & Categories

Run `migrations/20261030040000_work_category_safety.sql` in the Supabase SQL Editor. It idempotently inserts any missing one of the eight original categories without overwriting existing category data, and changes the `videos.category_id` foreign key to `ON DELETE RESTRICT`. It does not alter video records or RLS policies. Run it after the initial schema migration (`20261030000000_initial_schema.sql`).

## Phase 7 — Video Manager

After the initial schema and Phase 6 category migration, run `migrations/20261030050000_video_manager.sql` in Supabase SQL Editor. It creates an admin-only `video_drafts` table, enables the `direct` provider, adds the public catalog transition flag, and idempotently imports the source video inventory. The checked-in category JSON currently contains **29 videos**: the 13 named in the Phase 7 brief plus 16 other existing videos. The migration preserves the existing 16 too, so switching to the database catalog will not drop them. The migration checks each category/provider/video ID (and original URL) before inserting. Existing records are not updated. Keep `src/data/categories/*.json` until published playback is verified.

The public Work route loads category metadata only. Published video rows are fetched only after a visitor opens a category. Drafts live separately and are admin-only; Save Draft does not touch published video data. An explicit Publish action updates the published row. Public playback reads only `is_visible = true` and `processing_status = 'ready'` records in visible categories. Before the Phase 7 migration is applied, the public page continues using the original JSON video collections.

### Cloudflare Stream uploads

Cloudflare upload API calls are handled by Vercel functions under `/api/cloudflare/`. The selected video file goes from the browser directly to Cloudflare; it is never sent through a Vercel function. In Vercel Project Settings → Environment Variables, add:

- `SUPABASE_URL` — the same Supabase project URL used by the frontend.
- `SUPABASE_ANON_KEY` — the frontend-safe anon/publishable key. The function uses the signed-in user's token and existing `admin_users` RLS policy to verify access; do not use a service-role key.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account identifier (server only).
- `CLOUDFLARE_API_TOKEN` — a server-only token with Cloudflare Stream write/read permissions. Never prefix it with `VITE_`.
- `VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE` — the public Stream customer code used to render playback and thumbnails.

Redeploy the Vercel project after adding environment variables. The Vercel functions are not served by the Vite development server, so Cloudflare upload/status actions are available after deployment to Vercel. Files at or below 200 MB use a one-time direct POST upload; larger files use resumable TUS chunks and are limited to Cloudflare Stream's 30 GB upload limit. Upload progress, processing status checks, and a ready-before-publish check are included. No upload is simulated when credentials are absent.

## Phase 10 — Global Website Settings

Before using **Admin → Global Settings**, apply `supabase/migrations/20261030080000_global_website_settings.sql` in the Supabase Dashboard:

1. Open **SQL Editor → New query**.
2. Paste the complete contents of `supabase/migrations/20261030080000_global_website_settings.sql`.
3. Run the query and confirm it completes successfully.

The migration adds a `public_content` JSON object to the existing single-row `site_settings` table. Existing global visual fields and their policies are untouched. It creates `site_settings_drafts` only for private admin drafts; its RLS policy uses the existing `private.is_admin()` function. The public app reads only `site_settings.public_content`, never draft rows. The application does not run the migration automatically.

Global settings manage shared identity, homepage navigation, contact information, social profiles, default SEO/social-sharing metadata, and optional content inside the existing footers. Page-specific SEO fields from published `pages` records take priority over global SEO defaults. Canonical URLs are emitted only for a valid configured HTTPS domain. The manager does not change Page-wise Design Studio configuration. Image fields upload directly to the existing purpose-specific Storage buckets and place the resulting public URL in the current draft; save or publish the page to write the URL into the content record. Existing Media Library assets and records are preserved.

### Direct image uploads

Home, About, Work categories, video thumbnails, Page Design, and Website Info accept image files directly in their corresponding content fields. Uploads use the existing `thumbnails`, `images`, `logos`, and `backgrounds` buckets with the configured bucket size/type limits and existing Storage RLS policies. Supported files are JPG/JPEG, PNG, WebP, and AVIF. The upload returns a public URL and bucket-relative storage path; the current content model stores the URL. Uploading does not publish content. Use the existing Save Draft or Publish action to persist the field in its content record. The Media Library route and records remain available to admins, but routine image uploads no longer require it.

## Phase 9 — Section Builder

Before using **Admin → Section Builder**, apply `supabase/migrations/20261030070000_page_section_builder.sql` in the Supabase Dashboard:

1. Open **SQL Editor → New query**.
2. Paste the complete contents of `supabase/migrations/20261030070000_page_section_builder.sql`.
3. Run the query and confirm it completes successfully.

The migration creates `public.page_section_configs` for published page structures and `public.page_section_drafts` for admin-only drafts. It enables RLS, permits public reads only for published configurations, and restricts changes to admins through the existing `private.is_admin()` check. The application does not run this migration automatically. If the tables are unavailable, public pages keep their existing hardcoded structure and the admin editor reports that the migration is pending.

The Section Builder supports Home, About, Work, Contact, and the shared Category detail page; each category may also have its own override. Drafts are scoped by page key, and public renderers never load draft rows. Preview uses the existing public page components with the selected draft from the admin browser session. Normal visitors see only published configurations or the existing page fallback.
