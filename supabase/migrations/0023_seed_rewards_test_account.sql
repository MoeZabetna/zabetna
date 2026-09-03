-- 0023_seed_rewards_test_account.sql
--
-- A single, deliberately obvious test account with enough points to
-- exercise the payout flow end to end (User App "Redeem" -> admin
-- Reward Program tab -> Confirm -> notification).
--
-- Why this exists at all: points are `count(verified redemptions)`, the
-- payout minimum is 40 points, and the highest any demo user has ever
-- reached is 23. Without this, the Redeem button can only ever be seen in
-- its disabled state, and the whole money path would first run in
-- production against a real user's balance. Approved by Mo, 2026-09-02,
-- after a previous session correctly declined to pad the seed data
-- silently (see docs/rewards-program.md, "Demo data note").
--
-- Everything here is named to be unmistakable and is confined so it cannot
-- distort anything real:
--
--   * The shop is `status = 'pending'`, so `shops_public_read` (which
--     requires 'active') hides it from every app user. It is not browsable.
--   * The shop's `value_per_redemption` is 0.00, so these 40 redemptions
--     add **$0.00** to the Reports fee totals. They do add 40 rows to the
--     redemption *count* — that is unavoidable, since points are literally
--     that count — which is exactly why the shop name shouts.
--   * Every name is prefixed "ZZ TEST" so it sorts last and reads as fake.
--
-- TO REMOVE BEFORE LAUNCH: delete the auth user; the cascade takes the
-- profile, redemptions, notifications and push tokens with it, then delete
-- the shop (its offer cascades).
--
--   delete from auth.users where email = 'rewards.qa@zabetna.test';
--   delete from public.shops where name like 'ZZ TEST%';

do $$
declare
  test_user_id  uuid := gen_random_uuid();
  test_shop_id  uuid;
  test_offer_id uuid;
  test_category uuid;
begin
  -- Reuse whichever category sorts first; the shop is invisible anyway, so
  -- this is just satisfying the not-null FK without inventing a category.
  select id into test_category from public.categories order by sort_order, name limit 1;
  if test_category is null then
    raise exception 'no categories seeded — run 0003_seed_categories.sql first';
  end if;

  -- ── The account ───────────────────────────────────────────────────────
  -- Written straight into auth.users for the same reason 0004 does it: the
  -- sandbox running these migrations cannot reach the GoTrue REST API. The
  -- empty-string columns are mandatory; leaving them NULL makes GoTrue's
  -- schema query 500 on login. See 0004_bootstrap_super_admin.sql.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    test_user_id,
    'authenticated',
    'authenticated',
    'rewards.qa@zabetna.test',
    crypt('ZabetnaTest!2026', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    -- No full_name/phone here on purpose: handle_new_user() would create
    -- the profile from this metadata, and the profile is created explicitly
    -- below so this migration reads as one obvious block rather than
    -- depending on a trigger's side effect.
    '{}',
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    test_user_id,
    test_user_id::text,
    jsonb_build_object('sub', test_user_id::text, 'email', 'rewards.qa@zabetna.test'),
    'email',
    now(), now(), now()
  );

  insert into public.profiles (id, full_name, phone, status)
  values (
    test_user_id,
    'ZZ TEST — Rewards QA (delete before launch)',
    '+961700000000',
    'active'
  );

  -- ── The invisible shop and its offer ──────────────────────────────────
  insert into public.shops (name, category_id, description, status, city, value_per_redemption)
  values (
    'ZZ TEST SHOP — Rewards QA (delete before launch)',
    test_category,
    'Seeded by 0023 so the rewards payout flow can be tested. status=pending keeps it out of the app; value_per_redemption=0 keeps it out of the money in Reports.',
    'pending',
    'Beirut',
    0.00
  )
  returning id into test_shop_id;

  insert into public.offers (
    shop_id, title, description, discount_type, discount_value,
    start_at, end_at, per_user_limit, status
  ) values (
    test_shop_id,
    'ZZ TEST OFFER — Rewards QA',
    'Seeded alongside the test account purely to satisfy redemptions.offer_id.',
    'percentage',
    10,
    now() - interval '1 day',
    now() + interval '10 years',
    1000,
    'draft'
  )
  returning id into test_offer_id;

  -- ── 40 verified redemptions = 40 points = exactly the payout minimum ──
  -- fee_amount_usd is set explicitly to 0.00 rather than left null: the
  -- 2026-08-30 audit asserts "every verified redemption has a locked fee",
  -- and these rows must not be the ones that break that invariant. The fee
  -- trigger only fires on the pending -> verified *update*, and these are
  -- inserted already-verified, so nothing would set it otherwise.
  insert into public.redemptions (
    offer_id, shop_id, user_id, status, verified_at, expires_at,
    fee_amount_usd, created_at
  )
  select
    test_offer_id,
    test_shop_id,
    test_user_id,
    'verified',
    now() - (n || ' hours')::interval,
    now() - (n || ' hours')::interval + interval '3 minutes',
    0.00,
    now() - (n || ' hours')::interval
  from generate_series(1, 40) as n;

  raise notice 'Seeded rewards QA account % with 40 points', test_user_id;
end $$;
