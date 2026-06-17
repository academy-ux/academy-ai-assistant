-- Optional email/domain allowlist for a shared report. When both are empty the
-- link is public (current behaviour). When either is set, a visitor must enter a
-- matching email before the report's data loads.
alter table shared_reports
  add column if not exists allowed_emails text[] not null default '{}',
  add column if not exists allowed_domains text[] not null default '{}';
