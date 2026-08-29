-- Lets admins upload a custom image for a category icon instead of only
-- picking from the curated Lucide set in lib/icons.ts, and fixes a real gap
-- found while building this: `categories` had RLS enabled (0001_init.sql)
-- but no write policy at all, so every create/edit/delete/reorder from the
-- admin panel was being silently rejected by Postgres RLS. This migration
-- both adds that missing policy and adds icon-upload support in one pass.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Missing write policy on categories (pre-existing bug, not new work)
-- ─────────────────────────────────────────────────────────────────────────
create policy categories_admin_write on categories
  for all using (has_permission('content.manage')) with check (has_permission('content.manage'));

-- ─────────────────────────────────────────────────────────────────────────
-- 2. icon_url: when set, the admin panel and User App show this image
--    instead of looking `icon` up in the curated Lucide set. `icon` is kept
--    (nullable now) as the fallback name so a category never renders blank
--    if a custom image 404s.
-- ─────────────────────────────────────────────────────────────────────────
alter table categories add column icon_url text;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Storage bucket for uploaded icons. Public read (icons need to render
--    in the public User App), write restricted to admins with
--    content.manage — same permission that gates categories writes above.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'category-icons',
  'category-icons',
  true,
  1048576, -- 1 MB; these render at ~36px, no reason to allow more
  array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
on conflict (id) do nothing;

create policy category_icons_public_read on storage.objects
  for select using (bucket_id = 'category-icons');

create policy category_icons_admin_insert on storage.objects
  for insert with check (bucket_id = 'category-icons' and has_permission('content.manage'));

create policy category_icons_admin_update on storage.objects
  for update using (bucket_id = 'category-icons' and has_permission('content.manage'))
  with check (bucket_id = 'category-icons' and has_permission('content.manage'));

create policy category_icons_admin_delete on storage.objects
  for delete using (bucket_id = 'category-icons' and has_permission('content.manage'));
