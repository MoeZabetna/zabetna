-- Demo shops for testing the admin panel and User App end-to-end, per
-- Mo's request: real Beirut businesses, not placeholder "Shop 1 / Shop 2"
-- rows, researched via web search (see conversation for sources — mainly
-- Tripadvisor, Timeout Beirut, and each business's own site/Facebook page).
--
-- Coordinates are neighborhood-level approximations, not verified exact
-- addresses — no geocoding API was used (no Google Maps key configured;
-- see docs/blueprint.html §07). Correct the exact pin per shop with the
-- admin panel's map picker (apps/admin/components/MapPicker.tsx) before
-- these are shown to real users; that's what the picker is for.
insert into shops (name, category_id, description, address, lat, lng, status) values
  ('Em Sherif',
    (select id from categories where name = 'Restaurants'),
    'Upscale Lebanese fine dining, one of Beirut''s best-known restaurants.',
    'Ashrafieh, Beirut', 33.8886, 35.5192, 'active'),
  ('Tawlet',
    (select id from categories where name = 'Restaurants'),
    'Communal Lebanese kitchen with a rotating menu cooked by a different regional chef daily.',
    'Mar Mikhael, Beirut', 33.8973, 35.5155, 'active'),
  ('Liza Beirut',
    (select id from categories where name = 'Restaurants'),
    'Modern Lebanese cuisine in a restored 19th-century mansion.',
    'Ashrafieh, Beirut', 33.8896, 35.5187, 'active'),

  ('The Music Hall',
    (select id from categories where name = 'Club & Pubs'),
    'Beirut''s best-known live-music and cabaret venue.',
    'Clemenceau, Beirut', 33.8929, 35.4884, 'active'),
  ('Internazionale',
    (select id from categories where name = 'Club & Pubs'),
    'Gemmayze bar and late-night spot.',
    'Gemmayze, Beirut', 33.8946, 35.5136, 'active'),
  ('Ferdinand',
    (select id from categories where name = 'Club & Pubs'),
    'Mar Mikhael neighborhood bar.',
    'Mar Mikhael, Beirut', 33.8968, 35.5150, 'active'),

  ('ABC Achrafieh',
    (select id from categories where name = 'Fashion'),
    'Beirut''s flagship shopping mall, anchor for dozens of fashion brands.',
    'Achrafieh, Beirut', 33.8869, 35.5175, 'active'),
  ('Beirut Souks',
    (select id from categories where name = 'Fashion'),
    'Open-air downtown shopping district.',
    'Downtown, Beirut', 33.8967, 35.5033, 'active'),

  ('Escape The Room Beirut',
    (select id from categories where name = 'Activities'),
    'Live escape-room games.',
    'Sin El Fil, Beirut', 33.8820, 35.5230, 'active'),
  ('PlayerOne Lebanon',
    (select id from categories where name = 'Activities'),
    'Gaming and entertainment center.',
    'Downtown, Beirut', 33.8965, 35.5040, 'active'),

  ('Rymco',
    (select id from categories where name = 'Cars'),
    'Multi-brand new-car dealership.',
    'Sin El Fil, Beirut', 33.8860, 35.5460, 'active'),
  ('NATCO (Toyota Lebanon)',
    (select id from categories where name = 'Cars'),
    'Official Toyota dealership.',
    'Sin El Fil, Beirut', 33.8815, 35.5425, 'active'),

  ('Pet Palace',
    (select id from categories where name = 'Pets'),
    'Pet supplies and grooming.',
    'Beirut', 33.8850, 35.5250, 'active'),
  ('Animalife Veterinary Hospital',
    (select id from categories where name = 'Pets'),
    'Veterinary clinic and hospital.',
    'Beirut', 33.8890, 35.5100, 'active'),
  ('Vet Point Lebanon',
    (select id from categories where name = 'Pets'),
    'Veterinary care and pet shop.',
    'Beirut', 33.8900, 35.5080, 'active'),

  ('The Smallville Hotel Gym',
    (select id from categories where name = 'Gym'),
    'Hotel gym open to members, Furn El Chebbak.',
    'Furn El Chebbak, Beirut', 33.8697, 35.5211, 'active'),
  ('Fitness Zone',
    (select id from categories where name = 'Gym'),
    'Fitness club chain, Beirut branch.',
    'Beirut', 33.8880, 35.5100, 'active'),

  ('House of Excellence',
    (select id from categories where name = 'Electronic'),
    'High-end electronics retailer.',
    'Beirut', 33.8890, 35.5000, 'active'),
  ('Hamdan Electronics',
    (select id from categories where name = 'Electronic'),
    'Appliances and electronics retailer.',
    'Beirut', 33.8850, 35.5050, 'active');
