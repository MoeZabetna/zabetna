-- Builds out the `banners` table (schema + RLS already existed from
-- 0001_init.sql, but the admin panel feature was a "Coming Soon" stub) into
-- what Mo asked for: "banners per category available and homepage banners
-- ... we can upload 1 banner and if more than one then it becomes a
-- rotating slider banner. banners are the header of each page (homepage
-- and categories)."
--
-- `placement` already existed as a free-text column (default 'home_top')
-- but nothing enforced its shape — it was really meant to encode "where
-- does this banner render", which is exactly the homepage/category split
-- being asked for now. Rather than keep parsing conventions out of free
-- text (e.g. 'category:<uuid>'), this adds a real `category_id` FK and a
-- check constraint tying the two together, so "give me the active banners
-- for category X" is a plain indexed query, not string parsing. Safe to
-- redefine `placement`'s meaning outright — the banners table has 0 rows
-- (confirmed before writing this), so there's no data to migrate.
alter table banners add column category_id uuid references categories (id) on delete cascade;

alter table banners alter column placement set default 'homepage';

alter table banners add constraint banners_placement_category_check check (
  (placement = 'homepage' and category_id is null) or
  (placement = 'category' and category_id is not null)
);
alter table banners add constraint banners_placement_valid check (placement in ('homepage', 'category'));

create index idx_banners_placement on banners (placement, category_id, status, sort_order);

-- Storage bucket for banner images, same pattern as category-icons and
-- shop-banners/shop-menus (0006, 0010): public read, write gated by
-- content.manage — the permission that already gates banners_admin_write
-- (0001_init.sql).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banners',
  'banners',
  true,
  5242880, -- 5 MB; full-width header/slider images
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy banners_bucket_public_read on storage.objects
  for select using (bucket_id = 'banners');
create policy banners_bucket_admin_insert on storage.objects
  for insert with check (bucket_id = 'banners' and has_permission('content.manage'));
create policy banners_bucket_admin_update on storage.objects
  for update using (bucket_id = 'banners' and has_permission('content.manage'))
  with check (bucket_id = 'banners' and has_permission('content.manage'));
create policy banners_bucket_admin_delete on storage.objects
  for delete using (bucket_id = 'banners' and has_permission('content.manage'));
