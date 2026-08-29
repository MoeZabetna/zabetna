-- Offers: day-of-week scheduling + a real expiry guarantee.
--
-- A shop can already run several offers at once (multiple rows per shop_id);
-- this adds a column so each one can say which days of the week it applies
-- on -- e.g. one shop can have "50% off lunch weekdays", "20% off lunch
-- weekends", and "BOGO brunch" as three separate offers.
--
-- days_of_week uses JS Date.getDay() convention (0=Sunday .. 6=Saturday) to
-- match the admin panel's existing date handling. Empty array = every day
-- (the common case), not "no days" -- this keeps all existing offer rows
-- valid with no backfill needed.
alter table offers
  add column days_of_week smallint[] not null default '{}';

alter table offers
  add constraint offers_days_of_week_valid
  check (days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]);

comment on column offers.days_of_week is
  'Days an offer is valid on, 0=Sunday..6=Saturday. Empty array = every day.';

-- Pre-existing correctness gap found while adding the above, unrelated to
-- day-of-week: offers_public_read only checked `status = 'active'`, not the
-- offer's start/end window. No cron or trigger flips status to 'expired'
-- when end_at passes, so an offer left at status='active' past its end
-- date was still being served (and redeemable) by end users. Tightening the
-- read policy to also require `now()` fall inside [start_at, end_at] closes
-- that gap at the data layer regardless of whether status bookkeeping is
-- ever kept current -- the safer place to enforce it than trusting status
-- alone.
drop policy offers_public_read on offers;
create policy offers_public_read on offers
  for select using (status = 'active' and now() between start_at and end_at);
