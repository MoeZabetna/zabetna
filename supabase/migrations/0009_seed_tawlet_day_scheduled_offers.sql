-- Replaces Tawlet's single "$10 Off Lunch" demo offer (seeded in
-- 0007_seed_demo_offers.sql) with the exact multi-offer, day-scheduled
-- example requested: one shop running three concurrent offers that only
-- differ by which days they're valid on, demonstrating the days_of_week
-- column added in 0008_offer_days_of_week_and_expiry_fix.sql.
delete from offers where shop_id = (select id from shops where name = 'Tawlet');

insert into offers (shop_id, title, description, terms, discount_type, discount_value, per_user_limit, total_limit, start_at, end_at, status, days_of_week) values
  (
    (select id from shops where name = 'Tawlet'),
    '50% Off Lunch — Weekdays',
    'Half off the communal lunch menu, Monday through Friday.',
    'Lunch service only. Dine-in only.',
    'percentage', 50, 1, null,
    now() - interval '1 day', now() + interval '45 days', 'active',
    array[1,2,3,4,5]::smallint[]
  ),
  (
    (select id from shops where name = 'Tawlet'),
    '20% Off Lunch — Weekends',
    '20% off the communal lunch menu on Saturday and Sunday.',
    'Lunch service only. Dine-in only.',
    'percentage', 20, 1, null,
    now() - interval '1 day', now() + interval '45 days', 'active',
    array[0,6]::smallint[]
  ),
  (
    (select id from shops where name = 'Tawlet'),
    'Buy 1 Get 1 Free — Brunch',
    'Order any brunch plate and get a second one free.',
    'Weekend brunch service only. Lower-priced plate is the free one.',
    'bogo', 0, 1, 150,
    now() - interval '1 day', now() + interval '45 days', 'active',
    array[0,6]::smallint[]
  );
