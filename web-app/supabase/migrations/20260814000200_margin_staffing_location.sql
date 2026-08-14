-- Redefine deal dimensions: engagement_type becomes staffing|recruiting (what
-- the client engaged Academy for), and a new worker_location column carries
-- domestic|international (drives the W-2 employment burden).

alter table margin_deals drop constraint if exists margin_deals_engagement_type_check;

update margin_deals set engagement_type = case engagement_type
  when 'contractor' then 'staffing'
  when 'employee' then 'recruiting'
  else engagement_type
end;

alter table margin_deals
  add constraint margin_deals_engagement_type_check
  check (engagement_type in ('staffing', 'recruiting'));

alter table margin_deals alter column engagement_type set default 'staffing';

alter table margin_deals
  add column if not exists worker_location text not null default 'domestic'
  check (worker_location in ('domestic', 'international'));
