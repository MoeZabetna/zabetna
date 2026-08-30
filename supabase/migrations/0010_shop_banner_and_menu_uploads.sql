-- Adds per-shop header banner + menu photo uploads, per Mo's request:
-- "in shop profile, there should be an option to upload menu, and there
-- should be a mandatory banner per shop which displays later as header
-- image of the shop page."
--
-- `banner_image_url` is deliberately a separate column from the existing
-- `cover_images text[]` gallery field (0001_init.sql) — it's a distinct,
-- single-purpose "header image" concept, not another gallery photo, so it
-- gets its own name rather than overloading cover_images[0].
--
-- "Mandatory" is enforced in the admin UI (ShopFormModal won't submit
-- without one, same pattern as the existing name/category required-field
-- check), not as a database NOT NULL constraint. A hard NOT NULL can't be
-- added yet without breaking the 19 existing demo shops, none of which have
-- a banner set — this column starts nullable, gets backfilled (see the
-- follow-up seed migration), and NOT NULL can be added in a later migration
-- once every row actually has one. Two-step rollout, not a shortcut.
alter table shops add column banner_image_url text;
alter table shops add column menu_images text[] not null default '{}';

-- Storage buckets, same pattern as category-icons (0006_category_icon_uploads.sql):
-- public read (these render in the public User App), write gated by
-- shops.manage — the same permission that already gates all other shop
-- writes (shops_admin_write in 0001_init.sql).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-banners',
  'shop-banners',
  true,
  5242880, -- 5 MB; full-width header photos, not thumbnails
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-menus',
  'shop-menus',
  true,
  10485760, -- 10 MB; menus are often multi-page photos or a scanned PDF
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy shop_banners_public_read on storage.objects
  for select using (bucket_id = 'shop-banners');
create policy shop_banners_admin_insert on storage.objects
  for insert with check (bucket_id = 'shop-banners' and has_permission('shops.manage'));
create policy shop_banners_admin_update on storage.objects
  for update using (bucket_id = 'shop-banners' and has_permission('shops.manage'))
  with check (bucket_id = 'shop-banners' and has_permission('shops.manage'));
create policy shop_banners_admin_delete on storage.objects
  for delete using (bucket_id = 'shop-banners' and has_permission('shops.manage'));

create policy shop_menus_public_read on storage.objects
  for select using (bucket_id = 'shop-menus');
create policy shop_menus_admin_insert on storage.objects
  for insert with check (bucket_id = 'shop-menus' and has_permission('shops.manage'));
create policy shop_menus_admin_update on storage.objects
  for update using (bucket_id = 'shop-menus' and has_permission('shops.manage'))
  with check (bucket_id = 'shop-menus' and has_permission('shops.manage'));
create policy shop_menus_admin_delete on storage.objects
  for delete using (bucket_id = 'shop-menus' and has_permission('shops.manage'));
