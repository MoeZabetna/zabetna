-- Zabetna — Phase 0 foundation schema
-- Mirrors docs/blueprint.html §03 (Data model) and §05 (RBAC). Apply as the
-- first migration once the Supabase project exists.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────
create type shop_status        as enum ('pending', 'active', 'suspended');
create type offer_status       as enum ('draft', 'active', 'paused', 'expired');
create type discount_type      as enum ('percentage', 'fixed', 'bogo');
create type redemption_status  as enum ('pending', 'verified', 'expired', 'cancelled');
create type staff_role         as enum ('owner', 'manager', 'staff');
create type account_status     as enum ('active', 'suspended');
create type banner_link_type   as enum ('shop', 'offer', 'category', 'external_url');
create type banner_status      as enum ('draft', 'scheduled', 'active', 'expired');

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at helper
-- ─────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Identity
-- ─────────────────────────────────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text unique,
  avatar_url  text,
  locale      text not null default 'en',
  status      account_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create table admin_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

create table admin_permissions (
  id       uuid primary key default gen_random_uuid(),
  key      text not null unique,      -- e.g. 'shops.approve', 'reports.export'
  label    text not null,
  category text not null              -- e.g. 'shops', 'reports', 'admins'
);

create table role_permissions (
  role_id       uuid not null references admin_roles (id) on delete cascade,
  permission_id uuid not null references admin_permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table admin_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users (id) on delete cascade,
  full_name     text not null,
  email         text not null unique,
  role_id       uuid not null references admin_roles (id),
  status        account_status not null default 'active',
  invited_by    uuid references admin_users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_admin_users_updated_at before update on admin_users
  for each row execute function set_updated_at();

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references admin_users (id),
  action      text not null,          -- e.g. 'shop.approve', 'banner.create'
  entity_type text not null,
  entity_id   uuid,
  diff        jsonb,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Catalog
-- ─────────────────────────────────────────────────────────────────────────
create table categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  icon       text,
  parent_id  uuid references categories (id),
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table shops (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category_id  uuid not null references categories (id),
  description  text,
  logo_url     text,
  cover_images text[] not null default '{}',
  lat          double precision,
  lng          double precision,
  address      text,
  phone        text,
  hours        jsonb,                 -- { "mon": ["09:00","22:00"], ... }
  status       shop_status not null default 'pending',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_shops_category on shops (category_id);
create index idx_shops_status   on shops (status);
create trigger trg_shops_updated_at before update on shops
  for each row execute function set_updated_at();

create table shop_staff (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references shops (id) on delete cascade,
  auth_user_id  uuid not null unique references auth.users (id) on delete cascade,
  role          staff_role not null default 'staff',
  status        account_status not null default 'active',
  created_at    timestamptz not null default now()
);
create index idx_shop_staff_shop on shop_staff (shop_id);

create table favorites (
  user_id    uuid not null references profiles (id) on delete cascade,
  shop_id    uuid not null references shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Offers & redemption
-- ─────────────────────────────────────────────────────────────────────────
create table offers (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references shops (id) on delete cascade,
  title          text not null,
  description    text,
  terms          text,
  discount_type  discount_type not null,
  discount_value numeric not null,
  image_url      text,
  start_at       timestamptz not null default now(),
  end_at         timestamptz not null,
  per_user_limit int not null default 1,
  total_limit    int,                 -- null = unlimited
  status         offer_status not null default 'draft',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint offers_window_valid check (end_at > start_at)
);
create index idx_offers_shop   on offers (shop_id);
create index idx_offers_status on offers (status);
create trigger trg_offers_updated_at before update on offers
  for each row execute function set_updated_at();

create table redemptions (
  id          uuid primary key default gen_random_uuid(),
  offer_id    uuid not null references offers (id),
  shop_id     uuid not null references shops (id),
  user_id     uuid not null references profiles (id),
  token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  status      redemption_status not null default 'pending',
  verified_by uuid references shop_staff (id),
  verified_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '3 minutes'),
  created_at  timestamptz not null default now()
);
create index idx_redemptions_offer  on redemptions (offer_id);
create index idx_redemptions_shop   on redemptions (shop_id);
create index idx_redemptions_user   on redemptions (user_id);
create index idx_redemptions_status on redemptions (status);
-- Note: `token` is already globally unique (column constraint above), so no
-- extra index is needed to prevent two rows sharing a token. What actually
-- prevents a token being verified twice is the conditional
-- `update ... where status = 'pending'` in supabase/functions/verify-redemption
-- — that compare-and-swap is what closes the race between two scans.

-- ─────────────────────────────────────────────────────────────────────────
-- Merchandising
-- ─────────────────────────────────────────────────────────────────────────
create table banners (
  id         uuid primary key default gen_random_uuid(),
  image_url  text not null,
  link_type  banner_link_type not null,
  link_target text,                   -- shop_id / offer_id / category_id / URL, per link_type
  placement  text not null default 'home_top',
  start_at   timestamptz not null default now(),
  end_at     timestamptz,
  sort_order int not null default 0,
  status     banner_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table featured_listings (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  shop_id     uuid not null references shops (id) on delete cascade,
  rank        int not null check (rank between 1 and 3),
  start_at    timestamptz not null default now(),
  end_at      timestamptz,
  unique (category_id, rank, start_at)
);
create index idx_featured_category on featured_listings (category_id);

-- ─────────────────────────────────────────────────────────────────────────
-- RBAC helper — used by RLS policies below
-- ─────────────────────────────────────────────────────────────────────────
create or replace function has_permission(perm_key text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from admin_users au
    join role_permissions rp on rp.role_id = au.role_id
    join admin_permissions ap on ap.id = rp.permission_id
    where au.auth_user_id = auth.uid()
      and au.status = 'active'
      and ap.key = perm_key
  );
$$;

create or replace function staff_shop_id()
returns uuid language sql security definer stable as $$
  select shop_id from shop_staff
  where auth_user_id = auth.uid() and status = 'active'
  limit 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────────────────────
alter table profiles           enable row level security;
alter table shops               enable row level security;
alter table categories          enable row level security;
alter table shop_staff          enable row level security;
alter table favorites           enable row level security;
alter table offers              enable row level security;
alter table redemptions         enable row level security;
alter table banners             enable row level security;
alter table featured_listings   enable row level security;
alter table admin_users         enable row level security;
alter table admin_roles         enable row level security;
alter table audit_log           enable row level security;

-- profiles: users manage only their own row; admins with a users permission can read all
create policy profiles_self_rw on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_read on profiles
  for select using (has_permission('users.view'));

-- categories, shops, offers, banners, featured_listings: public read of "live" rows
create policy categories_public_read on categories
  for select using (is_active);
create policy shops_public_read on shops
  for select using (status = 'active');
create policy offers_public_read on offers
  for select using (status = 'active');
create policy banners_public_read on banners
  for select using (status = 'active');
create policy featured_public_read on featured_listings
  for select using (true);

-- shops/offers: admin write gated by permission; shop staff can read+update their own shop's offers
create policy shops_admin_write on shops
  for all using (has_permission('shops.manage')) with check (has_permission('shops.manage'));
create policy offers_admin_write on offers
  for all using (has_permission('shops.manage')) with check (has_permission('shops.manage'));
create policy offers_staff_scope on offers
  for select using (shop_id = staff_shop_id());

-- shop_staff: staff can read their own row; admins manage all
create policy shop_staff_self_read on shop_staff
  for select using (auth_user_id = auth.uid());
create policy shop_staff_admin_write on shop_staff
  for all using (has_permission('shops.manage')) with check (has_permission('shops.manage'));

-- favorites: strictly owner-scoped
create policy favorites_owner on favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- redemptions: user sees their own; shop staff see/verify only their shop's; admins with reports permission read all
create policy redemptions_user_read on redemptions
  for select using (user_id = auth.uid());
create policy redemptions_staff_scope on redemptions
  for select using (shop_id = staff_shop_id());
create policy redemptions_staff_verify on redemptions
  for update using (shop_id = staff_shop_id()) with check (shop_id = staff_shop_id());
create policy redemptions_admin_read on redemptions
  for select using (has_permission('reports.view'));

-- banners / featured_listings: admin write gated by permission
create policy banners_admin_write on banners
  for all using (has_permission('content.manage')) with check (has_permission('content.manage'));
create policy featured_admin_write on featured_listings
  for all using (has_permission('content.manage')) with check (has_permission('content.manage'));

-- admin_users / admin_roles / audit_log: super-admin-only surface
create policy admin_users_self_read on admin_users
  for select using (auth_user_id = auth.uid());
create policy admin_users_manage on admin_users
  for all using (has_permission('admins.manage')) with check (has_permission('admins.manage'));
create policy admin_roles_read on admin_roles
  for select using (auth.uid() is not null);
create policy audit_log_read on audit_log
  for select using (has_permission('admins.manage'));

-- ─────────────────────────────────────────────────────────────────────────
-- Seed: default roles + permission catalogue (from blueprint §05)
-- ─────────────────────────────────────────────────────────────────────────
insert into admin_permissions (key, label, category) values
  ('shops.manage',    'Approve, edit, suspend shops',        'shops'),
  ('content.manage',  'Manage categories, banners, featured', 'content'),
  ('users.view',       'View app user accounts',              'users'),
  ('support.resolve',  'View & resolve support/disputes',     'support'),
  ('reports.view',     'View overall & per-shop reports',     'reports'),
  ('reports.export',   'Export reports',                      'reports'),
  ('admins.manage',    'Manage admin users & roles',          'admins');

insert into admin_roles (name, description) values
  ('Super Admin',     'Full access to every capability'),
  ('Ops Manager',     'Shop onboarding, categories, reports'),
  ('Content Manager', 'Banners, featured listings, categories'),
  ('Support Agent',   'User support and dispute resolution'),
  ('Reports Viewer',  'Read-only reporting access');

-- Super Admin gets everything
insert into role_permissions (role_id, permission_id)
select (select id from admin_roles where name = 'Super Admin'), id from admin_permissions;

-- Ops Manager
insert into role_permissions (role_id, permission_id)
select (select id from admin_roles where name = 'Ops Manager'), id
from admin_permissions where key in ('shops.manage','reports.view','reports.export','support.resolve');

-- Content Manager
insert into role_permissions (role_id, permission_id)
select (select id from admin_roles where name = 'Content Manager'), id
from admin_permissions where key in ('content.manage');

-- Support Agent
insert into role_permissions (role_id, permission_id)
select (select id from admin_roles where name = 'Support Agent'), id
from admin_permissions where key in ('users.view','support.resolve');

-- Reports Viewer
insert into role_permissions (role_id, permission_id)
select (select id from admin_roles where name = 'Reports Viewer'), id
from admin_permissions where key in ('reports.view');
