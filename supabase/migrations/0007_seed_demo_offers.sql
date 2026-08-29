-- Demo offers so the new Offers tab (and the User App, once it reads
-- `offers`) has real percentage / fixed / BOGO examples to show, linked to
-- the demo shops seeded in 0005_seed_demo_shops_beirut.sql. RLS already
-- covers this table (offers_admin_write / offers_public_read /
-- offers_staff_scope, all present since 0001_init.sql) — nothing to add
-- there, unlike the categories gap found earlier.
insert into offers (shop_id, title, description, terms, discount_type, discount_value, per_user_limit, total_limit, start_at, end_at, status) values
  (
    (select id from shops where name = 'Em Sherif'),
    '20% Off Dinner',
    'Take 20% off your total bill when dining in for dinner.',
    'Dine-in only. Not valid with other promotions. One redemption per table.',
    'percentage', 20, 1, null,
    now() - interval '3 days', now() + interval '30 days', 'active'
  ),
  -- Tawlet's three lunch/brunch offers moved to 0008_offer_days_of_week_and_expiry_fix.sql's
  -- companion seed (they demonstrate the days_of_week column added there).
  (
    (select id from shops where name = 'Liza Beirut'),
    'Buy 1 Get 1 Free — Starters',
    'Order any starter and get a second one free.',
    'Lower-priced item is the free one. Dine-in only.',
    'bogo', 0, 1, null,
    now() - interval '5 days', now() + interval '20 days', 'active'
  ),
  (
    (select id from shops where name = 'The Music Hall'),
    '15% Off Show Tickets',
    'Discount on standard tickets for any regular show night.',
    'Excludes special/guest events. Subject to availability.',
    'percentage', 15, 2, 500,
    now() - interval '2 days', now() + interval '60 days', 'active'
  ),
  (
    (select id from shops where name = 'ABC Achrafieh'),
    '$25 Off Fashion Purchases',
    '$25 off purchases over $150 at participating fashion stores in the mall.',
    'Minimum spend $150. One use per customer per month.',
    'fixed', 25, 1, null,
    now() - interval '10 days', now() + interval '15 days', 'active'
  ),
  (
    (select id from shops where name = 'Escape The Room Beirut'),
    'Buy 1 Get 1 Free — Weekday Sessions',
    'Book a room Monday–Thursday and bring a second group for free.',
    'Weekday sessions only, subject to availability. Advance booking required.',
    'bogo', 0, 1, 100,
    now() - interval '4 days', now() + interval '25 days', 'active'
  ),
  (
    (select id from shops where name = 'Internazionale'),
    '10% Off Bar Tab',
    'Early planning draft — not yet visible to users.',
    null,
    'percentage', 10, 1, null,
    now(), now() + interval '30 days', 'draft'
  );
