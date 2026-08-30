-- 0013_seed_demo_redemptions.sql
--
-- SYNTHETIC DEMO DATA — not real customers, not real activity.
--
-- The new Reports pages (Overall Redemption + Daily Performance) have
-- nothing to show without real redemption rows, and as of this migration
-- zero redemptions have ever been created: the mobile redeem/scan flow
-- (User App + Restaurant App) isn't built yet, so no real code path has
-- ever inserted into `redemptions`.
--
-- To make Reports demoable, this migration creates:
--   1. 12 demo Supabase Auth users (`auth.users`) — required because
--      `redemptions.user_id` -> `profiles.id` -> `auth.users.id` is a real
--      foreign-key chain; there is no way to attach a redemption to
--      anything less than a real auth user row.
--   2. Matching `profiles` rows.
--   3. ~220 synthetic `redemptions`, all `status = 'verified'`, spread
--      over the last 8 weeks, with day/hour patterns that loosely mimic
--      real usage per category (restaurants skew dinner + weekend, clubs
--      skew late night + weekend, fashion/activities skew daytime).
--
-- These accounts are deliberately impossible to sign in to:
--   - encrypted_password is left NULL (no password to check against)
--   - banned_until is set far in the future (blocks every GoTrue auth
--     flow outright, not just password login)
--   - raw_user_meta_data marks them {"seed": "demo-redemptions", ...}
--     for easy identification
--
-- Redemptions can only be created for shops that already have at least
-- one offer (redemptions.offer_id is NOT NULL) — 7 of the 19 demo shops
-- currently have offers (Em Sherif, Liza Beirut, Tawlet, Internazionale,
-- The Music Hall, ABC Achrafieh, Escape The Room Beirut). The other 12
-- shops — and all of Cars, Pets, Gym, and Electronic — correctly show
-- zero redemptions in Reports: that's not a seeding gap, it's an
-- accurate reflection that those shops have no live offers yet.
--
-- CLEANUP BEFORE REAL LAUNCH: delete these rows (and the trigger they
-- exercise is fine to keep — only the seeded data needs removing) with:
--   delete from public.redemptions where fee_amount_usd is not null
--     and user_id in (select id from auth.users where raw_user_meta_data->>'seed' = 'demo-redemptions');
--   delete from public.profiles where id in
--     (select id from auth.users where raw_user_meta_data->>'seed' = 'demo-redemptions');
--   delete from auth.users where raw_user_meta_data->>'seed' = 'demo-redemptions';

-- 1 & 2. Demo auth users + profiles
do $$
declare
  i int;
  new_id uuid;
begin
  for i in 1..12 loop
    new_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      banned_until, is_sso_user, is_anonymous,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_id, 'authenticated', 'authenticated',
      'demo-customer-' || lpad(i::text, 2, '0') || '@zabetna-demo.internal',
      null, null,
      '{"provider":"demo","providers":["demo"]}'::jsonb,
      jsonb_build_object('seed', 'demo-redemptions', 'full_name', 'Demo Customer ' || lpad(i::text, 2, '0')),
      '2099-12-31 00:00:00+00',
      false, false,
      now(), now()
    );

    insert into public.profiles (id, full_name, locale, status)
    values (new_id, 'Demo Customer ' || lpad(i::text, 2, '0'), 'en', 'active');
  end loop;
end $$;

-- 3. Synthetic verified redemptions, ~8 weeks of history, per-category
--    day/hour weighting so the Daily Performance heatmap has a realistic
--    shape rather than uniform noise.
do $$
declare
  demo_user_ids uuid[];
  target record;
  redemption_count int;
  n int;
  target_dow int;
  cur_dow int;
  weeks_back int;
  seed_date date;
  hour_choice int;
  redeemed_at timestamptz;
  weighted_hours int[];
  weighted_days int[];
begin
  cur_dow := extract(dow from current_date)::int; -- 0=Sunday..6=Saturday
  select array_agg(id) into demo_user_ids
  from auth.users
  where raw_user_meta_data->>'seed' = 'demo-redemptions';

  for target in
    select s.id as shop_id, o.id as offer_id, c.name as category
    from shops s
    join categories c on c.id = s.category_id
    join lateral (
      select o.id, row_number() over (partition by o.shop_id order by o.created_at) as rn,
             count(*) over (partition by o.shop_id) as total
      from offers o where o.shop_id = s.id
    ) o on true
    where o.rn = 1  -- one representative offer per shop is enough for demo volume
  loop
    -- Category-shaped weighting: an array of hours (0-23) and days
    -- (0=Sunday..6=Saturday, matching offers.days_of_week's convention)
    -- with repeats so a weighted-random pick is a plain array index.
    if target.category = 'Restaurants' then
      weighted_hours := array[13,13,14,19,19,19,20,20,20,20,21,21,21,22];
      weighted_days := array[3,4,4,5,5,5,6,6,6,0,1,2];
      redemption_count := 28;
    elsif target.category = 'Club & Pubs' then
      weighted_hours := array[21,22,22,22,23,23,0,0,1];
      weighted_days := array[4,4,5,5,5,6,6,6,3];
      redemption_count := 24;
    elsif target.category = 'Fashion' then
      weighted_hours := array[11,12,13,14,15,16,17,18,19];
      weighted_days := array[5,6,6,0,0,1,2,3,4];
      redemption_count := 18;
    elsif target.category = 'Activities' then
      weighted_hours := array[14,15,16,17,18,19,20,21];
      weighted_days := array[5,5,6,6,6,0,0,4];
      redemption_count := 16;
    else
      weighted_hours := array[12,13,14,15,16,17,18,19,20];
      weighted_days := array[0,1,2,3,4,5,6];
      redemption_count := 12;
    end if;

    for n in 1..redemption_count loop
      -- Pick a day-of-week from the category's weighting, then walk back
      -- to the most recent real calendar date with that weekday, offset
      -- by a random 0-7 additional weeks so the 8-week window fills in
      -- rather than every pick landing on the same handful of dates.
      target_dow := weighted_days[1 + floor(random() * array_length(weighted_days, 1))::int];
      weeks_back := floor(random() * 8)::int;
      seed_date := current_date - (((cur_dow - target_dow + 7) % 7) + weeks_back * 7);
      hour_choice := weighted_hours[1 + floor(random() * array_length(weighted_hours, 1))::int];
      -- Composed as a plain (non-tz) timestamp in Beirut wall-clock time,
      -- then interpreted as Asia/Beirut and converted to a real instant —
      -- this is what makes "hour 20" in the seed actually mean 8pm Beirut
      -- time downstream, matching how the reports bucket verified_at.
      redeemed_at := (
        (seed_date::timestamp
          + (hour_choice || ' hours')::interval
          + (floor(random() * 60) || ' minutes')::interval)
      ) at time zone 'Asia/Beirut';

      insert into public.redemptions (
        offer_id, shop_id, user_id, status,
        verified_by, verified_at, created_at, expires_at
      ) values (
        target.offer_id,
        target.shop_id,
        demo_user_ids[1 + floor(random() * array_length(demo_user_ids, 1))::int],
        'verified',
        null,
        redeemed_at,
        redeemed_at - interval '2 minutes',
        redeemed_at + interval '1 minute'
      );
    end loop;
  end loop;
end $$;
