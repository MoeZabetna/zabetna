-- Seed the category set shown in the Figma Home Screen (get_design_context
-- on node 40:3000), now with an icon name from apps/admin/lib/icons.ts's
-- curated CATEGORY_ICONS list so the admin panel's picker and the seeded
-- data agree on names from day one.
insert into categories (name, icon, sort_order, is_active) values
  ('Restaurants', 'UtensilsCrossed', 0, true),
  ('Club & Pubs', 'Martini',         1, true),
  ('Fashion',     'Shirt',           2, true),
  ('Activities',  'Trophy',          3, true),
  ('Cars',        'Car',             4, true),
  ('Pets',        'PawPrint',        5, true),
  ('Gym',         'Dumbbell',        6, true),
  ('Electronic',  'Tv',              7, true);
